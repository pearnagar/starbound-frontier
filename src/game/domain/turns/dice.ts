import { createSeededRandom } from '../random/seeded-random'
import type { DiceResult } from './match'

/**
 * Deterministically rolls two six-sided dice from a random-state seed and
 * returns the result plus the next state to use for the following draw. Pure:
 * no `Math.random()`, no clock, no shared mutable state — the same
 * `randomState` always reproduces the same roll.
 */
export function rollTwoDice(
  randomState: number,
): Readonly<{ result: DiceResult; nextRandomState: number }> {
  const random = createSeededRandom(randomState)
  const die1 = random.nextInt(6) + 1
  const die2 = random.nextInt(6) + 1
  return {
    result: { die1, die2, total: die1 + die2 },
    // Advance the state deterministically so the next roll differs. Drawing
    // one more value from the same generator and using it as the next seed
    // keeps this a pure function of the input state.
    nextRandomState: random.nextUint32(),
  }
}
