# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@jscad/modeling`, a Constructive Solid Geometry (CSG) library for 2D and 3D geometric modeling. It implements boolean operations (union, intersect, subtract) using BSP trees on meshes. Part of the JSCAD monorepo at `/home/john/pkg/OpenJSCAD.org`.

## Commands

```bash
# Run all tests (AVA framework)
npm test

# Run a single test file
npx ava src/maths/vec2/add.test.js --verbose

# Run tests matching a pattern
npx ava 'src/primitives/*.test.js' --verbose

# Generate coverage report
npm run coverage

# Build browser bundle
npm run build

# TypeScript definition tests
npm run test:tsd

# From monorepo root - run all package tests
npm test

# From monorepo root - lint all packages (StandardX)
npm run lint
```

## Architecture

### Module Organization
- **Namespace-based**: Each directory is a namespace with a barrel `index.js`
- **One function per file**: Each function lives in its own file with matching `.test.js` and `.d.ts`
- **CommonJS exports**: `module.exports = functionName`

### Core Namespaces
- `geometries/` - Data types: geom2 (2D polygons), geom3 (3D meshes), path2, poly2, poly3
- `maths/` - Vector (vec2/3/4), matrix (mat4), plane, line operations
- `primitives/` - Basic shapes: cube, sphere, cylinder, torus, etc.
- `operations/booleans/` - CSG operations: union, intersect, subtract, scission
- `operations/transforms/` - translate, rotate, scale, mirror, align, center
- `operations/extrusions/` - 2D to 3D: extrudeLinear, extrudeRotate, extrudeHelical
- `operations/hulls/` - Convex hull operations
- `measurements/` - Area, volume, bounding box calculations

### Data Structures
```javascript
// geom3 - 3D geometry
{ polygons: [poly3, ...], transforms: mat4 }

// geom2 - 2D geometry
{ sides: [[start, end], ...], transforms: mat4 }

// poly3 - 3D polygon
{ vertices: [[x,y,z], ...] }

// Vectors are plain arrays: [x, y] or [x, y, z]
```

### Function Patterns

**In-place math operations** (vec/mat): First param receives result
```javascript
const add = (out, a, b) => {
  out[0] = a[0] + b[0]
  out[1] = a[1] + b[1]
  return out
}
```

**Options pattern with defaults**:
```javascript
const cube = (options) => {
  const defaults = { center: [0, 0, 0], size: 2 }
  let { center, size } = Object.assign({}, defaults, options)
  if (!isGTE(size, 0)) throw new Error('size must be positive')
  return cuboid({ center, size: [size, size, size] })
}
```

**Validation** via `commonChecks.js`: `isGTE`, `isGT`, `isNumberArray`

## Code Style

ESLint rules enforced (from root package.json):
- `func-style: expression` - Use const arrow functions, not function declarations
- `prefer-arrow-callback` - Arrow functions for callbacks
- `no-var` - Use const/let only
- `arrow-parens: always` - Always use parentheses: `(x) => x`

## Test Conventions

Tests use AVA with helpers from `test/helpers/`:
```javascript
const test = require('ava')
const { compareVectors } = require('../../../test/helpers/index')

test('vec2: add() should return correct values', (t) => {
  const obs = fromValues(0, 0)
  const ret = add(obs, [1, 2], [3, 4])
  t.true(compareVectors(ret, [4, 6]))
})
```

Helpers: `compareVectors`, `comparePoints`, `comparePolygons`, `comparePolygonLists`, `nearlyEqual`

## JSDoc Requirements

Every exported function needs:
```javascript
/**
 * Brief description of what it does.
 *
 * @param {type} name - description
 * @returns {type} description
 * @alias module:modeling/namespace.functionName
 * @example
 * let result = functionName(args)
 */
```

## Adding a New Function

1. Create `src/namespace/functionName.js` with JSDoc and implementation
2. Create `src/namespace/functionName.test.js` with AVA tests
3. Create `src/namespace/functionName.d.ts` for TypeScript
4. Export from `src/namespace/index.js` and `src/namespace/index.d.ts`
