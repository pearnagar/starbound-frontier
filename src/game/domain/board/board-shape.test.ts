import { describe, expect, it } from 'vitest'
import {
  BOARD_ORIGIN,
  createBoardCoordinates,
  createStandardBoardCoordinates,
  getBoardBoundaryCoordinates,
  getHexBoardSize,
  isBoardBoundaryCoordinate,
  STANDARD_BOARD_RADIUS,
} from './board-shape'
import {
  getHexDistance,
  getHexNeighbors,
  hexCoordinateKey,
  hexCoordinatesEqual,
} from './hex-coordinate'

describe('getHexBoardSize', () => {
  it.each([
    [0, 1],
    [1, 7],
    [2, 19],
    [3, 37],
  ])('radius %i holds %i sectors', (radius, expected) => {
    expect(getHexBoardSize(radius)).toBe(expected)
    expect(createBoardCoordinates(radius)).toHaveLength(expected)
  })
})

describe('createStandardBoardCoordinates', () => {
  const coordinates = createStandardBoardCoordinates()

  it('uses radius 3 and holds 37 sectors', () => {
    expect(STANDARD_BOARD_RADIUS).toBe(3)
    expect(coordinates).toHaveLength(37)
  })

  it('includes the origin first', () => {
    expect(coordinates[0]).toEqual(BOARD_ORIGIN)
    expect(coordinates.some((coordinate) => hexCoordinatesEqual(coordinate, BOARD_ORIGIN))).toBe(
      true,
    )
  })

  it('contains only unique coordinates', () => {
    const keys = coordinates.map(hexCoordinateKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps every coordinate within the radius', () => {
    for (const coordinate of coordinates) {
      expect(getHexDistance(BOARD_ORIGIN, coordinate)).toBeLessThanOrEqual(STANDARD_BOARD_RADIUS)
    }
  })

  it('is contiguous', () => {
    const present = new Set(coordinates.map(hexCoordinateKey))
    const visited = new Set<string>([hexCoordinateKey(BOARD_ORIGIN)])
    const queue = [BOARD_ORIGIN]
    while (queue.length > 0) {
      const current = queue.pop()
      if (current === undefined) break
      for (const neighbour of getHexNeighbors(current)) {
        const key = hexCoordinateKey(neighbour)
        if (!present.has(key) || visited.has(key)) continue
        visited.add(key)
        queue.push(neighbour)
      }
    }
    expect(visited.size).toBe(coordinates.length)
  })

  it('is deterministic across calls', () => {
    expect(createStandardBoardCoordinates()).toEqual(coordinates)
  })
})

describe('board boundary', () => {
  const radius = STANDARD_BOARD_RADIUS

  it('has 6r coordinates on the outer ring', () => {
    expect(getBoardBoundaryCoordinates(radius)).toHaveLength(6 * radius)
  })

  it('marks exactly the coordinates at the radius', () => {
    for (const coordinate of createBoardCoordinates(radius)) {
      const onBoundary = getHexDistance(BOARD_ORIGIN, coordinate) === radius
      expect(isBoardBoundaryCoordinate(coordinate, radius)).toBe(onBoundary)
    }
  })

  it('never marks an inner coordinate as boundary', () => {
    const boundary = new Set(getBoardBoundaryCoordinates(radius).map(hexCoordinateKey))
    const inner = createBoardCoordinates(radius).filter(
      (coordinate) => getHexDistance(BOARD_ORIGIN, coordinate) < radius,
    )
    expect(inner).toHaveLength(37 - 6 * radius)
    for (const coordinate of inner) {
      expect(boundary.has(hexCoordinateKey(coordinate))).toBe(false)
      expect(isBoardBoundaryCoordinate(coordinate, radius)).toBe(false)
    }
  })

  it('never includes the origin', () => {
    const boundary = getBoardBoundaryCoordinates(radius)
    expect(boundary.some((coordinate) => hexCoordinatesEqual(coordinate, BOARD_ORIGIN))).toBe(false)
  })
})
