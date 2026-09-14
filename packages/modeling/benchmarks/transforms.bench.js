/**
 * Transform operation benchmarks
 *
 * Tests translate, rotate, scale on geometries of varying complexity.
 * These benchmarks also test the flatten utility indirectly (issue #1422).
 */

const { primitives, transforms } = require('../src')
const { sphere, cube } = primitives
const { translate, rotate, scale, center, align } = transforms

const name = 'Transforms'

// Pre-create geometries of varying complexity
const smallGeom = () => cube({ size: 2 })
const mediumGeom = () => sphere({ radius: 2, segments: 32 })
const largeGeom = () => sphere({ radius: 2, segments: 64 })

const benchmarks = [
  // Single transforms
  {
    name: 'translate-small',
    fn: () => translate([10, 20, 30], smallGeom())
  },
  {
    name: 'translate-medium',
    fn: () => translate([10, 20, 30], mediumGeom())
  },
  {
    name: 'translate-large',
    fn: () => translate([10, 20, 30], largeGeom())
  },

  {
    name: 'rotate-small',
    fn: () => rotate([Math.PI / 4, Math.PI / 3, Math.PI / 6], smallGeom())
  },
  {
    name: 'rotate-medium',
    fn: () => rotate([Math.PI / 4, Math.PI / 3, Math.PI / 6], mediumGeom())
  },
  {
    name: 'rotate-large',
    fn: () => rotate([Math.PI / 4, Math.PI / 3, Math.PI / 6], largeGeom())
  },

  {
    name: 'scale-medium',
    fn: () => scale([2, 3, 4], mediumGeom())
  },

  // Center and align (use measureBoundingBox internally - issue #1427)
  {
    name: 'center-medium',
    fn: () => center({ axes: [true, true, true] }, mediumGeom())
  },
  {
    name: 'center-large',
    fn: () => center({ axes: [true, true, true] }, largeGeom())
  },

  {
    name: 'align-medium',
    fn: () => align({ modes: ['center', 'min', 'max'] }, mediumGeom())
  },

  // Transform multiple geometries (tests flatten - issue #1422)
  {
    name: 'translate-10-cubes',
    fn: () => {
      const cubes = []
      for (let i = 0; i < 10; i++) {
        cubes.push(cube({ size: 1, center: [i * 2, 0, 0] }))
      }
      return translate([5, 5, 5], cubes)
    }
  },
  {
    name: 'translate-50-cubes',
    fn: () => {
      const cubes = []
      for (let i = 0; i < 50; i++) {
        cubes.push(cube({ size: 1, center: [i * 2, 0, 0] }))
      }
      return translate([5, 5, 5], cubes)
    }
  },
  {
    name: 'translate-100-cubes',
    fn: () => {
      const cubes = []
      for (let i = 0; i < 100; i++) {
        cubes.push(cube({ size: 1, center: [i * 2, 0, 0] }))
      }
      return translate([5, 5, 5], cubes)
    }
  },

  // Chained transforms
  {
    name: 'chain-translate-rotate-scale',
    fn: () => scale([2, 2, 2], rotate([0, Math.PI / 4, 0], translate([5, 0, 0], mediumGeom())))
  }
]

module.exports = { name, benchmarks }
