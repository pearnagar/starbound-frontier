import { createSeededRandom } from '../random/seeded-random'
import type { PlayerId } from '../types/ids'
import type { Player } from '../types/player'
import {
  addResourceInventories,
  createEmptyResourceInventory,
  getTotalResourceCount,
  hasAtLeastResources,
  RESOURCE_TYPES,
  subtractResourceInventories,
  type ResourceInventory,
  type ResourceType,
} from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import { listOpponentsFromLeft, type Match } from './match'
import type { MatchEvent } from './match-events'
import { addToSupply, drawFromReserve } from './resource-bank'
import {
  computeRequiredDiscardForInventory,
  type SevenDiscardRequirement,
  type SevenState,
} from './seven-state'

function failure(code: string, message: string, field: string): DomainResult<never> {
  const error: DomainValidationError = { code, message, field }
  return { success: false, errors: [error] }
}

function appendEvent(match: Match, buildEvent: (sequence: number) => MatchEvent): Match {
  const sequence = match.eventSequence + 1
  return { ...match, events: [...match.events, buildEvent(sequence)], eventSequence: sequence }
}

/** Opponents of the active player holding at least one resource card. */
function getEligibleTargets(match: Match): readonly PlayerId[] {
  return listOpponentsFromLeft(match).filter((playerId) => {
    const player = match.playersById[playerId]
    return player !== undefined && getTotalResourceCount(player.resources) > 0
  })
}

/**
 * Opens roll-of-7 resolution. Discard requirements are fixed here from each
 * hand as it stands, so they cannot shift as other players discard. If nobody
 * owes a discard, the state advances straight to target selection.
 */
export function startSeven(match: Match): Match {
  const requirements: SevenDiscardRequirement[] = []
  for (const playerId of match.playerOrder) {
    const player = match.playersById[playerId]
    if (player === undefined) {
      continue
    }
    const requiredCount = computeRequiredDiscardForInventory(player.resources)
    if (requiredCount > 0) {
      requirements.push({ playerId, requiredCount, submitted: false })
    }
  }

  const withEvent = appendEvent(match, (sequence) => ({
    sequence,
    type: 'SevenRolled',
    playerId: match.activePlayerId,
    discardRequirements: requirements.map((requirement) => ({
      playerId: requirement.playerId,
      requiredCount: requirement.requiredCount,
    })),
  }))

  if (requirements.length === 0) {
    return { ...withEvent, sevenState: buildSelectingState(withEvent) }
  }
  return { ...withEvent, sevenState: { step: 'discarding', requirements } }
}

function buildSelectingState(match: Match): SevenState {
  return { step: 'selectingTarget', eligibleTargetIds: getEligibleTargets(match) }
}

/** Players who still owe a discard. */
export function getPendingDiscardPlayers(match: Match): readonly PlayerId[] {
  const state = match.sevenState
  if (state === undefined || state.step !== 'discarding') {
    return []
  }
  return state.requirements
    .filter((requirement) => !requirement.submitted)
    .map((requirement) => requirement.playerId)
}

export function getRequiredDiscardCount(match: Match, playerId: PlayerId): number {
  const state = match.sevenState
  if (state === undefined || state.step !== 'discarding') {
    return 0
  }
  return (
    state.requirements.find((requirement) => requirement.playerId === playerId)?.requiredCount ?? 0
  )
}

/**
 * Submits one player's discard. The total must match exactly and the player
 * must actually hold every card offered. Discards go to the face-up Supply.
 */
