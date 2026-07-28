import { describe, expect, it } from 'vitest'
import { createStructure } from '../buildings/structure'
import { asMatchId } from './match-id'
import type { Match } from './match'
import { createResourceBank } from './resource-bank'
import {
  advanceToBuildPhase,
  advanceToTradePhase,
  beginTurn,
  endTurn,
  resolveProduction,
  rollDice,
} from './turn-transitions'
import {
  allVisible,
  baseBoard,
  getHexVertices,
  makePlayer,
  p1,
  p2,
  withSectors,
} from './test-fixtures'

function matchFor(
  board: ReturnType<typeof allVisible>,
  structures: Match['structures'] = {},
): Match {
  return {
    matchId: asMatchId('m'),
    board,
    playersById: { [p1]: makePlayer(p1, 0), [p2]: makePlayer(p2, 1) },
    playerOrder: [p1, p2],
    activePlayerId: p1,
    activePlayerIndex: 0,
    turnNumber: 1,
    phase: 'startTurn',
    randomState: 42,
    structures,
    routes: {},
    bank: createResourceBank(),
    // Off in a corner, away from the sectors these tests override at/near the
    // origin, so the Marauder never incidentally blocks unrelated assertions.
    marauderCoordinate: { q: 3, r: -3 },
    events: [],
    eventSequence: 0,
    status: 'inProgress',
  }
}

/** Finds a random seed whose roll total is not 7, starting from `seed`. */
function findNonSevenSeed(match: Match): number {
  let candidate = match.randomState
  for (let i = 0; i < 200; i += 1) {
    const rolled = rollDice(
      { ...match, phase: 'roll', randomState: candidate },
      match.activePlayerId,
    )
    if (rolled.success && rolled.value.lastDiceResult?.total !== 7) {
      return candidate
    }
    candidate += 1
  }
  throw new Error('could not find a non-7 seed')
}

function findSevenSeed(match: Match): number {
  let candidate = match.randomState
  for (let i = 0; i < 200; i += 1) {
    const rolled = rollDice(
      { ...match, phase: 'roll', randomState: candidate },
      match.activePlayerId,
    )
    if (rolled.success && rolled.value.lastDiceResult?.total === 7) {
      return candidate
    }
    candidate += 1
  }
  throw new Error('could not find a 7 seed')
}

describe('legal phase flow', () => {
  it('walks startTurn -> roll -> resolveProduction -> trade -> build -> endTurn', () => {
    const board = allVisible(baseBoard())
    const base = matchFor(board)
    const seed = findNonSevenSeed(base)
    let match = { ...base, randomState: seed }

    const started = beginTurn(match)
    expect(started.success).toBe(true)
    if (!started.success) return
    expect(started.value.phase).toBe('roll')
    match = started.value

    const rolled = rollDice(match, p1)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return
    expect(rolled.value.phase).toBe('resolveProduction')
    match = rolled.value

    const produced = resolveProduction(match, p1)
    expect(produced.success).toBe(true)
    if (!produced.success) return
    expect(produced.value.phase).toBe('trade')
    match = produced.value

    const traded = advanceToTradePhase(match, p1)
    expect(traded.success).toBe(true)
    if (!traded.success) return
    expect(traded.value.phase).toBe('trade')

    const built = advanceToBuildPhase(match, p1)
    expect(built.success).toBe(true)
    if (!built.success) return
    expect(built.value.phase).toBe('build')
    match = built.value

    const ended = endTurn(match, p1)
    expect(ended.success).toBe(true)
    if (!ended.success) return
    expect(ended.value.phase).toBe('startTurn')
    expect(ended.value.activePlayerId).toBe(p2)
  })

  it('a roll totaling 7 enters crisisPending and skips production', () => {
    const board = allVisible(baseBoard())
    const base = matchFor(board)
    const seed = findSevenSeed(base)
    let match = { ...base, randomState: seed }

    const started = beginTurn(match)
    if (!started.success) throw new Error('expected startTurn to succeed')
    match = started.value

    const rolled = rollDice(match, p1)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return
    expect(rolled.value.lastDiceResult?.total).toBe(7)
    expect(rolled.value.phase).toBe('crisisPending')

    // No ResourcesGranted or ProductionResolved events exist yet.
    expect(rolled.value.events.some((e) => e.type === 'ProductionResolved')).toBe(false)
    expect(rolled.value.events.some((e) => e.type === 'ResourcesGranted')).toBe(false)
  })
})

