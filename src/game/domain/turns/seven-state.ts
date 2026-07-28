import { DISCARD_THRESHOLD } from '../rules/rules-config'
import type { PlayerId } from '../types/ids'
import { getTotalResourceCount, type ResourceInventory } from '../types/resources'

/**
 * Resolution state for a roll of 7. There is no board token and no adjacency
 * requirement — the steps are discard, direct theft from a chosen opponent,
 * then a free Reserve card for every opponent.
 */

export type SevenDiscardRequirement = Readonly<{
  playerId: PlayerId
  /** Cards this player must discard, fixed when the 7 was rolled. */
  requiredCount: number
  submitted: boolean
}>

/** Players are discarding; no other step may run yet. */
export type SevenDiscardingState = Readonly<{
  step: 'discarding'
  requirements: readonly SevenDiscardRequirement[]
}>

/** The active player must name an opponent to steal from. */
export type SevenSelectingTargetState = Readonly<{
  step: 'selectingTarget'
  /** Opponents holding at least one card; an empty list skips theft. */
  eligibleTargetIds: readonly PlayerId[]
}>

/** Theft resolved; opponents still owe their Reserve draws. */
export type SevenDrawingState = Readonly<{
  step: 'drawing'
  /** Opponents who have not yet drawn, in order starting from the left. */
  pendingPlayerIds: readonly PlayerId[]
}>

export type SevenState = SevenDiscardingState | SevenSelectingTargetState | SevenDrawingState

/** Cards a hand of `total` must discard: half, rounded down, above 7. */
export function computeRequiredDiscardCount(total: number): number {
  return total > DISCARD_THRESHOLD ? Math.floor(total / 2) : 0
}

export function computeRequiredDiscardForInventory(inventory: ResourceInventory): number {
  return computeRequiredDiscardCount(getTotalResourceCount(inventory))
}
