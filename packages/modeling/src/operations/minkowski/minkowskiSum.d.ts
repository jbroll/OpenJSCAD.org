import { Geom3 } from '../../geometries/types'

export default minkowskiSum

declare function minkowskiSum(geometryA: Geom3, geometryB: Geom3): Geom3
declare function minkowskiSum(...geometries: Geom3[]): Geom3
