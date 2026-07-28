import { listSpaceportSites, type IntersectionId, type SpaceportSite } from '../board/space-board'
import { asShipId, createShip, type ShipType } from '../buildings/ship'
import { createSpaceport } from '../buildings/structure'
import {
  getBuildCost,
  getMothershipUpgradeLimit,
  type BuildAction,
  type MothershipUpgradeKind,
} from '../rules/rules-config'
import type { PlayerId } from '../types/ids'
import { addUpgrade, canAddUpgrade } from '../types/mothership'
import { adjustPieceSupply, hasPieces, type PieceKind } from '../types/piece-supply'
import type { Player } from '../types/player'
import {
  hasAtLeastResources,
  subtractResourceInventories,
  type ResourceInventory,
} from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import {
  getStructureAt,
  isIntersectionOccupied,
  listPlayerSiteStructures,
  type Match,
} from './match'
import type { MatchEvent } from './match-events'
import { addToSupply } from './resource-bank'

function failure(code: string, message: string, field: string): DomainResult<never> {
  const error: DomainValidationError = { code, message, field }
  return { success: false, errors: [error] }
}

function appendEvent(match: Match, buildEvent: (sequence: number) => MatchEvent): Match {
  const sequence = match.eventSequence + 1
  return { ...match, events: [...match.events, buildEvent(sequence)], eventSequence: sequence }
}

/**
 * Building is legal only during Trade & Build, by the active player. Trading
 * and building share the phase, so a player may alternate freely between them.
 */
function checkBuildContext(match: Match, playerId: PlayerId): DomainResult<Player> {
  if (match.status !== 'inProgress') {
    return failure('MATCH_NOT_IN_PROGRESS', 'The match is not in progress.', 'status')
  }
  if (match.phase !== 'tradeAndBuild') {
    return failure('WRONG_PHASE', 'Building is only allowed during Trade & Build.', 'phase')
  }
  if (match.activePlayerId !== playerId) {
    return failure('WRONG_ACTIVE_PLAYER', 'It is not this player’s turn.', 'playerId')
  }
  const player = match.playersById[playerId]
  if (player === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }
  return { success: true, value: player }
}

export function canAffordBuild(player: Player, action: BuildAction): boolean {
  return hasAtLeastResources(player.resources, getBuildCost(action))
}

/** Deducts a cost from the player and returns it to the face-up Supply. */
function payCost(match: Match, player: Player, action: BuildAction): Match {
  const cost: ResourceInventory = getBuildCost(action)
  const updated: Player = {
    ...player,
    resources: subtractResourceInventories(player.resources, cost),
  }
  const paid: Match = {
    ...match,
    playersById: { ...match.playersById, [player.id]: updated },
    supply: addToSupply(match.supply, cost),
  }
  return appendEvent(paid, (sequence) => ({
    sequence,
    type: 'ResourcesSpent',
    playerId: player.id,
    action,
    spent: cost,
  }))
}

// --- Spaceport -----------------------------------------------------------

/** Colonies this player could upgrade into a Spaceport. */
export function getUpgradeableColonies(
  match: Match,
  playerId: PlayerId,
): readonly IntersectionId[] {
  return listPlayerSiteStructures(match, playerId)
    .filter((structure) => structure.type === 'colony')
    .map((structure) => structure.intersectionId)
}

export function validateSpaceportBuild(
  match: Match,
  playerId: PlayerId,
  intersectionId: IntersectionId,
): DomainResult<null> {
  const context = checkBuildContext(match, playerId)
  if (!context.success) {
    return context
  }
  const player = context.value

  const structure = getStructureAt(match, intersectionId)
  if (structure === undefined) {
    return failure('NO_STRUCTURE', 'There is no structure at that site.', 'intersectionId')
  }
  if (structure.ownerId !== playerId) {
    return failure('NOT_OWNER', 'That structure belongs to another player.', 'intersectionId')
  }
  if (structure.type !== 'colony') {
    return failure(
      'NOT_A_COLONY',
      'Only a Colony can be upgraded to a Spaceport.',
      'intersectionId',
    )
  }
  if (!hasPieces(player.pieceSupply, { shipyards: 1 })) {
    return failure(
      'NO_PIECE_AVAILABLE',
      'No Shipyard remains in the personal supply.',
      'pieceSupply',
    )
  }
  if (!canAffordBuild(player, 'spaceport')) {
    return failure('INSUFFICIENT_RESOURCES', 'Cannot afford a Spaceport.', 'resources')
  }
  return { success: true, value: null }
}

