import test from 'ava'

import { comparePolygonsAsPoints } from '../../../test/helpers/index.js'

import { TAU } from '../../maths/constants.js'

import { geom2, geom3, path2 } from '../../geometries/index.js'

import { extrudeLinear } from './index.js'

test('extrudeLinear (defaults)', (t) => {
  const geometry2 = geom2.fromPoints([[5, -5], [5, 5], [-5, 5], [-5, -5]])

  const geometry3 = extrudeLinear({ }, geometry2)
  const pts = geom3.toPoints(geometry3)
  const exp = [
    [[5, -5, 0], [5, 5, 0], [5, 5, 1]],
    [[5, -5, 0], [5, 5, 1], [5, -5, 1]],
    [[5, 5, 0], [-5, 5, 0], [-5, 5, 1]],
    [[5, 5, 0], [-5, 5, 1], [5, 5, 1]],
    [[-5, 5, 0], [-5, -5, 0], [-5, -5, 1]],
    [[-5, 5, 0], [-5, -5, 1], [-5, 5, 1]],
    [[-5, -5, 0], [5, -5, 0], [5, -5, 1]],
    [[-5, -5, 0], [5, -5, 1], [-5, -5, 1]],
    [[-5, -5, 1], [5, -5, 1], [5, 5, 1]],
    [[5, 5, 1], [-5, 5, 1], [-5, -5, 1]],
    [[5, 5, 0], [5, -5, 0], [-5, -5, 0]],
    [[-5, -5, 0], [-5, 5, 0], [5, 5, 0]]
  ]
  t.notThrows(() => geom3.validate(geometry3))
  t.is(pts.length, 12)
  t.true(comparePolygonsAsPoints(pts, exp))
})

test('extrudeLinear (no twist)', (t) => {
  const geometry2 = geom2.fromPoints([[5, -5], [5, 5], [-5, 5], [-5, -5]])

  let geometry3 = extrudeLinear({ height: 15 }, geometry2)
  let pts = geom3.toPoints(geometry3)
  let exp = [
    [[5, -5, 0], [5, 5, 0], [5, 5, 15]],
    [[5, -5, 0], [5, 5, 15], [5, -5, 15]],
    [[5, 5, 0], [-5, 5, 0], [-5, 5, 15]],
    [[5, 5, 0], [-5, 5, 15], [5, 5, 15]],
    [[-5, 5, 0], [-5, -5, 0], [-5, -5, 15]],
    [[-5, 5, 0], [-5, -5, 15], [-5, 5, 15]],
    [[-5, -5, 0], [5, -5, 0], [5, -5, 15]],
    [[-5, -5, 0], [5, -5, 15], [-5, -5, 15]],
    [[-5, -5, 15], [5, -5, 15], [5, 5, 15]],
    [[5, 5, 15], [-5, 5, 15], [-5, -5, 15]],
    [[5, 5, 0], [5, -5, 0], [-5, -5, 0]],
    [[-5, -5, 0], [-5, 5, 0], [5, 5, 0]]
  ]
  t.notThrows(() => geom3.validate(geometry3))
  t.is(pts.length, 12)
  t.true(comparePolygonsAsPoints(pts, exp))

  geometry3 = extrudeLinear({ height: -15 }, geometry2)
  pts = geom3.toPoints(geometry3)
  exp = [
    [[5, 5, 0], [5, -5, 0], [5, -5, -15]],
    [[5, 5, 0], [5, -5, -15], [5, 5, -15]],
    [[-5, 5, 0], [5, 5, 0], [5, 5, -15]],
    [[-5, 5, 0], [5, 5, -15], [-5, 5, -15]],
    [[-5, -5, 0], [-5, 5, 0], [-5, 5, -15]],
    [[-5, -5, 0], [-5, 5, -15], [-5, -5, -15]],
    [[5, -5, 0], [-5, -5, 0], [-5, -5, -15]],
    [[5, -5, 0], [-5, -5, -15], [5, -5, -15]],
    [[-5, 5, -15], [5, 5, -15], [5, -5, -15]],
    [[5, -5, -15], [-5, -5, -15], [-5, 5, -15]],
    [[5, -5, 0], [5, 5, 0], [-5, 5, 0]],
    [[-5, 5, 0], [-5, -5, 0], [5, -5, 0]]
  ]
  t.notThrows(() => geom3.validate(geometry3))
  t.is(pts.length, 12)
  t.true(comparePolygonsAsPoints(pts, exp))
})

