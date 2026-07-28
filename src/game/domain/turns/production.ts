import {
  getColonySiteAt,
  listColonySites,
  planetMatchesRoll,
  type Planet,
  type PlanetId,
  type SpaceBoard,
} from '../board/space-board'
import { getStructureProductionValue } from '../buildings/structure'
import type { PlayerId } from '../types/ids'
import {
  createEmptyResourceInventory,
  RESOURCE_TYPES,
  type ResourceInventory,
} from '../types/resources'
import { listSiteStructures, type Match } from './match'

/** Per-player grants and per-resource totals for one production resolution. */
export type ProductionDemand = Readonly<{
  grantsByPlayer: Readonly<Record<string, ResourceInventory>>
  totalDemand: ResourceInventory
  /** Per-planet detail for events. */
  producingPlanets: readonly Readonly<{
    planet: Planet
    /** Structures adjacent to this planet that produced. */
    structureCount: number
    /** Cards produced — one per adjacent Colony or Spaceport. */
    unitCount: number
  }>[]
}>

/**
 * Computes what every Colony and Spaceport adjacent to a rolled planet earns.
 * Each qualifying structure receives exactly 1 card — a Spaceport produces the
 * same single card as a Colony. Planets without a revealed disc, and planets
 * blocked by a hazard, never produce.
 */
export function getProductionDemand(match: Match, rollTotal: number): ProductionDemand {
  const board: SpaceBoard = match.board
  const grantsByPlayer = new Map<string, Record<string, number>>()
  const totalDemand: Record<string, number> = { ...createEmptyResourceInventory() }
  const producingByPlanet = new Map<string, { planet: Planet; structureCount: number }>()

  for (const structure of listSiteStructures(match)) {
    const units = getStructureProductionValue(structure.type)
    if (units === 0) {
      continue
    }
    const site = getColonySiteAt(board, structure.intersectionId)
    if (site === undefined) {
      continue
    }

    for (const planetId of site.planetIds) {
      const planet = board.planets[planetId]
      if (planet === undefined || !planetMatchesRoll(planet, rollTotal)) {
        continue
      }

      const existingEntry = producingByPlanet.get(planet.id)
      if (existingEntry === undefined) {
        producingByPlanet.set(planet.id, { planet, structureCount: 1 })
      } else {
        existingEntry.structureCount += 1
      }

      const existingGrant = grantsByPlayer.get(structure.ownerId)
      const grant = existingGrant ?? { ...createEmptyResourceInventory() }
      grant[planet.resource] = (grant[planet.resource] ?? 0) + units
      if (existingGrant === undefined) {
        grantsByPlayer.set(structure.ownerId, grant)
      }
      totalDemand[planet.resource] = (totalDemand[planet.resource] ?? 0) + units
    }
  }

  const grantsByPlayerRecord: Record<string, ResourceInventory> = {}
  for (const [playerId, grant] of grantsByPlayer) {
    grantsByPlayerRecord[playerId] = grant as ResourceInventory
  }

  // Ordered by board colony-site iteration rather than structure insertion, so
  // replaying the same match emits identical event ordering.
  const seen = new Set<string>()
  const orderedPlanetIds: PlanetId[] = []
  for (const site of listColonySites(board)) {
    for (const planetId of site.planetIds) {
      if (!seen.has(planetId)) {
        seen.add(planetId)
        orderedPlanetIds.push(planetId)
      }
    }
  }

  const producingPlanets = orderedPlanetIds
    .map((planetId) => producingByPlanet.get(planetId))
    .filter((entry): entry is { planet: Planet; structureCount: number } => entry !== undefined)
    .map((entry) => ({
      planet: entry.planet,
      structureCount: entry.structureCount,
      unitCount: entry.structureCount,
    }))

  return {
    grantsByPlayer: grantsByPlayerRecord,
    totalDemand: totalDemand as ResourceInventory,
    producingPlanets,
  }
}

export function getPlayerGrant(demand: ProductionDemand, playerId: PlayerId): ResourceInventory {
  return demand.grantsByPlayer[playerId] ?? createEmptyResourceInventory()
}

/**
 * Resource types whose total demand exceeds the Supply — withheld from
 * everyone this resolution rather than distributed partially.
 */
export function getShortResources(
  demand: ProductionDemand,
  supplyQuantities: ResourceInventory,
): readonly (typeof RESOURCE_TYPES)[number][] {
  return RESOURCE_TYPES.filter((type) => demand.totalDemand[type] > supplyQuantities[type])
}
