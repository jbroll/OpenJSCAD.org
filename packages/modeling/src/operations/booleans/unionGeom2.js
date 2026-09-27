const polygonClipping = require('polygon-clipping')

const flatten = require('../../utils/flatten')

const { fromMultiPolygon, toMultiPolygon } = require('./geom2Clipping')

/*
 * Return a new 2D geometry representing the total space in the given 2D geometries.
 * @param {...geom2} geometries - list of 2D geometries to union
 * @returns {geom2} new 2D geometry
 */
const union = (...geometries) => {
  geometries = flatten(geometries)
  const operands = geometries.map(toMultiPolygon)
  return fromMultiPolygon(polygonClipping.union(...operands))
}

module.exports = union
