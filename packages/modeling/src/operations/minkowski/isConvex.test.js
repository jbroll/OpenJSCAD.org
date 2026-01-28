const test = require('ava')

const { geom3 } = require('../../geometries')
const { cuboid, sphere, cylinderElliptic } = require('../../primitives')
const { subtract } = require('../booleans')

const isConvex = require('./isConvex')

test('isConvex: throws for non-geom3 input', (t) => {
  t.throws(() => isConvex('invalid'), { message: /requires a geom3/ })
  t.throws(() => isConvex(null), { message: /requires a geom3/ })
})

test('isConvex: empty geometry is convex', (t) => {
  const empty = geom3.create()
  t.true(isConvex(empty))
})

test('isConvex: cuboid is convex', (t) => {
  const cube = cuboid({ size: [10, 10, 10] })
  t.true(isConvex(cube))
})

test('isConvex: sphere is convex', (t) => {
  const sph = sphere({ radius: 5, segments: 16 })
  t.true(isConvex(sph))
})

test('isConvex: cylinder is convex', (t) => {
  const cyl = cylinderElliptic({ height: 10, startRadius: [3, 3], endRadius: [3, 3], segments: 16 })
  t.true(isConvex(cyl))
})

test('isConvex: cube with hole is not convex', (t) => {
  const cube = cuboid({ size: [10, 10, 10] })
  const hole = cuboid({ size: [4, 4, 20] }) // Hole through the cube

  const withHole = subtract(cube, hole)
  t.false(isConvex(withHole))
})

test('isConvex: L-shaped solid is not convex', (t) => {
  const big = cuboid({ size: [10, 10, 10], center: [0, 0, 0] })
  const corner = cuboid({ size: [6, 6, 12], center: [3, 3, 0] })

  const lShape = subtract(big, corner)
  t.false(isConvex(lShape))
})