/**
 * Upgrades a Colony into a Spaceport. The Colony piece remains part of the
 * Spaceport, so only a Shipyard leaves the personal supply and the site keeps
 * producing exactly 1 resource.
 */
export function buildSpaceport(
  match: Match,
  playerId: PlayerId,
  intersectionId: IntersectionId,
): DomainResult<Match> {
  const validation = validateSpaceportBuild(match, playerId, intersectionId)
  if (!validation.success) {
    return validation
  }
  const player = match.playersById[playerId]
  if (player === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }

  let working = payCost(match, player, 'spaceport')
  const paidPlayer = working.playersById[playerId]
  if (paidPlayer === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }

  const updated: Player = {
    ...paidPlayer,
    pieceSupply: adjustPieceSupply(paidPlayer.pieceSupply, { shipyards: -1 }),
  }

  working = {
    ...working,
    playersById: { ...working.playersById, [playerId]: updated },
    structures: {
      ...working.structures,
      [intersectionId]: createSpaceport(intersectionId, playerId),
    },
  }

  working = appendEvent(working, (sequence) => ({
    sequence,
    type: 'SpaceportBuilt',
    playerId,
    intersectionId,
  }))

  return {
    success: true,
    value: appendEvent(working, (sequence) => ({
      sequence,
      type: 'PieceSupplyChanged',
      playerId,
      pieceSupply: updated.pieceSupply,
    })),
  }
}

// --- Ships ---------------------------------------------------------------

/**
 * Unoccupied spaceport sites belonging to this player. A site belongs to a
 * player when they own a Spaceport in the system that site serves.
 */
export function getAvailableSpaceportSites(
  match: Match,
  playerId: PlayerId,
): readonly SpaceportSite[] {
  const ownedSpaceportIntersections = new Set<string>(
    listPlayerSiteStructures(match, playerId)
      .filter((structure) => structure.type === 'spaceport')
      .map((structure) => structure.intersectionId),
  )
  if (ownedSpaceportIntersections.size === 0) {
    return []
  }

  return listSpaceportSites(match.board).filter((site) => {
    if (isIntersectionOccupied(match, site.intersectionId)) {
      return false
    }
    const system = match.board.systems[site.systemId]
    if (system === undefined) {
      return false
    }
    return system.colonySites.some((colonySite) =>
      ownedSpaceportIntersections.has(colonySite.intersectionId),
    )
  })
}

const SHIP_BUILD_ACTION: Readonly<Record<ShipType, BuildAction>> = {
  colonyShip: 'colonyShip',
  tradeShip: 'tradeShip',
}

/** A ship consumes a Transport Ship plus the piece it will leave behind. */
const SHIP_PIECE_COST: Readonly<Record<ShipType, Partial<Record<PieceKind, number>>>> = {
  colonyShip: { transportShips: 1, colonies: 1 },
  tradeShip: { transportShips: 1, tradeStations: 1 },
}

export function validateShipBuild(
  match: Match,
  playerId: PlayerId,
  shipType: ShipType,
  intersectionId: IntersectionId,
): DomainResult<null> {
  const context = checkBuildContext(match, playerId)
  if (!context.success) {
    return context
  }
  const player = context.value

  const available = getAvailableSpaceportSites(match, playerId)
  if (!available.some((site) => site.intersectionId === intersectionId)) {
    return failure(
      'INVALID_SPACEPORT_SITE',
      'A ship may only be built on the player’s own unoccupied spaceport site.',
      'intersectionId',
    )
  }
  if (!hasPieces(player.pieceSupply, SHIP_PIECE_COST[shipType])) {
    return failure(
      'NO_PIECE_AVAILABLE',
      'The personal supply lacks a Transport Ship or the carried piece.',
      'pieceSupply',
    )
  }
  if (!canAffordBuild(player, SHIP_BUILD_ACTION[shipType])) {
    return failure('INSUFFICIENT_RESOURCES', 'Cannot afford that ship.', 'resources')
  }
  return { success: true, value: null }
}