test('extrudeLinear (twist)', (t) => {
  const geometry2 = geom2.fromPoints([[5, -5], [5, 5], [-5, 5], [-5, -5]])

  let geometry3 = extrudeLinear({ height: 15, twistAngle: -TAU / 8 }, geometry2)
  let pts = geom3.toPoints(geometry3)
  let exp = [
    [[5, -5, 0], [5, 5, 0], [7.0710678118654755, 4.440892098500626e-16, 15]],
    [[5, -5, 0], [7.0710678118654755, 4.440892098500626e-16, 15], [4.440892098500626e-16, -7.0710678118654755, 15]],
    [[5, 5, 0], [-5, 5, 0], [-4.440892098500626e-16, 7.0710678118654755, 15]],
    [[5, 5, 0], [-4.440892098500626e-16, 7.0710678118654755, 15], [7.0710678118654755, 4.440892098500626e-16, 15]],
    [[-5, 5, 0], [-5, -5, 0], [-7.0710678118654755, -4.440892098500626e-16, 15]],
    [[-5, 5, 0], [-7.0710678118654755, -4.440892098500626e-16, 15], [-4.440892098500626e-16, 7.0710678118654755, 15]],
    [[-5, -5, 0], [5, -5, 0], [4.440892098500626e-16, -7.0710678118654755, 15]],
    [[-5, -5, 0], [4.440892098500626e-16, -7.0710678118654755, 15], [-7.0710678118654755, -4.440892098500626e-16, 15]],
    [
      [-7.0710678118654755, -4.440892098500626e-16, 15],
      [4.440892098500626e-16, -7.0710678118654755, 15],
      [7.0710678118654755, 4.440892098500626e-16, 15]
    ],
    [
      [7.0710678118654755, 4.440892098500626e-16, 15],
      [-4.440892098500626e-16, 7.0710678118654755, 15],
      [-7.0710678118654755, -4.440892098500626e-16, 15]
    ],
    [[5, 5, 0], [5, -5, 0], [-5, -5, 0]],
    [[-5, -5, 0], [-5, 5, 0], [5, 5, 0]]
  ]
  t.notThrows(() => geom3.validate(geometry3))
  t.is(pts.length, 12)
  t.true(comparePolygonsAsPoints(pts, exp))

  geometry3 = extrudeLinear({ height: 15, twistAngle: TAU / 4, twistSteps: 3 }, geometry2)
  pts = geom3.toPoints(geometry3)
  exp = [
    [[5, -5, 0], [5, 5, 0], [1.830127018922194, 6.830127018922193, 5]],
    [[5, -5, 0], [1.830127018922194, 6.830127018922193, 5], [6.830127018922193, -1.830127018922194, 5]],
    [[5, 5, 0], [-5, 5, 0], [-6.830127018922193, 1.830127018922194, 5]],
    [[5, 5, 0], [-6.830127018922193, 1.830127018922194, 5], [1.830127018922194, 6.830127018922193, 5]],
    [[-5, 5, 0], [-5, -5, 0], [-1.830127018922194, -6.830127018922193, 5]],
    [[-5, 5, 0], [-1.830127018922194, -6.830127018922193, 5], [-6.830127018922193, 1.830127018922194, 5]],
    [[-5, -5, 0], [5, -5, 0], [6.830127018922193, -1.830127018922194, 5]],
    [[-5, -5, 0], [6.830127018922193, -1.830127018922194, 5], [-1.830127018922194, -6.830127018922193, 5]],
    [[6.830127018922193, -1.830127018922194, 5], [1.830127018922194, 6.830127018922193, 5], [-1.8301270189221923, 6.830127018922193, 10]],
    [[6.830127018922193, -1.830127018922194, 5], [-1.8301270189221923, 6.830127018922193, 10], [6.830127018922193, 1.8301270189221923, 10]],
    [[1.830127018922194, 6.830127018922193, 5], [-6.830127018922193, 1.830127018922194, 5], [-6.830127018922193, -1.8301270189221923, 10]],
    [[1.830127018922194, 6.830127018922193, 5], [-6.830127018922193, -1.8301270189221923, 10], [-1.8301270189221923, 6.830127018922193, 10]],
    [[-6.830127018922193, 1.830127018922194, 5], [-1.830127018922194, -6.830127018922193, 5], [1.8301270189221923, -6.830127018922193, 10]],
    [[-6.830127018922193, 1.830127018922194, 5], [1.8301270189221923, -6.830127018922193, 10], [-6.830127018922193, -1.8301270189221923, 10]],
    [[-1.830127018922194, -6.830127018922193, 5], [6.830127018922193, -1.830127018922194, 5], [6.830127018922193, 1.8301270189221923, 10]],
    [[-1.830127018922194, -6.830127018922193, 5], [6.830127018922193, 1.8301270189221923, 10], [1.8301270189221923, -6.830127018922193, 10]],
    [[6.830127018922193, 1.8301270189221923, 10], [-1.8301270189221923, 6.830127018922193, 10], [-5, 5, 15]],
    [[6.830127018922193, 1.8301270189221923, 10], [-5, 5, 15], [5, 5, 15]],
    [[-1.8301270189221923, 6.830127018922193, 10], [-6.830127018922193, -1.8301270189221923, 10], [-5, -5, 15]],
    [[-1.8301270189221923, 6.830127018922193, 10], [-5, -5, 15], [-5, 5, 15]],
    [[-6.830127018922193, -1.8301270189221923, 10], [1.8301270189221923, -6.830127018922193, 10], [5, -5, 15]],
    [[-6.830127018922193, -1.8301270189221923, 10], [5, -5, 15], [-5, -5, 15]],
    [[1.8301270189221923, -6.830127018922193, 10], [6.830127018922193, 1.8301270189221923, 10], [5, 5, 15]],
    [[1.8301270189221923, -6.830127018922193, 10], [5, 5, 15], [5, -5, 15]],
    [[5, -5, 15], [5, 5, 15], [-5, 5, 15]],
    [[-5, 5, 15], [-5, -5, 15], [5, -5, 15]],
    [[5, 5, 0], [5, -5, 0], [-5, -5, 0]],
    [[-5, -5, 0], [-5, 5, 0], [5, 5, 0]]
  ]
  t.is(pts.length, 28)
  t.true(comparePolygonsAsPoints(pts, exp))

  geometry3 = extrudeLinear({ height: 15, twistAngle: TAU / 2, twistSteps: 30 }, geometry2)
  pts = geom3.toPoints(geometry3)
  t.notThrows(() => geom3.validate(geometry3))
  t.is(pts.length, 244)
})

