#!/usr/bin/env node
/**
 * Interleaved Branch Comparison Benchmark
 *
 * Compares performance between two git branches by running benchmarks
 * in an interleaved fashion to eliminate systematic bias from thermal
 * throttling, background processes, and other time-varying factors.
 *
 * Usage:
 *   node benchmarks/compare-branches.js <base-ref> <test-ref> [options]
 *
 * Examples:
 *   node benchmarks/compare-branches.js 93d5df5d origin/pr/upstream-perf-polygontree
 *   node benchmarks/compare-branches.js master feature-branch --runs 5
 *
 * Options:
 *   --runs N      Number of interleaved runs per benchmark (default: 10)
 *   --benchmark X Run only benchmark matching X
 *   --verbose     Show individual run times
 */

const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Configuration
const DEFAULT_RUNS = 10
const WARMUP_RUNS = 2

// Parse arguments
const args = process.argv.slice(2)
const flags = {
  runs: DEFAULT_RUNS,
  benchmark: null,
  verbose: false
}

const refs = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--runs' && args[i + 1]) {
    flags.runs = parseInt(args[i + 1], 10)
    i++
  } else if (args[i] === '--benchmark' && args[i + 1]) {
    flags.benchmark = args[i + 1]
    i++
  } else if (args[i] === '--verbose') {
    flags.verbose = true
  } else if (!args[i].startsWith('-')) {
    refs.push(args[i])
  }
}

if (refs.length !== 2) {
  console.error('Usage: node compare-branches.js <base-ref> <test-ref> [--runs N] [--benchmark X] [--verbose]')
  console.error('')
  console.error('Examples:')
  console.error('  node compare-branches.js 93d5df5d origin/pr/upstream-perf-polygontree')
  console.error('  node compare-branches.js master feature-branch --runs 5')
  process.exit(1)
}

const [baseRef, testRef] = refs

// Resolve paths relative to the modeling package root
const modelingRoot = path.resolve(__dirname, '..')
const srcPath = (mod) => path.join(modelingRoot, 'src', mod)

// Heavy benchmarks designed to run 5-30 seconds each
// These stress the boolean operations which are the most performance-critical
const BENCHMARKS = [
  {
    name: 'swiss-cheese-250',
    description: 'Subtract 250 random spheres from a cube (~5-10s)',
    setup: () => {
      const { cube, sphere } = require(srcPath('primitives'))
      const { subtract, union } = require(srcPath('operations/booleans'))
      const { translate } = require(srcPath('operations/transforms'))

      // Seeded random for reproducibility
      let seed = 12345
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }

      const cubeSize = 50
      const holeRadius = 5
      const segments = 16
      const holes = 250

      return () => {
        seed = 12345 // Reset seed each run
        const body = cube({ size: cubeSize })
        const halfSize = cubeSize / 2 + holeRadius * 1.5
        const holeSpheres = []

        for (let i = 0; i < holes; i++) {
          const x = (random() - 0.5) * 2 * halfSize
          const y = (random() - 0.5) * 2 * halfSize
          const z = (random() - 0.5) * 2 * halfSize
          holeSpheres.push(translate([x, y, z], sphere({ radius: holeRadius, segments })))
        }

        return subtract(body, union(holeSpheres))
      }
    }
  },
  {
    name: 'sphere-union-chain-15',
    description: 'Union of 15 overlapping spheres (48 segments) (~5-10s)',
    setup: () => {
      const { sphere } = require(srcPath('primitives'))
      const { union } = require(srcPath('operations/booleans'))
      const { translate } = require(srcPath('operations/transforms'))

      return () => {
        const spheres = []
        for (let i = 0; i < 15; i++) {
          spheres.push(translate([i * 3, 0, 0], sphere({ radius: 5, segments: 48 })))
        }
        return union(spheres)
      }
    }
  },
  {
    name: 'torus-subtract-torus-64',
    description: 'Subtract two high-res tori (64 segments) (~5-10s)',
    setup: () => {
      const { torus } = require(srcPath('primitives'))
      const { subtract } = require(srcPath('operations/booleans'))
      const { translate } = require(srcPath('operations/transforms'))

      return () => {
        const t1 = torus({ innerRadius: 2, outerRadius: 8, innerSegments: 64, outerSegments: 64 })
        const t2 = translate([3, 0, 0], torus({ innerRadius: 2, outerRadius: 8, innerSegments: 64, outerSegments: 64 }))
        return subtract(t1, t2)
      }
    }
  },
  {
    name: 'menger-sponge-depth4',
    description: 'Menger sponge via intersection (depth 4) (~10-30s)',
    setup: () => {
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

      return () => {
        const size = 60
        const depth = 4
        const carpet = sierpinskiCarpet(size, depth)
        const height = size * 2
        const extruded = extrudeLinear({ height }, carpet)
        const centered = translate([0, 0, -height / 2], extruded)

        return intersect(
          centered,
          rotateY(Math.PI / 2, centered),
          rotateX(Math.PI / 2, centered)
        )
      }
    }
  },
  {
    name: 'cylinder-grid-subtract-6x6',
    description: 'Subtract 36 cylinders from a plate (48 segments) (~5-10s)',
    setup: () => {
      const { cuboid, cylinder } = require(srcPath('primitives'))
      const { subtract } = require(srcPath('operations/booleans'))
      const { translate } = require(srcPath('operations/transforms'))

      return () => {
        const plate = cuboid({ size: [120, 120, 10] })
        const holes = []
        const spacing = 18
        const offset = -45

        for (let x = 0; x < 6; x++) {
          for (let y = 0; y < 6; y++) {
            holes.push(translate(
              [offset + x * spacing, offset + y * spacing, 0],
              cylinder({ radius: 4, height: 15, segments: 48 })
            ))
          }
        }

        return subtract(plate, ...holes)
      }
    }
  }
]

