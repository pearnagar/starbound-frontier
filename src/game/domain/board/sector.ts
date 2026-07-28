import type { HexCoordinate } from './hex-coordinate'
import type { ProductionNumber } from './production-number'

/** Deterministic iteration order for all sector types. */
export const SECTOR_TYPES = [
  'alloyAsteroidField',
  'plasmaNebula',
  'cryoniteWorld',
  'biofiberPlanet',
  'quantumRift',
  'emptySpace',
  'anomaly',
  'centralStar',
] as const

export type SectorType = (typeof SECTOR_TYPES)[number]

/** Sector types that may carry a production number. */
export const PRODUCING_SECTOR_TYPES = [
  'alloyAsteroidField',
  'plasmaNebula',
  'cryoniteWorld',
  'biofiberPlanet',
  'quantumRift',
] as const

export type ProducingSectorType = (typeof PRODUCING_SECTOR_TYPES)[number]

/** The four common producing types; Quantum Rift is deliberately rarer. */
export const BASIC_PRODUCING_SECTOR_TYPES = [
  'alloyAsteroidField',
  'plasmaNebula',
  'cryoniteWorld',
  'biofiberPlanet',
] as const

export function isProducingSectorType(type: SectorType): type is ProducingSectorType {
  return (PRODUCING_SECTOR_TYPES as readonly SectorType[]).includes(type)
}

export type SectorVisibility = 'visible' | 'hidden'

/**
 * A single board space. `productionNumber` is present exactly when the sector
 * type produces; visibility never affects the underlying assignment.
 */
export type Sector = Readonly<{
  coordinate: HexCoordinate
  type: SectorType
  visibility: SectorVisibility
  productionNumber?: ProductionNumber
}>

export function isCentralStarSector(sector: Sector): boolean {
  return sector.type === 'centralStar'
}

export function isSectorHidden(sector: Sector): boolean {
  return sector.visibility === 'hidden'
}
