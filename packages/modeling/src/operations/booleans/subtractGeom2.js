const polygonClipping = require('polygon-clipping')

const flatten = require('../../utils/flatten')

const { fromMultiPolygon, toMultiPolygon } = require('./geom2Clipping')

/*
 * Return a new 2D geometry representing space in the first geometry but
 * not in the subsequent geometries. None of the given geometries are modified.
 * @param {...geom2} geometries - list of geometries
 * @returns {geom2} new 2D geometry
 */
const subtract = (...geometries) => {
  geometries = flatten(geometries)
  const operands = geometries.map(toMultiPolygon)
  return fromMultiPolygon(polygonClipping.difference(...operands))
}

module.exports = subtract
