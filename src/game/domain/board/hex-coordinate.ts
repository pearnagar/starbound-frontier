import type { DomainResult } from '../types/result'

/**
 * Axial hex coordinate. `q` and `r` must be finite integers.
 *
 * The implied cube coordinate is `(x, y, z) = (q, -q - r, r)`.
 */
export type HexCoordinate = Readonly<{
  q: number
  r: number
}>

/**
 * Direction indices for a pointy-top hex, ordered **clockwise** starting at
 * East, using screen conventions (+x right, +y down, so increasing `r` moves
 * down-left and `-r` moves up-right):
 *
 * | Index | Direction | Axial offset |
 * | ----- | --------- | ------------ |
 * | 0     | East      | (+1,  0)     |
 * | 1     | Southeast | ( 0, +1)     |
 * | 2     | Southwest | (-1, +1)     |
 * | 3     | West      | (-1,  0)     |
 * | 4     | Northwest | ( 0, -1)     |
 * | 5     | Northeast | (+1, -1)     |
 *
 * Directions `d` and `(d + 3) % 6` are always opposites.
 */
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5

export const HEX_DIRECTIONS: readonly [
  HexDirection,
  HexDirection,
  HexDirection,
  HexDirection,
  HexDirection,
  HexDirection,
] = [0, 1, 2, 3, 4, 5]

const HEX_DIRECTION_OFFSETS: Record<HexDirection, HexCoordinate> = {
  0: { q: 1, r: 0 },
  1: { q: 0, r: 1 },
  2: { q: -1, r: 1 },
  3: { q: -1, r: 0 },
  4: { q: 0, r: -1 },
  5: { q: 1, r: -1 },
}

export type HexNeighbors = readonly [
  HexCoordinate,
  HexCoordinate,
  HexCoordinate,
  HexCoordinate,
  HexCoordinate,
  HexCoordinate,
]

export function isValidHexCoordinate(hex: HexCoordinate): boolean {
  return Number.isInteger(hex.q) && Number.isInteger(hex.r)
}

export function isHexDirection(value: number): value is HexDirection {
  return Number.isInteger(value) && value >= 0 && value <= 5
}

/** Validating constructor for coordinates arriving from untrusted input. */
export function createHexCoordinate(q: number, r: number): DomainResult<HexCoordinate> {
  if (!Number.isInteger(q)) {
    return {
      success: false,
      errors: [
        { code: 'INVALID_HEX_COORDINATE', message: 'q must be a finite integer.', field: 'q' },
      ],
    }
  }
  if (!Number.isInteger(r)) {
    return {
      success: false,
      errors: [
        { code: 'INVALID_HEX_COORDINATE', message: 'r must be a finite integer.', field: 'r' },
      ],
    }
  }
  return { success: true, value: { q, r } }
}

export function hexCoordinateKey(hex: HexCoordinate): string {
  return `${hex.q},${hex.r}`
}

export function hexCoordinatesEqual(a: HexCoordinate, b: HexCoordinate): boolean {
  return a.q === b.q && a.r === b.r
}

export function getOppositeHexDirection(direction: HexDirection): HexDirection {
  // Safe: HEX_DIRECTIONS is indexed by the full 0-5 literal union.
  return HEX_DIRECTIONS[((direction + 3) % 6) as HexDirection]
}

export function getHexNeighbor(hex: HexCoordinate, direction: HexDirection): HexCoordinate {
  const offset = HEX_DIRECTION_OFFSETS[direction]
  return { q: hex.q + offset.q, r: hex.r + offset.r }
}

/** Validating variant for direction values arriving from untrusted input. */
export function tryGetHexNeighbor(
  hex: HexCoordinate,
  direction: number,
): DomainResult<HexCoordinate> {
  if (!isHexDirection(direction)) {
    return {
      success: false,
      errors: [
        {
          code: 'INVALID_HEX_DIRECTION',
          message: 'Direction must be an integer between 0 and 5.',
          field: 'direction',
        },
      ],
    }
  }
  return { success: true, value: getHexNeighbor(hex, direction) }
}

/** Neighbours in clockwise `HEX_DIRECTIONS` order, starting East. */
export function getHexNeighbors(hex: HexCoordinate): HexNeighbors {
  return [
    getHexNeighbor(hex, 0),
    getHexNeighbor(hex, 1),
    getHexNeighbor(hex, 2),
    getHexNeighbor(hex, 3),
    getHexNeighbor(hex, 4),
    getHexNeighbor(hex, 5),
  ]
}

export function getHexDistance(a: HexCoordinate, b: HexCoordinate): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2
}

export function areHexesAdjacent(a: HexCoordinate, b: HexCoordinate): boolean {
  return getHexDistance(a, b) === 1
}
