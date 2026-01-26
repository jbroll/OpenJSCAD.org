/**
 * Extrusion operation benchmarks
 *
 * Tests extrudeLinear, extrudeRotate at varying slice counts.
 * These benchmarks target:
 * - Issue #1419 (extrudeFromSlices concat in loop)
 * - Issue #1424 (extrudeWalls vec3.create allocations)
 */

const { primitives, extrusions } = require('../src')
const { circle, rectangle, star } = primitives
const { extrudeLinear, extrudeRotate, extrudeHelical } = extrusions

const name = 'Extrusions'

const benchmarks = [
  // ExtrudeLinear with varying heights (affects slice count internally)
  {
    name: 'extrudeLinear-circle-16-segments',
    fn: () => extrudeLinear({ height: 10 }, circle({ radius: 5, segments: 16 }))
  },
  {
    name: 'extrudeLinear-circle-32-segments',
    fn: () => extrudeLinear({ height: 10 }, circle({ radius: 5, segments: 32 }))
  },
  {
    name: 'extrudeLinear-circle-64-segments',
    fn: () => extrudeLinear({ height: 10 }, circle({ radius: 5, segments: 64 }))
  },

  // ExtrudeLinear with twist (creates multiple slices - tests #1419)
  {
    name: 'extrudeLinear-twist-10-slices',
    fn: () => extrudeLinear(
      { height: 10, twistAngle: Math.PI / 4, twistSteps: 10 },
      rectangle({ size: [4, 4] })
    )
  },
  {
    name: 'extrudeLinear-twist-50-slices',
    fn: () => extrudeLinear(
      { height: 10, twistAngle: Math.PI / 4, twistSteps: 50 },
      rectangle({ size: [4, 4] })
    )
  },
  {
    name: 'extrudeLinear-twist-100-slices',
    fn: () => extrudeLinear(
      { height: 10, twistAngle: Math.PI / 4, twistSteps: 100 },
      rectangle({ size: [4, 4] })
    )
  },
  {
    name: 'extrudeLinear-twist-200-slices',
    fn: () => extrudeLinear(
      { height: 10, twistAngle: Math.PI / 4, twistSteps: 200 },
      rectangle({ size: [4, 4] })
    )
  },

  // ExtrudeRotate (creates many slices)
  {
    name: 'extrudeRotate-16-segments',
    fn: () => extrudeRotate(
      { segments: 16 },
      rectangle({ size: [1, 2], center: [3, 0] })
    )
  },
  {
    name: 'extrudeRotate-32-segments',
    fn: () => extrudeRotate(
      { segments: 32 },
      rectangle({ size: [1, 2], center: [3, 0] })
    )
  },
  {
    name: 'extrudeRotate-64-segments',
    fn: () => extrudeRotate(
      { segments: 64 },
      rectangle({ size: [1, 2], center: [3, 0] })
    )
  },
  {
    name: 'extrudeRotate-128-segments',
    fn: () => extrudeRotate(
      { segments: 128 },
      rectangle({ size: [1, 2], center: [3, 0] })
    )
  },

  // ExtrudeHelical (complex extrusion)
  {
    name: 'extrudeHelical-32-segments',
    fn: () => extrudeHelical(
      { height: 10, angle: Math.PI * 4, segments: 32 },
      circle({ radius: 0.5, segments: 8, center: [2, 0] })
    )
  },
  {
    name: 'extrudeHelical-64-segments',
    fn: () => extrudeHelical(
      { height: 10, angle: Math.PI * 4, segments: 64 },
      circle({ radius: 0.5, segments: 8, center: [2, 0] })
    )
  },

  // Complex 2D shape extrusion (star has many vertices)
  {
    name: 'extrudeLinear-star-10-points',
    fn: () => extrudeLinear(
      { height: 5 },
      star({ vertices: 10, innerRadius: 2, outerRadius: 4 })
    )
  },
  {
    name: 'extrudeLinear-star-20-points',
    fn: () => extrudeLinear(
      { height: 5 },
      star({ vertices: 20, innerRadius: 2, outerRadius: 4 })
    )
  }
]

module.exports = { name, benchmarks }
