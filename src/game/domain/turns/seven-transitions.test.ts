import { describe, expect, it } from 'vitest'
import { createResourceInventory, getTotalResourceCount } from '../types/resources'
import type { Match } from './match'
import { computeRequiredDiscardCount } from './seven-state'
import {
  completeSeven,
  getEligibleStealTargets,
  getPendingDiscardPlayers,
  getRequiredDiscardCount,
  isSevenComplete,
  resolveOpponentReserveDraws,
  skipSteal,
  startSeven,
  stealResource,
  submitSevenDiscard,
} from './seven-transitions'
import { createTestMatch, makePlayerId } from './test-fixtures'

function expectSuccess<T>(result: { success: boolean; value?: T; errors?: unknown }): T {
  expect(result.success).toBe(true)
  if (!result.success || result.value === undefined) {
    throw new Error(`Expected success, got ${JSON.stringify(result.errors)}`)
  }
  return result.value
}

/** A match where each player holds a known hand, in `sevenPending`. */
function matchWithHands(hands: Readonly<Record<string, number>>): Match {
  const base = createTestMatch()
  const playersById = { ...base.playersById }
  for (const [playerId, count] of Object.entries(hands)) {
    const player = playersById[playerId]
    if (player === undefined) {
      continue
    }
    playersById[playerId] = {
      ...player,
      resources: createResourceInventory({ alloy: count }),
    }
  }
  return { ...base, playersById, phase: 'sevenPending' }
}

describe('discard requirement', () => {
  it('discards half rounded down above 7 cards', () => {
    expect(computeRequiredDiscardCount(9)).toBe(4)
    expect(computeRequiredDiscardCount(8)).toBe(4)
    expect(computeRequiredDiscardCount(10)).toBe(5)
    expect(computeRequiredDiscardCount(11)).toBe(5)
  })

  it('requires no discard at 7 cards or fewer', () => {
    for (const total of [0, 1, 5, 7]) {
      expect(computeRequiredDiscardCount(total)).toBe(0)
    }
  })
})

describe('roll of 7 discard step', () => {
  it('requires a discard only from players holding more than 7', () => {
    const match = startSeven(matchWithHands({ 'player-0': 9, 'player-1': 7, 'player-2': 12 }))
    expect(getPendingDiscardPlayers(match)).toEqual(['player-0', 'player-2'])
    expect(getRequiredDiscardCount(match, makePlayerId(0))).toBe(4)
    expect(getRequiredDiscardCount(match, makePlayerId(2))).toBe(6)
    expect(getRequiredDiscardCount(match, makePlayerId(1))).toBe(0)
  })

  it('fixes requirements at the moment the 7 is rolled', () => {
    const match = startSeven(matchWithHands({ 'player-0': 9, 'player-2': 12 }))
    const after = expectSuccess(
      submitSevenDiscard(match, makePlayerId(0), createResourceInventory({ alloy: 4 })),
    )
    // player-2's requirement is unchanged by player-0's discard.
    expect(getRequiredDiscardCount(after, makePlayerId(2))).toBe(6)
  })

  it('rejects a discard whose total is wrong', () => {
    const match = startSeven(matchWithHands({ 'player-0': 9 }))
    const result = submitSevenDiscard(match, makePlayerId(0), createResourceInventory({ alloy: 3 }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('WRONG_DISCARD_TOTAL')
    }
  })

  it('rejects discarding cards the player does not hold', () => {
    const match = startSeven(matchWithHands({ 'player-0': 9 }))
    const result = submitSevenDiscard(
      match,
      makePlayerId(0),
      createResourceInventory({ plasma: 4 }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('INSUFFICIENT_RESOURCES')
    }
  })

  it('returns discarded cards to the Supply', () => {
    const match = startSeven(matchWithHands({ 'player-0': 9 }))
    const before = match.supply.quantities.alloy
    const after = expectSuccess(
      submitSevenDiscard(match, makePlayerId(0), createResourceInventory({ alloy: 4 })),
    )
    expect(after.supply.quantities.alloy).toBe(before + 4)
    expect(getTotalResourceCount(after.playersById['player-0']!.resources)).toBe(5)
  })

  it('advances straight to target selection when nobody is over the limit', () => {
    const match = startSeven(matchWithHands({ 'player-0': 3, 'player-1': 2, 'player-2': 1 }))
    expect(match.sevenState?.step).toBe('selectingTarget')
  })
})

describe('roll of 7 theft', () => {
  it('offers every opponent holding cards, with no adjacency requirement', () => {
    const match = startSeven(matchWithHands({ 'player-0': 2, 'player-1': 3, 'player-2': 4 }))
    expect(getEligibleStealTargets(match).slice().sort()).toEqual(['player-1', 'player-2'])
  })

  it('never offers the active player as a target', () => {
    const match = startSeven(matchWithHands({ 'player-0': 5, 'player-1': 1, 'player-2': 1 }))
    expect(getEligibleStealTargets(match)).not.toContain(makePlayerId(0))
  })

  it('rejects an opponent holding no resource cards', () => {
    const match = startSeven(matchWithHands({ 'player-0': 2, 'player-1': 0, 'player-2': 3 }))
    expect(getEligibleStealTargets(match)).toEqual(['player-2'])

    const result = stealResource(match, makePlayerId(0), makePlayerId(1))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('INVALID_TARGET')
    }
  })

  it('moves exactly one card from target to thief', () => {
    const match = startSeven(matchWithHands({ 'player-0': 2, 'player-1': 3, 'player-2': 0 }))
    const after = expectSuccess(stealResource(match, makePlayerId(0), makePlayerId(1)))

    expect(getTotalResourceCount(after.playersById['player-0']!.resources)).toBe(3)
    expect(getTotalResourceCount(after.playersById['player-1']!.resources)).toBe(2)
  })

  it('keeps the stolen resource out of the public event', () => {
    const match = startSeven(matchWithHands({ 'player-0': 2, 'player-1': 3 }))
    const after = expectSuccess(stealResource(match, makePlayerId(0), makePlayerId(1)))
    const event = after.events.find((entry) => entry.type === 'ResourceStolen')
    expect(event).toBeDefined()
    expect(event).not.toHaveProperty('resource')
  })

  it('rejects a steal from a player who is not active', () => {
    const match = startSeven(matchWithHands({ 'player-0': 2, 'player-1': 3 }))
    const result = stealResource(match, makePlayerId(1), makePlayerId(0))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('WRONG_ACTIVE_PLAYER')
    }
  })

  it('is deterministic for a given random state', () => {
    const match = startSeven(matchWithHands({ 'player-0': 0, 'player-1': 6 }))
    const first = expectSuccess(stealResource(match, makePlayerId(0), makePlayerId(1)))
    const second = expectSuccess(stealResource(match, makePlayerId(0), makePlayerId(1)))
    expect(first.playersById['player-0']!.resources).toEqual(
      second.playersById['player-0']!.resources,
    )
  })

  it('allows skipping when no opponent holds a card', () => {
    const match = startSeven(matchWithHands({ 'player-0': 3, 'player-1': 0, 'player-2': 0 }))
    const after = expectSuccess(skipSteal(match, makePlayerId(0)))
    expect(after.sevenState?.step).toBe('drawing')
  })
})

