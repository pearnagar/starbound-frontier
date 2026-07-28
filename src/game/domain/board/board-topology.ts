import { listSectors, type Board } from './board'
import { getEdgeVertices, getHexEdges, type EdgeId } from './edge'
import { addLatticePoints, CORNER_OFFSETS } from './lattice'
import type { Sector } from './sector'
import { getHexVertices, getVertexPoint, latticePointToVertexId, type VertexId } from './vertex'

/**
 * Derived index of everything a board's sectors imply: which corners and edges
 * exist, and which sectors touch each corner. Built once and passed around, so
 * placement checks stay cheap and never re-walk the board.
 */
export type BoardTopology = Readonly<{
  /** Board corners in deterministic order. */
  vertexIds: readonly VertexId[]
  /** Board edges in deterministic order. */
  edgeIds: readonly EdgeId[]
  vertexIdSet: ReadonlySet<VertexId>
  edgeIdSet: ReadonlySet<EdgeId>
  sectorsByVertexId: ReadonlyMap<VertexId, readonly Sector[]>
  edgeIdsByVertexId: ReadonlyMap<VertexId, readonly EdgeId[]>
}>

export function createBoardTopology(board: Board): BoardTopology {
  const vertexIds: VertexId[] = []
  const vertexIdSet = new Set<VertexId>()
  const edgeIds: EdgeId[] = []
  const edgeIdSet = new Set<EdgeId>()
  const sectorsByVertexId = new Map<VertexId, Sector[]>()
  const edgeIdsByVertexId = new Map<VertexId, EdgeId[]>()

  for (const sector of listSectors(board)) {
    for (const vertexId of getHexVertices(sector.coordinate)) {
      if (!vertexIdSet.has(vertexId)) {
        vertexIdSet.add(vertexId)
        vertexIds.push(vertexId)
      }
      const touching = sectorsByVertexId.get(vertexId)
      if (touching === undefined) {
        sectorsByVertexId.set(vertexId, [sector])
      } else {
        touching.push(sector)
      }
    }

    for (const edgeId of getHexEdges(sector.coordinate)) {
      if (edgeIdSet.has(edgeId)) {
        continue
      }
      edgeIdSet.add(edgeId)
      edgeIds.push(edgeId)
    }
  }

  // Index edges by endpoint only after every edge is known, so both endpoints
  // of a shared edge see it exactly once.
  for (const edgeId of edgeIds) {
    for (const vertexId of getEdgeVertices(edgeId)) {
      if (!vertexIdSet.has(vertexId)) {
        continue
      }
      const touching = edgeIdsByVertexId.get(vertexId)
      if (touching === undefined) {
        edgeIdsByVertexId.set(vertexId, [edgeId])
      } else {
        touching.push(edgeId)
      }
    }
  }

  return { vertexIds, edgeIds, vertexIdSet, edgeIdSet, sectorsByVertexId, edgeIdsByVertexId }
}

export function isBoardVertex(topology: BoardTopology, vertexId: VertexId): boolean {
  return topology.vertexIdSet.has(vertexId)
}

export function isBoardEdge(topology: BoardTopology, edgeId: EdgeId): boolean {
  return topology.edgeIdSet.has(edgeId)
}

/** Corners joined to this one by a board edge. */
export function getAdjacentBoardVertexIds(
  topology: BoardTopology,
  vertexId: VertexId,
): readonly VertexId[] {
  const point = getVertexPoint(vertexId)
  if (point === undefined) {
    return []
  }
  return CORNER_OFFSETS.map((offset) =>
    latticePointToVertexId(addLatticePoints(point, offset)),
  ).filter((candidate) => topology.vertexIdSet.has(candidate))
}

export function getBoardEdgeIdsTouchingVertex(
  topology: BoardTopology,
  vertexId: VertexId,
): readonly EdgeId[] {
  return topology.edgeIdsByVertexId.get(vertexId) ?? []
}

/** Sectors whose corner this is — one, two, or three of them. */
export function getSectorsAdjacentToVertex(
  topology: BoardTopology,
  vertexId: VertexId,
): readonly Sector[] {
  return topology.sectorsByVertexId.get(vertexId) ?? []
}
