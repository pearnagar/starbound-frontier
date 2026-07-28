import { describe, expect, it } from 'vitest'
import { asCaptainId, asFactionColorId, asPlayerId } from './ids'
import type { AiPlayerConfiguration, HumanPlayerConfiguration } from './player-configuration'
import { createPlayer, type CreatePlayerInput } from './player'
import { getTotalResourceCount } from './resources'

function baseInput(overrides: Partial<CreatePlayerInput> = {}): CreatePlayerInput {
  return {
    id: asPlayerId('player-1'),
    name: 'Ada',
    seatIndex: 0,
    captainId: asCaptainId('captain-1'),
    factionColorId: asFactionColorId('color-1'),
    control: { controlType: 'human' },
    ...overrides,
  }
}

describe('createPlayer', () => {
  it('creates a human player correctly', () => {
    const result = createPlayer(baseInput({ name: '  Ada  ' }))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.name).toBe('Ada')
    expect(result.value.control).toEqual({ controlType: 'human' })
  })

  it('creates an AI player and stores its difficulty', () => {
    const result = createPlayer(
      baseInput({ control: { controlType: 'ai', difficulty: 'commander' } }),
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.control).toEqual({ controlType: 'ai', difficulty: 'commander' })
  })

  it('AI player configuration requires a difficulty', () => {
    // @ts-expect-error AiPlayerConfiguration requires a `difficulty` property.
    const missingDifficulty: AiPlayerConfiguration = { controlType: 'ai' }
    expect(missingDifficulty.difficulty).toBeUndefined()
  })

  it('human configuration cannot contain AI difficulty through the public API', () => {
    const humanConfig: HumanPlayerConfiguration = { controlType: 'human' }
    // @ts-expect-error HumanPlayerConfiguration has no `difficulty` property.
    expect(humanConfig.difficulty).toBeUndefined()
  })

  it('initializes an empty resource inventory', () => {
    const result = createPlayer(baseInput())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(getTotalResourceCount(result.value.resources)).toBe(0)
  })

  it('initializes the standard piece supply', () => {
    const result = createPlayer(baseInput())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.pieceSupply).toEqual({
      tradeRoutes: 15,
      outposts: 5,
      colonies: 4,
      nexus: 2,
    })
  })

  it('starts counters at zero and milestones empty', () => {
    const result = createPlayer(baseInput())
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.tradeCount).toBe(0)
    expect(result.value.exploredSectorCount).toBe(0)
    expect(result.value.cachedVictoryPoints).toBe(0)
    expect(result.value.earnedMilestoneIds).toEqual([])
  })

  it('rejects an empty display name', () => {
    const result = createPlayer(baseInput({ name: '' }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.some((error) => error.code === 'INVALID_NAME')).toBe(true)
  })

  it('rejects a whitespace-only display name', () => {
    const result = createPlayer(baseInput({ name: '   ' }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.some((error) => error.code === 'INVALID_NAME')).toBe(true)
  })

  it('rejects a negative seat index', () => {
    const result = createPlayer(baseInput({ seatIndex: -1 }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.some((error) => error.code === 'INVALID_SEAT_INDEX')).toBe(true)
  })

  it('rejects a fractional seat index', () => {
    const result = createPlayer(baseInput({ seatIndex: 1.5 }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.some((error) => error.code === 'INVALID_SEAT_INDEX')).toBe(true)
  })

  it('does not share mutable nested state between players', () => {
    const first = createPlayer(baseInput({ id: asPlayerId('p1') }))
    const second = createPlayer(baseInput({ id: asPlayerId('p2') }))
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    if (!first.success || !second.success) return
    expect(first.value.resources).not.toBe(second.value.resources)
    expect(first.value.pieceSupply).not.toBe(second.value.pieceSupply)
    expect(first.value.earnedMilestoneIds).not.toBe(second.value.earnedMilestoneIds)
  })
})
