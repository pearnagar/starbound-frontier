import { describe, expect, it } from 'vitest'
import { rollTwoDice } from './dice'

describe('rollTwoDice', () => {
  it('is deterministic for a given random state', () => {
    const a = rollTwoDice(12345)
    const b = rollTwoDice(12345)
    expect(a).toEqual(b)
  })

  it('produces both dice within 1-6 across many seeds', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const { result } = rollTwoDice(seed)
      expect(result.die1).toBeGreaterThanOrEqual(1)
      expect(result.die1).toBeLessThanOrEqual(6)
      expect(result.die2).toBeGreaterThanOrEqual(1)
      expect(result.die2).toBeLessThanOrEqual(6)
      expect(result.total).toBe(result.die1 + result.die2)
    }
  })

  it('advances the random state deterministically, differing from the input', () => {
    const { nextRandomState } = rollTwoDice(7)
    expect(nextRandomState).not.toBe(7)
    const again = rollTwoDice(7)
    expect(again.nextRandomState).toBe(nextRandomState)
  })

  it('produces different results for different states (not a fixed sequence)', () => {
    const results = new Set<string>()
    for (let seed = 0; seed < 50; seed += 1) {
      const { result } = rollTwoDice(seed)
      results.add(`${result.die1},${result.die2}`)
    }
    expect(results.size).toBeGreaterThan(1)
  })
})
