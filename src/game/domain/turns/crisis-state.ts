import type { PlayerId } from '../types/ids'

/**
 * Active crisis sub-state, entered when a roll totals 7. `Match.crisisState`
 * is `undefined` whenever no crisis is in progress — the union below only
 * models states that exist *during* one, so a match can never simultaneously
 * claim (for example) that discards are pending and that theft is pending.
 */

/** One player's fixed discard requirement, computed when the crisis began. */
export type CrisisDiscardRequirement = Readonly<{
  playerId: PlayerId
  requiredCount: number
}>

export type CrisisDiscardingState = Readonly<{
  status: 'discarding'
  /** Fixed at crisis start; does not change as players submit discards. */
  requirements: readonly CrisisDiscardRequirement[]
  /** Player ids from `requirements` that have not yet submitted a valid discard. */
  pendingPlayerIds: readonly PlayerId[]
}>

export type CrisisMovingMarauderState = Readonly<{
  status: 'movingMarauder'
}>

export type CrisisSelectingStealTargetState = Readonly<{
  status: 'selectingStealTarget'
  /** Unique opponent ids adjacent to the Marauder's new sector, each holding resources. */
  eligibleTargetIds: readonly PlayerId[]
}>

export type CrisisStealingState = Readonly<{
  status: 'stealing'
  targetId: PlayerId
}>

export type CrisisState =
  | CrisisDiscardingState
  | CrisisMovingMarauderState
  | CrisisSelectingStealTargetState
  | CrisisStealingState

/** Half of a total resource count, rounded down. */
export function computeRequiredDiscardCount(totalResourceCount: number): number {
  return Math.floor(totalResourceCount / 2)
}
