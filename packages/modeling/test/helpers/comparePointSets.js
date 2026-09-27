const compareVectors = require('./compareVectors')

/**
 * Compare two lists of points for equality, ignoring order
 * @param {Array} list1 - list of points
 * @param {Array} list2 - list of points
 * @param {number} eps - the largest difference between two coordinates to consider trivial
 * @returns {boolean} result of comparison
 */
const comparePointSets = (list1, list2, eps) => {
  if (list1.length !== list2.length) return false
  const unused = list2.slice()
  return list1.every((point) => {
    const index = unused.findIndex((other) => compareVectors(point, other, eps))
    if (index < 0) return false
    unused.splice(index, 1)
    return true
  })
}

module.exports = comparePointSets
