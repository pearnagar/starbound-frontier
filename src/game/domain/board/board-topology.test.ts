import { describe, expect, it } from 'vitest'
import { listSectors } from './board'
import { generateBoard } from './board-generation'
import {
  createBoardTopology,
  getAdjacentBoardVertexIds,
  getBoardEdgeIdsTouchingVertex,
  getSectorsAdjacentToVertex,
  isBoardEdge,
  isBoardVertex,
} from './board-topology'
import { getEdgeVertices, getHexEdges } from './edge'
import { getHexVertices, type VertexId } from './vertex'

const result = generateBoard(11)
if (!result.success) {
  throw new Error('expected a valid board fixture')
}
const board = result.value
const topology = createBoardTopology(board)

describe('createBoardTopology', () => {
  it('derives the canonical corner and edge counts for a radius-3 board', () => {
    // 6(r+1)² corners and 3(3r² + 5r + 2) edges.
    expect(topology.vertexIds).toHaveLength(96)
    expect(topology.edgeIds).toHaveLength(3 * (27 + 15 + 2))
  })

  it('lists each corner and edge exactly once', () => {
    expect(new Set(topology.vertexIds).size).toBe(topology.vertexIds.length)
    expect(new Set(topology.edgeIds).size).toBe(topology.edgeIds.length)
  })

  it('covers every corner and edge of every sector', () => {
    for (const sector of listSectors(board)) {
      for (const vertexId of getHexVertices(sector.coordinate)) {
        expect(isBoardVertex(topology, vertexId)).toBe(true)
      }
      for (const edgeId of getHexEdges(sector.coordinate)) {
        expect(isBoardEdge(topology, edgeId)).toBe(true)
      }
    }
  })

  it('rejects corners and edges from off the board', () => {
    const [offBoard] = getHexVertices({ q: 99, r: -99 })
    const [offBoardEdge] = getHexEdges({ q: 99, r: -99 })
    expect(isBoardVertex(topology, offBoard)).toBe(false)
    expect(isBoardEdge(topology, offBoardEdge)).toBe(false)
  })

  it('is deterministic for the same board', () => {
    expect(createBoardTopology(board).vertexIds).toEqual(topology.vertexIds)
  })
})

describe('getSectorsAdjacentToVertex', () => {
  it('attaches one to three sectors to every corner', () => {
    for (const vertexId of topology.vertexIds) {
      const sectors = getSectorsAdjacentToVertex(topology, vertexId)
      expect(sectors.length).toBeGreaterThanOrEqual(1)
      expect(sectors.length).toBeLessThanOrEqual(3)
    }
  })

  it('reports three sectors for an interior corner', () => {
    const [interior] = getHexVertices({ q: 0, r: 0 })
    expect(getSectorsAdjacentToVertex(topology, interior)).toHaveLength(3)
  })

  it('returns nothing for a corner off the board', () => {
    const [offBoard] = getHexVertices({ q: 99, r: -99 })
    expect(getSectorsAdjacentToVertex(topology, offBoard)).toEqual([])
  })
})

describe('getAdjacentBoardVertexIds', () => {
  it('gives interior corners three neighbours', () => {
    const [interior] = getHexVertices({ q: 0, r: 0 })
    expect(getAdjacentBoardVertexIds(topology, interior)).toHaveLength(3)
  })

  it('never includes the corner itself and stays on the board', () => {
    for (const vertexId of topology.vertexIds) {
      const neighbours = getAdjacentBoardVertexIds(topology, vertexId)
      expect(neighbours).not.toContain(vertexId)
      for (const neighbour of neighbours) {
        expect(isBoardVertex(topology, neighbour)).toBe(true)
      }
    }
  })

  it('is symmetric', () => {
    for (const vertexId of topology.vertexIds) {
      for (const neighbour of getAdjacentBoardVertexIds(topology, vertexId)) {
        expect(getAdjacentBoardVertexIds(topology, neighbour)).toContain(vertexId)
      }
    }
  })

  it('returns nothing for a malformed corner', () => {
    expect(getAdjacentBoardVertexIds(topology, 'not-a-vertex' as VertexId)).toEqual([])
  })
})

describe('getBoardEdgeIdsTouchingVertex', () => {
  it('gives interior corners three edges', () => {
    const [interior] = getHexVertices({ q: 0, r: 0 })
    expect(getBoardEdgeIdsTouchingVertex(topology, interior)).toHaveLength(3)
  })

  it('only lists edges that actually contain the corner', () => {
    for (const vertexId of topology.vertexIds) {
      for (const edgeId of getBoardEdgeIdsTouchingVertex(topology, vertexId)) {
        expect(getEdgeVertices(edgeId)).toContain(vertexId)
      }
    }
  })

  it('lists every edge exactly twice across all corners', () => {
    const seen = new Map<string, number>()
    for (const vertexId of topology.vertexIds) {
      for (const edgeId of getBoardEdgeIdsTouchingVertex(topology, vertexId)) {
        seen.set(edgeId, (seen.get(edgeId) ?? 0) + 1)
      }
    }
    expect(seen.size).toBe(topology.edgeIds.length)
    for (const count of seen.values()) {
      expect(count).toBe(2)
    }
  })

  it('returns nothing for a corner off the board', () => {
    const [offBoard] = getHexVertices({ q: 99, r: -99 })
    expect(getBoardEdgeIdsTouchingVertex(topology, offBoard)).toEqual([])
  })
})
