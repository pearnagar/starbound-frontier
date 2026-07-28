import { describe, expect, it } from 'vitest'
import { getEdgeVertices, getHexEdges, type EdgeId } from './edge'
import { getHexDistance, hexCoordinateKey, type HexCoordinate } from './hex-coordinate'
import { latticePointKey } from './lattice'
import { getHexVertices, getVertexPoint, type VertexId } from './vertex'

/** Test-only helper: every hex within `radius` of the origin. */
function hexPatch(radius: number): readonly HexCoordinate[] {
  const hexes: HexCoordinate[] = []
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      const hex: HexCoordinate = { q, r }
      if (getHexDistance({ q: 0, r: 0 }, hex) <= radius) {
        hexes.push(hex)
      }
    }
  }
  return hexes
}

function collectVertices(hexes: readonly HexCoordinate[]): ReadonlySet<VertexId> {
  return new Set(hexes.flatMap((hex) => [...getHexVertices(hex)]))
}

function collectEdges(hexes: readonly HexCoordinate[]): ReadonlySet<EdgeId> {
  return new Set(hexes.flatMap((hex) => [...getHexEdges(hex)]))
}

describe('hexPatch helper', () => {
  it('covers the expected hex counts', () => {
    expect(hexPatch(0)).toHaveLength(1)
    expect(hexPatch(1)).toHaveLength(7)
    expect(hexPatch(2)).toHaveLength(19)
  })

  it('produces unique coordinates', () => {
    const keys = hexPatch(2).map(hexCoordinateKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('structural consistency of a hex cluster', () => {
  it.each([
    [0, 6, 6],
    [1, 24, 30],
    [2, 54, 72],
  ])(
    'radius %i has %i canonical corners and %i canonical edges',
    (radius, expectedVertices, expectedEdges) => {
      const hexes = hexPatch(radius)
      expect(collectVertices(hexes).size).toBe(expectedVertices)
      expect(collectEdges(hexes).size).toBe(expectedEdges)
    },
  )

  it.each([[0], [1], [2]])('satisfies Euler’s formula at radius %i', (radius) => {
    const hexes = hexPatch(radius)
    const vertices = collectVertices(hexes).size
    const edges = collectEdges(hexes).size
    // Faces = each hex plus the single unbounded outer face.
    const faces = hexes.length + 1
    expect(vertices - edges + faces).toBe(2)
  })

  it('maps every corner id to a distinct lattice point', () => {
    const vertices = [...collectVertices(hexPatch(2))]
    const points = vertices.map((vertex) => {
      const point = getVertexPoint(vertex)
      expect(point).toBeDefined()
      return point === undefined ? '' : latticePointKey(point)
    })
    expect(new Set(points).size).toBe(vertices.length)
  })

  it('references only known canonical corners from every edge', () => {
    const hexes = hexPatch(2)
    const vertices = collectVertices(hexes)
    for (const hex of hexes) {
      for (const edge of getHexEdges(hex)) {
        for (const endpoint of getEdgeVertices(edge)) {
          expect(vertices.has(endpoint)).toBe(true)
        }
      }
    }
  })

  it('gives every edge in the cluster exactly two distinct endpoints', () => {
    for (const edge of collectEdges(hexPatch(2))) {
      const [a, b] = getEdgeVertices(edge)
      expect(a).not.toBe(b)
    }
  })
})
