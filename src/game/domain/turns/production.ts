import { listSectors } from '../board/board'
import { createBoardTopology, getSectorsAdjacentToVertex } from '../board/board-topology'
import { hexCoordinateKey, hexCoordinatesEqual, type HexCoordinate } from '../board/hex-coordinate'
import { getSectorResourceType, type Sector } from '../board/sector'
import { getStructureProductionValue, type Structure } from '../buildings/structure'
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
    /** Number of structures touching this sector that produced. */
    structureCount: number
    /** Total production units touching this sector (Outpost 1 / Colony 2 / Nexus 3). */
    unitCount: number
  }>[]
  /** Otherwise-matching sectors that produced nothing because the Marauder occupies them. */
  blockedSectors: readonly Sector[]
}>

/**
 * Computes what every structure adjacent to a rolled, visible, producing
 * sector would earn — before checking the bank. Adjacency is resolved through
 * the board topology (corner → sectors index, used in reverse via each
 * structure's own vertex). Each structure yields its production value
 * (Outpost 1 / Colony 2 / Nexus 3) in the sector's resource. A sector occupied
 * by the Void Marauder (`marauderCoordinate`) is excluded from production but
 * still reported via `blockedSectors` so callers can emit an observable event.
 */
export function getProductionDemand(match: Match, rollTotal: number): ProductionDemand {
  const topology = createBoardTopology(match.board)
  const grantsByPlayer = new Map<string, Record<string, number>>()
  const totalDemand: Record<string, number> = { ...createEmptyResourceInventory() }
  const producingSectorsByKey = new Map<string, { sector: Sector; structures: Structure[] }>()
  const blockedSectorsByKey = new Map<string, Sector>()

  // For each placed structure, look up (via the topology) the sectors
  // touching its corner, then keep only those that are visible and rolled
  // this turn.
  for (const structure of Object.values(match.structures)) {
    const touchingSectors = getSectorsAdjacentToVertex(topology, structure.vertexId)
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

      const key = hexCoordinateKey(sector.coordinate)
      if (isMarauderBlocked(sector.coordinate, match.marauderCoordinate)) {
        blockedSectorsByKey.set(key, sector)
        continue
      }

      const entry = producingSectorsByKey.get(key)
      if (entry === undefined) {
        producingSectorsByKey.set(key, { sector, structures: [structure] })
      } else {
        entry.structures.push(structure)
      }

      const units = getStructureProductionValue(structure.type)
      const existing = grantsByPlayer.get(structure.ownerId)
      const playerGrant = existing ?? { ...createEmptyResourceInventory() }
      playerGrant[resource] = (playerGrant[resource] ?? 0) + units
      if (existing === undefined) {
        grantsByPlayer.set(structure.ownerId, playerGrant)
      }
      totalDemand[resource] = (totalDemand[resource] ?? 0) + units
    }
  }

  const grantsByPlayerRecord: Record<string, ResourceInventory> = {}
  for (const [playerId, grant] of grantsByPlayer) {
    grantsByPlayerRecord[playerId] = grant as ResourceInventory
  }

  // Deterministic order matches board sector iteration order, not structure
  // insertion order, so events replay identically regardless of Object.values
  // ordering quirks.
  const producingSectors = listSectors(match.board)
    .map((sector) => producingSectorsByKey.get(hexCoordinateKey(sector.coordinate)))
    .filter((entry): entry is { sector: Sector; structures: Structure[] } => entry !== undefined)
    .map((entry) => ({
      sector: entry.sector,
      structureCount: entry.structures.length,
      unitCount: entry.structures.reduce(
        (sum, structure) => sum + getStructureProductionValue(structure.type),
        0,
      ),
    }))

  const blockedSectors = listSectors(match.board)
    .map((sector) => blockedSectorsByKey.get(hexCoordinateKey(sector.coordinate)))
    .filter((sector): sector is Sector => sector !== undefined)

  return {
    grantsByPlayer: grantsByPlayerRecord,
    totalDemand: totalDemand as ResourceInventory,
    producingSectors,
    blockedSectors,
  }
}

function isMarauderBlocked(
  sectorCoordinate: HexCoordinate,
  marauderCoordinate: HexCoordinate,
): boolean {
  return hexCoordinatesEqual(sectorCoordinate, marauderCoordinate)
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