/**
 * Calculate median of an array
 */
const median = (arr) => {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Format time nicely
 */
const formatTime = (ms) => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Format percentage change
 */
const formatChange = (base, test) => {
  const pct = ((test - base) / base) * 100
  const sign = pct > 0 ? '+' : ''
  const color = pct < -5 ? '\x1b[32m' : pct > 5 ? '\x1b[31m' : ''
  const reset = color ? '\x1b[0m' : ''
  return `${color}${sign}${pct.toFixed(1)}%${reset}`
}

/**
 * Run a single timed execution
 */
const timeOnce = (fn) => {
  const start = process.hrtime.bigint()
  fn()
  const end = process.hrtime.bigint()
  return Number(end - start) / 1e6 // ms
}

/**
 * Checkout a git ref and clear require cache
 */
const checkoutRef = (ref) => {
  execSync(`git checkout -f -q ${ref}`, { stdio: 'pipe' })
  // Clear require cache for src modules
  Object.keys(require.cache).forEach(key => {
    if (key.includes('/src/')) {
      delete require.cache[key]
    }
  })
}

/**
 * Run interleaved benchmark comparison
 */
const runComparison = () => {
  const modelingDir = path.resolve(__dirname, '..')
  process.chdir(modelingDir)

  // Save current state
  let originalRef
  try {
    originalRef = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
    if (originalRef === 'HEAD') {
      originalRef = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
    }
  } catch (e) {
    originalRef = 'HEAD'
  }

  // Verify refs exist
  try {
    execSync(`git rev-parse ${baseRef}`, { stdio: 'pipe' })
    execSync(`git rev-parse ${testRef}`, { stdio: 'pipe' })
  } catch (e) {
    console.error(`Error: Could not find one of the refs: ${baseRef}, ${testRef}`)
    process.exit(1)
  }

  const baseShort = execSync(`git rev-parse --short ${baseRef}`, { encoding: 'utf-8' }).trim()
  const testShort = execSync(`git rev-parse --short ${testRef}`, { encoding: 'utf-8' }).trim()

  console.log('═'.repeat(70))
  console.log('Interleaved Branch Comparison Benchmark')
  console.log('═'.repeat(70))
  console.log(`Base: ${baseRef} (${baseShort})`)
  console.log(`Test: ${testRef} (${testShort})`)
  console.log(`Runs: ${flags.runs} interleaved iterations per benchmark`)
  console.log('')

  const results = []

  // Filter benchmarks if specified
  let benchmarksToRun = BENCHMARKS
  if (flags.benchmark) {
    benchmarksToRun = BENCHMARKS.filter(b => b.name.includes(flags.benchmark))
    if (benchmarksToRun.length === 0) {
      console.error(`No benchmark matching: ${flags.benchmark}`)
      console.error('Available:', BENCHMARKS.map(b => b.name).join(', '))
      process.exit(1)
    }
  }

  try {
    for (const bench of benchmarksToRun) {
      console.log(`─ ${bench.name}`)
      console.log(`  ${bench.description}`)

      const baseTimes = []
      const testTimes = []

      // Warmup on both branches
      process.stdout.write('  Warming up...')
      checkoutRef(baseRef)
      const baseFn = bench.setup()
      for (let i = 0; i < WARMUP_RUNS; i++) baseFn()

      checkoutRef(testRef)
      const testFn = bench.setup()
      for (let i = 0; i < WARMUP_RUNS; i++) testFn()
      console.log(' done')

      // Interleaved runs
      process.stdout.write(`  Running ${flags.runs} interleaved iterations...`)
      for (let i = 0; i < flags.runs; i++) {
        // Alternate which branch goes first to eliminate ordering bias
        if (i % 2 === 0) {
          checkoutRef(baseRef)
          const fn1 = bench.setup()
          baseTimes.push(timeOnce(fn1))

          checkoutRef(testRef)
          const fn2 = bench.setup()
          testTimes.push(timeOnce(fn2))
        } else {
          checkoutRef(testRef)
          const fn2 = bench.setup()
          testTimes.push(timeOnce(fn2))

          checkoutRef(baseRef)
          const fn1 = bench.setup()
          baseTimes.push(timeOnce(fn1))
        }

        process.stdout.write('.')
      }
      console.log(' done')

      const baseMedian = median(baseTimes)
      const testMedian = median(testTimes)

      if (flags.verbose) {
        console.log(`  Base times: ${baseTimes.map(t => formatTime(t)).join(', ')}`)
        console.log(`  Test times: ${testTimes.map(t => formatTime(t)).join(', ')}`)
      }

      console.log(`  Base median: ${formatTime(baseMedian)} (min: ${formatTime(Math.min(...baseTimes))}, max: ${formatTime(Math.max(...baseTimes))})`)
      console.log(`  Test median: ${formatTime(testMedian)} (min: ${formatTime(Math.min(...testTimes))}, max: ${formatTime(Math.max(...testTimes))})`)
      console.log(`  Change: ${formatChange(baseMedian, testMedian)}`)
      console.log('')

      results.push({
        name: bench.name,
        base: { median: baseMedian, times: baseTimes },
        test: { median: testMedian, times: testTimes },
        change: ((testMedian - baseMedian) / baseMedian) * 100
      })
    }
  } finally {
    // Restore original state
    console.log('Restoring original branch...')
    try {
      execSync(`git checkout -f -q ${originalRef}`, { stdio: 'pipe' })
    } catch (e) {
      console.error('Warning: Could not restore original branch')
    }
  }

  // Summary table
  console.log('═'.repeat(70))
  console.log('SUMMARY')
  console.log('═'.repeat(70))
  console.log('')
  console.log(`${'Benchmark'.padEnd(30)} ${'Base'.padStart(10)} ${'Test'.padStart(10)} ${'Change'.padStart(10)}`)
  console.log('─'.repeat(70))

  for (const r of results) {
    const change = formatChange(r.base.median, r.test.median)
    console.log(`${r.name.padEnd(30)} ${formatTime(r.base.median).padStart(10)} ${formatTime(r.test.median).padStart(10)} ${change.padStart(18)}`)
  }

  console.log('')

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outputFile = path.join(__dirname, 'results', `compare-${baseShort}-vs-${testShort}-${timestamp}.json`)

  if (!fs.existsSync(path.join(__dirname, 'results'))) {
    fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true })
  }

  fs.writeFileSync(outputFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    base: { ref: baseRef, short: baseShort },
    test: { ref: testRef, short: testShort },
    runs: flags.runs,
    results
  }, null, 2))

  console.log(`Results saved to: ${outputFile}`)
}

// Run
runComparison()
