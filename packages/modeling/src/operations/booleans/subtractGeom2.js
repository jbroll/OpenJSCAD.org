const flatten = require('../../utils/flatten')

const clipGeom2 = require('./geom2Clipping')

/*
 * Return a new 2D geometry representing space in the first geometry but
 * not in the subsequent geometries. None of the given geometries are modified.
 * @param {...geom2} geometries - list of geometries
 * @returns {geom2} new 2D geometry
 */
const subtract = (...geometries) => clipGeom2('subtract', flatten(geometries))

module.exports = subtract
