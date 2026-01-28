#!/usr/bin/env node
/**
 * Compare benchmark results between fork and stock @jscad/modeling
 *
 * Usage:
 *   npm run bench:compare                     # run all benchmarks
 *   npm run bench:compare hull                # run benchmarks matching "hull"
 *   npm run bench:compare expand              # run benchmarks matching "expand"
 *   npm run bench:compare --stock @jscad/modeling@2.11.0  # compare against specific version
 *   npm run bench:compare hull --stock @jscad/modeling@2.11.0  # filter + specific version
 */

const { spawnSync, execSync } = require('child_process')

// Re-exec with CPU pinning if not already pinned
if (!process.env.BENCH_PINNED && process.platform === 'linux') {
  try {
    // Check for hybrid CPU architecture (P-cores + E-cores)
    const lscpuOutput = execSync('lscpu -e=MAXMHZ 2>/dev/null || true', { encoding: 'utf8' })
    const uniqueFreqs = new Set(lscpuOutput.trim().split('\n').filter(l => l && !l.includes('MAXMHZ')))
    if (uniqueFreqs.size > 2 || process.env.BENCH_FORCE_PIN) {
      // Pin to fast cores (typically 0-11 on Intel hybrid)
      const taskset = spawnSync('which', ['taskset'], { encoding: 'utf8' })
      if (taskset.status === 0) {
        console.log('Pinning to P-cores (0-11) for consistent performance...')
        const result = spawnSync('taskset', ['-c', '0-11', process.execPath, ...process.argv.slice(1)], {
          stdio: 'inherit',
          env: { ...process.env, BENCH_PINNED: '1' }
        })
        process.exit(result.status)
      }
    }
  } catch (e) {
    // Ignore errors, proceed without pinning
  }
}

const fs = require('fs')
const path = require('path')
const os = require('os')

// Configuration
const WARMUP_RUNS = 3
const SAMPLES = 5

// Parse arguments: [filter] [--stock package]
let BENCHMARK_FILTER = null
let STOCK_PACKAGE = '@jscad/modeling'

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg === '--stock' && process.argv[i + 1]) {
    STOCK_PACKAGE = process.argv[++i]
  } else if (!arg.startsWith('-')) {
    BENCHMARK_FILTER = arg
  }
}

/**
 * Calculate median of an array of numbers
 */
