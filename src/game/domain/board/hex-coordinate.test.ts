import { describe, expect, it } from 'vitest'
import {
  areHexesAdjacent,
  createHexCoordinate,
  getHexDistance,
  getHexNeighbor,
  getHexNeighbors,
  getOppositeHexDirection,
  HEX_DIRECTIONS,
  hexCoordinateKey,
  hexCoordinatesEqual,
  isHexDirection,
  isValidHexCoordinate,
  tryGetHexNeighbor,
  type HexCoordinate,
} from './hex-coordinate'

const ORIGIN: HexCoordinate = { q: 0, r: 0 }

describe('hex neighbours', () => {
  it('produces six unique neighbours', () => {
    const keys = getHexNeighbors(ORIGIN).map(hexCoordinateKey)
    expect(new Set(keys).size).toBe(6)
  })

  it('returns to the original hex when moving in the opposite direction', () => {
    for (const direction of HEX_DIRECTIONS) {
      const moved = getHexNeighbor(ORIGIN, direction)
      const returned = getHexNeighbor(moved, getOppositeHexDirection(direction))
      expect(hexCoordinatesEqual(returned, ORIGIN)).toBe(true)
    }
  })

  it('places every neighbour at distance 1', () => {
    for (const neighbour of getHexNeighbors(ORIGIN)) {
      expect(getHexDistance(ORIGIN, neighbour)).toBe(1)
      expect(areHexesAdjacent(ORIGIN, neighbour)).toBe(true)
    }
  })

  it('does not report distant hexes as adjacent', () => {
    expect(areHexesAdjacent(ORIGIN, { q: 2, r: 0 })).toBe(false)
    expect(areHexesAdjacent(ORIGIN, ORIGIN)).toBe(false)
  })
})

describe('getHexDistance', () => {
  it('is zero from a hex to itself', () => {
    expect(getHexDistance(ORIGIN, ORIGIN)).toBe(0)
    expect(getHexDistance({ q: -4, r: 7 }, { q: -4, r: 7 })).toBe(0)
  })

  it('is symmetric', () => {
    const a: HexCoordinate = { q: 2, r: -3 }
    const b: HexCoordinate = { q: -1, r: 4 }
    expect(getHexDistance(a, b)).toBe(getHexDistance(b, a))
  })

  it('matches known examples', () => {
    expect(getHexDistance(ORIGIN, { q: 3, r: -1 })).toBe(3)
    expect(getHexDistance(ORIGIN, { q: 0, r: 2 })).toBe(2)
    expect(getHexDistance(ORIGIN, { q: -2, r: -1 })).toBe(3)
    expect(getHexDistance({ q: 1, r: 1 }, { q: -1, r: 2 })).toBe(2)
  })
})

describe('hexCoordinateKey', () => {
  it('is stable and distinguishes coordinates', () => {
    expect(hexCoordinateKey({ q: 2, r: -3 })).toBe(hexCoordinateKey({ q: 2, r: -3 }))
    expect(hexCoordinateKey({ q: 2, r: -3 })).not.toBe(hexCoordinateKey({ q: -3, r: 2 }))
  })
})

describe('createHexCoordinate', () => {
  it('accepts finite integers', () => {
    const result = createHexCoordinate(2, -3)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toEqual({ q: 2, r: -3 })
  })

  it.each([
    ['fractional q', 1.5, 0],
    ['fractional r', 0, 1.5],
    ['non-finite q', Number.POSITIVE_INFINITY, 0],
    ['non-finite r', 0, Number.NaN],
  ])('rejects %s', (_label, q, r) => {
    const result = createHexCoordinate(q, r)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.some((error) => error.code === 'INVALID_HEX_COORDINATE')).toBe(true)
  })
})

describe('isValidHexCoordinate', () => {
  it('distinguishes integer from non-integer coordinates', () => {
    expect(isValidHexCoordinate({ q: 0, r: 0 })).toBe(true)
    expect(isValidHexCoordinate({ q: 0.5, r: 0 })).toBe(false)
    expect(isValidHexCoordinate({ q: 0, r: Number.NaN })).toBe(false)
  })
})

describe('direction validation', () => {
  it('accepts only integers 0-5', () => {
    expect(isHexDirection(0)).toBe(true)
    expect(isHexDirection(5)).toBe(true)
    expect(isHexDirection(6)).toBe(false)
    expect(isHexDirection(-1)).toBe(false)
    expect(isHexDirection(1.5)).toBe(false)
  })

  it('rejects an out-of-range direction at runtime', () => {
    const result = tryGetHexNeighbor(ORIGIN, 7)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.some((error) => error.code === 'INVALID_HEX_DIRECTION')).toBe(true)
  })

  it('resolves a valid runtime direction', () => {
    const result = tryGetHexNeighbor(ORIGIN, 0)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toEqual({ q: 1, r: 0 })
  })
})
