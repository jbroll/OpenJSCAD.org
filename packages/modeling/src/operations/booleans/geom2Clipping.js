const ClipperLib = require('clipper-lib')

const vec2 = require('../../maths/vec2')

const geom2 = require('../../geometries/geom2')

const { Clipper, ClipType, PolyType, PolyFillType } = ClipperLib

// Clipper works on integers; 1e9 keeps nanometre detail on millimetre models.
// Beyond 4.5e6 the scale shrinks so coordinates stay inside its 2^53 range.
const maxScale = 1e9
const maxScaled = 4.5e15

// Chain sides into rings without requiring closure, so a geom2 left open by
// an earlier boolean still yields its region.
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

const execute = (clipType, subject, clip, fillType) => {
  const clipper = new Clipper()
  clipper.AddPaths(subject, PolyType.ptSubject, true)
  if (clip) clipper.AddPaths(clip, PolyType.ptClip, true)
  const solution = []
  clipper.Execute(clipType, solution, fillType, fillType)
  return solution
}

/*
 * The region of one geom2 as Clipper paths, outlines resolved even-odd so
 * nested outlines become holes whatever their orientation.
 */
const toRegion = (rings, scale) => {
  const paths = rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => ring.map((point) => ({ X: Math.round(point[0] * scale), Y: Math.round(point[1] * scale) })))
  if (paths.length === 0) return []
  return execute(ClipType.ctUnion, paths, null, PolyFillType.pftEvenOdd)
}

// Clipper returns outers counter-clockwise and holes clockwise, as geom2 wants.
// Unions of touching slivers (projections) come back with zero-width spikes;
// CleanPolygons removes them and vertices within 1.415 units of collinear.
const fromRegion = (paths, scale) => {
  const sides = []
  Clipper.CleanPolygons(paths, 1.415).filter((path) => path.length >= 3).forEach((path) => {
    const points = path.map((point) => vec2.fromValues(point.X / scale, point.Y / scale))
    points.forEach((point, i) => {
      sides.push([point, points[(i + 1) % points.length]])
    })
  })
  return geom2.create(sides)
}

const scaleFor = (ringSets) => {
  let maxAbs = 0
  ringSets.forEach((rings) => rings.forEach((ring) => ring.forEach((point) => {
    maxAbs = Math.max(maxAbs, Math.abs(point[0]), Math.abs(point[1]))
  })))
  return maxAbs * maxScale > maxScaled ? maxScaled / maxAbs : maxScale
}

/*
 * Apply a boolean to geom2 operands: 'union' of all, 'subtract' the rest from
 * the first, 'intersect' all.
 */
const clipGeom2 = (operation, geometries) => {
  const ringSets = geometries.map(toRings)
  const scale = scaleFor(ringSets)
  const regions = ringSets.map((rings) => toRegion(rings, scale))
  const fill = PolyFillType.pftNonZero
  let result
  if (regions.length === 0) {
    result = []
  } else if (operation === 'union') {
    result = execute(ClipType.ctUnion, regions.flat(), null, fill)
  } else if (operation === 'subtract') {
    result = execute(ClipType.ctDifference, regions[0], regions.slice(1).flat(), fill)
  } else {
    result = regions.slice(1).reduce((acc, region) => execute(ClipType.ctIntersection, acc, region, fill), regions[0])
  }
  return fromRegion(result, scale)
}

module.exports = clipGeom2
