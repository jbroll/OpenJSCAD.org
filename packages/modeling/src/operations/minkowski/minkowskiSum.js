const flatten = require('../../utils/flatten')

const geom3 = require('../../geometries/geom3')
const poly3 = require('../../geometries/poly3')

const hullPoints3 = require('../hulls/hullPoints3')
const union = require('../booleans/union')

const isConvex = require('./isConvex')

/**
 * Compute the Minkowski sum of two 3D geometries.
 *
 * The Minkowski sum A ⊕ B is the set of all points a + b where a ∈ A and b ∈ B.
 * Geometrically, this "inflates" geometry A by the shape of geometry B.
 *
 * Common use cases:
 * - Offset a solid by a sphere to round all edges and corners
 * - Offset a solid by a cube to create chamfered edges
 * - Collision detection (if Minkowski sum contains origin, shapes overlap)
 *
 * For best performance, use convex geometries. Non-convex geometries are supported
 * when the second operand is convex, but require decomposition and are slower.
 *
 * @param {...Object} geometries - two geom3 geometries (second should be convex for non-convex first)
 * @returns {geom3} new 3D geometry representing the Minkowski sum
 * @alias module:modeling/operations/minkowski.minkowskiSum
 *
 * @example
 * const { primitives, minkowski } = require('@jscad/modeling')
 * const cube = primitives.cuboid({ size: [10, 10, 10] })
 * const sphere = primitives.sphere({ radius: 2, segments: 16 })
 * const rounded = minkowski.minkowskiSum(cube, sphere)
 */
const minkowskiSum = (...geometries) => {
  geometries = flatten(geometries)

  if (geometries.length < 2) {
    throw new Error('minkowskiSum requires at least two geometries')
  }

  if (geometries.length > 2) {
    throw new Error('minkowskiSum currently supports exactly two geometries')
  }

  const [geomA, geomB] = geometries

  if (!geom3.isA(geomA) || !geom3.isA(geomB)) {
    throw new Error('minkowskiSum requires geom3 geometries')
  }

  const aConvex = isConvex(geomA)
  const bConvex = isConvex(geomB)

  // Fast path: both convex
  if (aConvex && bConvex) {
    return minkowskiSumConvex(geomA, geomB)
  }

  // Non-convex A + convex B: decompose A into tetrahedra
  if (!aConvex && bConvex) {
    return minkowskiSumNonConvexConvex(geomA, geomB)
  }

  // Convex A + non-convex B: swap operands (Minkowski sum is commutative)
  if (aConvex && !bConvex) {
    return minkowskiSumNonConvexConvex(geomB, geomA)
  }

  // Both non-convex: not yet supported
  throw new Error('minkowskiSum of two non-convex geometries is not yet supported')
}

/**
 * Compute Minkowski sum of non-convex A with convex B.
 *
 * Decomposes A into tetrahedra, computes Minkowski sum of each with B,
 * then unions all results.
 */
const minkowskiSumNonConvexConvex = (geomA, geomB) => {
  const tetrahedra = decomposeIntoTetrahedra(geomA)

  if (tetrahedra.length === 0) {
    return geom3.create()
  }

  // Compute Minkowski sum for each tetrahedron
  const parts = tetrahedra.map((tet) => minkowskiSumConvex(tet, geomB))

  // Union all parts
  if (parts.length === 1) {
    return parts[0]
  }

  return union(parts)
}

/**
 * Decompose a geom3 into tetrahedra using fan triangulation from centroid.
 * Each resulting tetrahedron is guaranteed to be convex.
 */
const decomposeIntoTetrahedra = (geometry) => {
  const polygons = geom3.toPolygons(geometry)

  if (polygons.length === 0) {
    return []
  }

  // Compute centroid of the geometry
  const centroid = computeCentroid(geometry)

  const tetrahedra = []

  // For each polygon, create tetrahedra from centroid to each triangle
  for (let i = 0; i < polygons.length; i++) {
    const vertices = polygons[i].vertices

    // Fan triangulate the polygon and create tetrahedra
    for (let j = 1; j < vertices.length - 1; j++) {
      const v0 = vertices[0]
      const v1 = vertices[j]
      const v2 = vertices[j + 1]

      // Create tetrahedron from centroid and triangle
      const tetPolygons = createTetrahedronPolygons(centroid, v0, v1, v2)
      tetrahedra.push(geom3.create(tetPolygons))
    }
  }

  return tetrahedra
}

/**
 * Create the 4 triangular faces of a tetrahedron.
 */
const createTetrahedronPolygons = (p0, p1, p2, p3) => {
  // Tetrahedron has 4 faces, each a triangle
  // We need to ensure consistent winding (outward-facing normals)
  return [
    poly3.create([p0, p2, p1]), // base seen from p3
    poly3.create([p0, p1, p3]), // face opposite p2
    poly3.create([p1, p2, p3]), // face opposite p0
    poly3.create([p2, p0, p3])  // face opposite p1
  ]
}

/**
 * Compute the centroid of a geom3.
 */
const computeCentroid = (geometry) => {
  const vertices = extractUniqueVertices(geometry)

  if (vertices.length === 0) {
    return [0, 0, 0]
  }

  let x = 0, y = 0, z = 0
  for (let i = 0; i < vertices.length; i++) {
    x += vertices[i][0]
    y += vertices[i][1]
    z += vertices[i][2]
  }

  const n = vertices.length
  return [x / n, y / n, z / n]
}

/**
 * Compute Minkowski sum of two convex polyhedra.
 *
 * For convex polyhedra, the Minkowski sum equals the convex hull of
 * all pairwise vertex sums. This is O(n*m) for n and m vertices,
 * plus the cost of the convex hull algorithm.
 */
const minkowskiSumConvex = (geomA, geomB) => {
  const pointsA = extractUniqueVertices(geomA)
  const pointsB = extractUniqueVertices(geomB)

  if (pointsA.length === 0 || pointsB.length === 0) {
    return geom3.create()
  }

  // Compute all pairwise sums
  const summedPoints = []
  for (let i = 0; i < pointsA.length; i++) {
    const a = pointsA[i]
    for (let j = 0; j < pointsB.length; j++) {
      const b = pointsB[j]
      summedPoints.push([a[0] + b[0], a[1] + b[1], a[2] + b[2]])
    }
  }

  // Compute convex hull of the summed points
  const hullPolygons = hullPoints3(summedPoints)

  return geom3.create(hullPolygons)
}

/**
 * Extract unique vertices from a geom3.
 * Uses a Set with string keys for deduplication.
 */
const extractUniqueVertices = (geometry) => {
  const found = new Set()
  const unique = []

  const polygons = geom3.toPolygons(geometry)
  for (let i = 0; i < polygons.length; i++) {
    const vertices = polygons[i].vertices
    for (let j = 0; j < vertices.length; j++) {
      const v = vertices[j]
      const key = `${v[0]},${v[1]},${v[2]}`
      if (!found.has(key)) {
        found.add(key)
        unique.push(v)
      }
    }
  }

  return unique
}

module.exports = minkowskiSum
