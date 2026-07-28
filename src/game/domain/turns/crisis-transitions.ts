import { getSector, listSectors } from '../board/board'
import { hexCoordinatesEqual, type HexCoordinate } from '../board/hex-coordinate'
import { getHexVertices } from '../board/vertex'
import { createSeededRandom } from '../random/seeded-random'
import type { PlayerId } from '../types/ids'
import {
  getTotalResourceCount,
  RESOURCE_TYPES,
  type ResourceInventory,
  type ResourceType,
} from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import {
  computeRequiredDiscardCount,
  type CrisisDiscardRequirement,
  type CrisisState,
} from './crisis-state'
import type { Match } from './match'
import type { MatchEvent } from './match-events'
import { addToBank } from './resource-bank'

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

function checkCrisisPhase(match: Match): DomainResult<null> {
  if (match.phase !== 'crisisPending') {
    return failure(
      'WRONG_PHASE',
      `Expected phase "crisisPending" but the match is in "${match.phase}".`,
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

function getTotal(inventory: ResourceInventory): number {
  return RESOURCE_TYPES.reduce((total, type) => total + inventory[type], 0)
}

/**
 * Builds the crisis's fixed discard requirements from the match's current
 * player inventories, in deterministic player-order.
 */
function buildDiscardRequirements(match: Match): readonly CrisisDiscardRequirement[] {
  const requirements: CrisisDiscardRequirement[] = []
  for (const playerId of match.playerOrder) {
    const player = match.playersById[playerId]
    if (player === undefined) {
      continue
    }
    const total = getTotalResourceCount(player.resources)
    if (total > 7) {
      requirements.push({ playerId, requiredCount: computeRequiredDiscardCount(total) })
    }
  }
  return requirements
}

/**
 * Enters the crisis for a roll of 7: computes fixed discard requirements from
 * current player inventories and either starts the `discarding` sub-state or,
 * if nobody must discard, moves straight to `movingMarauder`. Called by
 * `rollDice` — not part of the public crisis API, since callers never invoke
 * it directly.
 */
export function startCrisis(match: Match): Match {
  const requirements = buildDiscardRequirements(match)

  const withEvent = appendEvent(match, (sequence) => ({
    sequence,
    type: 'CrisisStarted',
    requirements,
  }))

  const crisisState: CrisisState =
    requirements.length === 0
      ? { status: 'movingMarauder' }
      : {
          status: 'discarding',
          requirements,
          pendingPlayerIds: requirements.map((requirement) => requirement.playerId),
        }

  return { ...withEvent, crisisState }
}

/** Required discard count for `playerId` in the active crisis, or 0 if none applies. */
export function getRequiredDiscardCount(match: Match, playerId: PlayerId): number {
  if (match.crisisState === undefined || match.crisisState.status !== 'discarding') {
    return 0
  }
  const requirement = match.crisisState.requirements.find((r) => r.playerId === playerId)
  return requirement?.requiredCount ?? 0
}

/** Player ids that have not yet submitted a valid discard, or `[]` outside the discard sub-state. */
export function getPendingDiscardPlayers(match: Match): readonly PlayerId[] {
  if (match.crisisState === undefined || match.crisisState.status !== 'discarding') {
    return []
  }
  return match.crisisState.pendingPlayerIds
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

/**
 * Submits `playerId`'s discard selection. `actingPlayerId` must equal
 * `playerId` — this milestone exposes no trusted-system variant.
 */
export function submitCrisisDiscard(
  match: Match,
  actingPlayerId: PlayerId,
  playerId: PlayerId,
  discarded: ResourceInventory,
): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const phaseCheck = checkCrisisPhase(match)
  if (!phaseCheck.success) {
    return phaseCheck
  }
  if (actingPlayerId !== playerId) {
    return failure(
      'CANNOT_SUBMIT_FOR_OTHER_PLAYER',
      'A player may only submit their own discard.',
      'actingPlayerId',
    )
  }
  if (match.crisisState === undefined || match.crisisState.status !== 'discarding') {
    return failure(
      'NO_DISCARD_PENDING',
      'The crisis is not currently waiting on discards.',
      'crisisState',
    )
  }
  if (!match.crisisState.pendingPlayerIds.includes(playerId)) {
    return failure(
      'PLAYER_NOT_REQUIRED_TO_DISCARD',
      'This player is not required to discard.',
      'playerId',
    )
  }

  for (const type of RESOURCE_TYPES) {
    const quantity = discarded[type]
    if (!isNonNegativeInteger(quantity)) {
      return failure(
        'INVALID_DISCARD_QUANTITY',
        `Discard quantity for "${type}" must be a non-negative integer.`,
        'discarded',
      )
    }
  }

  const requiredCount = getRequiredDiscardCount(match, playerId)
  const submittedTotal = getTotal(discarded)
  if (submittedTotal !== requiredCount) {
    return failure(
      'INCORRECT_DISCARD_TOTAL',
      `Expected exactly ${requiredCount} cards discarded, got ${submittedTotal}.`,
      'discarded',
    )
  }

  const player = match.playersById[playerId]
  if (player === undefined) {
    return failure('PLAYER_NOT_FOUND', 'No player found for this id.', 'playerId')
  }
  for (const type of RESOURCE_TYPES) {
    if (discarded[type] > player.resources[type]) {
      return failure(
        'INSUFFICIENT_PLAYER_RESOURCES',
        `Player does not own enough "${type}" to discard that many.`,
        'discarded',
      )
    }
  }

  const resources: Record<ResourceType, number> = { ...player.resources }
  for (const type of RESOURCE_TYPES) {
    resources[type] -= discarded[type]
  }

  const playersById = {
    ...match.playersById,
    [playerId]: { ...player, resources: resources as ResourceInventory },
  }
  const bank = addToBank(match.bank, discarded)

  const withEvent = appendEvent({ ...match, playersById, bank }, (sequence) => ({
    sequence,
    type: 'ResourcesDiscarded',
    playerId,
    discarded,
  }))

  const remainingPendingIds = match.crisisState.pendingPlayerIds.filter((id) => id !== playerId)
  const nextCrisisState: CrisisState =
    remainingPendingIds.length === 0
      ? { status: 'movingMarauder' }
      : {
          status: 'discarding',
          requirements: match.crisisState.requirements,
          pendingPlayerIds: remainingPendingIds,
        }

  return { success: true, value: { ...withEvent, crisisState: nextCrisisState } }
}

/** Every sector coordinate on the board other than the Marauder's current one. */
export function getLegalMarauderDestinations(match: Match): readonly HexCoordinate[] {
  return listSectors(match.board)
    .map((sector) => sector.coordinate)
    .filter((coordinate) => !hexCoordinatesEqual(coordinate, match.marauderCoordinate))
}

/**
 * Moves the Void Marauder to `destination`. Only legal once all crisis
 * discards are complete; computes eligible steal targets immediately after.
 */
export function moveMarauder(
  match: Match,
  playerId: PlayerId,
  destination: HexCoordinate,
): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const phaseCheck = checkCrisisPhase(match)
  if (!phaseCheck.success) {
    return phaseCheck
  }
  if (match.activePlayerId !== playerId) {
    return failure(
      'WRONG_ACTIVE_PLAYER',
      'Only the active player may move the Marauder.',
      'playerId',
    )
  }
  if (match.crisisState === undefined || match.crisisState.status !== 'movingMarauder') {
    return failure(
      'MARAUDER_MOVE_NOT_PENDING',
      'The Marauder cannot move until required discards finish.',
      'crisisState',
    )
  }

  const targetSector = getSector(match.board, destination)
  if (targetSector === undefined) {
    return failure(
      'DESTINATION_OFF_BOARD',
      'Destination is not a sector on the board.',
      'destination',
    )
  }
  if (hexCoordinatesEqual(destination, match.marauderCoordinate)) {
    return failure(
      'DESTINATION_UNCHANGED',
      'The Marauder must move to a different sector.',
      'destination',
    )
  }

  const withEvent = appendEvent(match, (sequence) => ({
    sequence,
    type: 'MarauderMoved',
    playerId,
    from: match.marauderCoordinate,
    to: destination,
  }))

  const eligibleTargetIds = getAdjacentEligibleTargets(withEvent, destination)

  const nextCrisisState: CrisisState =
    eligibleTargetIds.length === 0
      ? // No eligible target: the crisis finishes immediately (handled by the
        // caller via isCrisisComplete/completeCrisis semantics below).
        { status: 'selectingStealTarget', eligibleTargetIds: [] }
      : { status: 'selectingStealTarget', eligibleTargetIds }

  return {
    success: true,
    value: { ...withEvent, marauderCoordinate: destination, crisisState: nextCrisisState },
  }
}

/** Unique opponent ids adjacent to `coordinate` holding at least one resource. */
function getAdjacentEligibleTargets(match: Match, coordinate: HexCoordinate): readonly PlayerId[] {
  const sector = getSector(match.board, coordinate)
  if (sector === undefined) {
    return []
  }

  const eligibleIds = new Set<PlayerId>()
  const orderedIds: PlayerId[] = []
  const vertexIds = new Set(getHexVertices(sector.coordinate))

  for (const structure of Object.values(match.structures)) {
    if (!vertexIds.has(structure.vertexId)) {
      continue
    }
    if (structure.ownerId === match.activePlayerId) {
      continue
    }
    if (eligibleIds.has(structure.ownerId)) {
      continue
    }
    const player = match.playersById[structure.ownerId]
    if (player === undefined) {
      continue
    }
    if (getTotalResourceCount(player.resources) === 0) {
      continue
    }
    eligibleIds.add(structure.ownerId)
    orderedIds.push(structure.ownerId)
  }

  return orderedIds
}

/** Eligible steal targets after the Marauder has moved, or `[]` otherwise. */
export function getEligibleStealTargets(match: Match): readonly PlayerId[] {
  if (match.crisisState === undefined || match.crisisState.status !== 'selectingStealTarget') {
    return []
  }
  return match.crisisState.eligibleTargetIds
}

/**
 * Steals exactly one resource from `targetId`'s hand, chosen with probability
 * proportional to how many of each resource type they hold, using the
 * match's seeded random state. Advances `randomState` deterministically.
 */
export function stealCrisisResource(
  match: Match,
  playerId: PlayerId,
  targetId: PlayerId,
): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const phaseCheck = checkCrisisPhase(match)
  if (!phaseCheck.success) {
    return phaseCheck
  }
  if (match.activePlayerId !== playerId) {
    return failure('WRONG_ACTIVE_PLAYER', 'Only the active player may steal.', 'playerId')
  }
  if (match.crisisState === undefined || match.crisisState.status !== 'selectingStealTarget') {
    return failure('STEAL_NOT_PENDING', 'Stealing is not currently pending.', 'crisisState')
  }
  if (!match.crisisState.eligibleTargetIds.includes(targetId)) {
    return failure(
      'INVALID_STEAL_TARGET',
      'This player is not an eligible steal target.',
      'targetId',
    )
  }

  const target = match.playersById[targetId]
  const thief = match.playersById[playerId]
  if (target === undefined || thief === undefined) {
    return failure('PLAYER_NOT_FOUND', 'No player found for this id.', 'targetId')
  }

  const weightedTypes: ResourceType[] = []
  for (const type of RESOURCE_TYPES) {
    for (let i = 0; i < target.resources[type]; i += 1) {
      weightedTypes.push(type)
    }
  }
  if (weightedTypes.length === 0) {
    return failure(
      'STEAL_TARGET_HAS_NO_RESOURCES',
      'The selected target has no resources to steal.',
      'targetId',
    )
  }

  const rng = createSeededRandom(match.randomState)
  const stolenType = rng.pick(weightedTypes)
  if (stolenType === undefined) {
    return failure(
      'STEAL_TARGET_HAS_NO_RESOURCES',
      'The selected target has no resources to steal.',
      'targetId',
    )
  }
  const nextRandomState = rng.nextUint32()

  const targetResources: Record<ResourceType, number> = { ...target.resources }
  targetResources[stolenType] -= 1
  const thiefResources: Record<ResourceType, number> = { ...thief.resources }
  thiefResources[stolenType] += 1

  const playersById = {
    ...match.playersById,
    [targetId]: { ...target, resources: targetResources as ResourceInventory },
    [playerId]: { ...thief, resources: thiefResources as ResourceInventory },
  }

  const withEvent = appendEvent(
    { ...match, playersById, randomState: nextRandomState },
    (sequence) => ({
      sequence,
      type: 'ResourceStolen',
      thiefId: playerId,
      targetId,
    }),
  )

  return {
    success: true,
    value: { ...withEvent, crisisState: { status: 'stealing', targetId } },
  }
}

/** True once the active crisis has no remaining work (including "no crisis at all"). */
export function isCrisisComplete(match: Match): boolean {
  if (match.phase !== 'crisisPending') {
    return true
  }
  if (match.crisisState === undefined) {
    return true
  }
  if (match.crisisState.status === 'selectingStealTarget') {
    return match.crisisState.eligibleTargetIds.length === 0
  }
  return match.crisisState.status === 'stealing'
}

/**
 * Clears crisis state and advances to `trade`, preserving the active player
 * and the rolled dice result. Only legal once `isCrisisComplete` is true.
 */
export function completeCrisis(match: Match, playerId: PlayerId): DomainResult<Match> {
  const inProgress = checkInProgress(match)
  if (!inProgress.success) {
    return inProgress
  }
  const phaseCheck = checkCrisisPhase(match)
  if (!phaseCheck.success) {
    return phaseCheck
  }
  if (match.activePlayerId !== playerId) {
    return failure(
      'WRONG_ACTIVE_PLAYER',
      'Only the active player may complete the crisis.',
      'playerId',
    )
  }
  if (!isCrisisComplete(match)) {
    return failure('CRISIS_NOT_COMPLETE', 'Crisis work remains unresolved.', 'crisisState')
  }

  const withEvent = appendEvent(match, (sequence) => ({
    sequence,
    type: 'CrisisCompleted',
    playerId,
  }))

  // `crisisState` is dropped rather than set to undefined
  // (exactOptionalPropertyTypes), matching endTurn's convention for clearing
  // an optional field.
  const nextMatch: Match = {
    matchId: withEvent.matchId,
    board: withEvent.board,
    playersById: withEvent.playersById,
    playerOrder: withEvent.playerOrder,
    activePlayerId: withEvent.activePlayerId,
    activePlayerIndex: withEvent.activePlayerIndex,
    turnNumber: withEvent.turnNumber,
    phase: 'trade',
    randomState: withEvent.randomState,
    ...(withEvent.lastDiceResult === undefined ? {} : { lastDiceResult: withEvent.lastDiceResult }),
    structures: withEvent.structures,
    routes: withEvent.routes,
    bank: withEvent.bank,
    marauderCoordinate: withEvent.marauderCoordinate,
    events: withEvent.events,
    eventSequence: withEvent.eventSequence,
    status: withEvent.status,
  }

  return { success: true, value: nextMatch }
}
