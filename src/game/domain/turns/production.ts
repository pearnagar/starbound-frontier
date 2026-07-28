import { listSectors } from '../board/board'
import { createBoardTopology, getSectorsAdjacentToVertex } from '../board/board-topology'
import { getSectorResourceType, type Sector } from '../board/sector'
import type { Outpost } from '../buildings/outpost'
import type { PlayerId } from '../types/ids'
import {
  createEmptyResourceInventory,
  RESOURCE_TYPES,
  type ResourceInventory,
} from '../types/resources'
import type { Match } from './match'

/** Per-player resource grants and per-resource total demand for one production resolution. */
export type ProductionDemand = Readonly<{
  /** Resources each player would receive if the bank can supply them. */
  grantsByPlayer: Readonly<Record<string, ResourceInventory>>
  /** Total units of each resource demanded across all players. */
  totalDemand: ResourceInventory
  /** Per-sector detail, useful for SectorProduced events. */
  producingSectors: readonly Readonly<{
    sector: Sector
    outpostCount: number
  }>[]
}>

/**
 * Computes what every outpost adjacent to a rolled, visible, producing sector
 * would earn — before checking the bank. Adjacency is resolved through the
 * board topology (corner → sectors index, used in reverse via each outpost's
 * own vertex). Only outposts produce in this milestone.
 */
export function getProductionDemand(match: Match, rollTotal: number): ProductionDemand {
  const topology = createBoardTopology(match.board)
  const grantsByPlayer = new Map<string, Record<string, number>>()
  const totalDemand: Record<string, number> = { ...createEmptyResourceInventory() }
  const producingSectorsByKey = new Map<string, { sector: Sector; outposts: Outpost[] }>()

  // For each placed outpost, look up (via the topology) the sectors touching
  // its corner, then keep only those that are visible and rolled this turn.
  for (const outpost of Object.values(match.outposts)) {
    const touchingSectors = getSectorsAdjacentToVertex(topology, outpost.vertexId)
    for (const sector of touchingSectors) {
      if (sector.visibility !== 'visible') {
        continue
      }
      if (sector.productionNumber === undefined || sector.productionNumber !== rollTotal) {
        continue
      }
      const resource = getSectorResourceType(sector.type)
      if (resource === undefined) {
        continue
      }

      const key = `${sector.coordinate.q},${sector.coordinate.r}`
      const entry = producingSectorsByKey.get(key)
      if (entry === undefined) {
        producingSectorsByKey.set(key, { sector, outposts: [outpost] })
      } else {
        entry.outposts.push(outpost)
      }

      const existing = grantsByPlayer.get(outpost.ownerId)
      const playerGrant = existing ?? { ...createEmptyResourceInventory() }
      playerGrant[resource] = (playerGrant[resource] ?? 0) + 1
      if (existing === undefined) {
        grantsByPlayer.set(outpost.ownerId, playerGrant)
      }
      totalDemand[resource] = (totalDemand[resource] ?? 0) + 1
    }
  }

  const grantsByPlayerRecord: Record<string, ResourceInventory> = {}
  for (const [playerId, grant] of grantsByPlayer) {
    grantsByPlayerRecord[playerId] = grant as ResourceInventory
  }

  // Deterministic order matches board sector iteration order, not outpost
  // insertion order, so events replay identically regardless of Object.values
  // ordering quirks.
  const producingSectors = listSectors(match.board)
    .map((sector) => producingSectorsByKey.get(`${sector.coordinate.q},${sector.coordinate.r}`))
    .filter((entry): entry is { sector: Sector; outposts: Outpost[] } => entry !== undefined)
    .map((entry) => ({ sector: entry.sector, outpostCount: entry.outposts.length }))

  return {
    grantsByPlayer: grantsByPlayerRecord,
    totalDemand: totalDemand as ResourceInventory,
    producingSectors,
  }
}

/** Resources this player would receive from a demand computation, or an empty inventory. */
export function getPlayerGrant(demand: ProductionDemand, playerId: PlayerId): ResourceInventory {
  return demand.grantsByPlayer[playerId] ?? createEmptyResourceInventory()
}

/**
 * Resource types whose total demand exceeds the bank's current supply —
 * these are withheld from everyone this resolution (all-or-nothing).
 */
export function getShortResources(
  demand: ProductionDemand,
  bankQuantities: ResourceInventory,
): readonly (typeof RESOURCE_TYPES)[number][] {
  return RESOURCE_TYPES.filter((type) => demand.totalDemand[type] > bankQuantities[type])
}
