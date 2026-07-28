import type { BoardConfiguration } from './board-configuration'
import { hexCoordinateKey, type HexCoordinate } from './hex-coordinate'
import type { Sector } from './sector'

/**
 * A fully generated board. Plain readonly data — safe to serialize as-is.
 * Sectors are keyed by canonical hex-coordinate key; geometry (corners, edges,
 * neighbours) is derived on demand rather than stored.
 */
export type Board = Readonly<{
  seed: number
  /** Which generation attempt produced this board (1-based). */
  attempt: number
  configuration: BoardConfiguration
  sectors: Readonly<Record<string, Sector>>
}>

export function getSector(board: Board, coordinate: HexCoordinate): Sector | undefined {
  return board.sectors[hexCoordinateKey(coordinate)]
}

/** Sectors in the board's deterministic insertion order. */
export function listSectors(board: Board): readonly Sector[] {
  return Object.values(board.sectors)
}

export function getBoardSize(board: Board): number {
  return Object.keys(board.sectors).length
}
