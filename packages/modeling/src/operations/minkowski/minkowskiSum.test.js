const test = require('ava')

const { geom3 } = require('../../geometries')
const { cuboid, sphere } = require('../../primitives')
const { measureBoundingBox } = require('../../measurements')
const { subtract } = require('../booleans')

const minkowskiSum = require('./minkowskiSum')
const isConvex = require('./isConvex')

test('minkowskiSum: throws for non-geom3 inputs', (t) => {
  t.throws(() => minkowskiSum('invalid', cuboid()), { message: /requires geom3/ })
  t.throws(() => minkowskiSum(cuboid(), 'invalid'), { message: /requires geom3/ })
})

test('minkowskiSum: throws for less than two geometries', (t) => {
  t.throws(() => minkowskiSum(), { message: /requires at least two/ })
  t.throws(() => minkowskiSum(cuboid()), { message: /requires at least two/ })
})

test('minkowskiSum: throws for more than two geometries', (t) => {
  t.throws(() => minkowskiSum(cuboid(), cuboid(), cuboid()), { message: /exactly two/ })
})

test('minkowskiSum: cube + cube produces correct bounds', (t) => {
  // Cube1: size 10 (±5 from origin)
  // Cube2: size 4 (±2 from origin)
  // Minkowski sum should be size 14 (±7 from origin)
  const cube1 = cuboid({ size: [10, 10, 10] })
  const cube2 = cuboid({ size: [4, 4, 4] })

  const result = minkowskiSum(cube1, cube2)

  t.true(geom3.isA(result))

  const bounds = measureBoundingBox(result)
  // Allow small tolerance for floating point
  t.true(Math.abs(bounds[0][0] - (-7)) < 0.001)
  t.true(Math.abs(bounds[0][1] - (-7)) < 0.001)
  t.true(Math.abs(bounds[0][2] - (-7)) < 0.001)
  t.true(Math.abs(bounds[1][0] - 7) < 0.001)
  t.true(Math.abs(bounds[1][1] - 7) < 0.001)
  t.true(Math.abs(bounds[1][2] - 7) < 0.001)
})

test('minkowskiSum: cube + sphere produces correct bounds', (t) => {
  // Cube: size 10 (±5 from origin)
  // Sphere: radius 2
  // Minkowski sum should be ±7 from origin
  const cube = cuboid({ size: [10, 10, 10] })
  const sph = sphere({ radius: 2, segments: 16 })

  const result = minkowskiSum(cube, sph)

  t.true(geom3.isA(result))

  const bounds = measureBoundingBox(result)
  // Allow small tolerance
  t.true(Math.abs(bounds[0][0] - (-7)) < 0.1)
  t.true(Math.abs(bounds[1][0] - 7) < 0.1)
})

test('minkowskiSum: sphere + sphere produces correct bounds', (t) => {
  // Sphere1: radius 3
  // Sphere2: radius 2
  // Minkowski sum should be a sphere-like shape with radius ~5
  const sph1 = sphere({ radius: 3, segments: 16 })
  const sph2 = sphere({ radius: 2, segments: 16 })

  const result = minkowskiSum(sph1, sph2)

  t.true(geom3.isA(result))

  const bounds = measureBoundingBox(result)
  // Should be approximately ±5
  t.true(Math.abs(bounds[0][0] - (-5)) < 0.2)
  t.true(Math.abs(bounds[1][0] - 5) < 0.2)
})

test('minkowskiSum: empty geometry returns empty', (t) => {
  const empty = geom3.create()
  const cube = cuboid({ size: [10, 10, 10] })

  const result = minkowskiSum(empty, cube)

  t.true(geom3.isA(result))
  t.is(geom3.toPolygons(result).length, 0)
})

test('minkowskiSum: result is convex', (t) => {
  const cube = cuboid({ size: [10, 10, 10] })
  const sph = sphere({ radius: 2, segments: 12 })

  const result = minkowskiSum(cube, sph)

  t.true(isConvex(result))
})

// Non-convex tests

test('minkowskiSum: non-convex + convex produces valid geometry', (t) => {
  // Create L-shaped non-convex geometry
  const big = cuboid({ size: [10, 10, 10] })
  const corner = cuboid({ size: [6, 6, 12], center: [3, 3, 0] })
  const lShape = subtract(big, corner)

  t.false(isConvex(lShape))

  const sph = sphere({ radius: 1, segments: 8 })

  const result = minkowskiSum(lShape, sph)

  t.true(geom3.isA(result))
  t.true(geom3.toPolygons(result).length > 0)
})

test('minkowskiSum: non-convex + convex produces correct bounds', (t) => {
  // Cube with hole through it
  const cube = cuboid({ size: [10, 10, 10] })
  const hole = cuboid({ size: [4, 4, 20] })
  const cubeWithHole = subtract(cube, hole)

  t.false(isConvex(cubeWithHole))

  // Offset by sphere of radius 1
  const sph = sphere({ radius: 1, segments: 8 })
  const result = minkowskiSum(cubeWithHole, sph)

  const bounds = measureBoundingBox(result)

  // Original cube is ±5, plus sphere radius 1 = ±6
  t.true(Math.abs(bounds[0][0] - (-6)) < 0.2)
  t.true(Math.abs(bounds[1][0] - 6) < 0.2)
})

test('minkowskiSum: convex + non-convex swaps operands', (t) => {
  // Minkowski sum is commutative, so A⊕B = B⊕A
  const cube = cuboid({ size: [10, 10, 10] })
  const hole = cuboid({ size: [4, 4, 20] })
  const cubeWithHole = subtract(cube, hole)

  const sph = sphere({ radius: 1, segments: 8 })

  // convex + non-convex should work (swaps internally)
  const result = minkowskiSum(sph, cubeWithHole)

  t.true(geom3.isA(result))
  t.true(geom3.toPolygons(result).length > 0)
})

test('minkowskiSum: throws for two non-convex geometries', (t) => {
  const cube1 = cuboid({ size: [10, 10, 10] })
  const hole1 = cuboid({ size: [4, 4, 20] })
  const nonConvex1 = subtract(cube1, hole1)

  const cube2 = cuboid({ size: [8, 8, 8] })
  const hole2 = cuboid({ size: [3, 3, 16] })
  const nonConvex2 = subtract(cube2, hole2)

  t.throws(() => minkowskiSum(nonConvex1, nonConvex2), { message: /two non-convex/ })
})
