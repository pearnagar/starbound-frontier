import { getHexBoardSize, STANDARD_BOARD_RADIUS } from './board-shape'
import type { ProductionNumber } from './production-number'
import type { SectorType } from './sector'

export type BoardConfiguration = Readonly<{
  radius: number
  /** How many sectors of each type the board must contain. */
  sectorCounts: Readonly<Record<SectorType, number>>
  /** How many tokens of each production value exist. */
  productionTokenCounts: Readonly<Record<ProductionNumber, number>>
  /** How many outer-ring sectors begin hidden. */
  hiddenSectorCount: number
  /** Upper bound on deterministic regeneration attempts. */
  maxGenerationAttempts: number
}>

/**
 * Standard 37-sector board (radius 3).
 *
 * - 27 producing sectors: 6 each of the four basic resources, 3 Quantum Rift.
 * - 10 non-producing: 6 empty space, 3 anomaly, 1 central star.
 * - 27 production tokens, weighted toward 6 and 8 but capped so they stay
 *   placeable without adjacency, and thinnest at 2 and 12.
 */
const STANDARD_SECTOR_COUNTS: Record<SectorType, number> = {
  alloyAsteroidField: 6,
  plasmaNebula: 6,
  cryoniteWorld: 6,
  biofiberPlanet: 6,
  quantumRift: 3,
  emptySpace: 6,
  anomaly: 3,
  centralStar: 1,
}

const STANDARD_PRODUCTION_TOKEN_COUNTS: Record<ProductionNumber, number> = {
  2: 1,
  3: 3,
  4: 3,
  5: 3,
  6: 4,
  8: 4,
  9: 3,
  10: 3,
  11: 2,
  12: 1,
}

export function createStandardBoardConfiguration(): BoardConfiguration {
  return {
    radius: STANDARD_BOARD_RADIUS,
    sectorCounts: { ...STANDARD_SECTOR_COUNTS },
    productionTokenCounts: { ...STANDARD_PRODUCTION_TOKEN_COUNTS },
    hiddenSectorCount: 6,
    maxGenerationAttempts: 25,
  }
}

export function getConfiguredBoardSize(configuration: BoardConfiguration): number {
  return getHexBoardSize(configuration.radius)
}

export function getConfiguredSectorTotal(configuration: BoardConfiguration): number {
  return Object.values(configuration.sectorCounts).reduce((total, count) => total + count, 0)
}

export function getConfiguredProductionTokenTotal(configuration: BoardConfiguration): number {
  return Object.values(configuration.productionTokenCounts).reduce(
    (total, count) => total + count,
    0,
  )
}
