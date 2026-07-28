import { describe, expect, it } from 'vitest'
import { getTotalResourceCount } from '../types/resources'
import type { Match } from './match'
import { NORMAL_TURN_PHASE_ORDER, TURN_PHASES } from './turn-phase'
import { createTestMatch } from './test-fixtures'
import {
  advanceToFlightPhase,
  beginTurn,
  endTurn,
  resolveProduction,
  rollDice,
} from './turn-transitions'

function expectSuccess<T>(result: { success: boolean; value?: T; errors?: unknown }): T {
  expect(result.success).toBe(true)
  if (!result.success || result.value === undefined) {
    throw new Error(`Expected success, got ${JSON.stringify(result.errors)}`)
  }
  return result.value
}

/** Rolls until a non-7 total, so production tests are not hijacked by a 7. */
function rollNonSeven(match: Match): Match {
  let working = match
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const begun = expectSuccess(beginTurn(working))
    const rolled = expectSuccess(rollDice(begun, begun.activePlayerId))
    if (rolled.lastDiceResult?.total !== 7) {
      return rolled
    }
    // Drop the pending seven state rather than assigning undefined
    // (exactOptionalPropertyTypes) so the turn can simply be ended.
    const { sevenState: _pending, ...withoutSeven } = rolled
    void _pending
    working = expectSuccess(endTurn({ ...withoutSeven, phase: 'flight' }, rolled.activePlayerId))
  }
  throw new Error('Could not obtain a non-7 roll')
}

describe('turn phases', () => {
  it('exposes the corrected phase set', () => {
    expect(TURN_PHASES).toEqual([
      'startTurn',
      'roll',
      'resolveProduction',
      'sevenPending',
      'tradeAndBuild',
      'flight',
      'endTurn',
    ])
  })

  it('orders Production, Trade & Build, then Flight', () => {
    expect(NORMAL_TURN_PHASE_ORDER).toEqual([
      'startTurn',
      'roll',
      'resolveProduction',
      'tradeAndBuild',
      'flight',
      'endTurn',
    ])
  })

  it('has no separate trade and build phases', () => {
    expect(TURN_PHASES).not.toContain('trade')
    expect(TURN_PHASES).not.toContain('build')
  })

  it('has no crisis phase', () => {
    expect(TURN_PHASES).not.toContain('crisisPending')
  })
})

describe('normal turn flow', () => {
  it('runs Production into a single Trade & Build phase, then Flight', () => {
    const rolled = rollNonSeven(createTestMatch())
    expect(rolled.phase).toBe('resolveProduction')

    const produced = expectSuccess(resolveProduction(rolled, rolled.activePlayerId))
    expect(produced.phase).toBe('tradeAndBuild')

    const flight = expectSuccess(advanceToFlightPhase(produced, produced.activePlayerId))
    expect(flight.phase).toBe('flight')

    const ended = expectSuccess(endTurn(flight, flight.activePlayerId))
    expect(ended.phase).toBe('startTurn')
  })

  it('rejects leaving Trade & Build out of turn order', () => {
    const match = createTestMatch()
    const begun = expectSuccess(beginTurn(match))
    const result = advanceToFlightPhase(begun, begun.activePlayerId)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('WRONG_PHASE')
    }
  })

  it('rejects actions from a player whose turn it is not', () => {
    const match = createTestMatch()
    const begun = expectSuccess(beginTurn(match))
    const other = begun.playerOrder[1]!
    const result = rollDice(begun, other)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('WRONG_ACTIVE_PLAYER')
    }
  })

  it('advances to the next player in seat order', () => {
    const match = createTestMatch()
    const rolled = rollNonSeven(match)
    const produced = expectSuccess(resolveProduction(rolled, rolled.activePlayerId))
    const flight = expectSuccess(advanceToFlightPhase(produced, produced.activePlayerId))
    const ended = expectSuccess(endTurn(flight, flight.activePlayerId))

    const expectedIndex = (flight.activePlayerIndex + 1) % flight.playerOrder.length
    expect(ended.activePlayerIndex).toBe(expectedIndex)
    expect(ended.activePlayerId).toBe(flight.playerOrder[expectedIndex])
  })

  it('increments the turn number only when seat order wraps', () => {
    const match = createTestMatch()
    // Drive the last seat directly so ending its turn wraps to seat 0.
    const lastIndex = match.playerOrder.length - 1
    const atLastSeat: Match = {
      ...match,
      activePlayerIndex: lastIndex,
      activePlayerId: match.playerOrder[lastIndex]!,
      phase: 'flight',
    }
    const wrapped = expectSuccess(endTurn(atLastSeat, atLastSeat.activePlayerId))
    expect(wrapped.activePlayerIndex).toBe(0)
    expect(wrapped.turnNumber).toBe(match.turnNumber + 1)

    const atFirstSeat: Match = { ...match, phase: 'flight' }
    const notWrapped = expectSuccess(endTurn(atFirstSeat, atFirstSeat.activePlayerId))
    expect(notWrapped.turnNumber).toBe(match.turnNumber)
  })
})

