const vec4 = require('../../maths/vec4')

/**
 * Measure the bounding sphere of the given polygon.
 * @param {poly3} polygon - the polygon to measure
 * @returns {vec4} the computed bounding sphere; center point (3D) and radius
 * @alias module:modeling/geometries/poly3.measureBoundingSphere
 */
const measureBoundingSphere = (polygon) => {
  // Use direct property cache instead of WeakMap for faster lookup.
  // WeakMap.get() was consuming ~12% of boolean operation time due to
  // 15+ million lookups. Direct property access is ~2x faster.
  if (polygon.boundingSphere) return polygon.boundingSphere

  const vertices = polygon.vertices
  const out = vec4.create()

  if (vertices.length === 0) {
    out[0] = 0
    out[1] = 0
    out[2] = 0
    out[3] = 0
    return out
  }

  // keep a list of min/max vertices by axis
  let minx = vertices[0]
  let miny = minx
  let minz = minx
  let maxx = minx
  let maxy = minx
  let maxz = minx

  // Use for loop instead of forEach for better performance in hot path
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]
    if (minx[0] > v[0]) minx = v
    if (miny[1] > v[1]) miny = v
    if (minz[2] > v[2]) minz = v
    if (maxx[0] < v[0]) maxx = v
    if (maxy[1] < v[1]) maxy = v
    if (maxz[2] < v[2]) maxz = v
  }

  out[0] = (minx[0] + maxx[0]) * 0.5 // center of sphere
  out[1] = (miny[1] + maxy[1]) * 0.5
  out[2] = (minz[2] + maxz[2]) * 0.5
  const x = out[0] - maxx[0]
  const y = out[1] - maxy[1]
  const z = out[2] - maxz[2]
  out[3] = Math.sqrt(x * x + y * y + z * z) // radius of sphere

  polygon.boundingSphere = out

  return out
}

module.exports = measureBoundingSphere
