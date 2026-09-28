const test = require('ava')

const { geom2 } = require('../../geometries')

const { measureArea, measureBoundingBox } = require('../../measurements')

const { rectangle } = require('../../primitives')

const { translate } = require('../transforms/translate')

const clipGeom2 = require('./geom2Clipping')

const toSides = (points) => points.map((point, i) => [point, points[(i + 1) % points.length]])

test('clipGeom2: empty operands give an empty geom2', (t) => {
  t.deepEqual(clipGeom2('union', [geom2.create()]).sides, [])
  t.deepEqual(clipGeom2('union', []).sides, [])
})

test('clipGeom2: applies the geom2 transforms', (t) => {
  const result = clipGeom2('union', [translate([10, 0], rectangle({ size: [2, 2] }))])
  t.deepEqual(measureBoundingBox(result), [[9, -1, 0], [11, 1, 0]])
})

test('clipGeom2: nested outlines resolve even-odd into outer and hole', (t) => {
  // both outlines CCW, so only even-odd nesting makes the inner one a hole
  const outer = [[0, 0], [4, 0], [4, 4], [0, 4]]
  const inner = [[1, 1], [3, 1], [3, 3], [1, 3]]
  const result = clipGeom2('union', [geom2.create([...toSides(outer), ...toSides(inner)])])
  t.is(geom2.toOutlines(result).length, 2)
  t.is(measureArea(result), 12)
})

test('clipGeom2: an open outline is closed from its last point to its first', (t) => {
  const sides = [[[0, 0], [4, 0]], [[4, 0], [4, 4]], [[4, 4], [0, 4]]]
  const result = clipGeom2('union', [geom2.create(sides)])
  t.notThrows(() => geom2.validate(result))
  t.is(measureArea(result), 16)
})

test('clipGeom2: coordinates beyond the default scale range keep their region', (t) => {
  const far = translate([1e7, 1e7], rectangle({ size: [2e6, 2e6] }))
  const result = clipGeom2('union', [far])
  t.true(Math.abs(measureArea(result) - 4e12) / 4e12 < 1e-9)
})
