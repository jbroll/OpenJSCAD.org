const test = require('ava')

const { geom2, geom3 } = require('../../geometries')

const to3DWalls = require('./to3DWalls')
const fromFakePolygons = require('./fromFakePolygons')

// A 3D boolean returns each shared corner once per wall that meets there, and
// the two copies differ by float noise. Snapping each copy independently onto
// an epsilon grid puts a pair that straddles a cell boundary into different
// cells, which leaves the outline open.
test('fromFakePolygons closes an outline whose shared corner straddles an epsilon cell', (t) => {
  const epsilon = 0.1
  // 1.04999 and 1.05001 are one grid step apart under Math.round(x / 0.1).
  const sides = [
    [[0, 0], [2, 0]],
    [[2, 0], [1.04999, 1]],
    [[1.05001, 1], [0, 0]]
  ]
  const walls = to3DWalls({ z0: -1, z1: 1 }, geom2.create(sides))

  const result = fromFakePolygons(epsilon, geom3.toPolygons(walls))

  t.is(geom2.toSides(result).length, 3)
  t.notThrows(() => geom2.toOutlines(result))
})

// The repair is the operand of the next boolean, and a BSP fed slightly
// different input can return geometry that is broken in its own right.
test('fromFakePolygons leaves a closed outline exactly where rounding put it', (t) => {
  const epsilon = 0.1
  // Consecutive corners 0.06 apart: within epsilon of each other, but every
  // one of them already balances, so none of them may move.
  const sides = [
    [[0, 0], [1, 0]],
    [[1, 0], [1.06, 0.5]],
    [[1.06, 0.5], [1.12, 1]],
    [[1.12, 1], [0, 0]]
  ]
  const walls = to3DWalls({ z0: -1, z1: 1 }, geom2.create(sides))

  const result = fromFakePolygons(epsilon, geom3.toPolygons(walls))

  t.is(geom2.toOutlines(result).length, 1)
  t.deepEqual(
    geom2.toSides(result).map((side) => side.map((p) => [...p])).sort(),
    [
      [[0, 0], [1, 0]],
      [[1, 0], [1.1, 0.5]],
      [[1.1, 0.5], [1.1, 1]],
      [[1.1, 1], [0, 0]]
    ].sort()
  )
})

test('fromFakePolygons keeps corners further apart than epsilon distinct', (t) => {
  const epsilon = 0.1
  const sides = [
    [[0, 0], [2, 0]],
    [[2, 0], [1, 1]],
    [[1, 1], [0, 0]],
    [[0, 3], [2, 3]],
    [[2, 3], [1, 4]],
    [[1, 4], [0, 3]]
  ]
  const walls = to3DWalls({ z0: -1, z1: 1 }, geom2.create(sides))

  const result = fromFakePolygons(epsilon, geom3.toPolygons(walls))

  t.is(geom2.toOutlines(result).length, 2)
})