export function submitSevenDiscard(
  match: Match,
  playerId: PlayerId,
  discarded: ResourceInventory,
): DomainResult<Match> {
  const state = match.sevenState
  if (state === undefined || state.step !== 'discarding') {
    return failure('NOT_DISCARDING', 'No discard is pending.', 'sevenState')
  }

  const requirement = state.requirements.find((entry) => entry.playerId === playerId)
  if (requirement === undefined) {
    return failure('NO_DISCARD_REQUIRED', 'This player owes no discard.', 'playerId')
  }
  if (requirement.submitted) {
    return failure('ALREADY_DISCARDED', 'This player has already discarded.', 'playerId')
  }

  const player = match.playersById[playerId]
  if (player === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }

  if (!RESOURCE_TYPES.every((type) => Number.isInteger(discarded[type]) && discarded[type] >= 0)) {
    return failure(
      'INVALID_DISCARD',
      'Discard quantities must be non-negative integers.',
      'discarded',
    )
  }
  if (getTotalResourceCount(discarded) !== requirement.requiredCount) {
    return failure(
      'WRONG_DISCARD_TOTAL',
      `Expected exactly ${String(requirement.requiredCount)} cards.`,
      'discarded',
    )
  }
  if (!hasAtLeastResources(player.resources, discarded)) {
    return failure('INSUFFICIENT_RESOURCES', 'Player does not hold those cards.', 'discarded')
  }

  const updatedPlayer: Player = {
    ...player,
    resources: subtractResourceInventories(player.resources, discarded),
  }
  const requirements = state.requirements.map((entry) =>
    entry.playerId === playerId ? { ...entry, submitted: true } : entry,
  )

  let working: Match = {
    ...match,
    playersById: { ...match.playersById, [playerId]: updatedPlayer },
    supply: addToSupply(match.supply, discarded),
  }

  working = appendEvent(working, (sequence) => ({
    sequence,
    type: 'ResourcesDiscarded',
    playerId,
    discarded,
  }))

  const allSubmitted = requirements.every((entry) => entry.submitted)
  const nextState: SevenState = allSubmitted
    ? buildSelectingState(working)
    : { step: 'discarding', requirements }

  return { success: true, value: { ...working, sevenState: nextState } }
}

/** Opponents the active player may currently steal from. */
export function getEligibleStealTargets(match: Match): readonly PlayerId[] {
  const state = match.sevenState
  if (state === undefined || state.step !== 'selectingTarget') {
    return []
  }
  return state.eligibleTargetIds
}

/**
 * Steals one random card from a chosen opponent. Selection is weighted by
 * cards held — a flat list with one entry per card — and drawn from the seeded
 * generator, so it is deterministic and proportional. The stolen type is
 * deliberately absent from the emitted event.
 */
export function stealResource(
  match: Match,
  playerId: PlayerId,
  targetId: PlayerId,
): DomainResult<Match> {
  const state = match.sevenState
  if (state === undefined || state.step !== 'selectingTarget') {
    return failure('NOT_SELECTING_TARGET', 'No steal is pending.', 'sevenState')
  }
  if (match.activePlayerId !== playerId) {
    return failure('WRONG_ACTIVE_PLAYER', 'Only the active player may steal.', 'playerId')
  }
  if (targetId === playerId) {
    return failure('INVALID_TARGET', 'A player cannot steal from themselves.', 'targetId')
  }
  if (!state.eligibleTargetIds.includes(targetId)) {
    return failure('INVALID_TARGET', 'That opponent holds no resource cards.', 'targetId')
  }

  const thief = match.playersById[playerId]
  const target = match.playersById[targetId]
  if (thief === undefined || target === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'targetId')
  }

  const weighted: ResourceType[] = []
  for (const type of RESOURCE_TYPES) {
    for (let index = 0; index < target.resources[type]; index += 1) {
      weighted.push(type)
    }
  }

  const random = createSeededRandom(match.randomState)
  const stolen = random.pick(weighted)
  if (stolen === undefined) {
    return failure('INVALID_TARGET', 'That opponent holds no resource cards.', 'targetId')
  }
  const nextRandomState = random.nextUint32()

  const single: Record<string, number> = { ...createEmptyResourceInventory() }
  single[stolen] = 1
  const stolenInventory = single as ResourceInventory

  const updatedTarget: Player = {
    ...target,
    resources: subtractResourceInventories(target.resources, stolenInventory),
  }
  const updatedThief: Player = {
    ...thief,
    resources: addResourceInventories(thief.resources, stolenInventory),
  }

  let working: Match = {
    ...match,
    randomState: nextRandomState,
    playersById: {
      ...match.playersById,
      [targetId]: updatedTarget,
      [playerId]: updatedThief,
    },
  }

  working = appendEvent(working, (sequence) => ({
    sequence,
    type: 'ResourceStolen',
    thiefId: playerId,
    targetId,
  }))

  return {
    success: true,
    value: {
      ...working,
      sevenState: { step: 'drawing', pendingPlayerIds: listOpponentsFromLeft(working) },
    },
  }
}

