/**
 * Primitive shape benchmarks
 *
 * Tests sphere, cylinder, torus creation - the key primitives
 * that involve trigonometry and significant vertex generation.
 */

const { primitives } = require('../src')
const { cube, sphere, cylinder, cylinderElliptic, torus, geodesicSphere, roundedCuboid, roundedCylinder } = primitives

const name = 'Primitives'

const benchmarks = [
  // Cubes (baseline - very fast)
  {
    name: 'cube-default',
    fn: () => cube()
  },
  {
    name: 'roundedCuboid-default',
    fn: () => roundedCuboid()
  },

  // Spheres - key optimization target (trig + many vertices)
  {
    name: 'sphere-16-segments',
    fn: () => sphere({ segments: 16 })
  },
  {
    name: 'sphere-32-segments',
    fn: () => sphere({ segments: 32 })
  },
  {
    name: 'sphere-64-segments',
    fn: () => sphere({ segments: 64 })
  },
  {
    name: 'sphere-128-segments',
    fn: () => sphere({ segments: 128 })
  },
  {
    name: 'geodesicSphere-frequency-6',
    fn: () => geodesicSphere({ frequency: 6 })
  },

  // Cylinders - common primitive
  {
    name: 'cylinder-16-segments',
    fn: () => cylinder({ segments: 16 })
  },
  {
    name: 'cylinder-32-segments',
    fn: () => cylinder({ segments: 32 })
  },
  {
    name: 'cylinder-64-segments',
    fn: () => cylinder({ segments: 64 })
  },
  {
    name: 'cylinderElliptic-32-segments',
    fn: () => cylinderElliptic({ segments: 32 })
  },
  {
    name: 'roundedCylinder-32-segments',
    fn: () => roundedCylinder({ segments: 32 })
  },

  // Torus - uses extrudeRotate internally
  {
    name: 'torus-16x16',
    fn: () => torus({ innerSegments: 16, outerSegments: 16 })
  },
  {
    name: 'torus-32x32',
    fn: () => torus({ innerSegments: 32, outerSegments: 32 })
  },
  {
    name: 'torus-64x64',
    fn: () => torus({ innerSegments: 64, outerSegments: 64 })
  }
]

module.exports = { name, benchmarks }
