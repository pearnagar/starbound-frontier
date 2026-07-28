import type { HexCoordinate } from './hex-coordinate'

/**
 * A point on the *tripled cube* integer lattice.
 *
 * Hex centres are stored at three times their cube coordinate, which leaves
 * room for the six corners to land on exact integer points of the same
 * lattice. Because every corner of every hex resolves to integers, a physical
 * corner shared by three hexes produces the *same* triple no matter which hex
 * it was derived from — so identity is exact and needs no floating-point
 * tolerance.
 *
 * Invariant: `x + y + z === 0`.
 */
export type LatticePoint = Readonly<{
  x: number
  y: number
  z: number
}>

/** Corner offsets from a tripled hex centre, clockwise from North. */
export const CORNER_OFFSETS: readonly [
  LatticePoint,
  LatticePoint,
  LatticePoint,
  LatticePoint,
  LatticePoint,
  LatticePoint,
] = [
  { x: 1, y: 1, z: -2 }, // North
  { x: 2, y: -1, z: -1 }, // North-east
  { x: 1, y: -2, z: 1 }, // South-east
  { x: -1, y: -1, z: 2 }, // South
  { x: -2, y: 1, z: 1 }, // South-west
  { x: -1, y: 2, z: -1 }, // North-west
]

/**
 * Tripled cube centre of a hex: `(3q, -3q - 3r, 3r)`.
 *
 * `y` is derived by subtraction from zero so the origin yields `+0` rather
 * than `-0`, keeping serialized domain data canonical.
 */
export function hexCentreLatticePoint(hex: HexCoordinate): LatticePoint {
  const x = 3 * hex.q
  const z = 3 * hex.r
  return { x, y: 0 - x - z, z }
}

export function addLatticePoints(a: LatticePoint, b: LatticePoint): LatticePoint {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function subtractLatticePoints(a: LatticePoint, b: LatticePoint): LatticePoint {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function latticePointsEqual(a: LatticePoint, b: LatticePoint): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z
}

export function latticePointKey(point: LatticePoint): string {
  return `${point.x},${point.y},${point.z}`
}

export function parseLatticePointKey(key: string): LatticePoint | undefined {
  const parts = key.split(',')
  if (parts.length !== 3) {
    return undefined
  }
  const [rawX, rawY, rawZ] = parts as [string, string, string]
  const x = Number(rawX)
  const y = Number(rawY)
  const z = Number(rawZ)
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
    return undefined
  }
  return { x, y, z }
}
