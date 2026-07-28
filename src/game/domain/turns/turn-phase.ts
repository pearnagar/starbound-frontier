/** Closed set of normal-turn phases. Crisis resolution beyond entry is out of scope. */
export const TURN_PHASES = [
  'startTurn',
  'roll',
  'resolveProduction',
  'crisisPending',
  'trade',
  'build',
  'endTurn',
] as const

export type TurnPhase = (typeof TURN_PHASES)[number]

export function isTurnPhase(value: string): value is TurnPhase {
  return (TURN_PHASES as readonly string[]).includes(value)
}
