const test = require('ava')

const { comparePointSets } = require('../../../test/helpers')

const { geom2 } = require('../../geometries')

const { measureArea } = require('../../measurements')

const { circle, rectangle } = require('../../primitives')

const { union } = require('./index')

const { center } = require('../transforms/center')
const { translate } = require('../transforms/translate')

// every vertex of a closed outline has as many sides arriving as leaving
const isClosed = (geometry) => {
  const balance = new Map()
  const bump = (point, n) => {
    const key = `${point[0]},${point[1]}`
    balance.set(key, (balance.get(key) || 0) + n)
  }
  geom2.toSides(geometry).forEach(([from, to]) => {
    bump(from, 1)
    bump(to, -1)
  })
  return [...balance.values()].every((n) => n === 0)
}

test('union of one or more geom2 objects produces expected geometry', (t) => {
  const geometry1 = circle({ radius: 2, segments: 8 })
  const circlePoints = geom2.toPoints(geometry1)

  // union of one object
  const result1 = union(geometry1)
  let obs = geom2.toPoints(result1)
  t.notThrows(() => geom2.validate(result1))
  t.true(comparePointSets(obs, circlePoints))

  // union of two non-overlapping objects
  const geometry2 = center({ relativeTo: [10, 10, 0] }, rectangle({ size: [4, 4] }))

  const result2 = union(geometry1, geometry2)
  obs = geom2.toPoints(result2)
  let exp = [...circlePoints, [8, 12], [8, 8], [12, 8], [12, 12]]
  t.notThrows(() => geom2.validate(result2))
  t.true(comparePointSets(obs, exp))

  // union of two partially overlapping objects
  const geometry3 = rectangle({ size: [18, 18] })

  const result3 = union(geometry2, geometry3)
  obs = geom2.toPoints(result3)
  exp = [
    [12, 12], [8, 12], [8, 9], [-9, 9], [-9, -9], [9, -9], [9, 8], [12, 8]
  ]
  t.notThrows(() => geom2.validate(result3))
  t.true(comparePointSets(obs, exp))

  // union of two completely overlapping objects
  const result4 = union(geometry1, geometry3)
  obs = geom2.toPoints(result4)
  exp = [[-9, -9], [9, -9], [9, 9], [-9, 9]]
  t.notThrows(() => geom2.validate(result4))
  t.true(comparePointSets(obs, exp))

  // union of unions of non-overlapping objects (BSP gap from #907)
  const circ = circle({ radius: 1, segments: 32 })
  const result5 = union(
    union(
      translate([17, 21], circ),
      translate([7, 0], circ)
    ),
    union(
      translate([3, 21], circ),
      translate([17, 21], circ)
    )
  )
  obs = geom2.toPoints(result5)
  t.notThrows(() => geom2.validate(result5))
  t.is(obs.length, 96)
  t.is(geom2.toOutlines(result5).length, 3)
})

