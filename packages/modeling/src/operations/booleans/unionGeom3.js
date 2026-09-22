const { EPS } = require('../../maths/constants')

const geom3 = require('../../geometries/geom3')

const measureBoundingBox = require('../../measurements/measureBoundingBox')

const flatten = require('../../utils/flatten')

const retessellate = require('../modifiers/retessellate')

const unionSub = require('./unionGeom3Sub')

/*
 * Do the bounds of two geometries come close enough to touch?
 * Same test as mayOverlap, from bounds measured once by the caller.
 */
const boundsMayOverlap = (bounds1, bounds2) => {
  for (let i = 0; i < 3; i++) {
    if ((bounds2[0][i] - bounds1[1][i]) > EPS) return false
    if ((bounds1[0][i] - bounds2[1][i]) > EPS) return false
  }
  return true
}

/*
 * Group the given geometries so that any two whose bounds may overlap end up
 * in the same group. Geometries without polygons cannot overlap anything.
 */
const groupByBounds = (geometries) => {
  const bounds = geometries.map((geometry) => geometry.polygons.length === 0 ? null : measureBoundingBox(geometry))
  const parent = geometries.map((geometry, i) => i)
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  for (let i = 0; i < bounds.length; i++) {
    if (!bounds[i]) continue
    for (let j = i + 1; j < bounds.length; j++) {
      if (bounds[j] && boundsMayOverlap(bounds[i], bounds[j])) parent[find(i)] = find(j)
    }
  }
  const groups = new Map()
  geometries.forEach((geometry, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(geometry)
  })
  return [...groups.values()]
}

/*
 * Union geometries that may overlap, in a balanced binary tree pattern.
 */
const mergeGroup = (geometries) => {
  let i
  for (i = 1; i < geometries.length; i += 2) {
    geometries.push(unionSub(geometries[i - 1], geometries[i]))
  }
  return geometries[i - 1]
}

/*
 * Return a new 3D geometry representing the space in the given 3D geometries.
 * @param {...objects} geometries - list of geometries to union
 * @returns {geom3} new 3D geometry
 */
const union = (...geometries) => {
  geometries = flatten(geometries)

  // Group by bounds before merging. Merging in input order lets two solids far
  // apart concatenate into one geometry whose bounds span both, after which
  // every remaining solid looks like an overlap and takes the full BSP path.
  // Grouping keeps solids that can really intersect together and leaves the
  // rest to a concatenation.
  const groups = geometries.length > 2 ? groupByBounds(geometries) : [geometries]
  const merged = groups.map((group) => mergeGroup(group.slice()))

  let newgeometry = merged.length === 1
    ? merged[0]
    : geom3.create(merged.reduce((polygons, geometry) => polygons.concat(geom3.toPolygons(geometry)), []))
  newgeometry = retessellate(newgeometry)
  return newgeometry
}

module.exports = union