/**
 * Builds a Colony Ship or Trade Ship on an owned, unoccupied spaceport site.
 * The ship is marked as built this turn because both types may move during the
 * same turn's Flight Phase.
 */
export function buildShip(
  match: Match,
  playerId: PlayerId,
  shipType: ShipType,
  intersectionId: IntersectionId,
): DomainResult<Match> {
  const validation = validateShipBuild(match, playerId, shipType, intersectionId)
  if (!validation.success) {
    return validation
  }
  const player = match.playersById[playerId]
  if (player === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }

  let working = payCost(match, player, SHIP_BUILD_ACTION[shipType])
  const paidPlayer = working.playersById[playerId]
  if (paidPlayer === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }

  const pieceDelta = SHIP_PIECE_COST[shipType]
  const updated: Player = {
    ...paidPlayer,
    pieceSupply: adjustPieceSupply(paidPlayer.pieceSupply, {
      transportShips: -(pieceDelta.transportShips ?? 0),
      colonies: -(pieceDelta.colonies ?? 0),
      tradeStations: -(pieceDelta.tradeStations ?? 0),
    }),
  }

  const shipId = asShipId(`${working.matchId}-ship-${String(working.nextShipNumber)}`)
  const ship = createShip(shipId, shipType, playerId, intersectionId, true)

  working = {
    ...working,
    playersById: { ...working.playersById, [playerId]: updated },
    ships: { ...working.ships, [shipId]: ship },
    nextShipNumber: working.nextShipNumber + 1,
  }

  working = appendEvent(working, (sequence) => ({
    sequence,
    type: 'ShipBuilt',
    playerId,
    shipId,
    shipType,
    intersectionId,
  }))

  return {
    success: true,
    value: appendEvent(working, (sequence) => ({
      sequence,
      type: 'PieceSupplyChanged',
      playerId,
      pieceSupply: updated.pieceSupply,
    })),
  }
}

// --- Mothership upgrades -------------------------------------------------

const UPGRADE_ACTION: Readonly<Record<MothershipUpgradeKind, BuildAction>> = {
  cannon: 'cannon',
  freightPod: 'freightPod',
  booster: 'booster',
}

export function validateMothershipUpgrade(
  match: Match,
  playerId: PlayerId,
  kind: MothershipUpgradeKind,
): DomainResult<null> {
  const context = checkBuildContext(match, playerId)
  if (!context.success) {
    return context
  }
  const player = context.value

  if (!canAddUpgrade(player.mothership, kind)) {
    return failure(
      'UPGRADE_LIMIT_REACHED',
      `A Mothership may carry at most ${String(getMothershipUpgradeLimit(kind))} of that upgrade.`,
      'mothership',
    )
  }
  if (!canAffordBuild(player, UPGRADE_ACTION[kind])) {
    return failure('INSUFFICIENT_RESOURCES', 'Cannot afford that upgrade.', 'resources')
  }
  return { success: true, value: null }
}

export function buildMothershipUpgrade(
  match: Match,
  playerId: PlayerId,
  kind: MothershipUpgradeKind,
): DomainResult<Match> {
  const validation = validateMothershipUpgrade(match, playerId, kind)
  if (!validation.success) {
    return validation
  }
  const player = match.playersById[playerId]
  if (player === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }

  let working = payCost(match, player, UPGRADE_ACTION[kind])
  const paidPlayer = working.playersById[playerId]
  if (paidPlayer === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }

  const mothership = addUpgrade(paidPlayer.mothership, kind)
  const updated: Player = { ...paidPlayer, mothership }

  working = { ...working, playersById: { ...working.playersById, [playerId]: updated } }

  const total =
    kind === 'cannon'
      ? mothership.cannons
      : kind === 'freightPod'
        ? mothership.freightPods
        : mothership.boosters

  return {
    success: true,
    value: appendEvent(working, (sequence) => ({
      sequence,
      type: 'MothershipUpgraded',
      playerId,
      upgrade: kind,
      total,
    })),
  }
}
