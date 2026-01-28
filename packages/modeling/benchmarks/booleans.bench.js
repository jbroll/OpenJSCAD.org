/**
 * Boolean operation benchmarks
 *
 * Tests union, subtract, intersect at varying complexity levels.
 * These benchmarks target issue #1421 (splitPolygonByPlane splice).
 */

const { primitives, booleans, transforms } = require('../src')
const { cube, sphere, cylinder } = primitives
const { union, subtract, intersect } = booleans
const { translate } = transforms

const name = 'Booleans'

const benchmarks = [
  // Simple operations - baseline
  {
    name: 'union-sphere-8-segments',
    fn: () => union(cube({ size: 2 }), sphere({ radius: 1.2, segments: 8 }))
  },
  {
    name: 'union-sphere-16-segments',
    fn: () => union(cube({ size: 2 }), sphere({ radius: 1.2, segments: 16 }))
  },
  {
    name: 'union-sphere-32-segments',
    fn: () => union(cube({ size: 2 }), sphere({ radius: 1.2, segments: 32 }))
  },
  // Higher complexity - should reveal O(n²) behavior
  {
    name: 'union-sphere-64-segments',
    fn: () => union(cube({ size: 2 }), sphere({ radius: 1.2, segments: 64 }))
  },

  // Subtract operations
  {
    name: 'subtract-sphere-16-segments',
    fn: () => subtract(cube({ size: 2 }), sphere({ radius: 1.2, segments: 16 }))
  },
  {
    name: 'subtract-sphere-32-segments',
    fn: () => subtract(cube({ size: 2 }), sphere({ radius: 1.2, segments: 32 }))
  },
  {
    name: 'subtract-sphere-64-segments',
    fn: () => subtract(cube({ size: 2 }), sphere({ radius: 1.2, segments: 64 }))
  },

  // Intersect operations
  {
    name: 'intersect-sphere-32-segments',
    fn: () => intersect(cube({ size: 2 }), sphere({ radius: 1.2, segments: 32 }))
  },

  // Chain of unions (tests repeated boolean operations)
  {
    name: 'union-chain-5-cubes',
    fn: () => {
      let result = cube({ size: 1 })
      for (let i = 1; i < 5; i++) {
        result = union(result, translate([i * 0.8, 0, 0], cube({ size: 1 })))
      }
      return result
    }
  },
  {
    name: 'union-chain-10-cubes',
    fn: () => {
      let result = cube({ size: 1 })
      for (let i = 1; i < 10; i++) {
        result = union(result, translate([i * 0.8, 0, 0], cube({ size: 1 })))
      }
      return result
    }
  },

  // Union of array (tests flatten utility - issue #1422)
  {
    name: 'union-array-10-cubes',
    fn: () => {
      const cubes = []
      for (let i = 0; i < 10; i++) {
        cubes.push(translate([i * 1.5, 0, 0], cube({ size: 1 })))
      }
      return union(cubes)
    }
  },
  {
    name: 'union-array-25-cubes',
    fn: () => {
      const cubes = []
      for (let i = 0; i < 25; i++) {
        cubes.push(translate([i * 1.5, 0, 0], cube({ size: 1 })))
      }
      return union(cubes)
    }
  }
]

module.exports = { name, benchmarks }
