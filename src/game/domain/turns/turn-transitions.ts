import { getReserveDrawEntitlement } from '../rules/rules-config'
import { hasReachedVictoryTarget } from '../scoring/scoring'
import type { PlayerId } from '../types/ids'
import type { Player } from '../types/player'
import { addResourceInventories, RESOURCE_TYPES, type ResourceInventory } from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import { rollTwoDice } from './dice'
import type { Match } from './match'
import type { MatchEvent } from './match-events'
import { getProductionDemand, getShortResources } from './production'
import { deductFromSupply, drawFromReserve } from './resource-bank'
import { startSeven } from './seven-transitions'

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
  return { ...match, events: [...match.events, buildEvent(sequence)], eventSequence: sequence }
}

/** Opens the turn and advances to the roll. */
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

/**
 * Rolls two dice. A total of 7 branches into roll-of-7 resolution instead of
 * production; there is no board token to move.
 */
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
    phase: result.total === 7 ? 'sevenPending' : 'resolveProduction',
  }

  return {
    success: true,
    value: result.total === 7 ? startSeven(rolledMatch) : rolledMatch,
  }
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

/**
 * Grants planetary production, then the active player's Reserve entitlement
 * for their current victory points, and moves into Trade & Build.
 */
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
  const shortResources = getShortResources(demand, match.supply.quantities)

  let working = match

  for (const entry of demand.producingPlanets) {
    const { planet } = entry
    const productionNumber = planet.disc?.value
    if (productionNumber === undefined) {
      continue
    }
    working = appendEvent(working, (sequence) => ({
      sequence,
      type: 'PlanetProduced',
      planetId: planet.id,
      resource: planet.resource,
      productionNumber,
      structureCount: entry.structureCount,
      unitCount: entry.unitCount,
    }))
  }

  for (const resource of shortResources) {
    working = appendEvent(working, (sequence) => ({
      sequence,
      type: 'ResourceShortage',
      resource,
      demanded: demand.totalDemand[resource],
      available: working.supply.quantities[resource],
    }))
  }

  for (const [rawPlayerId, grant] of Object.entries(demand.grantsByPlayer)) {
    const filteredGrant = withoutShortResources(grant, shortResources)
    if (getTotal(filteredGrant) === 0) {
      continue
    }
    const player = working.playersById[rawPlayerId]
    if (player === undefined) {
      continue
    }
    const updated: Player = {
      ...player,
      resources: addResourceInventories(player.resources, filteredGrant),
    }
    working = {
      ...working,
      playersById: { ...working.playersById, [rawPlayerId]: updated },
      supply: deductFromSupply(working.supply, filteredGrant),
    }
    working = appendEvent(working, (sequence) => ({
      sequence,
      type: 'ResourcesGranted',
      playerId: player.id,
      resources: filteredGrant,
    }))
  }

  working = appendEvent(working, (sequence) => ({
    sequence,
    type: 'ProductionResolved',
    total: rollTotal,
  }))

  const reserveResult = grantActiveReserveDraw(working)
  if (!reserveResult.success) {
    return reserveResult
  }

  return { success: true, value: { ...reserveResult.value, phase: 'tradeAndBuild' } }
}

/**
 * Draws the active player's Reserve entitlement. Only the roller draws, and
 * only by victory points: 4-7 draws 2, 8-9 draws 1, 10+ draws none.
 */
function grantActiveReserveDraw(match: Match): DomainResult<Match> {
  const player = match.playersById[match.activePlayerId]
  if (player === undefined) {
    return failure('UNKNOWN_PLAYER', 'No active player in this match.', 'activePlayerId')
  }

  const entitlement = getReserveDrawEntitlement(player.victoryPoints)
  if (entitlement === 0) {
    return { success: true, value: match }
  }

  const draw = drawFromReserve(match.reserve, entitlement, match.randomState)
  const updated: Player = {
    ...player,
    resources: addResourceInventories(player.resources, draw.inventory),
  }

  const working: Match = {
    ...match,
    playersById: { ...match.playersById, [player.id]: updated },
    reserve: draw.pile,
    randomState: draw.nextRandomState,
  }

  return {
    success: true,
    value: appendEvent(working, (sequence) => ({
      sequence,
      type: 'ReserveCardsDrawn',
      playerId: player.id,
      count: draw.drawn.length,
    })),
  }
}

/**
 * Leaves Trade & Build for the Flight Phase. Flight itself — speed, movement,
 * encounters — is a later milestone; this only moves the phase boundary so no
 * fake movement behaviour exists.
 */
export function advanceToFlightPhase(match: Match, playerId: PlayerId): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const activeCheck = checkActivePlayer(match, playerId)
  if (!activeCheck.success) {
    return activeCheck
  }
  const phaseCheck = checkPhase(match, 'tradeAndBuild')
  if (!phaseCheck.success) {
    return phaseCheck
  }
  return { success: true, value: { ...match, phase: 'flight' } }
}

/**
 * Ends the turn. The match is won here if the active player has reached the
 * target — victory is only ever checked on the holder's own turn.
 */
export function endTurn(match: Match, playerId: PlayerId): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const activeCheck = checkActivePlayer(match, playerId)
  if (!activeCheck.success) {
    return activeCheck
  }
  const phaseCheck = checkPhase(match, 'flight')
  if (!phaseCheck.success) {
    return phaseCheck
  }

  const activePlayer = match.playersById[playerId]
  if (activePlayer === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }

  if (hasReachedVictoryTarget(activePlayer.victoryPoints)) {
    const won = appendEvent(match, (sequence) => ({
      sequence,
      type: 'MatchWon',
      playerId,
      victoryPoints: activePlayer.victoryPoints,
    }))
    return {
      success: true,
      value: { ...won, phase: 'endTurn', status: 'complete', winnerId: playerId },
    }
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

  // Ships built on a previous turn are no longer "built this turn".
  const ships = Object.fromEntries(
    Object.entries(withEvent.ships).map(([shipId, ship]) => [
      shipId,
      ship.builtThisTurn ? { ...ship, builtThisTurn: false } : ship,
    ]),
  )

  // `lastDiceResult` is dropped rather than set to undefined
  // (exactOptionalPropertyTypes).
  const { lastDiceResult: _dropped, sevenState: _seven, ...rest } = withEvent
  void _dropped
  void _seven

  return {
    success: true,
    value: {
      ...rest,
      ships,
      activePlayerId: nextPlayerId,
      activePlayerIndex: nextIndex,
      turnNumber: wrapped ? match.turnNumber + 1 : match.turnNumber,
      phase: 'startTurn',
    },
  }
}
