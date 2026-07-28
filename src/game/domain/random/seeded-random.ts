/**
 * Deterministic, dependency-free pseudo-random source.
 *
 * Pure in the sense that matters here: no `Math.random()`, no clock, no
 * browser APIs, no shared global state. Each generator owns its own counter,
 * so the same seed always replays the same sequence.
 */
export interface SeededRandom {
  /** Next raw 32-bit value. */
  nextUint32(): number
  /** Uniform integer in `[0, maxExclusive)`. */
  nextInt(maxExclusive: number): number
  /** A new array shuffled with Fisher-Yates; the input is not mutated. */
  shuffle<T>(values: readonly T[]): T[]
  /** Element at a uniformly chosen index, or `undefined` when empty. */
  pick<T>(values: readonly T[]): T | undefined
}

const UINT32_RANGE = 0x100000000

/** mulberry32 — small, fast, and good enough for content layout. */
export function createSeededRandom(seed: number): SeededRandom {
  let state = Math.trunc(seed) | 0

  function nextUint32(): number {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (t ^ (t >>> 14)) >>> 0
  }

  function nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive integer')
    }
    // Reject the ragged tail so every value is equally likely.
    const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive
    let value = nextUint32()
    while (value >= limit) {
      value = nextUint32()
    }
    return value % maxExclusive
  }

  function shuffle<T>(values: readonly T[]): T[] {
    const result = [...values]
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = nextInt(index + 1)
      const current = result[index]
      const other = result[swapIndex]
      if (current === undefined || other === undefined) {
        continue
      }
      result[index] = other
      result[swapIndex] = current
    }
    return result
  }

  function pick<T>(values: readonly T[]): T | undefined {
    if (values.length === 0) {
      return undefined
    }
    return values[nextInt(values.length)]
  }

  return { nextUint32, nextInt, shuffle, pick }
}

/**
 * Derives a distinct but reproducible seed for a numbered retry, so attempt
 * `n` of a given seed always explores the same arrangement.
 */
export function deriveAttemptSeed(seed: number, attempt: number): number {
  return (Math.imul(Math.trunc(seed) | 0, 0x9e3779b1) + Math.imul(attempt, 0x85ebca77)) | 0
}
