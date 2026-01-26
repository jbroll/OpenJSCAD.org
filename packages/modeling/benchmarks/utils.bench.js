/**
 * Utility function benchmarks
 *
 * Tests flatten and other utilities.
 * These benchmarks target issue #1422 (inefficient flatten with recursive concat).
 */

const { utils } = require('../src')
const { flatten } = utils

const name = 'Utils'

// Create nested arrays of varying depth and size
const createNestedArray = (depth, itemsPerLevel) => {
  if (depth === 0) return [1, 2, 3]
  const result = []
  for (let i = 0; i < itemsPerLevel; i++) {
    result.push(createNestedArray(depth - 1, itemsPerLevel))
  }
  return result
}

// Create flat array with many items
const createFlatArray = (size) => {
  const result = []
  for (let i = 0; i < size; i++) {
    result.push({ id: i })
  }
  return result
}

// Create mixed nested/flat array (realistic usage)
const createMixedArray = (groups, itemsPerGroup) => {
  const result = []
  for (let i = 0; i < groups; i++) {
    const group = []
    for (let j = 0; j < itemsPerGroup; j++) {
      group.push({ id: i * itemsPerGroup + j })
    }
    result.push(group)
  }
  return result
}

const benchmarks = [
  // Flat arrays (no nesting needed)
  {
    name: 'flatten-flat-10-items',
    fn: () => flatten(createFlatArray(10))
  },
  {
    name: 'flatten-flat-100-items',
    fn: () => flatten(createFlatArray(100))
  },
  {
    name: 'flatten-flat-1000-items',
    fn: () => flatten(createFlatArray(1000))
  },

  // Mixed arrays (typical usage: arrays of geometry arrays)
  {
    name: 'flatten-mixed-10x10',
    fn: () => flatten(createMixedArray(10, 10))
  },
  {
    name: 'flatten-mixed-20x20',
    fn: () => flatten(createMixedArray(20, 20))
  },
  {
    name: 'flatten-mixed-50x10',
    fn: () => flatten(createMixedArray(50, 10))
  },

  // Deeply nested (stress test)
  {
    name: 'flatten-nested-depth-3',
    fn: () => flatten(createNestedArray(3, 4))
  },
  {
    name: 'flatten-nested-depth-4',
    fn: () => flatten(createNestedArray(4, 3))
  },
  {
    name: 'flatten-nested-depth-5',
    fn: () => flatten(createNestedArray(5, 2))
  }
]

module.exports = { name, benchmarks }
