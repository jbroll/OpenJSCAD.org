/**
 * Benchmarks for utils/flatten, which every operation calls on its arguments
 *
 * Run with: node bench/flatten.bench.js
 */

const flatten = require('../src/utils/flatten')
const { cuboid } = require('../src/primitives')
const { translate } = require('../src/operations/transforms')
const { colorize } = require('../src/colors')

// Simple benchmark runner, reporting the median of several rounds
const benchmark = (name, fn, iterations, rounds = 9) => {
  // Warmup
  for (let i = 0; i < iterations; i++) fn()

  const times = []
  for (let r = 0; r < rounds; r++) {
    const start = process.hrtime.bigint()
    for (let i = 0; i < iterations; i++) fn()
    const end = process.hrtime.bigint()
    times.push(Number(end - start) / iterations)
  }
  times.sort((a, b) => a - b)
  const median = times[Math.floor(rounds / 2)]

  console.log(`${name.padEnd(50)} ${median.toFixed(0).padStart(10)} ns/op  (${iterations} iterations)`)
  return median
}

console.log('='.repeat(80))
console.log('Flatten Benchmarks')
console.log('='.repeat(80))
console.log()

const geometry = () => ({ polygons: [] })

// argument lists as operations receive them
const twoArgs = [geometry(), geometry()] // union(a, b)
const flatList = [Array.from({ length: 1000 }, geometry)] // union(arrayOfParts)
const nested = [Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => [geometry(), geometry(), geometry()]))]

// the previous implementation, for comparison
const nativeFlat = (arr) => arr.flat(Infinity)

console.log('--- flatten vs Array.prototype.flat(Infinity) ---')
benchmark('flatten: two arguments', () => flatten(twoArgs), 1000000)
benchmark('flat(Infinity): two arguments', () => nativeFlat(twoArgs), 1000000)
benchmark('flatten: list of 1000', () => flatten(flatList), 20000)
benchmark('flat(Infinity): list of 1000', () => nativeFlat(flatList), 20000)
benchmark('flatten: 10 x 10 x 3 nested', () => flatten(nested), 20000)
benchmark('flat(Infinity): 10 x 10 x 3 nested', () => nativeFlat(nested), 20000)
console.log()

console.log('--- Operations that flatten their arguments ---')
const cube = cuboid()
let x = 0
benchmark('translate + colorize: cuboid', () => colorize([1, 0, 0], translate([x++, 0, 0], cube)), 200000)
console.log()
