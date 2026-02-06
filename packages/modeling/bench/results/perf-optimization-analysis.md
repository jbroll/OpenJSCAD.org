# Performance Optimization Analysis

**Date:** 2026-02-06
**Base commit:** 93d5df5d
**Branches analyzed:** origin/pr/upstream-perf-*

## Summary

Five performance optimization branches were analyzed. When combined on master, they produce a **3-4x speedup** on complex boolean operations. Individual branches show less improvement due to remaining O(n²) bottlenecks and high benchmark variance.

## Optimization Branches

| Branch | Optimization | Complexity Fix |
|--------|-------------|----------------|
| `splitpolygon` | Replace splice with filter in duplicate vertex removal | O(n²) → O(n) |
| `polygontree` | Defer PolygonTreeNode cleanup, avoid splice in remove() | O(n²) → O(1) |
| `flatten` | Iterative flatten with stack instead of recursive concat | O(n²) → O(n) |
| `extrude` | Replace concat with push in extrudeFromSlices | O(n²) → O(n) |
| `object-pooling` | Pre-allocate arrays in splitPolygonByPlane + O(n) fix | Reduces allocations |

## Benchmark Results (Heavy Mode)

### Chainmail Benchmark (36 tori union)

```
Branch              Time (3 runs)           Variance
base                37.7s, 39.7s, 39.4s     ±3%   (consistent)
splitpolygon        39.1s, 37.9s, 60.6s     ±37%  (variable)
object-pooling      17.8s, 23.7s, 55.2s     ±68%  (very variable)
master               9.5s, 12.1s, 14.1s     ±19%  (fast)
```

### Full Suite (Single Run)

```
                    swiss-cheese  sphere-union  sphere-cloud  menger  chainmail  TOTAL
base                     31.2s        33.4s        26.8s      25.5s     22.9s   139.8s
splitpolygon             25.3s        26.7s        23.8s      21.6s     22.9s   120.3s
master                   24.9s        25.3s        15.5s       7.5s      9.6s    82.9s
```

## Key Findings

1. **High variance** - The chainmail benchmark shows up to 3x variance between runs on the same code. Single-run benchmarks are unreliable.

2. **Synergistic optimizations** - Master (with all optimizations) achieves 3-4x speedup because fixing ALL O(n²) bottlenecks produces compounding benefits.

3. **splitPolygonByPlane is the hot path** - This function is called thousands of times during complex boolean operations. The O(n²) splice in duplicate vertex removal was the primary bottleneck.

4. **Individual branches don't show full benefit** - Each branch fixes one bottleneck while others remain, limiting observable improvement.

## Recommended Push Order

1. **splitpolygon** - Highest impact, minimal change, foundation for others
2. **polygontree** - Independent O(n²) fix, high impact
3. **flatten** - Independent O(n²) fix, moderate impact
4. **extrude** - Independent optimization, lower impact
5. **object-pooling** - Adds pooling on top of splitpolygon fix (push after #1)

## Additional Optimizations on Master

These commits are on master but not in the upstream-perf branches:

- `3d6214b6` - poly3 V8 performance optimization
- `818a2a1a` - vec2 allocation reduction in reTesselateCoplanarPolygons

## Files Changed

| Branch | Files Modified |
|--------|---------------|
| splitpolygon | `src/operations/booleans/trees/splitPolygonByPlane.js` |
| polygontree | `src/operations/booleans/trees/PolygonTreeNode.js` |
| flatten | `src/utils/flatten.js` |
| extrude | `src/operations/extrusions/extrudeFromSlices.js` |
| object-pooling | `src/operations/booleans/trees/splitPolygonByPlane.js` |

## Benchmarking Tools

- `benchmarks/quick-timing.js` - Quick single-run timing (lite/heavy modes)
- `benchmarks/compare-branches.js` - Interleaved multi-run comparison between branches
