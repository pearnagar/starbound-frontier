export type PieceSupply = Readonly<{
  tradeRoutes: number
  outposts: number
  colonies: number
  nexus: number
}>

const PIECE_SUPPLY_KEYS = ['tradeRoutes', 'outposts', 'colonies', 'nexus'] as const

const INITIAL_PIECE_SUPPLY: PieceSupply = {
  tradeRoutes: 15,
  outposts: 5,
  colonies: 4,
  nexus: 2,
}

export function createInitialPieceSupply(): PieceSupply {
  return { ...INITIAL_PIECE_SUPPLY }
}

export function isValidPieceSupply(supply: PieceSupply): boolean {
  return PIECE_SUPPLY_KEYS.every((key) => Number.isInteger(supply[key]) && supply[key] >= 0)
}
