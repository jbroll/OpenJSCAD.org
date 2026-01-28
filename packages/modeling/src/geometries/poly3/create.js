
/**
 * Represents a convex 3D polygon. The vertices used to initialize a polygon must
 * be coplanar and form a convex shape. The vertices do not have to be `vec3`
 * instances but they must behave similarly.
 * @typedef {Object} poly3
 * @property {Array} vertices - list of ordered vertices (3D)
 */

/**
 * Creates a new 3D polygon with initial values.
 *
 * @param {Array} [vertices] - a list of vertices (3D)
 * @returns {poly3} a new polygon
 * @alias module:modeling/geometries/poly3.create
 */
const create = (vertices) => {
  if (vertices === undefined || vertices.length < 3) {
    vertices = [] // empty contents
  }
  // Initialize all properties upfront for consistent object shape.
  // V8 optimizes property access when objects have the same hidden class.
  // Without this, polygons get different shapes (vertices only, vertices+plane,
  // vertices+plane+boundingSphere) causing megamorphic property access.
  return { vertices, plane: null, boundingSphere: null }
}

module.exports = create
