/**
 * Typical workflow benchmarks
 *
 * Tests common modeling patterns that users actually do:
 * - Create primitive, boolean op, transform
 * - Multiple booleans in sequence
 * - Mixed geometry types (cube vs cylinder)
 */

const { primitives, booleans, transforms } = require('../src')
const { cube, sphere, cylinder, torus } = primitives
const { union, subtract, intersect } = booleans
const { translate, rotate, scale } = transforms

const name = 'Workflows'

// Pre-create some geometries for fair comparison
const cube10 = cube({ size: 10 })
const cyl16 = cylinder({ radius: 3, height: 15, segments: 16 })
const cyl32 = cylinder({ radius: 3, height: 15, segments: 32 })
const sphere16 = sphere({ radius: 5, segments: 16 })
const sphere32 = sphere({ radius: 5, segments: 32 })

const benchmarks = [
  // Classic workflow: cube with hole
  {
    name: 'workflow-cube-subtract-cylinder-16',
    fn: () => subtract(cube({ size: 10 }), cylinder({ radius: 3, height: 15, segments: 16 }))
  },
  {
    name: 'workflow-cube-subtract-cylinder-32',
    fn: () => subtract(cube({ size: 10 }), cylinder({ radius: 3, height: 15, segments: 32 }))
  },

  // Pre-created geometry (isolates boolean cost)
  {
    name: 'workflow-precreated-cube-subtract-cyl16',
    fn: () => subtract(cube10, cyl16)
  },
  {
    name: 'workflow-precreated-cube-subtract-cyl32',
    fn: () => subtract(cube10, cyl32)
  },

  // Full pipeline: create, boolean, transform
  {
    name: 'workflow-full-cube-subtract-cyl-rotate',
    fn: () => rotate([0, Math.PI / 4, 0], subtract(cube({ size: 10 }), cylinder({ radius: 3, height: 15, segments: 16 })))
  },
  {
    name: 'workflow-full-cube-subtract-cyl-translate',
    fn: () => translate([10, 0, 0], subtract(cube({ size: 10 }), cylinder({ radius: 3, height: 15, segments: 16 })))
  },

  // Multiple holes (common pattern)
  {
    name: 'workflow-cube-3-holes',
    fn: () => {
      const box = cube({ size: 10 })
      const hole1 = cylinder({ radius: 1.5, height: 15, segments: 16 })
      const hole2 = translate([3, 0, 0], hole1)
      const hole3 = translate([-3, 0, 0], hole1)
      return subtract(box, hole1, hole2, hole3)
    }
  },

  // Union of shapes (assembly pattern)
  {
    name: 'workflow-union-cube-sphere-16',
    fn: () => union(cube({ size: 8 }), translate([0, 0, 6], sphere({ radius: 5, segments: 16 })))
  },
  {
    name: 'workflow-union-cube-sphere-32',
    fn: () => union(cube({ size: 8 }), translate([0, 0, 6], sphere({ radius: 5, segments: 32 })))
  },

  // Intersect (less common but important)
  {
    name: 'workflow-intersect-cube-sphere-16',
    fn: () => intersect(cube({ size: 10 }), sphere({ radius: 7, segments: 16 }))
  },
  {
    name: 'workflow-intersect-cube-sphere-32',
    fn: () => intersect(cube({ size: 10 }), sphere({ radius: 7, segments: 32 }))
  },

  // Chained operations
  {
    name: 'workflow-chain-subtract-union',
    fn: () => {
      const base = cube({ size: 10 })
      const hole = cylinder({ radius: 3, height: 15, segments: 16 })
      const top = translate([0, 0, 5], sphere({ radius: 3, segments: 16 }))
      return union(subtract(base, hole), top)
    }
  },

  // Scaling after boolean (tests transform application)
  {
    name: 'workflow-subtract-then-scale',
    fn: () => scale([2, 2, 2], subtract(cube({ size: 10 }), cylinder({ radius: 3, height: 15, segments: 16 })))
  }
]

module.exports = { name, benchmarks }
