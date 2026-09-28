const flatten = require('../../utils/flatten')

const clipGeom2 = require('./geom2Clipping')

/*
 * Return a new 2D geometry representing the total space in the given 2D geometries.
 * @param {...geom2} geometries - list of 2D geometries to union
 * @returns {geom2} new 2D geometry
 */
const union = (...geometries) => clipGeom2('union', flatten(geometries))

module.exports = union
