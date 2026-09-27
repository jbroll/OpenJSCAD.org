const test = require('ava')

const { geom2 } = require('../../geometries')

const { rectangle } = require('../../primitives')

const { translate } = require('../transforms/translate')

const { fromMultiPolygon, toMultiPolygon } = require('./geom2Clipping')

test('toMultiPolygon: an empty geom2 has no polygons', (t) => {
  t.deepEqual(toMultiPolygon(geom2.create()), [])
})

test('toMultiPolygon: applies the geom2 transforms', (t) => {
  const multiPolygon = toMultiPolygon(translate([10, 0], rectangle({ size: [2, 2] })))
  t.is(multiPolygon.length, 1)
  const xs = multiPolygon[0][0].map((point) => point[0])
  t.is(Math.min(...xs), 9)
  t.is(Math.max(...xs), 11)
})

test('toMultiPolygon: nested outlines resolve even-odd into outer and hole', (t) => {
  // both outlines CCW, so only even-odd nesting makes the inner one a hole
  const outer = [[0, 0], [4, 0], [4, 4], [0, 4]]
  const inner = [[1, 1], [3, 1], [3, 3], [1, 3]]
  const toSides = (points) => points.map((point, i) => [point, points[(i + 1) % points.length]])
  const multiPolygon = toMultiPolygon(geom2.create([...toSides(outer), ...toSides(inner)]))
  t.is(multiPolygon.length, 1)
  t.is(multiPolygon[0].length, 2)
})

test('toMultiPolygon: an open outline is still read as a region', (t) => {
  const sides = [[[0, 0], [4, 0]], [[4, 0], [4, 4]], [[4, 4], [0, 4]]]
  const multiPolygon = toMultiPolygon(geom2.create(sides))
  t.is(multiPolygon.length, 1)
})

test('fromMultiPolygon: builds closed sides from closed rings', (t) => {
  const result = fromMultiPolygon([[[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]])
  t.notThrows(() => geom2.validate(result))
  t.is(geom2.toSides(result).length, 4)
  t.deepEqual(fromMultiPolygon([]).sides, [])
})
