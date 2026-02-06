#!/usr/bin/env node
/**
 * Quick Benchmark Timing Script
 *
 * Runs all standard benchmarks once on the current branch and reports times.
 * Use this to get a quick overview of benchmark performance.
 *
 * Usage:
 *   node benchmarks/quick-timing.js
 *   node benchmarks/quick-timing.js --heavy   # Run heavy configuration
 */

const path = require('path')

// Configuration
const HEAVY = process.argv.includes('--heavy')

// Resolve paths relative to the modeling package root
const modelingRoot = path.resolve(__dirname, '..')
const srcPath = (mod) => path.join(modelingRoot, 'src', mod)

// Benchmark definitions
const BENCHMARKS = [
  {
    name: 'swiss-cheese',
    lite: { holes: 20 },
    heavy: { holes: 380, segments: 24 },  // ~20-30s
    run: (params) => {
      const { cube, sphere } = require(srcPath('primitives'))
      const { subtract, union } = require(srcPath('operations/booleans'))
      const { translate } = require(srcPath('operations/transforms'))

      let seed = 12345
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }

      const cubeSize = 50
      const holeRadius = 8
      const segments = params.segments || 16
      const body = cube({ size: cubeSize })
      const halfSize = cubeSize / 2 + holeRadius * 1.5
      const holeSpheres = []

      for (let i = 0; i < params.holes; i++) {
        const x = (random() - 0.5) * 2 * halfSize
        const y = (random() - 0.5) * 2 * halfSize
        const z = (random() - 0.5) * 2 * halfSize
        holeSpheres.push(translate([x, y, z], sphere({ radius: holeRadius, segments })))
      }

      return subtract(body, union(holeSpheres))
    }
  },
  {
    name: 'sphere-union',
    lite: { count: 8, segments: 32 },
    heavy: { count: 26, segments: 68 },  // ~30s target
    run: (params) => {
      const { sphere } = require(srcPath('primitives'))
      const { union } = require(srcPath('operations/booleans'))
      const { translate } = require(srcPath('operations/transforms'))

      const spheres = []
      for (let i = 0; i < params.count; i++) {
        spheres.push(translate([i * 3, 0, 0], sphere({ radius: 5, segments: params.segments })))
      }
      return union(spheres)
    }
  },
  {
    name: 'sphere-cloud',
    lite: { count: 30, segments: 16 },
    heavy: { count: 220, segments: 36 },  // ~30s target
    run: (params) => {
      const { sphere } = require(srcPath('primitives'))
      const { union } = require(srcPath('operations/booleans'))
      const { translate } = require(srcPath('operations/transforms'))

      let seed = 54321
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }

      const spheres = []
      for (let i = 0; i < params.count; i++) {
        const x = (random() - 0.5) * 40
        const y = (random() - 0.5) * 40
        const z = (random() - 0.5) * 40
        spheres.push(translate([x, y, z], sphere({ radius: 3, segments: params.segments })))
      }
      return union(spheres)
    }
  },
  {
    name: 'menger-intersect',
    lite: { depth: 3, size: 60 },
    heavy: { depth: 4, size: 60 },  // ~25s (depth 5 would be too slow)
    run: (params) => {
      const { square } = require(srcPath('primitives'))
      const { union, intersect } = require(srcPath('operations/booleans'))
      const { translate, rotateX, rotateY } = require(srcPath('operations/transforms'))
      const { extrudeLinear } = require(srcPath('operations/extrusions'))

      const sierpinskiCarpet = (size, depth) => {
        if (depth === 0) return square({ size })
        const s = size / 3
        const parts = []
        for (let x = -1; x <= 1; x++) {
          for (let y = -1; y <= 1; y++) {
            if (x === 0 && y === 0) continue
            parts.push(translate([x * s, y * s, 0], sierpinskiCarpet(s, depth - 1)))
          }
        }
        return union(parts)
      }

      const size = params.size
      const carpet = sierpinskiCarpet(size, params.depth)
      const height = size * 2
      const extruded = extrudeLinear({ height }, carpet)
      const centered = translate([0, 0, -height / 2], extruded)

      return intersect(
        centered,
        rotateY(Math.PI / 2, centered),
        rotateX(Math.PI / 2, centered)
      )
    }
  },
  {
    name: 'chainmail',
    lite: { rings: 3, segments: 24 },
    heavy: { rings: 6, segments: 56 },  // ~20-40s (high variance)
    run: (params) => {
      const { torus } = require(srcPath('primitives'))
      const { union } = require(srcPath('operations/booleans'))
      const { translate, rotateX } = require(srcPath('operations/transforms'))

      const innerRadius = 1
      const outerRadius = 3
      const spacing = outerRadius * 2.5
      const rings = []

      for (let x = 0; x < params.rings; x++) {
        for (let y = 0; y < params.rings; y++) {
          const offsetX = (y % 2) * (spacing / 2)
          const ring = rotateX(Math.PI / 2, torus({
            innerRadius,
            outerRadius,
            innerSegments: params.segments,
            outerSegments: params.segments
          }))
          rings.push(translate([x * spacing + offsetX, y * spacing * 0.866, 0], ring))
        }
      }

      return union(rings)
    }
  }
]

/**
 * Format time nicely
 */
const formatTime = (ms) => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Run all benchmarks
 */
const runBenchmarks = () => {
  const mode = HEAVY ? 'heavy' : 'lite'

  console.log('═'.repeat(60))
  console.log(`Quick Benchmark Timing (${mode} mode)`)
  console.log('═'.repeat(60))
  console.log('')

  const results = []
  let totalMs = 0

  for (const bench of BENCHMARKS) {
    const params = bench[mode]
    process.stdout.write(`${bench.name.padEnd(20)}`)

    // Clear require cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('/src/')) delete require.cache[key]
    })

    const start = process.hrtime.bigint()
    try {
      bench.run(params)
      const end = process.hrtime.bigint()
      const ms = Number(end - start) / 1e6
      totalMs += ms
      console.log(formatTime(ms).padStart(12))
      results.push({ name: bench.name, ms, success: true })
    } catch (e) {
      console.log('ERROR'.padStart(12))
      console.log(`  ${e.message}`)
      results.push({ name: bench.name, error: e.message, success: false })
    }
  }

  console.log('─'.repeat(32))
  console.log(`${'TOTAL'.padEnd(20)}${formatTime(totalMs).padStart(12)}`)
  console.log('')

  return { results, totalMs }
}

// Run
runBenchmarks()
