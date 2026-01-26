#!/usr/bin/env node
/**
 * Simple benchmark runner for @jscad/modeling
 *
 * Usage:
 *   npm run bench              # run all benchmarks
 *   npm run bench booleans     # run specific benchmark file
 */

const fs = require('fs')
const path = require('path')

// Benchmark configuration
const WARMUP_RUNS = 2
const BENCHMARK_RUNS = 10

/**
 * Calculate median of an array of numbers
 */
const median = (arr) => {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Run a single benchmark
 */
const runBenchmark = (fn, runs = BENCHMARK_RUNS) => {
  // Warmup
  for (let i = 0; i < WARMUP_RUNS; i++) {
    fn()
  }

  // Force GC if available
  if (global.gc) global.gc()

  // Timed runs
  const times = []
  for (let i = 0; i < runs; i++) {
    const start = process.hrtime.bigint()
    fn()
    const end = process.hrtime.bigint()
    times.push(Number(end - start) / 1e6) // Convert to ms
  }

  return {
    median: median(times),
    min: Math.min(...times),
    max: Math.max(...times),
    runs
  }
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
 * Run a benchmark suite (array of {name, fn} objects)
 */
const runSuite = (name, benchmarks) => {
  console.log(`\n${name}`)
  console.log('─'.repeat(60))

  const results = []
  for (const bench of benchmarks) {
    process.stdout.write(`  ${bench.name.padEnd(40)}`)
    try {
      const result = runBenchmark(bench.fn)
      const opsPerSec = (1000 / result.median).toFixed(1)
      console.log(`${formatTime(result.median).padStart(10)}  (${opsPerSec} ops/sec)`)
      results.push({ name: bench.name, ...result })
    } catch (err) {
      console.log(`  ERROR: ${err.message}`)
      results.push({ name: bench.name, error: err.message })
    }
  }

  return results
}

/**
 * Load and run benchmark files
 */
const main = () => {
  const args = process.argv.slice(2)
  const benchDir = __dirname

  console.log('@jscad/modeling benchmarks')
  console.log(`Runs: ${BENCHMARK_RUNS} (+ ${WARMUP_RUNS} warmup)`)
  if (!global.gc) {
    console.log('Tip: Run with --expose-gc for more accurate results')
  }

  // Find benchmark files
  let benchFiles
  if (args.length > 0) {
    // Run specific benchmarks
    benchFiles = args.map((arg) => {
      const file = arg.endsWith('.bench.js') ? arg : `${arg}.bench.js`
      return path.join(benchDir, file)
    })
  } else {
    // Run all benchmarks
    benchFiles = fs.readdirSync(benchDir)
      .filter((f) => f.endsWith('.bench.js'))
      .map((f) => path.join(benchDir, f))
  }

  // Run each benchmark file
  const allResults = {}
  for (const file of benchFiles) {
    if (!fs.existsSync(file)) {
      console.error(`Benchmark file not found: ${file}`)
      continue
    }

    const suite = require(file)
    if (typeof suite.run === 'function') {
      const results = suite.run(runSuite)
      allResults[path.basename(file)] = results
    } else if (Array.isArray(suite.benchmarks)) {
      const name = suite.name || path.basename(file, '.bench.js')
      const results = runSuite(name, suite.benchmarks)
      allResults[name] = results
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('Benchmark complete')
}

// Export for programmatic use
module.exports = { runBenchmark, runSuite, median, formatTime }

// Run if called directly
if (require.main === module) {
  main()
}
