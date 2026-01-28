/**
 * Memory impact test for PolygonTreeNode optimization
 *
 * Measures heap usage before and after boolean operations
 */

const { primitives, booleans } = require('../src')
const { sphere, cube } = primitives
const { union, subtract, intersect } = booleans

// Force GC if available
const gc = global.gc || (() => {})

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const measureMemory = (label, fn, iterations = 5) => {
  gc()
  const before = process.memoryUsage()

  const results = []
  for (let i = 0; i < iterations; i++) {
    results.push(fn())
  }

  gc()
  const after = process.memoryUsage()

  const heapDiff = after.heapUsed - before.heapUsed
  const externalDiff = after.external - before.external

  console.log(`${label}:`)
  console.log(`  Heap used: ${formatBytes(before.heapUsed)} -> ${formatBytes(after.heapUsed)} (${heapDiff >= 0 ? '+' : ''}${formatBytes(heapDiff)})`)
  console.log(`  Iterations: ${iterations}, Results retained: ${results.length}`)

  // Return results to prevent GC from collecting them during measurement
  return { heapDiff, results }
}

const runMemoryTests = () => {
  console.log('Memory Impact Test')
  console.log('==================')
  console.log(`Node ${process.version}, GC available: ${!!global.gc}`)
  if (!global.gc) {
    console.log('Run with: node --expose-gc benchmarks/memory-test.js')
  }
  console.log()

  // Test 1: Union of spheres (many polygons clipped)
  console.log('--- Union Operations (high clip count) ---')
  const s32a = sphere({ segments: 32 })
  const s32b = sphere({ segments: 32, center: [0.5, 0, 0] })

  measureMemory('union-sphere-32 x5', () => union(s32a, s32b), 5)
  console.log()

  // Test 2: Larger spheres
  const s64a = sphere({ segments: 64 })
  const s64b = sphere({ segments: 64, center: [0.5, 0, 0] })

  measureMemory('union-sphere-64 x3', () => union(s64a, s64b), 3)
  console.log()

  // Test 3: Subtract (fewer clips)
  console.log('--- Subtract Operations (moderate clip count) ---')
  measureMemory('subtract-sphere-32 x5', () => subtract(s32a, s32b), 5)
  console.log()

  // Test 4: Chain of operations (accumulating dead nodes)
  console.log('--- Chained Operations (accumulating) ---')
  measureMemory('union-chain-10-cubes', () => {
    let result = cube({ size: 2 })
    for (let i = 1; i < 10; i++) {
      result = union(result, cube({ size: 2, center: [i * 1.5, 0, 0] }))
    }
    return result
  }, 3)
  console.log()

  // Test 5: Many small operations
  console.log('--- Many Small Operations ---')
  measureMemory('union-25-cubes-array', () => {
    const cubes = []
    for (let i = 0; i < 25; i++) {
      cubes.push(cube({ size: 1, center: [i * 1.2, 0, 0] }))
    }
    return union(cubes)
  }, 3)
  console.log()

  // Test 6: Measure polygon counts
  console.log('--- Result Polygon Counts ---')
  const unionResult = union(s32a, s32b)
  const subtractResult = subtract(s32a, s32b)
  console.log(`  sphere-32 polygons: ${s32a.polygons.length}`)
  console.log(`  union result polygons: ${unionResult.polygons.length}`)
  console.log(`  subtract result polygons: ${subtractResult.polygons.length}`)
}

runMemoryTests()
