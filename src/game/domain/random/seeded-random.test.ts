import { describe, expect, it, vi } from 'vitest'
import { createSeededRandom, deriveAttemptSeed } from './seeded-random'

describe('createSeededRandom', () => {
  it('replays the same sequence for the same seed', () => {
    const first = createSeededRandom(1234)
    const second = createSeededRandom(1234)
    const a = Array.from({ length: 20 }, () => first.nextUint32())
    const b = Array.from({ length: 20 }, () => second.nextUint32())
    expect(a).toEqual(b)
  })

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, () => createSeededRandom(1).nextUint32())
    const b = Array.from({ length: 20 }, () => createSeededRandom(2).nextUint32())
    expect(a).not.toEqual(b)
  })

  it('never calls Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    const random = createSeededRandom(7)
    random.shuffle([1, 2, 3, 4, 5])
    random.nextInt(10)
    random.pick(['a', 'b'])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  describe('nextInt', () => {
    it('stays within range', () => {
      const random = createSeededRandom(99)
      for (let index = 0; index < 500; index += 1) {
        const value = random.nextInt(7)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(7)
      }
    })

    it('always returns 0 for a range of one', () => {
      expect(createSeededRandom(3).nextInt(1)).toBe(0)
    })

    it('rejects a non-positive or fractional range', () => {
      const random = createSeededRandom(3)
      expect(() => random.nextInt(0)).toThrow(RangeError)
      expect(() => random.nextInt(-1)).toThrow(RangeError)
      expect(() => random.nextInt(1.5)).toThrow(RangeError)
    })
  })

  describe('shuffle', () => {
    it('preserves the multiset and leaves the input untouched', () => {
      const source = [1, 2, 3, 4, 5, 6, 7, 8]
      const shuffled = createSeededRandom(42).shuffle(source)
      expect([...shuffled].sort((a, b) => a - b)).toEqual(source)
      expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('is deterministic for a given seed', () => {
      const source = [1, 2, 3, 4, 5, 6, 7, 8]
      expect(createSeededRandom(42).shuffle(source)).toEqual(createSeededRandom(42).shuffle(source))
    })

    it('handles empty and single-element inputs', () => {
      const random = createSeededRandom(5)
      expect(random.shuffle([])).toEqual([])
      expect(random.shuffle(['only'])).toEqual(['only'])
    })
  })

  describe('pick', () => {
    it('returns an element of the array', () => {
      const values = ['a', 'b', 'c']
      expect(values).toContain(createSeededRandom(11).pick(values))
    })

    it('returns undefined for an empty array', () => {
      expect(createSeededRandom(11).pick([])).toBeUndefined()
    })
  })
})

describe('deriveAttemptSeed', () => {
  it('is stable for the same seed and attempt', () => {
    expect(deriveAttemptSeed(500, 3)).toBe(deriveAttemptSeed(500, 3))
  })

  it('separates attempts and seeds', () => {
    expect(deriveAttemptSeed(500, 1)).not.toBe(deriveAttemptSeed(500, 2))
    expect(deriveAttemptSeed(500, 1)).not.toBe(deriveAttemptSeed(501, 1))
  })
})
