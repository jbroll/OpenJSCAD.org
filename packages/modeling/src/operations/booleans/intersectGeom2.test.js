const test = require('ava')

const { comparePointSets } = require('../../../test/helpers')

const { geom2 } = require('../../geometries')

const { measureArea } = require('../../measurements')

const { circle, rectangle } = require('../../primitives')

const { intersect } = require('./index')

const { center } = require('../transforms/center')

test('intersect: intersect of one or more geom2 objects produces expected geometry', (t) => {
  const geometry1 = circle({ radius: 2, segments: 8 })
  const circlePoints = geom2.toPoints(geometry1)

  // intersect of one object
  const result1 = intersect(geometry1)
  let obs = geom2.toPoints(result1)
  t.notThrows(() => geom2.validate(result1))
  t.is(obs.length, 8)
  t.true(comparePointSets(obs, circlePoints))

  // intersect of two non-overlapping objects
  const geometry2 = center({ relativeTo: [10, 10, 0] }, rectangle({ size: [4, 4] }))

  const result2 = intersect(geometry1, geometry2)
  obs = geom2.toPoints(result2)
  t.notThrows(() => geom2.validate(result2))
  t.is(obs.length, 0)

  // intersect of two partially overlapping objects
  const geometry3 = rectangle({ size: [18, 18] })

  const result3 = intersect(geometry2, geometry3)
  obs = geom2.toPoints(result3)
  const exp = [
    [9, 9], [8, 9], [8, 8], [9, 8]
  ]
  t.notThrows(() => geom2.validate(result3))
  t.is(obs.length, 4)
  t.true(comparePointSets(obs, exp))

  // intersect of two completely overlapping objects
  const result4 = intersect(geometry1, geometry3)
  obs = geom2.toPoints(result4)
  t.notThrows(() => geom2.validate(result4))
  t.is(obs.length, 8)
  t.true(comparePointSets(obs, circlePoints))
})

test('intersect: an empty geom2 operand gives an empty result', (t) => {
  const result = intersect(rectangle({ size: [2, 2] }), geom2.create())
  t.notThrows(() => geom2.validate(result))
  t.is(geom2.toSides(result).length, 0)
})

// polygon-clipping 0.15.7 threw "Unable to complete output ring" on these (dotSCAD fidget_boo.scad)
test('intersect of spiral arms from fidget_boo.scad', (t) => {
  const operands = require('../../../test/fixtures/fidgetBooIntersectOperands.json').map((sides) => geom2.create(sides))
  const result = intersect(operands)
  t.notThrows(() => geom2.validate(result))
  t.is(geom2.toOutlines(result).length, 1)
  t.true(Math.abs(measureArea(result) - 0.063740922) < 1e-8)
})

// polyclip-ts 0.16.8 threw "Unable to complete output ring" on these (dotSCAD voronoi_penholder.scad)
test('intersect of voronoi cell bounds from voronoi_penholder.scad', (t) => {
  const operands = require('../../../test/fixtures/voronoiPenholderIntersectOperands.json').map((sides) => geom2.create(sides))
  const result = intersect(operands)
  t.notThrows(() => geom2.validate(result))
  t.is(geom2.toOutlines(result).length, 1)
  t.true(Math.abs(measureArea(result) - 733.447303021) < 1e-6)
})