describe('roll of 7 opponent draws', () => {
  it('gives every opponent one Reserve card, starting from the left', () => {
    const match = startSeven(matchWithHands({ 'player-0': 1, 'player-1': 2, 'player-2': 3 }))
    const stolen = expectSuccess(stealResource(match, makePlayerId(0), makePlayerId(1)))
    const drawn = expectSuccess(resolveOpponentReserveDraws(stolen))

    const draws = drawn.events.filter((event) => event.type === 'ReserveCardsDrawn')
    expect(draws).toHaveLength(2)
    expect(
      draws.map((event) => (event.type === 'ReserveCardsDrawn' ? event.playerId : '')),
    ).toEqual(['player-1', 'player-2'])
    for (const event of draws) {
      if (event.type === 'ReserveCardsDrawn') {
        expect(event.count).toBe(1)
      }
    }
  })

  it('does not give the active player a card', () => {
    const match = startSeven(matchWithHands({ 'player-0': 1, 'player-1': 2, 'player-2': 3 }))
    const stolen = expectSuccess(stealResource(match, makePlayerId(0), makePlayerId(1)))
    const drawn = expectSuccess(resolveOpponentReserveDraws(stolen))
    const draws = drawn.events.filter(
      (event) => event.type === 'ReserveCardsDrawn' && event.playerId === makePlayerId(0),
    )
    expect(draws).toHaveLength(0)
  })
})

describe('roll of 7 completion', () => {
  it('moves into Trade & Build once every step is resolved', () => {
    const match = startSeven(matchWithHands({ 'player-0': 1, 'player-1': 2, 'player-2': 3 }))
    const stolen = expectSuccess(stealResource(match, makePlayerId(0), makePlayerId(1)))
    const drawn = expectSuccess(resolveOpponentReserveDraws(stolen))

    expect(isSevenComplete(drawn)).toBe(true)
    const done = expectSuccess(completeSeven(drawn, makePlayerId(0)))
    expect(done.phase).toBe('tradeAndBuild')
    expect(done.sevenState).toBeUndefined()
  })

  it('refuses to complete while a discard is outstanding', () => {
    const match = startSeven(matchWithHands({ 'player-0': 9 }))
    expect(isSevenComplete(match)).toBe(false)
    const result = completeSeven(match, makePlayerId(0))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('SEVEN_UNRESOLVED')
    }
  })
})

describe('void marauder removal', () => {
  it('keeps no marauder location on the match', () => {
    const match = createTestMatch()
    expect(match).not.toHaveProperty('marauderCoordinate')
  })

  it('emits no marauder events during a 7', () => {
    const match = startSeven(matchWithHands({ 'player-0': 2, 'player-1': 3 }))
    const after = expectSuccess(stealResource(match, makePlayerId(0), makePlayerId(1)))
    const types = after.events.map((event) => event.type)
    expect(types).not.toContain('MarauderMoved')
    expect(types).not.toContain('ProductionBlockedByMarauder')
  })

  it('never requires a board token to move during a 7', () => {
    const match = startSeven(matchWithHands({ 'player-0': 2, 'player-1': 3 }))
    // Selection follows discards directly, with no movement step between.
    expect(match.sevenState?.step).toBe('selectingTarget')
  })
})
