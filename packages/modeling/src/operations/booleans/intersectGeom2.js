const flatten = require('../../utils/flatten')

const clipGeom2 = require('./geom2Clipping')

/*
 * Return a new 2D geometry representing space in both the first geometry and
 * in the subsequent geometries. None of the given geometries are modified.
 * @param {...geom2} geometries - list of 2D geometries
 * @returns {geom2} new 2D geometry
 */
const intersect = (...geometries) => clipGeom2('intersect', flatten(geometries))

module.exports = intersect
