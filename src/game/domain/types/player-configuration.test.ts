import { describe, expect, it } from 'vitest'
import {
  isAiPlayerConfiguration,
  isValidPlayerControlConfiguration,
  type PlayerControlConfiguration,
} from './player-configuration'

describe('isAiPlayerConfiguration', () => {
  it('returns true for an AI configuration', () => {
    const config: PlayerControlConfiguration = { controlType: 'ai', difficulty: 'cadet' }
    expect(isAiPlayerConfiguration(config)).toBe(true)
  })

  it('returns false for a human configuration', () => {
    const config: PlayerControlConfiguration = { controlType: 'human' }
    expect(isAiPlayerConfiguration(config)).toBe(false)
  })
})

describe('isValidPlayerControlConfiguration', () => {
  it('accepts a human configuration', () => {
    expect(isValidPlayerControlConfiguration({ controlType: 'human' })).toBe(true)
  })

  it('accepts an AI configuration with a valid difficulty', () => {
    expect(isValidPlayerControlConfiguration({ controlType: 'ai', difficulty: 'admiral' })).toBe(
      true,
    )
  })
})
