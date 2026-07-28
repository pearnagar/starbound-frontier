import { describe, expect, it } from 'vitest'
import { getHexNeighbors, type HexCoordinate } from './hex-coordinate'
import {
  areVerticesConnected,
  getHexVertices,
  getVertexPoint,
  vertexIdKey,
  type VertexId,
} from './vertex'

const ORIGIN: HexCoordinate = { q: 0, r: 0 }

function sharedVertexCount(a: HexCoordinate, b: HexCoordinate): number {
  const vertices = new Set<string>(getHexVertices(a))
  return getHexVertices(b).filter((vertex) => vertices.has(vertex)).length
}

describe('getHexVertices', () => {
  it('returns exactly six unique corners', () => {
    const vertices = getHexVertices(ORIGIN)
    expect(vertices).toHaveLength(6)
    expect(new Set(vertices).size).toBe(6)
  })

  it('is deterministic across calls', () => {
    expect(getHexVertices({ q: 2, r: -1 })).toEqual(getHexVertices({ q: 2, r: -1 }))
  })

  it('produces corners on the zero-sum lattice', () => {
    for (const vertex of getHexVertices({ q: -2, r: 3 })) {
      const point = getVertexPoint(vertex)
      expect(point).toBeDefined()
      if (point === undefined) return
      expect(point.x + point.y + point.z).toBe(0)
    }
  })

  it('round-trips through its serialized key', () => {
    for (const vertex of getHexVertices({ q: 1, r: 1 })) {
      expect(vertexIdKey(vertex)).toBe(vertex)
      expect(getVertexPoint(vertex)).toBeDefined()
    }
  })
})

describe('shared corner identity', () => {
  it('gives adjacent hexes exactly two shared corners', () => {
    for (const neighbour of getHexNeighbors(ORIGIN)) {
      expect(sharedVertexCount(ORIGIN, neighbour)).toBe(2)
    }
  })

  it('gives non-adjacent hexes no shared corners', () => {
    expect(sharedVertexCount(ORIGIN, { q: 2, r: 0 })).toBe(0)
    expect(sharedVertexCount(ORIGIN, { q: -2, r: 1 })).toBe(0)
    expect(sharedVertexCount(ORIGIN, { q: 0, r: 3 })).toBe(0)
  })

  it('derives the identical id from every hex touching a corner', () => {
    const patch = [ORIGIN, ...getHexNeighbors(ORIGIN)]
    for (const vertex of getHexVertices(ORIGIN)) {
      const touching = patch.filter((hex) => getHexVertices(hex).includes(vertex))
      expect(touching).toHaveLength(3)
    }
  })
})

describe('areVerticesConnected', () => {
  it('connects consecutive corners of a hex', () => {
    const [v0, v1, v2, v3, v4, v5] = getHexVertices(ORIGIN)
    const consecutive: readonly (readonly [VertexId, VertexId])[] = [
      [v0, v1],
      [v1, v2],
      [v2, v3],
      [v3, v4],
      [v4, v5],
      [v5, v0],
    ]
    for (const [a, b] of consecutive) {
      expect(areVerticesConnected(a, b)).toBe(true)
      expect(areVerticesConnected(b, a)).toBe(true)
    }
  })

  it('does not connect opposite corners of a hex', () => {
    const [v0, v1, v2, v3, v4, v5] = getHexVertices(ORIGIN)
    expect(areVerticesConnected(v0, v3)).toBe(false)
    expect(areVerticesConnected(v1, v4)).toBe(false)
    expect(areVerticesConnected(v2, v5)).toBe(false)
  })

  it('does not connect a corner to itself', () => {
    const [v0] = getHexVertices(ORIGIN)
    expect(areVerticesConnected(v0, v0)).toBe(false)
  })

  it('gives every corner exactly three connected corners within its neighbourhood', () => {
    const patch = [ORIGIN, ...getHexNeighbors(ORIGIN)]
    const allVertices = new Set(patch.flatMap((hex) => [...getHexVertices(hex)]))
    const [centreVertex] = getHexVertices(ORIGIN)
    const connected = [...allVertices].filter((vertex) =>
      areVerticesConnected(centreVertex, vertex),
    )
    expect(connected).toHaveLength(3)
  })
})