const median = (arr) => {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Run a single timed execution with optional iteration count
 */
const timeOnce = (fn, iterations = 1) => {
  if (global.gc) global.gc()
  const start = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const end = process.hrtime.bigint()
  return Number(end - start) / 1e6 / iterations
}

/**
 * Format time with appropriate unit
 */
const formatTime = (ms) => {
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`
  if (ms < 1000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

/**
 * Install stock package to temp directory and return its path
 */
const installStockPackage = (packageSpec) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscad-bench-'))

  console.log(`Installing ${packageSpec} to temp directory...`)

  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
    name: 'jscad-bench-temp',
    version: '1.0.0',
    private: true
  }))

  const result = spawnSync('npm', ['install', packageSpec, '--no-save'], {
    cwd: tempDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  })

  if (result.status !== 0) {
    console.error(`Failed to install ${packageSpec}:`)
    console.error(result.stderr)
    process.exit(1)
  }

  const stockPath = path.join(tempDir, 'node_modules', '@jscad', 'modeling')
  if (!fs.existsSync(stockPath)) {
    console.error(`Package not found at expected path: ${stockPath}`)
    process.exit(1)
  }

  console.log(`Stock package installed: ${stockPath}`)
  return { tempDir, stockPath }
}

/**
 * Get package version from package.json
 */
const getPackageVersion = (packagePath) => {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8'))
  return pkgJson.version
}

/**
 * Define benchmark operations
 */
const defineBenchmarks = (jscad) => {
  const { primitives, booleans, transforms, extrusions, hulls, expansions, minkowski } = jscad

  return [
    {
      name: 'boolean-subtract-cube-sphere-64',
      fn: () => {
        const cube = primitives.cube({ size: 10 })
        const sphere = primitives.sphere({ radius: 7, segments: 64 })
        return booleans.subtract(cube, sphere)
      },
      iterations: 3
    },
    {
      name: 'boolean-intersect-cube-sphere-64',
      fn: () => {
        const cube = primitives.cube({ size: 15 })
        const sphere = primitives.sphere({ radius: 10, segments: 64 })
        return booleans.intersect(cube, sphere)
      },
      iterations: 2
    },
    {
      name: 'menger-intersection-depth3',
      fn: () => {
        // Build Sierpinski carpet in 2D, extrude, intersect 3 rotated copies
        const sierpinskiCarpet = (size, depth) => {
          if (depth === 0) return primitives.square({ size })
          const s = size / 3
          const parts = []
          for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
              if (x === 0 && y === 0) continue
              parts.push(transforms.translate([x * s, y * s, 0], sierpinskiCarpet(s, depth - 1)))
            }
          }
          return booleans.union(parts)
        }
        const carpet = sierpinskiCarpet(60, 3)
        const extruded = extrusions.extrudeLinear({ height: 120 }, carpet)
        const centered = transforms.translate([0, 0, -60], extruded)
        return booleans.intersect(
          centered,
          transforms.rotateY(Math.PI / 2, centered),
          transforms.rotateX(Math.PI / 2, centered)
        )
      },
      iterations: 1
    },
    {
      name: 'menger-sponge-depth4',
      fn: () => {
        const menger = (size, depth) => {
          if (depth === 0) return primitives.cube({ size })
          const s = size / 3
          const parts = []
          for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
              for (let z = -1; z <= 1; z++) {
                const zeros = (x === 0 ? 1 : 0) + (y === 0 ? 1 : 0) + (z === 0 ? 1 : 0)
                if (zeros <= 1) {
                  parts.push(transforms.translate([x * s, y * s, z * s], menger(s, depth - 1)))
                }
              }
            }
          }
          return booleans.union(parts)
        }
        return menger(60, 4)
      },
      iterations: 1
    },
    {
      name: 'swiss-cheese-200holes',
      fn: () => {
        const seededRandom = (seed) => () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff
          return seed / 0x7fffffff
        }
        const rand = seededRandom(12345)
        const cubeSize = 80
        const holeRadius = 5
        const body = primitives.cube({ size: cubeSize })
        const halfSize = cubeSize / 2 + holeRadius
        const holeSpheres = []
        for (let i = 0; i < 200; i++) {
          holeSpheres.push(transforms.translate(
            [(rand() - 0.5) * 2 * halfSize, (rand() - 0.5) * 2 * halfSize, (rand() - 0.5) * 2 * halfSize],
            primitives.sphere({ radius: holeRadius, segments: 12 })
          ))
        }
        return booleans.subtract(body, booleans.union(holeSpheres))
      },
      iterations: 1
    },
    {
      name: 'chainmail-5x5',
      fn: () => {
        const rows = 5, cols = 5, ringRadius = 5, tubeRadius = 1, segments = 12
        const spacing = ringRadius * 1.5
        const rings = []
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const x = col * spacing
            const y = row * spacing
            const offset = (row % 2) * spacing / 2
            const rotation = (row + col) % 2 === 0 ? 0 : Math.PI / 2
            rings.push(transforms.translate(
              [x + offset, y, 0],
              transforms.rotateX(rotation, primitives.torus({
                innerRadius: ringRadius - tubeRadius,
                outerRadius: ringRadius + tubeRadius,
                innerSegments: segments,
                outerSegments: segments
              }))
            ))
          }
        }
        return booleans.union(rings)
      },
      iterations: 1
    },
    {
      name: 'sphere-cloud-40',
      fn: () => {
        const seededRandom = (seed) => () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff
          return seed / 0x7fffffff
        }
        const rand = seededRandom(42)
        const spheres = []
        for (let i = 0; i < 40; i++) {
          spheres.push(transforms.translate(
            [(rand() - 0.5) * 80, (rand() - 0.5) * 80, (rand() - 0.5) * 80],
            primitives.sphere({ radius: 6, segments: 16 })
          ))
        }
        return booleans.union(spheres)
      },
      iterations: 1
    },
    {
      name: 'HIGH-union-spheres-96',
      fn: () => {
        const a = primitives.sphere({ radius: 10, segments: 96, center: [0, 0, 0] })
        const b = primitives.sphere({ radius: 10, segments: 96, center: [8, 0, 0] })
        return booleans.union(a, b)
      },
      iterations: 1
    },
    {
      name: 'HIGH-mounting-plate-25holes',
      fn: () => {
        let plate = primitives.cuboid({ size: [120, 80, 5] })
        for (let x = 0; x < 5; x++) {
          for (let y = 0; y < 5; y++) {
            const hole = primitives.cylinder({
              radius: 3,
              height: 10,
              segments: 32,
              center: [-48 + x * 24, -32 + y * 16, 0]
            })
            plate = booleans.subtract(plate, hole)
          }
        }
        return plate
      },
      iterations: 1
    },
    {
      name: 'HIGH-sphere-cloud-70',
      fn: () => {
        const seededRandom = (seed) => () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff
          return seed / 0x7fffffff
        }
        const rand = seededRandom(42)
        const spheres = []
        for (let i = 0; i < 70; i++) {
          spheres.push(transforms.translate(
            [(rand() - 0.5) * 80, (rand() - 0.5) * 80, (rand() - 0.5) * 80],
            primitives.sphere({ radius: 6, segments: 16 })
          ))
        }
        return booleans.union(spheres)
      },
      iterations: 1
    },
    // Hull operations - convex hull of multiple 3D shapes
    {
      name: 'hull-spheres-8',
      fn: () => {
        const shapes = []
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2
          const x = Math.cos(angle) * 20
          const y = Math.sin(angle) * 20
          const z = (i % 2) * 15 - 7.5
          shapes.push(primitives.sphere({ radius: 5, segments: 16, center: [x, y, z] }))
        }
        return hulls.hull(shapes)
      },
      iterations: 3
    },
    // Expand 3D - expand a cube with round corners
    {
      name: 'expand-cube-round-seg8',
      fn: () => {
        const cube = primitives.cube({ size: 20 })
        return expansions.expand({ delta: 2, corners: 'round', segments: 8 }, cube)
      },
      iterations: 3
    },
    // Expand 3D - expand a sphere (more faces = shows O(n) scaling)
    {
      name: 'expand-sphere16-round-seg8',
      fn: () => {
        const sphere = primitives.sphere({ radius: 10, segments: 16 })
        return expansions.expand({ delta: 2, corners: 'round', segments: 8 }, sphere)
      },
      iterations: 1
    },
    // Minkowski sum - alternative to expand for convex shapes (only in fork)
    ...(minkowski ? [{
      name: 'minkowski-cube-sphere8',
      fn: () => {
        const cube = primitives.cube({ size: 20 })
        const sphere = primitives.sphere({ radius: 2, segments: 8 })
        return minkowski.minkowskiSum(cube, sphere)
      },
      iterations: 10
    }] : []),
    // ExtrudeRotate - lathe a profile into a vase shape
    {
      name: 'extrudeRotate-vase-seg32',
      fn: () => {
        // Create a vase profile (2D shape)
        const profile = primitives.polygon({
          points: [
            [0, 0], [10, 0], [12, 5], [8, 15], [6, 25], [8, 30], [10, 35], [0, 35]
          ]
        })
        return extrusions.extrudeRotate({ segments: 32 }, profile)
      },
      iterations: 5
    },
    // HullChain - creates a chain of hulls (useful for organic shapes)
    {
      name: 'hullChain-spheres-10',
      fn: () => {
        const shapes = []
        for (let i = 0; i < 10; i++) {
          const t = i / 9
          shapes.push(primitives.sphere({
            radius: 3 + Math.sin(t * Math.PI) * 2,
            segments: 12,
            center: [i * 8, Math.sin(t * Math.PI * 2) * 10, 0]
          }))
        }
        return hulls.hullChain(shapes)
      },
      iterations: 2
    }
  ]
}

/**
 * Run comparison benchmarks
 */
const runComparison = (forkJscad, stockJscad, forkVersion, stockVersion) => {
  let forkBenchmarks = defineBenchmarks(forkJscad)
  let stockBenchmarks = defineBenchmarks(stockJscad)

  // Filter benchmarks if pattern specified
  if (BENCHMARK_FILTER) {
    const pattern = BENCHMARK_FILTER.toLowerCase()
    const filterFn = (b) => b.name.toLowerCase().includes(pattern)
    forkBenchmarks = forkBenchmarks.filter(filterFn)
    stockBenchmarks = stockBenchmarks.filter(filterFn)
    if (forkBenchmarks.length === 0) {
      console.error(`No benchmarks match filter: "${BENCHMARK_FILTER}"`)
      console.log('Available benchmarks:')
      defineBenchmarks(forkJscad).forEach((b) => console.log(`  - ${b.name}`))
      process.exit(1)
    }
  }

  console.log('\n' + '═'.repeat(100))
  console.log('BENCHMARK COMPARISON')
  console.log('═'.repeat(100))
  console.log(`Fork:  @jbroll/jscad-modeling v${forkVersion} (local)`)
  console.log(`Stock: @jscad/modeling v${stockVersion} (npm)`)
  console.log(`Runs: ${WARMUP_RUNS} warmup + ${SAMPLES} samples per benchmark`)
  console.log(`Method: Interleaved; improvement from all runs, variance from samples only`)
  if (!global.gc) {
    console.log('Tip: Run with --expose-gc for more accurate results')
  }
  console.log('─'.repeat(100))

  const header = 'Benchmark'.padEnd(38) +
    'Stock (ms)'.padStart(12) +
    'Fork (ms)'.padStart(12) +
    'Change'.padStart(10) +
    '  StdDev%'.padStart(10) +
    'Status'.padStart(10)
  console.log(header)
  console.log('─'.repeat(100))

  const results = []
  let improvements = 0
  let regressions = 0
  let unchanged = 0

  for (let i = 0; i < forkBenchmarks.length; i++) {
    const forkBench = forkBenchmarks[i]
    // Find matching stock benchmark by name (handles fork-only benchmarks)
    const stockBench = stockBenchmarks.find((b) => b.name === forkBench.name)
    const iterations = forkBench.iterations || 1

    process.stdout.write(`  ${forkBench.name.padEnd(36)}`)

    // Skip if benchmark only exists in fork (new feature)
    if (!stockBench) {
      console.log('N/A'.padStart(12) + formatTime(timeOnce(forkBench.fn, iterations)).padStart(12) + '   (fork only)')
      results.push({ name: forkBench.name, forkOnly: true })
      continue
    }

    try {
      // All times (warmup + samples) - used for improvement calculation
      const stockAllTimes = []
      const forkAllTimes = []

      // Warmup runs (timed, included in improvement calc)
      for (let w = 0; w < WARMUP_RUNS; w++) {
        stockAllTimes.push(timeOnce(stockBench.fn, iterations))
        forkAllTimes.push(timeOnce(forkBench.fn, iterations))
      }

      // Sample runs (used for both improvement and variance)
      const stockSampleTimes = []
      const forkSampleTimes = []
      for (let s = 0; s < SAMPLES; s++) {
        if (s % 2 === 0) {
          const st = timeOnce(stockBench.fn, iterations)
          const ft = timeOnce(forkBench.fn, iterations)
          stockSampleTimes.push(st)
          forkSampleTimes.push(ft)
          stockAllTimes.push(st)
          forkAllTimes.push(ft)
        } else {
          const ft = timeOnce(forkBench.fn, iterations)
          const st = timeOnce(stockBench.fn, iterations)
          forkSampleTimes.push(ft)
          stockSampleTimes.push(st)
          forkAllTimes.push(ft)
          stockAllTimes.push(st)
        }
      }

      // Variance from samples only (stable runs)
      const stockSampleMedian = median(stockSampleTimes)
      const forkSampleMedian = median(forkSampleTimes)
      const stockStdDev = Math.sqrt(stockSampleTimes.reduce((sum, t) => sum + Math.pow(t - stockSampleMedian, 2), 0) / stockSampleTimes.length)
      const forkStdDev = Math.sqrt(forkSampleTimes.reduce((sum, t) => sum + Math.pow(t - forkSampleMedian, 2), 0) / forkSampleTimes.length)
      const avgCV = ((stockStdDev / stockSampleMedian + forkStdDev / forkSampleMedian) / 2) * 100

      // Improvement from all runs (warmup + samples)
      const stockMedian = median(stockAllTimes)
      const forkMedian = median(forkAllTimes)
      const change = ((forkMedian - stockMedian) / stockMedian) * 100
      const changeStr = (change >= 0 ? '+' : '') + change.toFixed(1) + '%'

      const threshold = Math.max(5, avgCV * 2)

      let status
      if (change < -threshold) {
        status = 'FASTER'
        improvements++
      } else if (change > threshold) {
        status = 'SLOWER'
        regressions++
      } else {
        status = '~same'
        unchanged++
      }

      console.log(
        stockMedian.toFixed(2).padStart(12) +
        forkMedian.toFixed(2).padStart(12) +
        changeStr.padStart(10) +
        `±${avgCV.toFixed(1)}%`.padStart(10) +
        status.padStart(10)
      )

      results.push({
        name: forkBench.name,
        iterations,
        stock: { median: stockMedian, min: Math.min(...stockAllTimes), max: Math.max(...stockAllTimes), stdDev: stockStdDev },
        fork: { median: forkMedian, min: Math.min(...forkAllTimes), max: Math.max(...forkAllTimes), stdDev: forkStdDev },
        change,
        coefficientOfVariation: avgCV,
        status
      })
    } catch (err) {
      console.log('ERROR'.padStart(12) + `  ${err.message}`)
      results.push({ name: forkBench.name, error: err.message })
    }
  }

  console.log('─'.repeat(100))
  console.log(`\nSummary: ${improvements} faster, ${regressions} slower, ${unchanged} unchanged`)
  console.log(`(threshold: 5% or 2× coefficient of variation, whichever is larger)`)

  const validResults = results.filter(r => r.stock && r.fork)
  if (validResults.length > 0) {
    const totalStock = validResults.reduce((sum, r) => sum + r.stock.median, 0)
    const totalFork = validResults.reduce((sum, r) => sum + r.fork.median, 0)
    const overallChange = ((totalFork - totalStock) / totalStock) * 100
    console.log(`Overall: ${overallChange >= 0 ? '+' : ''}${overallChange.toFixed(1)}% total time (${formatTime(totalStock)} stock → ${formatTime(totalFork)} fork)`)
  }

  return results
}

/**
 * Get git info for the current repo
 */
const getGitInfo = () => {
  try {
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    const shortHash = hash.slice(0, 8)
    const dirty = execSync('git status --porcelain', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() !== ''
    return { hash, shortHash, dirty }
  } catch (e) {
    return { hash: 'unknown', shortHash: 'unknown', dirty: true }
  }
}

/**
 * Save results to JSON file and append to NDJSON log
 */
const saveResults = (results, forkVersion, stockVersion) => {
  const outputDir = path.join(__dirname, 'results')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const git = getGitInfo()
  const timestamp = new Date().toISOString()
  const validResults = results.filter(r => r.stock && r.fork)
  const totalStock = validResults.reduce((sum, r) => sum + r.stock.median, 0)
  const totalFork = validResults.reduce((sum, r) => sum + r.fork.median, 0)
  const overallChange = ((totalFork - totalStock) / totalStock) * 100

  const output = {
    timestamp,
    git,
    node: process.version,
    samples: SAMPLES,
    warmup: WARMUP_RUNS,
    fork: { package: '@jbroll/jscad-modeling', version: forkVersion },
    stock: { package: '@jscad/modeling', version: stockVersion },
    summary: {
      totalStock,
      totalFork,
      overallChange,
      faster: results.filter(r => r.status === 'FASTER').length,
      slower: results.filter(r => r.status === 'SLOWER').length,
      unchanged: results.filter(r => r.status === '~same').length
    },
    results
  }

  // Save detailed JSON file
  const fileTimestamp = timestamp.replace(/[:.]/g, '-').slice(0, 19)
  const outputFile = path.join(outputDir, `compare-${fileTimestamp}.json`)
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2))

  // Append to NDJSON log (one line per run)
  const logFile = path.join(outputDir, 'benchmark-log.ndjson')
  const logEntry = {
    timestamp,
    git,
    node: process.version,
    forkVersion,
    stockVersion,
    overallChange: Math.round(overallChange * 10) / 10,
    totalStock: Math.round(totalStock),
    totalFork: Math.round(totalFork),
    faster: output.summary.faster,
    slower: output.summary.slower
  }
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n')

  console.log(`\nResults saved: ${outputFile}`)
  console.log(`Log appended: ${logFile} (git: ${git.shortHash}${git.dirty ? ' dirty' : ''})`)
}

/**
 * Cleanup temp directory
 */
const cleanup = (tempDir) => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

/**
 * Main
 */
const main = () => {
  console.log('JSCAD Modeling Benchmark Comparison')
  console.log('═'.repeat(60))

  const forkPath = path.resolve(__dirname, '..')
  const forkVersion = getPackageVersion(forkPath)
  console.log(`\nFork: @jbroll/jscad-modeling v${forkVersion}`)
  const forkJscad = require(path.join(forkPath, 'src'))

  const { tempDir, stockPath } = installStockPackage(STOCK_PACKAGE)
  const stockVersion = getPackageVersion(stockPath)
  console.log(`Stock: @jscad/modeling v${stockVersion}`)
  const stockJscad = require(stockPath)

  try {
    const results = runComparison(forkJscad, stockJscad, forkVersion, stockVersion)
    saveResults(results, forkVersion, stockVersion)
  } finally {
    console.log('\nCleaning up temp directory...')
    cleanup(tempDir)
  }

  console.log('Done!')
}

main()
