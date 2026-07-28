import { describe, expect, it } from 'vitest'
import { createResourceInventory } from '../types/resources'
import type { Match } from '../turns/match'
import { createTestMatch } from '../turns/test-fixtures'
import { getTradeRateFor, tradeWithSupply, validateSupplyTrade } from './supply-trade'

function expectSuccess<T>(result: { success: boolean; value?: T; errors?: unknown }): T {
  expect(result.success).toBe(true)
  if (!result.success || result.value === undefined) {
    throw new Error(`Expected success, got ${JSON.stringify(result.errors)}`)
  }
  return result.value
}

function tradableMatch(resources: Parameters<typeof createResourceInventory>[0]): Match {
  const base = createTestMatch()
  const activeId = base.activePlayerId
  return {
    ...base,
    phase: 'tradeAndBuild',
    playersById: {
      ...base.playersById,
      [activeId]: {
        ...base.playersById[activeId]!,
        resources: createResourceInventory(resources),
      },
    },
  }
}

describe('supply trade rates', () => {
  it('trades ordinary resources at 3:1', () => {
    for (const resource of ['alloy', 'plasma', 'cryonite', 'biofiber'] as const) {
      expect(getTradeRateFor(resource)).toBe(3)
    }
  })

  it('trades quantumCore at 2:1', () => {
    expect(getTradeRateFor('quantumCore')).toBe(2)
  })
})

describe('trading with the supply', () => {
  it('exchanges 3 identical cards for 1 different card', () => {
    const match = tradableMatch({ alloy: 3 })
    const after = expectSuccess(tradeWithSupply(match, match.activePlayerId, 'alloy', 'plasma'))
    const player = after.playersById[after.activePlayerId]!

    expect(player.resources.alloy).toBe(0)
    expect(player.resources.plasma).toBe(1)
  })

  it('exchanges 2 quantumCore for 1 different card', () => {
    const match = tradableMatch({ quantumCore: 2 })
    const after = expectSuccess(
      tradeWithSupply(match, match.activePlayerId, 'quantumCore', 'cryonite'),
    )
    const player = after.playersById[after.activePlayerId]!

    expect(player.resources.quantumCore).toBe(0)
    expect(player.resources.cryonite).toBe(1)
  })

  it('returns traded cards to the Supply and takes the received card from it', () => {
    const match = tradableMatch({ alloy: 3 })
    const before = match.supply.quantities
    const after = expectSuccess(tradeWithSupply(match, match.activePlayerId, 'alloy', 'plasma'))

    expect(after.supply.quantities.alloy).toBe(before.alloy + 3)
    expect(after.supply.quantities.plasma).toBe(before.plasma - 1)
  })

  it('rejects a trade below the required rate', () => {
    const match = tradableMatch({ alloy: 2 })
    const result = validateSupplyTrade(match, match.activePlayerId, 'alloy', 'plasma')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('INSUFFICIENT_RESOURCES')
    }
  })

  it('rejects 2-for-1 on a resource that is not the goods equivalent', () => {
    const match = tradableMatch({ alloy: 2 })
    expect(validateSupplyTrade(match, match.activePlayerId, 'alloy', 'plasma').success).toBe(false)
  })

  it('rejects trading a resource for itself', () => {
    const match = tradableMatch({ alloy: 5 })
    const result = validateSupplyTrade(match, match.activePlayerId, 'alloy', 'alloy')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('INVALID_TRADE')
    }
  })

  it('allows only the active player to trade with the Supply', () => {
    const match = tradableMatch({ alloy: 3 })
    const other = match.playerOrder[1]!
    const result = validateSupplyTrade(match, other, 'alloy', 'plasma')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('WRONG_ACTIVE_PLAYER')
    }
  })

  it('rejects trading outside Trade & Build', () => {
    const match: Match = { ...tradableMatch({ alloy: 3 }), phase: 'roll' }
    const result = validateSupplyTrade(match, match.activePlayerId, 'alloy', 'plasma')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('WRONG_PHASE')
    }
  })

  it('does not mutate the match', () => {
    const match = tradableMatch({ alloy: 3 })
    const snapshot = JSON.parse(JSON.stringify(match)) as unknown
    expectSuccess(tradeWithSupply(match, match.activePlayerId, 'alloy', 'plasma'))
    expect(JSON.parse(JSON.stringify(match)) as unknown).toEqual(snapshot)
  })
})
