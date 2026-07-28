import { getHexDistance, type HexCoordinate } from './hex-coordinate'

export const BOARD_ORIGIN: HexCoordinate = { q: 0, r: 0 }

/**
 * Radius of the standard board. A radius-3 hexagon holds
 * `3r² + 3r + 1 = 37` sectors, inside the 30-40 target.
 */
export const STANDARD_BOARD_RADIUS = 3

/** Sector count of a hexagonal board of the given radius. */
export function getHexBoardSize(radius: number): number {
  return 3 * radius * radius + 3 * radius + 1
}

/**
 * All coordinates of a hexagon centred on the origin, in a deterministic
 * order: ring by ring outwards, and within each ring by ascending `q` then
 * ascending `r`. The origin is always first.
 */
export function createBoardCoordinates(radius: number): readonly HexCoordinate[] {
  const rings: HexCoordinate[][] = Array.from({ length: radius + 1 }, () => [])

  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      const coordinate: HexCoordinate = { q, r }
      const distance = getHexDistance(BOARD_ORIGIN, coordinate)
      if (distance > radius) {
        continue
      }
      rings[distance]?.push(coordinate)
    }
  }

  return rings.flat()
}

export function createStandardBoardCoordinates(): readonly HexCoordinate[] {
  return createBoardCoordinates(STANDARD_BOARD_RADIUS)
}

export function isBoardBoundaryCoordinate(coordinate: HexCoordinate, radius: number): boolean {
  return getHexDistance(BOARD_ORIGIN, coordinate) === radius
}

/** The outermost ring — the only sectors allowed to start hidden. */
export function getBoardBoundaryCoordinates(radius: number): readonly HexCoordinate[] {
  return createBoardCoordinates(radius).filter((coordinate) =>
    isBoardBoundaryCoordinate(coordinate, radius),
  )
}