describe('validation', () => {
  it('rejects rollDice from the wrong player', () => {
    const board = allVisible(baseBoard())
    const base = matchFor(board)
    const started = beginTurn(base)
    if (!started.success) throw new Error('expected startTurn to succeed')
    const result = rollDice(started.value, p2)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_ACTIVE_PLAYER')
  })

  it('rejects rollDice in the wrong phase', () => {
    const board = allVisible(baseBoard())
    const base = matchFor(board)
    const result = rollDice(base, p1)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_PHASE')
  })

  it('rejects a repeated roll', () => {
    const board = allVisible(baseBoard())
    const base = matchFor(board)
    const seed = findNonSevenSeed(base)
    const started = beginTurn({ ...base, randomState: seed })
    if (!started.success) throw new Error('expected startTurn to succeed')
    const rolled = rollDice(started.value, p1)
    if (!rolled.success) throw new Error('expected roll to succeed')

    const secondRoll = rollDice(rolled.value, p1)
    expect(secondRoll.success).toBe(false)
    if (secondRoll.success) return
    expect(secondRoll.errors[0]?.code).toBe('WRONG_PHASE')
  })

  it('rejects a repeated production resolution', () => {
    const board = allVisible(baseBoard())
    const base = matchFor(board)
    const seed = findNonSevenSeed(base)
    const started = beginTurn({ ...base, randomState: seed })
    if (!started.success) throw new Error('expected startTurn to succeed')
    const rolled = rollDice(started.value, p1)
    if (!rolled.success) throw new Error('expected roll to succeed')
    const produced = resolveProduction(rolled.value, p1)
    if (!produced.success) throw new Error('expected production to resolve')

    const again = resolveProduction(produced.value, p1)
    expect(again.success).toBe(false)
    if (again.success) return
    expect(again.errors[0]?.code).toBe('WRONG_PHASE')
  })

  it('rejects ending the turn outside the build phase', () => {
    const board = allVisible(baseBoard())
    const base = matchFor(board)
    const result = endTurn(base, p1)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_PHASE')
  })

  it('rejects any transition when the match is not in progress', () => {
    const board = allVisible(baseBoard())
    const base = { ...matchFor(board), status: 'complete' as const }
    const result = rollDice(base, p1)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('MATCH_NOT_IN_PROGRESS')
  })
})

describe('turn advancement', () => {
  it('wraps player order and increments turn number after the last player', () => {
    const board = allVisible(baseBoard())
    const base = matchFor(board)

    function playFullTurn(match: Match, activePlayer: typeof p1): Match {
      const seed = findNonSevenSeed({ ...match, activePlayerId: activePlayer })
      let current = { ...match, randomState: seed }
      const started = beginTurn(current)
      if (!started.success) throw new Error('startTurn failed')
      current = started.value
      const rolled = rollDice(current, activePlayer)
      if (!rolled.success) throw new Error('roll failed')
      current = rolled.value
      const produced = resolveProduction(current, activePlayer)
      if (!produced.success) throw new Error('production failed')
      current = produced.value
      const built = advanceToBuildPhase(current, activePlayer)
      if (!built.success) throw new Error('build failed')
      current = built.value
      const ended = endTurn(current, activePlayer)
      if (!ended.success) throw new Error('endTurn failed')
      return ended.value
    }

    let match = playFullTurn(base, p1)
    expect(match.activePlayerId).toBe(p2)
    expect(match.turnNumber).toBe(1)

    match = playFullTurn(match, p2)
    expect(match.activePlayerId).toBe(p1)
    expect(match.turnNumber).toBe(2)
  })
})

