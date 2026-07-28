import { describe, expect, it } from 'vitest'
import {
  createEdgeId,
  doEdgesShareVertex,
  edgeHasVertex,
  edgeIdKey,
  getEdgeVertices,
  getHexEdges,
} from './edge'
import { getHexNeighbors, type HexCoordinate } from './hex-coordinate'
import { getHexVertices } from './vertex'

const ORIGIN: HexCoordinate = { q: 0, r: 0 }

function sharedEdgeCount(a: HexCoordinate, b: HexCoordinate): number {
  const edges = new Set<string>(getHexEdges(a))
  return getHexEdges(b).filter((edge) => edges.has(edge)).length
}

describe('getHexEdges', () => {
  it('returns exactly six unique edges', () => {
    const edges = getHexEdges(ORIGIN)
    expect(edges).toHaveLength(6)
    expect(new Set(edges).size).toBe(6)
  })

  it('gives every edge two distinct endpoints', () => {
    for (const edge of getHexEdges({ q: -1, r: 2 })) {
      const [a, b] = getEdgeVertices(edge)
      expect(a).not.toBe(b)
    }
  })

  it('references only corners belonging to that hex', () => {
    const hex: HexCoordinate = { q: 2, r: -1 }
    const vertices = new Set<string>(getHexVertices(hex))
    for (const edge of getHexEdges(hex)) {
      for (const endpoint of getEdgeVertices(edge)) {
        expect(vertices.has(endpoint)).toBe(true)
      }
    }
  })

  it('joins consecutive edges at exactly one shared corner', () => {
    const edges = getHexEdges(ORIGIN)
    for (let index = 0; index < edges.length; index += 1) {
      const current = edges[index]
      const next = edges[(index + 1) % edges.length]
      if (current === undefined || next === undefined) continue
      expect(doEdgesShareVertex(current, next)).toBe(true)
    }
  })

  it('does not report opposite edges of a hex as touching', () => {
    const [e0, e1, e2, e3, e4, e5] = getHexEdges(ORIGIN)
    expect(doEdgesShareVertex(e0, e3)).toBe(false)
    expect(doEdgesShareVertex(e1, e4)).toBe(false)
    expect(doEdgesShareVertex(e2, e5)).toBe(false)
  })

  it('does not report an edge as sharing a corner with itself', () => {
    const [e0] = getHexEdges(ORIGIN)
    expect(doEdgesShareVertex(e0, e0)).toBe(false)
  })
})

describe('shared edge identity', () => {
  it('gives adjacent hexes exactly one shared edge', () => {
    for (const neighbour of getHexNeighbors(ORIGIN)) {
      expect(sharedEdgeCount(ORIGIN, neighbour)).toBe(1)
    }
  })

  it('gives non-adjacent hexes no shared edge', () => {
    expect(sharedEdgeCount(ORIGIN, { q: 2, r: 0 })).toBe(0)
    expect(sharedEdgeCount(ORIGIN, { q: -1, r: -1 })).toBe(0)
    expect(sharedEdgeCount(ORIGIN, { q: 0, r: 3 })).toBe(0)
  })
})

describe('createEdgeId', () => {
  it('is independent of endpoint order', () => {
    const [v0, v1] = getHexVertices(ORIGIN)
    const forward = createEdgeId(v0, v1)
    const backward = createEdgeId(v1, v0)
    expect(forward.success).toBe(true)
    expect(backward.success).toBe(true)
    if (!forward.success || !backward.success) return
    expect(forward.value).toBe(backward.value)
  })

  it('matches the edge derived from the hex', () => {
    const [v0, v1] = getHexVertices(ORIGIN)
    const [e0] = getHexEdges(ORIGIN)
    const result = createEdgeId(v1, v0)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toBe(e0)
  })

  it('rejects identical endpoints', () => {
    const [v0] = getHexVertices(ORIGIN)
    const result = createEdgeId(v0, v0)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.some((error) => error.code === 'DEGENERATE_EDGE')).toBe(true)
  })

  it('rejects corners that no edge joins', () => {
    const [v0, , , v3] = getHexVertices(ORIGIN)
    const result = createEdgeId(v0, v3)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.some((error) => error.code === 'VERTICES_NOT_CONNECTED')).toBe(true)
  })
})

describe('edge helpers', () => {
  it('exposes a stable serialized key', () => {
    const [e0] = getHexEdges(ORIGIN)
    expect(edgeIdKey(e0)).toBe(e0)
  })

  it('reports membership of its own endpoints only', () => {
    const [e0] = getHexEdges(ORIGIN)
    const [a, b] = getEdgeVertices(e0)
    const [, , v2] = getHexVertices(ORIGIN)
    expect(edgeHasVertex(e0, a)).toBe(true)
    expect(edgeHasVertex(e0, b)).toBe(true)
    expect(edgeHasVertex(e0, v2)).toBe(false)
  })
})