test('extrudeLinear (holes)', (t) => {
  const geometry2 = geom2.create([
    [[-5, 5], [-5, -5], [5, -5], [5, 5]],
    [[-2, -2], [-2, 2], [2, 2], [2, -2]]
  ])
  const geometry3 = extrudeLinear({ height: 15 }, geometry2)
  const pts = geom3.toPoints(geometry3)
  const exp = [
    [[-5, 5, 0], [-5, -5, 0], [-5, -5, 15]],
    [[-5, 5, 0], [-5, -5, 15], [-5, 5, 15]],
    [[-5, -5, 0], [5, -5, 0], [5, -5, 15]],
    [[-5, -5, 0], [5, -5, 15], [-5, -5, 15]],
    [[5, -5, 0], [5, 5, 0], [5, 5, 15]],
    [[5, -5, 0], [5, 5, 15], [5, -5, 15]],
    [[5, 5, 0], [-5, 5, 0], [-5, 5, 15]],
    [[5, 5, 0], [-5, 5, 15], [5, 5, 15]],
    [[-2, -2, 0], [-2, 2, 0], [-2, 2, 15]],
    [[-2, -2, 0], [-2, 2, 15], [-2, -2, 15]],
    [[-2, 2, 0], [2, 2, 0], [2, 2, 15]],
    [[-2, 2, 0], [2, 2, 15], [-2, 2, 15]],
    [[2, 2, 0], [2, -2, 0], [2, -2, 15]],
    [[2, 2, 0], [2, -2, 15], [2, 2, 15]],
    [[2, -2, 0], [-2, -2, 0], [-2, -2, 15]],
    [[2, -2, 0], [-2, -2, 15], [2, -2, 15]],
    [[5, -5, 15], [5, 5, 15], [2, 2, 15]],
    [[-2, 2, 15], [2, 2, 15], [5, 5, 15]],
    [[5, -5, 15], [2, 2, 15], [2, -2, 15]],
    [[-2, 2, 15], [5, 5, 15], [-5, 5, 15]],
    [[-5, -5, 15], [5, -5, 15], [2, -2, 15]],
    [[-2, -2, 15], [-2, 2, 15], [-5, 5, 15]],
    [[-5, -5, 15], [2, -2, 15], [-2, -2, 15]],
    [[-2, -2, 15], [-5, 5, 15], [-5, -5, 15]],
    [[2, 2, 0], [5, 5, 0], [5, -5, 0]],
    [[5, 5, 0], [2, 2, 0], [-2, 2, 0]],
    [[2, -2, 0], [2, 2, 0], [5, -5, 0]],
    [[-5, 5, 0], [5, 5, 0], [-2, 2, 0]],
    [[2, -2, 0], [5, -5, 0], [-5, -5, 0]],
    [[-5, 5, 0], [-2, 2, 0], [-2, -2, 0]],
    [[-2, -2, 0], [2, -2, 0], [-5, -5, 0]],
    [[-5, -5, 0], [-5, 5, 0], [-2, -2, 0]]
  ]
  t.notThrows(() => geom3.validate(geometry3))
  t.is(pts.length, 32)
  t.true(comparePolygonsAsPoints(pts, exp))
})

