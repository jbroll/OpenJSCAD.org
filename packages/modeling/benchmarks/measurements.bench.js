/**
 * Measurement operation benchmarks
 *
 * Tests measureBoundingBox, measureVolume, etc at varying complexity.
 * These benchmarks target issue #1427 (toPoints in measureBoundingBox).
 */

const { primitives, booleans, transforms, measurements } = require('../src')
const { sphere, cube, cylinder } = primitives
const { union } = booleans
const { translate } = transforms
const { measureBoundingBox, measureVolume, measureArea, measureCenter } = measurements

const name = 'Measurements'

// Pre-create geometries of varying complexity for benchmarking
const createComplexGeometry = (polygonTarget) => {
  // sphere segments² ≈ polygon count
  // segments=16 → ~512 polygons
  // segments=32 → ~2048 polygons
  // segments=64 → ~8192 polygons
  const segments = Math.ceil(Math.sqrt(polygonTarget))
  return sphere({ radius: 5, segments })
}

// Create a mesh with many polygons by unioning multiple spheres
const createMultiPartGeometry = (parts) => {
  const shapes = []
  for (let i = 0; i < parts; i++) {
    shapes.push(translate([i * 3, 0, 0], sphere({ radius: 1, segments: 16 })))
  }
  return union(shapes)
}

const benchmarks = [
  // measureBoundingBox at varying polygon counts
  {
    name: 'boundingBox-sphere-512-polys',
    fn: () => {
      const geom = createComplexGeometry(512)
      return measureBoundingBox(geom)
    }
  },
  {
    name: 'boundingBox-sphere-2048-polys',
    fn: () => {
      const geom = createComplexGeometry(2048)
      return measureBoundingBox(geom)
    }
  },
  {
    name: 'boundingBox-sphere-8192-polys',
    fn: () => {
      const geom = createComplexGeometry(8192)
      return measureBoundingBox(geom)
    }
  },

  // measureVolume
  {
    name: 'volume-sphere-512-polys',
    fn: () => {
      const geom = createComplexGeometry(512)
      return measureVolume(geom)
    }
  },
  {
    name: 'volume-sphere-2048-polys',
    fn: () => {
      const geom = createComplexGeometry(2048)
      return measureVolume(geom)
    }
  },

  // measureArea
  {
    name: 'area-sphere-512-polys',
    fn: () => {
      const geom = createComplexGeometry(512)
      return measureArea(geom)
    }
  },
  {
    name: 'area-sphere-2048-polys',
    fn: () => {
      const geom = createComplexGeometry(2048)
      return measureArea(geom)
    }
  },

  // measureCenter
  {
    name: 'center-sphere-2048-polys',
    fn: () => {
      const geom = createComplexGeometry(2048)
      return measureCenter(geom)
    }
  },

  // Measure multiple geometries (tests flatten - issue #1422)
  {
    name: 'boundingBox-10-cubes',
    fn: () => {
      const cubes = []
      for (let i = 0; i < 10; i++) {
        cubes.push(translate([i * 2, 0, 0], cube({ size: 1 })))
      }
      return measureBoundingBox(cubes)
    }
  },
  {
    name: 'boundingBox-50-cubes',
    fn: () => {
      const cubes = []
      for (let i = 0; i < 50; i++) {
        cubes.push(translate([i * 2, 0, 0], cube({ size: 1 })))
      }
      return measureBoundingBox(cubes)
    }
  }
]

module.exports = { name, benchmarks }
