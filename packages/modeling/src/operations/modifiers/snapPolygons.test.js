import test from 'ava'

import { poly3 } from '../../geometries/index.js'

import { snapPolygons } from './snapPolygons.js'

test('snapPolygons: snap of polygons produces expected results', (t) => {
  const polygons = [
    // valid polygons
    poly3.create([[0, 0, 0], [0, 10, 0], [0, 10, 10]]), // OK
    poly3.create([[0, 0, 0], [0, 10, 0], [0, 10, 10], [0, 0, 10]]), // OK
    // invalid polygons
    poly3.create(),
    poly3.create([[0, 0, 0]]),
    poly3.create([[0, 0, 0], [0, 10, 0]]),
    // duplicated vertices
    poly3.create([
      [-24.445112000000115, 19.346837333333426, 46.47572533333356],
      [-24.44446933333345, 19.346837333333426, 46.47508266666689],
      [-23.70540266666678, 18.79864266666676, 39.56448800000019],
      [-23.70540266666678, 18.79864266666676, 39.56448800000019]
    ]), // OK
    poly3.create([
      [-24.445112000000115, 19.346837333333426, 46.47572533333356],
      [-23.70540266666678, 18.79864266666676, 39.56448800000019],
      [-23.70540266666678, 18.79864266666676, 39.56448800000019]
    ]),
    poly3.create([
      [-23.70540266666678, 18.79864266666676, 39.56448800000019],
      [-23.70540266666678, 18.79864266666676, 39.56448800000019]
    ]),
    // duplicate vertices after snap
    poly3.create([
      [-24.445112000000115, 19.346837333333426, 46.47572533333356],
      [-24.44446933333345, 19.346837333333426, 46.47508266666689],
      [-23.70540266666678, 18.79864266666676, 39.56448800000019],
      [-23.70540266666678 - 0.00001234, 18.79864266666676 + 0.000001234, 39.56448800000019 + 0.00001234]
    ]), // OK
    poly3.create([
      [-24.445112000000115, 19.346837333333426, 46.47572533333356],
      [-23.70540266666678 - 0.00001234, 18.79864266666676 + 0.000001234, 39.56448800000019 + 0.00001234],
      [-23.70540266666678, 18.79864266666676, 39.56448800000019],
      [-23.70540266666678 - 0.00001234, 18.79864266666676 + 0.000001234, 39.56448800000019 + 0.00001234]
    ]),
    poly3.create([
      [-23.70540266666678, 18.79864266666676, 39.56448800000019],
      [-23.70540266666678 - 0.00001234, 18.79864266666676 + 0.000001234, 39.56448800000019 + 0.00001234],
      [-23.70540266666678, 18.79864266666676, 39.56448800000019],
      [-23.70540266666678 - 0.00001234, 18.79864266666676 + 0.000001234, 39.56448800000019 + 0.00001234]
    ]),
    // inverted polygon
    poly3.create([
      [20.109133333333336, -4.894033333333335, -1.0001266666666668],
      [20.021120000000003, -5.1802133333333344, -1.0001266666666668],
      [20.020300000000002, -5.182946666666668, -1.0001266666666668],
      [10.097753333333335, -5.182946666666668, -1.0001266666666668],
      [10.287720000000002, -4.894033333333335, -1.0001266666666668]
    ])
  ]

  const results = snapPolygons(0.0001, polygons)
  t.is(results.length, 5)

  const exp3 = poly3.create([
    [-24.4451, 19.3468, 46.4757],
    [-24.4445, 19.3468, 46.475100000000005],
    [-23.7054, 18.7986, 39.5645]
  ])
  t.deepEqual(results[3].vertices, exp3.vertices)
})
