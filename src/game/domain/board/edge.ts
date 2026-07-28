import type { Brand } from '../types/brand'
import type { DomainResult } from '../types/result'
import type { HexCoordinate } from './hex-coordinate'
import { areVerticesConnected, getHexVertices, type VertexId } from './vertex'

const EDGE_SEPARATOR = '|'

/**
 * Canonical identifier for a physical board edge: the two endpoint
 * `VertexId`s joined in lexicographic order, so `(a, b)` and `(b, a)` produce
 * the identical string and equality is plain `===`.
 */
export type EdgeId = Brand<string, 'EdgeId'>

export type HexEdges = readonly [EdgeId, EdgeId, EdgeId, EdgeId, EdgeId, EdgeId]

/** Endpoints must already be known-distinct and connected. */
function canonicalEdgeId(a: VertexId, b: VertexId): EdgeId {
  return (a < b ? `${a}${EDGE_SEPARATOR}${b}` : `${b}${EDGE_SEPARATOR}${a}`) as EdgeId
}

export function createEdgeId(a: VertexId, b: VertexId): DomainResult<EdgeId> {
  if (a === b) {
    return {
      success: false,
      errors: [
        {
          code: 'DEGENERATE_EDGE',
          message: 'An edge must have two distinct endpoints.',
          field: 'endpoints',
        },
      ],
    }
  }
  if (!areVerticesConnected(a, b)) {
    return {
      success: false,
      errors: [
        {
          code: 'VERTICES_NOT_CONNECTED',
          message: 'The two corners are not joined by a board edge.',
          field: 'endpoints',
        },
      ],
    }
  }
  return { success: true, value: canonicalEdgeId(a, b) }
}

export function edgeIdKey(edgeId: EdgeId): string {
  return edgeId
}

export function getEdgeVertices(edgeId: EdgeId): readonly [VertexId, VertexId] {
  // Safe: an EdgeId can only be produced by the canonical constructors above,
  // which always emit exactly two separator-joined VertexId keys.
  const [a, b] = edgeId.split(EDGE_SEPARATOR) as [VertexId, VertexId]
  return [a, b]
}

/** Edges of a hex, clockwise; edge `i` joins corner `i` to corner `i + 1`. */
export function getHexEdges(hex: HexCoordinate): HexEdges {
  const [v0, v1, v2, v3, v4, v5] = getHexVertices(hex)
  return [
    canonicalEdgeId(v0, v1),
    canonicalEdgeId(v1, v2),
    canonicalEdgeId(v2, v3),
    canonicalEdgeId(v3, v4),
    canonicalEdgeId(v4, v5),
    canonicalEdgeId(v5, v0),
  ]
}

export function doEdgesShareVertex(a: EdgeId, b: EdgeId): boolean {
  if (a === b) {
    return false
  }
  const [a0, a1] = getEdgeVertices(a)
  const [b0, b1] = getEdgeVertices(b)
  return a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1
}

export function edgeHasVertex(edgeId: EdgeId, vertexId: VertexId): boolean {
  const [a, b] = getEdgeVertices(edgeId)
  return a === vertexId || b === vertexId
}
