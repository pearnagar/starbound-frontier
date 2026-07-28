import { getSectorResourceType } from '../board/sector'
import type { PlayerId } from '../types/ids'
import { RESOURCE_TYPES, type ResourceInventory } from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import { startCrisis } from './crisis-transitions'
import { rollTwoDice } from './dice'
import type { Match } from './match'
import type { MatchEvent } from './match-events'
import { deductFromBank } from './resource-bank'
import { getProductionDemand, getShortResources } from './production'

function failure(code: string, message: string, field: string): DomainResult<never> {
  const error: DomainValidationError = { code, message, field }
  return { success: false, errors: [error] }
}

function checkInProgress(match: Match): DomainResult<null> {
  if (match.status !== 'inProgress') {
    return failure('MATCH_NOT_IN_PROGRESS', 'The match is not in progress.', 'status')
  }
  return { success: true, value: null }
}

function checkActivePlayer(match: Match, playerId: PlayerId): DomainResult<null> {
  if (match.activePlayerId !== playerId) {
    return failure('WRONG_ACTIVE_PLAYER', 'It is not this player’s turn.', 'playerId')
  }
  return { success: true, value: null }
}

function checkPhase(match: Match, expected: Match['phase']): DomainResult<null> {
  if (match.phase !== expected) {
    return failure(
      'WRONG_PHASE',
      `Expected phase "${expected}" but the match is in "${match.phase}".`,
      'phase',
    )
  }
  return { success: true, value: null }
}

function appendEvent(match: Match, buildEvent: (sequence: number) => MatchEvent): Match {
  const sequence = match.eventSequence + 1
  const event = buildEvent(sequence)
  return { ...match, events: [...match.events, event], eventSequence: sequence }
}

/**
 * Enters `startTurn` for the current active player and immediately advances
 * to `roll`, emitting `TurnStarted`. Used both to open turn 1 of the match and
 * after `endTurn` has already advanced to the next player.
 */
export function beginTurn(match: Match): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const phaseCheck = checkPhase(match, 'startTurn')
  if (!phaseCheck.success) {
    return phaseCheck
  }

  const withEvent = appendEvent(match, (sequence) => ({
    sequence,
    type: 'TurnStarted',
    playerId: match.activePlayerId,
    turnNumber: match.turnNumber,
  }))

  return { success: true, value: { ...withEvent, phase: 'roll' } }
}

export function rollDice(match: Match, playerId: PlayerId): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const activeCheck = checkActivePlayer(match, playerId)
  if (!activeCheck.success) {
    return activeCheck
  }
  const phaseCheck = checkPhase(match, 'roll')
  if (!phaseCheck.success) {
    return phaseCheck
  }

  const { result, nextRandomState } = rollTwoDice(match.randomState)

  const withEvent = appendEvent(match, (sequence) => ({
    sequence,
    type: 'DiceRolled',
    playerId,
    die1: result.die1,
    die2: result.die2,
    total: result.total,
  }))

  const rolledMatch: Match = {
    ...withEvent,
    randomState: nextRandomState,
    lastDiceResult: result,
    phase: result.total === 7 ? 'crisisPending' : 'resolveProduction',
  }

  return {
    success: true,
    value: result.total === 7 ? startCrisis(rolledMatch) : rolledMatch,
  }
}

