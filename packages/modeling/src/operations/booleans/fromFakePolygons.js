const vec2 = require('../../maths/vec2')

const geom2 = require('../../geometries/geom2')

const fromFakePolygon = (epsilon, polygon) => {
  // this can happen based on union, seems to be residuals -
  // return null and handle in caller
  if (polygon.vertices.length < 4) {
    return null
  }
  const vert1Indices = []
  const points3D = polygon.vertices.filter((vertex, i) => {
    if (vertex[2] > 0) {
      vert1Indices.push(i)
      return true
    }
    return false
  })

  if (points3D.length !== 2) {
    throw new Error('Assertion failed: fromFakePolygon: not enough points found') // TBD remove later
  }

  const points2D = points3D.map((v3) => {
    const x = Math.round(v3[0] / epsilon) * epsilon + 0 // no more -0
    const y = Math.round(v3[1] / epsilon) * epsilon + 0 // no more -0
    return vec2.fromValues(x, y)
  })

  if (vec2.equals(points2D[0], points2D[1])) return null

  const d = vert1Indices[1] - vert1Indices[0]
  if (d === 1 || d === 3) {
    if (d === 1) {
      points2D.reverse()
    }
  } else {
    throw new Error('Assertion failed: fromFakePolygon: unknown index ordering')
  }
  return points2D
}

/*
 * Close outlines that grid rounding left open.
 *
 * A 3D boolean hands back each shared corner once per wall that meets there,
 * and the copies differ by float noise, so a pair straddling a cell boundary
 * rounds into two cells and the outline never closes. Both copies are left
 * with one side attached instead of two, which is the only trace the split
 * leaves: every vertex of a closed outline has as many sides arriving as
 * leaving.
 *
 * So repair only those. Vertices that already balance keep the exact
 * coordinates rounding gave them — moving them perturbs the operand of the
 * next boolean, and a BSP fed slightly different input can return geometry
 * that is broken in its own right.
 */
const closeOpenVertices = (epsilon, sides) => {
  const balance = new Map()
  const bump = (point, n) => {
    const k = `${point[0]},${point[1]}`
    const entry = balance.get(k)
    if (entry) entry.n += n
    else balance.set(k, { point, n })
  }
  for (const [from, to] of sides) {
    bump(from, 1)
    bump(to, -1)
  }

  const open = [...balance.values()].filter((entry) => entry.n !== 0)
  if (open.length === 0) return sides

  // Compare cells rather than distance: the points sit on grid nodes, so two
  // adjacent ones are epsilon apart give or take float error, and a distance
  // test against epsilon rejects exactly the pair this is here to join.
  const cell = (point) => [Math.round(point[0] / epsilon), Math.round(point[1] / epsilon)]
  const merged = new Map()
  const kept = []
  for (const entry of open) {
    const [cx, cy] = cell(entry.point)
    const onto = kept.find((k) => Math.abs(k.cx - cx) <= 1 && Math.abs(k.cy - cy) <= 1)
    if (onto) merged.set(`${entry.point[0]},${entry.point[1]}`, onto.point)
    else kept.push({ point: entry.point, cx, cy })
  }
  if (merged.size === 0) return sides

  const remap = (point) => merged.get(`${point[0]},${point[1]}`) ?? point
  return sides
    .map((side) => [remap(side[0]), remap(side[1])])
    .filter((side) => !vec2.equals(side[0], side[1]))
}

/*
 * Convert the given polygons to a list of sides.
 * The polygons must have only z coordinates +1 and -1, as constructed by to3DWalls().
 */
const fromFakePolygons = (epsilon, polygons) => {
  const sides = polygons.map((polygon) => fromFakePolygon(epsilon, polygon)).filter((polygon) => (polygon !== null))
  return geom2.create(closeOpenVertices(epsilon, sides))
}

module.exports = fromFakePolygons