/**
 * Skips theft when no opponent holds a card. Kept explicit rather than
 * auto-advancing so the caller decides when the step is over.
 */
export function skipSteal(match: Match, playerId: PlayerId): DomainResult<Match> {
  const state = match.sevenState
  if (state === undefined || state.step !== 'selectingTarget') {
    return failure('NOT_SELECTING_TARGET', 'No steal is pending.', 'sevenState')
  }
  if (match.activePlayerId !== playerId) {
    return failure('WRONG_ACTIVE_PLAYER', 'Only the active player may act.', 'playerId')
  }
  if (state.eligibleTargetIds.length > 0) {
    return failure('TARGET_AVAILABLE', 'An eligible opponent must be chosen.', 'targetId')
  }
  return {
    success: true,
    value: {
      ...match,
      sevenState: { step: 'drawing', pendingPlayerIds: listOpponentsFromLeft(match) },
    },
  }
}

/**
 * Resolves every opponent's free Reserve draw, in order from the active
 * player's left. Drawn cards are hidden, so the event records only a count.
 */
export function resolveOpponentReserveDraws(match: Match): DomainResult<Match> {
  const state = match.sevenState
  if (state === undefined || state.step !== 'drawing') {
    return failure('NOT_DRAWING', 'No Reserve draws are pending.', 'sevenState')
  }

  let working = match
  for (const playerId of state.pendingPlayerIds) {
    const player = working.playersById[playerId]
    if (player === undefined) {
      continue
    }
    const draw = drawFromReserve(working.reserve, 1, working.randomState)
    const updated: Player = {
      ...player,
      resources: addResourceInventories(player.resources, draw.inventory),
    }
    working = {
      ...working,
      playersById: { ...working.playersById, [playerId]: updated },
      reserve: draw.pile,
      randomState: draw.nextRandomState,
    }
    working = appendEvent(working, (sequence) => ({
      sequence,
      type: 'ReserveCardsDrawn',
      playerId,
      count: draw.drawn.length,
    }))
  }

  return {
    success: true,
    value: { ...working, sevenState: { step: 'drawing', pendingPlayerIds: [] } },
  }
}

/** True once nothing about the 7 remains unresolved. */
export function isSevenComplete(match: Match): boolean {
  const state = match.sevenState
  if (state === undefined) {
    return true
  }
  switch (state.step) {
    case 'discarding':
      return state.requirements.every((requirement) => requirement.submitted)
    case 'selectingTarget':
      return false
    case 'drawing':
      return state.pendingPlayerIds.length === 0
  }
}

/** Clears roll-of-7 state and moves the turn into Trade & Build. */
export function completeSeven(match: Match, playerId: PlayerId): DomainResult<Match> {
  if (match.activePlayerId !== playerId) {
    return failure('WRONG_ACTIVE_PLAYER', 'Only the active player may act.', 'playerId')
  }
  if (!isSevenComplete(match)) {
    return failure('SEVEN_UNRESOLVED', 'Roll-of-7 resolution is not finished.', 'sevenState')
  }

  const withEvent = appendEvent(match, (sequence) => ({
    sequence,
    type: 'SevenResolved',
    playerId,
  }))

  // `sevenState` is dropped rather than set to undefined (exactOptionalPropertyTypes).
  const { sevenState: _removed, ...rest }: Match & { sevenState?: SevenState } = withEvent
  void _removed

  return { success: true, value: { ...rest, phase: 'tradeAndBuild' } }
}
