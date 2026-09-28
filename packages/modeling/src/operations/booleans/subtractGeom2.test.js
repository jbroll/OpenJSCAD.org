const test = require('ava')

const { comparePointSets } = require('../../../test/helpers')

const { geom2 } = require('../../geometries')

const { circle, rectangle } = require('../../primitives')

const { subtract } = require('./index')

const { center } = require('../transforms/center')

test('subtract: subtract of one or more geom2 objects produces expected geometry', (t) => {
  const geometry1 = circle({ radius: 2, segments: 8 })
  const circlePoints = geom2.toPoints(geometry1)

  // subtract of one object
  const result1 = subtract(geometry1)
  let obs = geom2.toPoints(result1)
  t.notThrows(() => geom2.validate(result1))
  t.is(obs.length, 8)
  t.true(comparePointSets(obs, circlePoints))

  // subtract of two non-overlapping objects
  const geometry2 = center({ relativeTo: [10, 10, 0] }, rectangle({ size: [4, 4] }))

  const result2 = subtract(geometry1, geometry2)
  obs = geom2.toPoints(result2)
  t.notThrows(() => geom2.validate(result2))
  t.is(obs.length, 8)
  t.true(comparePointSets(obs, circlePoints))

  // subtract of two partially overlapping objects
  const geometry3 = rectangle({ size: [18, 18] })

  const result3 = subtract(geometry2, geometry3)
  obs = geom2.toPoints(result3)
  const exp = [
    [12, 12], [9, 9], [8, 9], [8, 12], [9, 8], [12, 8]
  ]
  t.notThrows(() => geom2.validate(result3))
  t.is(obs.length, 6)
  t.true(comparePointSets(obs, exp))

  // subtract of two completely overlapping objects
  const result4 = subtract(geometry1, geometry3)
  obs = geom2.toPoints(result4)
  t.notThrows(() => geom2.validate(result4))
  t.is(obs.length, 0)
  t.deepEqual(obs, [])
})

test('subtract: removing an inner geom2 leaves a CW hole inside a CCW outline', (t) => {
  const { measureArea } = require('../../measurements')
  const result = subtract(rectangle({ size: [6, 6] }), rectangle({ size: [2, 2] }))
  t.notThrows(() => geom2.validate(result))
  const outlines = geom2.toOutlines(result)
  t.is(outlines.length, 2)
  const signedArea = (points) => points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]
    return sum + (p[0] * q[1] - q[0] * p[1]) / 2
  }, 0)
  const areas = outlines.map(signedArea).sort((a, b) => a - b)
  t.deepEqual(areas, [-4, 36])
  t.is(measureArea(result), 32)
})

test('subtract: multiple geom2 are all removed from the first', (t) => {
  const { translate } = require('../transforms/translate')
  const result = subtract(
    rectangle({ size: [10, 2] }),
    translate([-3, 0], rectangle({ size: [2, 4] })),
    translate([3, 0], rectangle({ size: [2, 4] }))
  )
  t.notThrows(() => geom2.validate(result))
  t.is(geom2.toOutlines(result).length, 3)
})

// polyclip-ts 0.16.8 threw "Unable to complete output ring" on these (NopSCADlib pin_headers.scad)
test('subtract of a pin header housing from pin_headers.scad', (t) => {
  const { measureArea } = require('../../measurements')
  const operands = require('../../../test/fixtures/pinHeadersSubtractOperands.json').map((sides) => geom2.create(sides))
  const result = subtract(operands)
  t.notThrows(() => geom2.validate(result))
  t.is(geom2.toOutlines(result).length, 4)
  t.true(Math.abs(measureArea(result) - 27.12) < 1e-6)
})
