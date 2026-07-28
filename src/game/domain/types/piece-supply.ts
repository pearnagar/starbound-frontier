/**
 * Unplaced player pieces. Composite pieces are never stored directly — a
 * Colony Ship is a Transport Ship plus a Colony, a Trade Ship is a Transport
 * Ship plus a Trade Station, and a Spaceport is a Colony plus a Shipyard. The
 * supply therefore tracks only the four physical piece kinds.
 */
export type PieceSupply = Readonly<{
  colonies: number
  tradeStations: number
  transportShips: number
  shipyards: number
}>

export const PIECE_SUPPLY_KEYS = [
  'colonies',
  'tradeStations',
  'transportShips',
  'shipyards',
] as const

export type PieceKind = (typeof PIECE_SUPPLY_KEYS)[number]

const INITIAL_PIECE_SUPPLY: PieceSupply = {
  colonies: 9,
  tradeStations: 7,
  transportShips: 3,
  shipyards: 3,
}

export function createInitialPieceSupply(): PieceSupply {
  return { ...INITIAL_PIECE_SUPPLY }
}

export function isValidPieceSupply(supply: PieceSupply): boolean {
  return PIECE_SUPPLY_KEYS.every((key) => Number.isInteger(supply[key]) && supply[key] >= 0)
}

/** Whether the supply still holds at least one of every listed piece kind. */
export function hasPieces(
  supply: PieceSupply,
  required: Partial<Record<PieceKind, number>>,
): boolean {
  return PIECE_SUPPLY_KEYS.every((key) => supply[key] >= (required[key] ?? 0))
}

/** Applies a signed delta per piece kind, clamping at zero. */
export function adjustPieceSupply(
  supply: PieceSupply,
  delta: Partial<Record<PieceKind, number>>,
): PieceSupply {
  const result: Record<string, number> = { ...supply }
  for (const key of PIECE_SUPPLY_KEYS) {
    result[key] = Math.max(0, supply[key] + (delta[key] ?? 0))
  }
  return result as PieceSupply
}
