/**
 * Normal-turn phases. Trading and building share one phase and may be
 * interleaved freely, so there is no separate `trade` then `build` sequence.
 * `sevenPending` is entered instead of production when the roll totals 7.
 */
export const TURN_PHASES = [
  'startTurn',
  'roll',
  'resolveProduction',
  'sevenPending',
  'tradeAndBuild',
  'flight',
  'endTurn',
] as const

export type TurnPhase = (typeof TURN_PHASES)[number]

export function isTurnPhase(value: string): value is TurnPhase {
  return (TURN_PHASES as readonly string[]).includes(value)
}

/**
 * Ordinary forward order, excluding the conditional `sevenPending` branch.
 * Used by documentation and tests to assert the corrected flow.
 */
export const NORMAL_TURN_PHASE_ORDER = [
  'startTurn',
  'roll',
  'resolveProduction',
  'tradeAndBuild',
  'flight',
  'endTurn',
] as const
