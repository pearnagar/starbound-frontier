import type { DockId, IntersectionId, OutpostId } from '../board/space-board'
import { VICTORY_POINT_VALUES } from '../rules/rules-config'
import type { PlayerId } from '../types/ids'

/**
 * Structures that occupy a board position. A Spaceport is a Colony that has
 * had a Shipyard built around it, so it is one structure worth 2 points in
 * total rather than a Colony plus a separate Spaceport.
 */
export const STRUCTURE_TYPES = ['colony', 'spaceport', 'tradeStation'] as const

export type StructureType = (typeof STRUCTURE_TYPES)[number]

/** A Colony or Spaceport occupying a colony site. */
export type SiteStructure = Readonly<{
  type: 'colony' | 'spaceport'
  intersectionId: IntersectionId
  ownerId: PlayerId
}>

/** A Trade Station occupying a dock at an alien outpost. */
export type TradeStationStructure = Readonly<{
  type: 'tradeStation'
  outpostId: OutpostId
  dockId: DockId
  ownerId: PlayerId
}>

export type Structure = SiteStructure | TradeStationStructure

export function createColony(intersectionId: IntersectionId, ownerId: PlayerId): SiteStructure {
  return { type: 'colony', intersectionId, ownerId }
}

export function createSpaceport(intersectionId: IntersectionId, ownerId: PlayerId): SiteStructure {
  return { type: 'spaceport', intersectionId, ownerId }
}

export function createTradeStation(
  outpostId: OutpostId,
  dockId: DockId,
  ownerId: PlayerId,
): TradeStationStructure {
  return { type: 'tradeStation', outpostId, dockId, ownerId }
}

export function isSiteStructure(structure: Structure): structure is SiteStructure {
  return structure.type === 'colony' || structure.type === 'spaceport'
}

export function isTradeStation(structure: Structure): structure is TradeStationStructure {
  return structure.type === 'tradeStation'
}

/**
 * Resources this structure receives when an adjacent planet's number is
 * rolled. A Colony and a Spaceport each receive exactly 1 — a Spaceport does
 * not produce extra. Trade Stations receive no planetary production.
 */
export function getStructureProductionValue(type: StructureType): number {
  return type === 'tradeStation' ? 0 : 1
}

/**
 * Victory points this structure contributes. A Spaceport is worth 2 in total,
 * already accounting for the Colony it upgraded. Trade Stations score nothing
 * directly — their points come from a Friendship Marker, handled separately.
 */
export function getStructureVictoryPoints(type: StructureType): number {
  switch (type) {
    case 'colony':
      return VICTORY_POINT_VALUES.colony
    case 'spaceport':
      return VICTORY_POINT_VALUES.spaceport
    case 'tradeStation':
      return 0
  }
}