describe('deterministic event sequencing', () => {
  it('assigns strictly increasing sequence numbers with no gaps', () => {
    const board = allVisible(baseBoard())
    const base = matchFor(board)
    const seed = findNonSevenSeed(base)
    let match = { ...base, randomState: seed }

    const started = beginTurn(match)
    if (!started.success) throw new Error('startTurn failed')
    match = started.value
    const rolled = rollDice(match, p1)
    if (!rolled.success) throw new Error('roll failed')
    match = rolled.value
    const produced = resolveProduction(match, p1)
    if (!produced.success) throw new Error('production failed')
    match = produced.value

    const sequences = match.events.map((e) => e.sequence)
    for (let i = 0; i < sequences.length; i += 1) {
      expect(sequences[i]).toBe(i + 1)
    }
    expect(match.eventSequence).toBe(sequences.length)
  })

  it('is reproducible for identical inputs', () => {
    const board = allVisible(baseBoard())
    const base = matchFor(board)
    const seed = findNonSevenSeed(base)
    const run = () => {
      let match = { ...base, randomState: seed }
      const started = beginTurn(match)
      if (!started.success) throw new Error('startTurn failed')
      match = started.value
      const rolled = rollDice(match, p1)
      if (!rolled.success) throw new Error('roll failed')
      match = rolled.value
      const produced = resolveProduction(match, p1)
      if (!produced.success) throw new Error('production failed')
      return produced.value
    }
    const a = run()
    const b = run()
    expect(a.events).toEqual(b.events)
    expect(a.lastDiceResult).toEqual(b.lastDiceResult)
  })
})

describe('production resolution and bank', () => {
  it('deducts granted resources from the bank', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const base = matchFor(board, { [vertexId]: createStructure('outpost', vertexId, p1) })

    // Force a roll of 8 by finding a seed.
    let seed = base.randomState
    let match = base
    for (let i = 0; i < 500; i += 1) {
      const started = beginTurn({ ...base, randomState: seed })
      if (!started.success) throw new Error('startTurn failed')
      const rolled = rollDice(started.value, p1)
      if (rolled.success && rolled.value.lastDiceResult?.total === 8) {
        match = rolled.value
        break
      }
      seed += 1
    }
    expect(match.lastDiceResult?.total).toBe(8)

    const bankBefore = match.bank.quantities.alloy
    const produced = resolveProduction(match, p1)
    expect(produced.success).toBe(true)
    if (!produced.success) return
    expect(produced.value.bank.quantities.alloy).toBe(bankBefore - 1)
    expect(produced.value.playersById[p1]?.resources.alloy).toBe(1)
  })

  it('all-or-nothing shortage: nobody receives a resource the bank cannot fully cover', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const base = matchFor(board, { [vertexId]: createStructure('outpost', vertexId, p1) })
    const starvedBank = createResourceBank(0)

    let seed = base.randomState
    let match = { ...base, bank: starvedBank }
    for (let i = 0; i < 500; i += 1) {
      const started = beginTurn({ ...match, randomState: seed })
      if (!started.success) throw new Error('startTurn failed')
      const rolled = rollDice(started.value, p1)
      if (rolled.success && rolled.value.lastDiceResult?.total === 8) {
        match = rolled.value
        break
      }
      seed += 1
    }
    expect(match.lastDiceResult?.total).toBe(8)

    const produced = resolveProduction(match, p1)
    expect(produced.success).toBe(true)
    if (!produced.success) return
    expect(produced.value.playersById[p1]?.resources.alloy).toBe(0)
    expect(produced.value.bank.quantities.alloy).toBe(0)
    expect(produced.value.events.some((e) => e.type === 'ResourceShortage')).toBe(true)
    expect(produced.value.events.some((e) => e.type === 'ResourcesGranted')).toBe(false)
  })

  it('emits ProductionBlockedByMarauder and withholds resources for a sector it occupies', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const base = {
      ...matchFor(board, { [vertexId]: createStructure('outpost', vertexId, p1) }),
      marauderCoordinate: { q: 0, r: 0 },
    }

    let seed = base.randomState
    let match = base
    for (let i = 0; i < 500; i += 1) {
      const started = beginTurn({ ...base, randomState: seed })
      if (!started.success) throw new Error('startTurn failed')
      const rolled = rollDice(started.value, p1)
      if (rolled.success && rolled.value.lastDiceResult?.total === 8) {
        match = rolled.value
        break
      }
      seed += 1
    }
    expect(match.lastDiceResult?.total).toBe(8)

    const produced = resolveProduction(match, p1)
    expect(produced.success).toBe(true)
    if (!produced.success) return
    expect(produced.value.playersById[p1]?.resources.alloy).toBe(0)
    const blockedEvent = produced.value.events.find((e) => e.type === 'ProductionBlockedByMarauder')
    expect(blockedEvent).toBeDefined()
    if (blockedEvent?.type !== 'ProductionBlockedByMarauder') return
    expect(blockedEvent.coordinate).toEqual({ q: 0, r: 0 })
  })
})