test('extrudeLinear (path2)', (t) => {
  const geometry2 = path2.fromPoints({ closed: true }, [[6, 10], [0, 0], [12, 0]])
  const geometry3 = extrudeLinear({ height: 15 }, geometry2)
  t.notThrows(() => geom3.validate(geometry3))
  const pts = geom3.toPoints(geometry3)
  const exp = [
    [[6, 10, 0], [0, 0, 0], [0, 0, 15]],
    [[6, 10, 0], [0, 0, 15], [6, 10, 15]],
    [[0, 0, 0], [12, 0, 0], [12, 0, 15]],
    [[0, 0, 0], [12, 0, 15], [0, 0, 15]],
    [[12, 0, 0], [6, 10, 0], [6, 10, 15]],
    [[12, 0, 0], [6, 10, 15], [12, 0, 15]],
    [[12, 0, 15], [6, 10, 15], [0, 0, 15]],
    [[0, 0, 0], [6, 10, 0], [12, 0, 0]]
  ]

  t.is(pts.length, 8)
  t.true(comparePolygonsAsPoints(pts, exp))
})

test('extrudeLinear (unclosed path throws error)', (t) => {
  const geometry2 = path2.fromPoints({ closed: false }, [[0, 0], [12, 0], [6, 10]])
  t.throws(() => extrudeLinear({}, geometry2))
})
