const polygonClipping = require('polyclip-ts')

const vec2 = require('../../maths/vec2')

const geom2 = require('../../geometries/geom2')

// Chain sides into rings without requiring closure, so a geom2 left open by
// an earlier boolean still yields its region (the clipper closes rings).
const chainSides = (sides) => {
  const key = (point) => `${point[0]},${point[1]}`
  const outgoing = new Map()
  sides.forEach((side) => {
    const k = key(side[0])
    if (outgoing.has(k)) outgoing.get(k).push(side)
    else outgoing.set(k, [side])
  })
  const rings = []
  for (const list of outgoing.values()) {
    while (list.length > 0) {
      const ring = []
      let side = list.pop()
      const start = key(side[0])
      while (true) {
        ring.push(side[0])
        const next = key(side[1])
        if (next === start) break
        const candidates = outgoing.get(next)
        const following = candidates && candidates.pop()
        if (!following) {
          ring.push(side[1])
          break
        }
        side = following
      }
      rings.push(ring)
    }
  }
  return rings
}

const toRings = (geometry) => {
  try {
    return geom2.toOutlines(geometry)
  } catch (e) {
    return chainSides(geom2.toSides(geometry))
  }
}

/*
 * Convert a geom2 into a polyclip-ts MultiPolygon.
 * Outlines are resolved even-odd, since polyclip-ts ignores orientation
 * and wants each polygon as [outer, ...holes].
 */
const toMultiPolygon = (geometry) => {
  const rings = toRings(geometry)
    .filter((ring) => ring.length >= 3)
    .map((ring) => [ring.map((point) => [point[0], point[1]])])
  if (rings.length === 0) return []
  return polygonClipping.xor(rings[0], ...rings.slice(1))
}

/*
 * Convert a polyclip-ts MultiPolygon into a geom2.
 * Rings come back closed (last point repeats the first), outers CCW and holes CW.
 */
const fromMultiPolygon = (multiPolygon) => {
  const sides = []
  multiPolygon.forEach((polygon) => {
    polygon.forEach((ring) => {
      const points = ring.slice(0, -1).map((point) => vec2.fromValues(point[0], point[1]))
      points.forEach((point, i) => {
        sides.push([point, points[(i + 1) % points.length]])
      })
    })
  })
  return geom2.create(sides)
}

module.exports = { fromMultiPolygon, toMultiPolygon }