describe('reserve entitlement on production', () => {
  it('draws 2 cards for a player on 4 victory points', () => {
    const rolled = rollNonSeven(createTestMatch())
    const before = rolled.playersById[rolled.activePlayerId]!
    const produced = expectSuccess(resolveProduction(rolled, rolled.activePlayerId))
    const after = produced.playersById[produced.activePlayerId]!

    const drawnEvent = produced.events.find((event) => event.type === 'ReserveCardsDrawn')
    expect(drawnEvent).toBeDefined()
    if (drawnEvent?.type === 'ReserveCardsDrawn') {
      expect(drawnEvent.count).toBe(2)
      expect(drawnEvent.playerId).toBe(produced.activePlayerId)
    }

    // The hand grew by the Reserve draw plus any planetary production.
    expect(getTotalResourceCount(after.resources)).toBeGreaterThanOrEqual(
      getTotalResourceCount(before.resources) + 2,
    )
  })

  it('draws only for the active player', () => {
    const rolled = rollNonSeven(createTestMatch())
    const produced = expectSuccess(resolveProduction(rolled, rolled.activePlayerId))
    const draws = produced.events.filter((event) => event.type === 'ReserveCardsDrawn')
    expect(draws).toHaveLength(1)
  })

  it('draws 1 card at 8 victory points and none at 10', () => {
    const base = createTestMatch()
    for (const [points, expected] of [
      [8, 1],
      [10, 0],
    ] as const) {
      const activeId = base.activePlayerId
      const adjusted: Match = {
        ...base,
        playersById: {
          ...base.playersById,
          [activeId]: { ...base.playersById[activeId]!, victoryPoints: points },
        },
      }
      const rolled = rollNonSeven(adjusted)
      const produced = expectSuccess(resolveProduction(rolled, rolled.activePlayerId))
      const draws = produced.events.filter((event) => event.type === 'ReserveCardsDrawn')
      if (expected === 0) {
        expect(draws).toHaveLength(0)
      } else {
        expect(draws).toHaveLength(1)
        if (draws[0]?.type === 'ReserveCardsDrawn') {
          expect(draws[0].count).toBe(expected)
        }
      }
    }
  })
})

describe('immutability and determinism', () => {
  it('never mutates the match passed in', () => {
    const match = createTestMatch()
    const snapshot = JSON.parse(JSON.stringify(match)) as unknown
    const begun = expectSuccess(beginTurn(match))
    expectSuccess(rollDice(begun, begun.activePlayerId))
    expect(JSON.parse(JSON.stringify(match)) as unknown).toEqual(snapshot)
  })

  it('replays identically from the same seed', () => {
    const first = rollNonSeven(createTestMatch(4321))
    const second = rollNonSeven(createTestMatch(4321))
    expect(first.lastDiceResult).toEqual(second.lastDiceResult)
    expect(first.randomState).toBe(second.randomState)
  })
})