export function resolveProduction(match: Match, playerId: PlayerId): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const activeCheck = checkActivePlayer(match, playerId)
  if (!activeCheck.success) {
    return activeCheck
  }
  const phaseCheck = checkPhase(match, 'resolveProduction')
  if (!phaseCheck.success) {
    return phaseCheck
  }
  const rollTotal = match.lastDiceResult?.total
  if (rollTotal === undefined) {
    return failure('NO_DICE_ROLLED', 'Production cannot resolve before a roll.', 'lastDiceResult')
  }

  const demand = getProductionDemand(match, rollTotal)
  const shortResources = getShortResources(demand, match.bank.quantities)

  let working = match

  for (const sector of demand.blockedSectors) {
    working = appendEvent(working, (sequence) => ({
      sequence,
      type: 'ProductionBlockedByMarauder',
      coordinate: sector.coordinate,
    }))
  }

  for (const entry of demand.producingSectors) {
    const resource = getSectorResourceType(entry.sector.type)
    const productionNumber = entry.sector.productionNumber
    // producingSectors is built only from sectors with a matching resource and
    // production number (see getProductionDemand), so both are always defined.
    if (resource === undefined || productionNumber === undefined) {
      continue
    }
    working = appendEvent(working, (sequence) => ({
      sequence,
      type: 'SectorProduced',
      coordinate: entry.sector.coordinate,
      resource,
      productionNumber,
      outpostCount: entry.outpostCount,
    }))
  }

  for (const resource of shortResources) {
    working = appendEvent(working, (sequence) => ({
      sequence,
      type: 'ResourceShortage',
      resource,
      demanded: demand.totalDemand[resource],
      available: working.bank.quantities[resource],
    }))
  }

  let playersById = working.playersById
  let bank = working.bank

  for (const [rawPlayerId, grant] of Object.entries(demand.grantsByPlayer)) {
    const filteredGrant = withoutShortResources(grant, shortResources)
    if (getTotal(filteredGrant) === 0) {
      continue
    }
    const player = playersById[rawPlayerId]
    if (player === undefined) {
      continue
    }
    const resources: Record<string, number> = { ...player.resources }
    for (const type of RESOURCE_TYPES) {
      resources[type] = player.resources[type] + filteredGrant[type]
    }
    playersById = {
      ...playersById,
      [rawPlayerId]: { ...player, resources: resources as ResourceInventory },
    }
    bank = deductFromBank(bank, filteredGrant)

    working = appendEvent({ ...working, playersById, bank }, (sequence) => ({
      sequence,
      type: 'ResourcesGranted',
      playerId: player.id,
      resources: filteredGrant,
    }))
    playersById = working.playersById
    bank = working.bank
  }

  working = appendEvent(working, (sequence) => ({
    sequence,
    type: 'ProductionResolved',
    total: rollTotal,
  }))

  return { success: true, value: { ...working, playersById, bank, phase: 'trade' } }
}

function withoutShortResources(
  grant: ResourceInventory,
  shortResources: readonly (typeof RESOURCE_TYPES)[number][],
): ResourceInventory {
  const result: Record<string, number> = { ...grant }
  for (const type of shortResources) {
    result[type] = 0
  }
  return result as ResourceInventory
}

function getTotal(inventory: ResourceInventory): number {
  return RESOURCE_TYPES.reduce((total, type) => total + inventory[type], 0)
}

export function advanceToTradePhase(match: Match, playerId: PlayerId): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const activeCheck = checkActivePlayer(match, playerId)
  if (!activeCheck.success) {
    return activeCheck
  }
  const phaseCheck = checkPhase(match, 'trade')
  if (!phaseCheck.success) {
    return phaseCheck
  }
  return { success: true, value: match }
}

export function advanceToBuildPhase(match: Match, playerId: PlayerId): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const activeCheck = checkActivePlayer(match, playerId)
  if (!activeCheck.success) {
    return activeCheck
  }
  const phaseCheck = checkPhase(match, 'trade')
  if (!phaseCheck.success) {
    return phaseCheck
  }
  return { success: true, value: { ...match, phase: 'build' } }
}

export function endTurn(match: Match, playerId: PlayerId): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const activeCheck = checkActivePlayer(match, playerId)
  if (!activeCheck.success) {
    return activeCheck
  }
  const phaseCheck = checkPhase(match, 'build')
  if (!phaseCheck.success) {
    return phaseCheck
  }

  const withEvent = appendEvent(match, (sequence) => ({
    sequence,
    type: 'TurnEnded',
    playerId,
    turnNumber: match.turnNumber,
  }))

  const nextIndex = (match.activePlayerIndex + 1) % match.playerOrder.length
  const wrapped = nextIndex === 0
  const nextPlayerId = match.playerOrder[nextIndex]
  if (nextPlayerId === undefined) {
    return failure('INVALID_PLAYER_ORDER', 'No player found at the next turn index.', 'playerOrder')
  }

  // `lastDiceResult` is dropped rather than set to undefined
  // (exactOptionalPropertyTypes), matching the setup module's convention for
  // clearing an optional field.
  const nextMatch: Match = {
    matchId: withEvent.matchId,
    board: withEvent.board,
    playersById: withEvent.playersById,
    playerOrder: withEvent.playerOrder,
    activePlayerId: nextPlayerId,
    activePlayerIndex: nextIndex,
    turnNumber: wrapped ? match.turnNumber + 1 : match.turnNumber,
    phase: 'startTurn',
    randomState: withEvent.randomState,
    outposts: withEvent.outposts,
    routes: withEvent.routes,
    bank: withEvent.bank,
    marauderCoordinate: withEvent.marauderCoordinate,
    events: withEvent.events,
    eventSequence: withEvent.eventSequence,
    status: withEvent.status,
  }

  return { success: true, value: nextMatch }
}
