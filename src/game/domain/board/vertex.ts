import type { Brand } from '../types/brand'
import type { HexCoordinate } from './hex-coordinate'
import {
  addLatticePoints,
  CORNER_OFFSETS,
  hexCentreLatticePoint,
  latticePointKey,
  latticePointsEqual,
  parseLatticePointKey,
  subtractLatticePoints,
  type LatticePoint,
} from './lattice'

/**
 * Canonical identifier for a physical board corner, serialized as the
 * `"x,y,z"` key of its tripled-cube lattice point. Two hexes touching the same
 * corner always derive the identical string, so equality is plain `===`.
 */
export type VertexId = Brand<string, 'VertexId'>

export type HexVertices = readonly [VertexId, VertexId, VertexId, VertexId, VertexId, VertexId]

export function latticePointToVertexId(point: LatticePoint): VertexId {
  return latticePointKey(point) as VertexId
}

export function vertexIdKey(vertexId: VertexId): string {
  return vertexId
}

export function getVertexPoint(vertexId: VertexId): LatticePoint | undefined {
  const point = parseLatticePointKey(vertexId)
  if (point === undefined || point.x + point.y + point.z !== 0) {
    return undefined
  }
  return point
}

/** Corners of a hex, clockwise starting at North. */
export function getHexVertices(hex: HexCoordinate): HexVertices {
  const centre = hexCentreLatticePoint(hex)
  const [o0, o1, o2, o3, o4, o5] = CORNER_OFFSETS
  return [
    latticePointToVertexId(addLatticePoints(centre, o0)),
    latticePointToVertexId(addLatticePoints(centre, o1)),
    latticePointToVertexId(addLatticePoints(centre, o2)),
    latticePointToVertexId(addLatticePoints(centre, o3)),
    latticePointToVertexId(addLatticePoints(centre, o4)),
    latticePointToVertexId(addLatticePoints(centre, o5)),
  ]
}

/**
 * True when an edge of the board connects the two corners.
 *
 * Every real corner sits at a lattice point whose components are congruent to
 * `(1,1,1)` or `(2,2,2)` modulo 3; stepping by a corner offset of the other
 * parity always lands on a hex-centre point, which is never a corner. So a
 * difference matching any corner offset is sufficient — a corner has exactly
 * three neighbours, not six.
 */
export function areVerticesConnected(a: VertexId, b: VertexId): boolean {
  if (a === b) {
    return false
  }
  const pointA = getVertexPoint(a)
  const pointB = getVertexPoint(b)
  if (pointA === undefined || pointB === undefined) {
    return false
  }
  const difference = subtractLatticePoints(pointB, pointA)
  return CORNER_OFFSETS.some((offset) => latticePointsEqual(offset, difference))
}