test('union of geom2 with closing issues #15', (t) => {
  const c = geom2.create([
    [[-45.82118740347841168159, -16.85726810555620147625], [-49.30331715865012398581, -14.68093629710870118288]],
    [[-49.10586702080816223770, -15.27604177352110781385], [-48.16645938811709015681, -15.86317173589183227023]],
    [[-49.60419521731581937729, -14.89550781504266296906], [-49.42407001323204696064, -15.67605088949303393520]],
    [[-49.05727291218684626983, -15.48661638542171203881], [-49.10586702080816223770, -15.27604177352110781385]],
    [[-49.30706235399220815907, -15.81529674600091794900], [-46.00505780290426827150, -17.21108547999804727624]],
    [[-46.00505780290426827150, -17.21108547999804727624], [-45.85939703723252591772, -17.21502856394236857795]],
    [[-45.85939703723252591772, -17.21502856394236857795], [-45.74972032664388166268, -17.11909303495791334626]],
    [[-45.74972032664388166268, -17.11909303495791334626], [-45.73424573227583067592, -16.97420292661295349035]],
    [[-45.73424573227583067592, -16.97420292661295349035], [-45.82118740347841168159, -16.85726810555620147625]],
    [[-49.30331715865012398581, -14.68093629710870118288], [-49.45428884427643367871, -14.65565769658912387285]],
    [[-49.45428884427643367871, -14.65565769658912387285], [-49.57891661679624917269, -14.74453612941635327616]],
    [[-49.57891661679624917269, -14.74453612941635327616], [-49.60419521731581937729, -14.89550781504266296906]],
    [[-49.42407001323204696064, -15.67605088949303393520], [-49.30706235399220815907, -15.81529674600091794900]],
    [[-48.16645938811709015681, -15.86317173589183227023], [-49.05727291218684626983, -15.48661638542171203881]]
  ])
  const d = geom2.create([
    [[-49.03431352173912216585, -15.58610714407888764299], [-49.21443872582289458251, -14.80556406962851667686]],
    [[-68.31614651314507113966, -3.10790373951434872879], [-49.34036769611472550423, -15.79733157434056778357]],
    [[-49.58572929483430868913, -14.97552686612213790340], [-49.53755741140093959984, -15.18427183431472826669]],
    [[-49.53755741140093959984, -15.18427183431472826669], [-54.61235529924312714911, -11.79066769321313756791]],
    [[-49.30227466841120076424, -14.68159232649114187552], [-68.09792828135776687759, -2.77270756611528668145]],
    [[-49.21443872582289458251, -14.80556406962851667686], [-49.30227466841120076424, -14.68159232649114187552]],
    [[-49.34036769611472550423, -15.79733157434056778357], [-49.18823337756091262918, -15.82684012194931710837]],
    [[-49.18823337756091262918, -15.82684012194931710837], [-49.06069007212390431505, -15.73881563386780157998]],
    [[-49.06069007212390431505, -15.73881563386780157998], [-49.03431352173912216585, -15.58610714407888764299]],
    [[-68.09792828135776687759, -2.77270756611528668145], [-68.24753735887460948106, -2.74623350179570024920]],
    [[-68.24753735887460948106, -2.74623350179570024920], [-68.37258141465594007968, -2.83253376987636329432]],
    [[-68.37258141465594007968, -2.83253376987636329432], [-68.40089829889257089235, -2.98180502037078554167]],
    [[-68.40089829889257089235, -2.98180502037078554167], [-68.31614651314507113966, -3.10790373951434872879]],
    [[-54.61235529924312714911, -11.79066769321313756791], [-49.58572929483430868913, -14.97552686612213790340]]
  ])
  // geom2.toOutlines(c)
  // geom2.toOutlines(d)

  const obs = union(c, d)
  const pts = geom2.toPoints(obs)
  const exp = [
    [-68.31614651314507, -3.1079037395143487],
    [-49.340367696114726, -15.797331574340568],
    [-49.318612612739564, -15.801551272562577],
    [-49.30706235399221, -15.815296746000918],
    [-46.00505780290427, -17.211085479998047],
    [-45.859397037232526, -17.21502856394237],
    [-45.74972032664388, -17.119093034957913],
    [-45.73424573227583, -16.974202926612953],
    [-45.82118740347841, -16.8572681055562],
    [-49.30279490346146, -14.681262706708324],
    [-68.09792828135777, -2.7727075661152867],
    [-68.24753735887461, -2.7462335017957002],
    [-68.37258141465594, -2.8325337698763633],
    [-54.61235529924313, -11.790667693213138],
    [-49.58572929483431, -14.975526866122138],
    [-49.53755741140094, -15.184271834314728],
    [-49.10586702080816, -15.276041773521108],
    [-48.16645938811709, -15.863171735891832],
    [-49.057272912186846, -15.486616385421712],
    [-68.40089829889257, -2.9818050203707855]
  ]
  t.notThrows(() => geom2.validate(obs))
  t.is(pts.length, 20) // number of sides in union
  t.is(geom2.toOutlines(obs).length, 3)
  t.true(comparePointSets(pts, exp))
  t.true(Math.abs(measureArea(obs) - 17.5612067) < 1e-6)
})

test('union of near-coincident, slightly non-parallel operands forms closed outlines', (t) => {
  const left = geom2.fromPoints([[0, 0], [10, 0], [10, 10], [0, 10]])
  // right operand's left edge runs from x0 at y=0 to x1 at y=10, within 1e-5 of x=10
  const edges = [
    [10 - 1e-6, 10 - 5e-6],
    [10 - 1e-5, 10 - 2e-6],
    [10 - 3e-6, 10 + 3e-6],
    [10 + 1e-6, 10 + 7e-6]
  ]
  edges.forEach(([x0, x1]) => {
    const right = geom2.fromPoints([[x0, 0], [20, 0], [20, 10], [x1, 10]])
    const result = union(left, right)
    t.notThrows(() => geom2.validate(result))
    t.true(isClosed(result))
    const overlap = (10 - x0 + 10 - x1) / 2 * 10
    t.true(Math.abs(measureArea(result) - (100 + measureArea(right) - Math.max(overlap, 0))) < 1e-4)
  })
})

test('union of near-coincident rotated operands forms closed outlines', (t) => {
  const base = rectangle({ size: [4, 4] })
  for (let i = 1; i <= 50; i++) {
    const shift = 4 + i * 2e-7
    const tilted = geom2.fromPoints([[shift, 0], [8, 0], [8, 4], [shift + (i % 2 ? 1 : -1) * 3e-6, 4]])
    const result = union(translate([2, 2], base), tilted, translate([0, 4 - i * 1e-7], base))
    t.notThrows(() => geom2.validate(result))
    t.true(isClosed(result))
  }
})

test('union of disjoint geom2 keeps both outlines', (t) => {
  const a = rectangle({ size: [2, 2] })
  const b = translate([5, 0], rectangle({ size: [2, 2] }))
  const result = union(a, b)
  t.notThrows(() => geom2.validate(result))
  t.is(geom2.toOutlines(result).length, 2)
  t.is(measureArea(result), 8)
})

test('union with an empty geom2 returns the other operand', (t) => {
  const a = rectangle({ size: [2, 2] })
  const result = union(a, geom2.create())
  t.notThrows(() => geom2.validate(result))
  t.true(comparePointSets(geom2.toPoints(result), geom2.toPoints(a)))
  t.is(geom2.toPoints(union(geom2.create(), geom2.create())).length, 0)
})

// operands of the first open union in NopSCADlib tests/horiholes.scad under the 3D-BSP booleans
test('union of near-coincident slots from horiholes.scad forms closed outlines', (t) => {
  const operands = require('../../../test/fixtures/horiholesUnionOperands.json').map((sides) => geom2.create(sides))
  const result = union(operands)
  t.true(isClosed(result))
  t.notThrows(() => geom2.validate(result))
  t.is(geom2.toOutlines(result).length, 16)
})
