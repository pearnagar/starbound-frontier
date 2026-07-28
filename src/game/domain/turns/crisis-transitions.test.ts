import { describe, expect, it } from 'vitest'
import { createOutpost } from '../buildings/outpost'
import { asMatchId } from './match-id'
import type { Match } from './match'
import { createResourceBank } from './resource-bank'
import {
  completeCrisis,
  getEligibleStealTargets,
  getLegalMarauderDestinations,
  getPendingDiscardPlayers,
  getRequiredDiscardCount,
  isCrisisComplete,
  moveMarauder,
  startCrisis,
  stealCrisisResource,
  submitCrisisDiscard,
} from './crisis-transitions'
import { advanceToTradePhase, rollDice } from './turn-transitions'
import { allVisible, baseBoard, getHexVertices, makePlayer, p1, p2 } from './test-fixtures'
import { asPlayerId } from '../types/ids'
import type { ResourceInventory } from '../types/resources'

const p3 = asPlayerId('p3')

function inventory(overrides: Partial<ResourceInventory> = {}): ResourceInventory {
  return {
    alloy: 0,
    plasma: 0,
    cryonite: 0,
    biofiber: 0,
    quantumCore: 0,
    ...overrides,
  }
}

function matchFor(
  overrides: Partial<Match> = {},
  players: readonly ReturnType<typeof makePlayer>[] = [makePlayer(p1, 0), makePlayer(p2, 1)],
): Match {
  const board = allVisible(baseBoard())
  const playersById: Record<string, ReturnType<typeof makePlayer>> = {}
  for (const player of players) {
    playersById[player.id] = player
  }
  return {
    matchId: asMatchId('m'),
    board,
    playersById,
    playerOrder: players.map((player) => player.id),
    activePlayerId: p1,
    activePlayerIndex: 0,
    turnNumber: 1,
    phase: 'crisisPending',
    randomState: 7,
    outposts: {},
    routes: {},
    bank: createResourceBank(),
    marauderCoordinate: { q: 3, r: -3 },
    events: [],
    eventSequence: 0,
    status: 'inProgress',
    ...overrides,
  }
}

function withResources(match: Match, playerId: string, resources: ResourceInventory): Match {
  const player = match.playersById[playerId]
  if (player === undefined) throw new Error('player not found')
  return { ...match, playersById: { ...match.playersById, [playerId]: { ...player, resources } } }
}

describe('startCrisis / discard requirements', () => {
  it('players with more than 7 cards must discard half rounded down', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 8 })) // 8 -> 4
    match = withResources(match, p2, inventory({ alloy: 7 })) // 7 -> 0 (no discard)

    const started = startCrisis(match)
    expect(getRequiredDiscardCount(started, p1)).toBe(4)
    expect(getRequiredDiscardCount(started, p2)).toBe(0)
    expect(getPendingDiscardPlayers(started)).toEqual([p1])
  })

  it('exactly 7 cards requires no discard; 8 requires discarding 4', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 7 }))
    match = withResources(match, p2, inventory({ alloy: 8 }))

    const started = startCrisis(match)
    expect(getPendingDiscardPlayers(started)).toEqual([p2])
    expect(getRequiredDiscardCount(started, p2)).toBe(4)
  })

  it('half is rounded down for odd totals above 7', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 9 })) // 9 -> 4

    const started = startCrisis(match)
    expect(getRequiredDiscardCount(started, p1)).toBe(4)
  })

  it('multiple players may be required to discard at once', () => {
    let match = matchFor({}, [makePlayer(p1, 0), makePlayer(p2, 1), makePlayer(p3, 2)])
    match = withResources(match, p1, inventory({ alloy: 8 }))
    match = withResources(match, p2, inventory({ alloy: 10 }))
    match = withResources(match, p3, inventory({ alloy: 2 }))

    const started = startCrisis(match)
    expect(getPendingDiscardPlayers(started)).toEqual([p1, p2])
    expect(getRequiredDiscardCount(started, p1)).toBe(4)
    expect(getRequiredDiscardCount(started, p2)).toBe(5)
  })

  it('emits CrisisStarted with the fixed requirements', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 8 }))
    const started = startCrisis(match)
    const event = started.events.find((e) => e.type === 'CrisisStarted')
    expect(event).toBeDefined()
    if (event?.type !== 'CrisisStarted') return
    expect(event.requirements).toEqual([{ playerId: p1, requiredCount: 4 }])
    expect(event.sequence).toBe(1)
  })

  it('no player needing to discard proceeds directly to Marauder movement', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 3 }))
    match = withResources(match, p2, inventory({ alloy: 3 }))

    const started = startCrisis(match)
    expect(started.crisisState?.status).toBe('movingMarauder')
    expect(getPendingDiscardPlayers(started)).toEqual([])
  })
})

describe('submitCrisisDiscard', () => {
  function crisisMatch(): Match {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 5, plasma: 3 })) // total 8 -> discard 4
    return startCrisis(match)
  }

  it('accepts an exact, valid discard and returns resources to the bank', () => {
    const match = crisisMatch()
    const bankAlloyBefore = match.bank.quantities.alloy
    const result = submitCrisisDiscard(match, p1, p1, inventory({ alloy: 3, plasma: 1 }))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.playersById[p1]?.resources.alloy).toBe(2)
    expect(result.value.playersById[p1]?.resources.plasma).toBe(2)
    expect(result.value.bank.quantities.alloy).toBe(bankAlloyBefore + 3)
    expect(result.value.bank.quantities.plasma).toBe(match.bank.quantities.plasma + 1)
  })

  it('rejects a total that does not exactly equal the required count', () => {
    const match = crisisMatch()
    const result = submitCrisisDiscard(match, p1, p1, inventory({ alloy: 3 }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('INCORRECT_DISCARD_TOTAL')
  })

  it('rejects discarding more of a resource than the player owns', () => {
    const match = crisisMatch()
    const result = submitCrisisDiscard(match, p1, p1, inventory({ alloy: 4, plasma: 0 }))
    // alloy: player owns 5, so alloy:4 is a legal quantity but must equal
    // required total (4) - this is a valid discard; use an over-owned amount instead.
    expect(result.success).toBe(true)

    const overDrawn = submitCrisisDiscard(match, p1, p1, inventory({ plasma: 4 }))
    expect(overDrawn.success).toBe(false)
    if (overDrawn.success) return
    expect(overDrawn.errors[0]?.code).toBe('INSUFFICIENT_PLAYER_RESOURCES')
  })

  it('rejects negative or non-integer quantities', () => {
    const match = crisisMatch()
    const result = submitCrisisDiscard(match, p1, p1, inventory({ alloy: -4 }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('INVALID_DISCARD_QUANTITY')
  })

  it('rejects a player submitting a discard for someone else', () => {
    const match = crisisMatch()
    const result = submitCrisisDiscard(match, p2, p1, inventory({ alloy: 4 }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('CANNOT_SUBMIT_FOR_OTHER_PLAYER')
  })

  it('rejects a player who is not required to discard', () => {
    const match = crisisMatch()
    const result = submitCrisisDiscard(match, p2, p2, inventory({ alloy: 0 }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('PLAYER_NOT_REQUIRED_TO_DISCARD')
  })

  it('moves to movingMarauder once every required discard is complete', () => {
    const match = crisisMatch()
    const result = submitCrisisDiscard(match, p1, p1, inventory({ alloy: 4 }))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.crisisState?.status).toBe('movingMarauder')
  })

  it('does not advance until all pending players have discarded', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 8 }))
    match = withResources(match, p2, inventory({ alloy: 8 }))
    match = startCrisis(match)

    const afterP1 = submitCrisisDiscard(match, p1, p1, inventory({ alloy: 4 }))
    expect(afterP1.success).toBe(true)
    if (!afterP1.success) return
    expect(afterP1.value.crisisState?.status).toBe('discarding')
    expect(getPendingDiscardPlayers(afterP1.value)).toEqual([p2])

    const afterP2 = submitCrisisDiscard(afterP1.value, p2, p2, inventory({ alloy: 4 }))
    expect(afterP2.success).toBe(true)
    if (!afterP2.success) return
    expect(afterP2.value.crisisState?.status).toBe('movingMarauder')
  })
})

describe('Marauder movement', () => {
  it('cannot move while discards are still pending', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 8 }))
    match = startCrisis(match)

    const result = moveMarauder(match, p1, { q: 1, r: 0 })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('MARAUDER_MOVE_NOT_PENDING')
  })

  it('legal movement to a different on-board sector succeeds', () => {
    const match = startCrisis(matchFor())
    const destinations = getLegalMarauderDestinations(match)
    expect(destinations.length).toBeGreaterThan(0)
    const destination = destinations[0]
    if (destination === undefined) throw new Error('no destination')

    const result = moveMarauder(match, p1, destination)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.marauderCoordinate).toEqual(destination)
    const event = result.value.events.find((e) => e.type === 'MarauderMoved')
    expect(event).toBeDefined()
  })

  it('rejects moving to the same sector', () => {
    const match = startCrisis(matchFor())
    const result = moveMarauder(match, p1, match.marauderCoordinate)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('DESTINATION_UNCHANGED')
  })

  it('rejects an off-board destination', () => {
    const match = startCrisis(matchFor())
    const result = moveMarauder(match, p1, { q: 999, r: 999 })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('DESTINATION_OFF_BOARD')
  })

  it('rejects movement from a non-active player', () => {
    const match = startCrisis(matchFor())
    const destinations = getLegalMarauderDestinations(match)
    const destination = destinations[0]
    if (destination === undefined) throw new Error('no destination')
    const result = moveMarauder(match, p2, destination)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_ACTIVE_PLAYER')
  })

  it('rejects a repeated move once stealing has advanced past movingMarauder', () => {
    const match = startCrisis(matchFor())
    const destination = getLegalMarauderDestinations(match)[0]
    if (destination === undefined) throw new Error('no destination')
    const moved = moveMarauder(match, p1, destination)
    expect(moved.success).toBe(true)
    if (!moved.success) return

    const secondMove = moveMarauder(moved.value, p1, { q: 0, r: 0 })
    expect(secondMove.success).toBe(false)
    if (secondMove.success) return
    expect(secondMove.errors[0]?.code).toBe('MARAUDER_MOVE_NOT_PENDING')
  })
})

describe('steal eligibility', () => {
  function targetSectorMatch(): Readonly<{ match: Match; destination: { q: number; r: number } }> {
    const destination = { q: 1, r: 0 }
    const match = matchFor({ marauderCoordinate: { q: 3, r: -3 } })
    return { match: startCrisis(match), destination }
  }

  it('opponents with outposts adjacent to the destination become eligible', () => {
    const { match, destination } = targetSectorMatch()
    const [vertexId] = getHexVertices(destination)
    if (vertexId === undefined) throw new Error('no vertex')
    let withOutpost: Match = {
      ...match,
      outposts: { [vertexId]: createOutpost(vertexId, p2) },
    }
    withOutpost = withResources(withOutpost, p2, inventory({ alloy: 1 }))

    const moved = moveMarauder(withOutpost, p1, destination)
    expect(moved.success).toBe(true)
    if (!moved.success) return
    expect(getEligibleStealTargets(moved.value)).toEqual([p2])
  })

  it('excludes the active player even if adjacent', () => {
    const { match, destination } = targetSectorMatch()
    const [vertexId] = getHexVertices(destination)
    if (vertexId === undefined) throw new Error('no vertex')
    let withOutpost: Match = {
      ...match,
      outposts: { [vertexId]: createOutpost(vertexId, p1) },
    }
    withOutpost = withResources(withOutpost, p1, inventory({ alloy: 1 }))

    const moved = moveMarauder(withOutpost, p1, destination)
    expect(moved.success).toBe(true)
    if (!moved.success) return
    expect(getEligibleStealTargets(moved.value)).toEqual([])
  })

  it('excludes opponents with no resources', () => {
    const { match, destination } = targetSectorMatch()
    const [vertexId] = getHexVertices(destination)
    if (vertexId === undefined) throw new Error('no vertex')
    const withOutpost: Match = {
      ...match,
      outposts: { [vertexId]: createOutpost(vertexId, p2) },
    }
    // p2 has zero resources by default.

    const moved = moveMarauder(withOutpost, p1, destination)
    expect(moved.success).toBe(true)
    if (!moved.success) return
    expect(getEligibleStealTargets(moved.value)).toEqual([])
  })

  it('does not duplicate a target with multiple adjacent outposts', () => {
    const { match, destination } = targetSectorMatch()
    const vertices = getHexVertices(destination)
    const [firstVertex, secondVertex] = vertices
    if (firstVertex === undefined || secondVertex === undefined) throw new Error('need 2 vertices')
    let withOutposts: Match = {
      ...match,
      outposts: {
        [firstVertex]: createOutpost(firstVertex, p2),
        [secondVertex]: createOutpost(secondVertex, p2),
      },
    }
    withOutposts = withResources(withOutposts, p2, inventory({ alloy: 2 }))

    const moved = moveMarauder(withOutposts, p1, destination)
    expect(moved.success).toBe(true)
    if (!moved.success) return
    expect(getEligibleStealTargets(moved.value)).toEqual([p2])
  })

  it('no eligible target skips theft and lets the crisis complete into trade', () => {
    const { match, destination } = targetSectorMatch()
    const moved = moveMarauder(match, p1, destination)
    expect(moved.success).toBe(true)
    if (!moved.success) return
    expect(getEligibleStealTargets(moved.value)).toEqual([])
    expect(isCrisisComplete(moved.value)).toBe(true)

    const completed = completeCrisis(moved.value, p1)
    expect(completed.success).toBe(true)
    if (!completed.success) return
    expect(completed.value.phase).toBe('trade')
    expect(completed.value.crisisState).toBeUndefined()
  })
})

describe('resource theft', () => {
  function movedMatchWithTarget(targetResources: ResourceInventory): Match {
    const destination = { q: 1, r: 0 }
    let match = matchFor({ marauderCoordinate: { q: 3, r: -3 } })
    const [vertexId] = getHexVertices(destination)
    if (vertexId === undefined) throw new Error('no vertex')
    match = { ...match, outposts: { [vertexId]: createOutpost(vertexId, p2) } }
    match = withResources(match, p2, targetResources)
    match = startCrisis(match)
    const moved = moveMarauder(match, p1, destination)
    if (!moved.success) throw new Error('expected move to succeed')
    return moved.value
  }

  it('rejects an invalid (non-eligible) target', () => {
    const match = movedMatchWithTarget(inventory({ alloy: 1 }))
    const result = stealCrisisResource(match, p1, p3)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('INVALID_STEAL_TARGET')
  })

  it('rejects a target with no resources at resolution time', () => {
    const destination = { q: 1, r: 0 }
    let match = matchFor({ marauderCoordinate: { q: 3, r: -3 } })
    const [vertexId] = getHexVertices(destination)
    if (vertexId === undefined) throw new Error('no vertex')
    match = { ...match, outposts: { [vertexId]: createOutpost(vertexId, p2) } }
    match = withResources(match, p2, inventory({ alloy: 1 }))
    match = startCrisis(match)
    const moved = moveMarauder(match, p1, destination)
    if (!moved.success) throw new Error('expected move to succeed')

    // Resources vanish between eligibility and resolution (e.g. hand edited
    // out from under the crisis) - stealing must reject rather than fabricate.
    const drained = withResources(moved.value, p2, inventory())
    const result = stealCrisisResource(drained, p1, p2)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('STEAL_TARGET_HAS_NO_RESOURCES')
  })

  it('moves exactly one resource from target to thief; bank is unchanged', () => {
    const match = movedMatchWithTarget(inventory({ alloy: 2, plasma: 1 }))
    const bankBefore = match.bank
    const result = stealCrisisResource(match, p1, p2)
    expect(result.success).toBe(true)
    if (!result.success) return

    const targetTotal =
      result.value.playersById[p2]!.resources.alloy + result.value.playersById[p2]!.resources.plasma
    const thiefTotal =
      result.value.playersById[p1]!.resources.alloy + result.value.playersById[p1]!.resources.plasma
    expect(targetTotal).toBe(2) // started with 3, lost 1
    expect(thiefTotal).toBe(1)
    expect(result.value.bank).toEqual(bankBefore)
  })

  it('is deterministic for the same match state and RNG state', () => {
    const matchA = movedMatchWithTarget(inventory({ alloy: 2, plasma: 1 }))
    const matchB = movedMatchWithTarget(inventory({ alloy: 2, plasma: 1 }))
    const resultA = stealCrisisResource(matchA, p1, p2)
    const resultB = stealCrisisResource(matchB, p1, p2)
    expect(resultA.success).toBe(true)
    expect(resultB.success).toBe(true)
    if (!resultA.success || !resultB.success) return
    expect(resultA.value.playersById[p2]?.resources).toEqual(resultB.value.playersById[p2]?.resources)
    expect(resultA.value.randomState).toBe(resultB.value.randomState)
  })

  it('advances randomState deterministically', () => {
    const match = movedMatchWithTarget(inventory({ alloy: 1 }))
    const result = stealCrisisResource(match, p1, p2)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.randomState).not.toBe(match.randomState)
  })

  it('selection is weighted proportional to cards held', () => {
    // 2 alloy, 1 plasma across many independent trials with different seeds
    // should select alloy roughly twice as often as plasma.
    let alloyCount = 0
    let plasmaCount = 0
    const trials = 300
    for (let seed = 0; seed < trials; seed += 1) {
      const destination = { q: 1, r: 0 }
      let match = matchFor({ marauderCoordinate: { q: 3, r: -3 }, randomState: seed })
      const [vertexId] = getHexVertices(destination)
      if (vertexId === undefined) throw new Error('no vertex')
      match = { ...match, outposts: { [vertexId]: createOutpost(vertexId, p2) } }
      match = withResources(match, p2, inventory({ alloy: 2, plasma: 1 }))
      match = startCrisis(match)
      const moved = moveMarauder(match, p1, destination)
      if (!moved.success) throw new Error('expected move to succeed')
      const stolen = stealCrisisResource(moved.value, p1, p2)
      if (!stolen.success) throw new Error('expected steal to succeed')
      const target = stolen.value.playersById[p2]
      if (target === undefined) throw new Error('missing target')
      if (target.resources.alloy === 1) alloyCount += 1
      if (target.resources.plasma === 0) plasmaCount += 1
    }
    // Expected ratio 2:1; assert both occur and alloy is meaningfully more frequent.
    expect(alloyCount).toBeGreaterThan(0)
    expect(plasmaCount).toBeGreaterThan(0)
    expect(alloyCount).toBeGreaterThan(plasmaCount)
  })

  it('completes the crisis into trade after theft', () => {
    const match = movedMatchWithTarget(inventory({ alloy: 1 }))
    const stolen = stealCrisisResource(match, p1, p2)
    expect(stolen.success).toBe(true)
    if (!stolen.success) return
    expect(isCrisisComplete(stolen.value)).toBe(true)

    const completed = completeCrisis(stolen.value, p1)
    expect(completed.success).toBe(true)
    if (!completed.success) return
    expect(completed.value.phase).toBe('trade')
    expect(completed.value.activePlayerId).toBe(p1)
    expect(completed.value.crisisState).toBeUndefined()
  })

  it('rejects a repeated theft once already resolved', () => {
    const match = movedMatchWithTarget(inventory({ alloy: 1 }))
    const stolen = stealCrisisResource(match, p1, p2)
    expect(stolen.success).toBe(true)
    if (!stolen.success) return

    const secondSteal = stealCrisisResource(stolen.value, p1, p2)
    expect(secondSteal.success).toBe(false)
    if (secondSteal.success) return
    expect(secondSteal.errors[0]?.code).toBe('STEAL_NOT_PENDING')
  })
})

describe('crisis completion and progression guards', () => {
  it('preserves the rolled dice result through crisis resolution', () => {
    let match = matchFor()
    match = { ...match, lastDiceResult: { die1: 4, die2: 3, total: 7 } }
    match = startCrisis(match)
    const destination = getLegalMarauderDestinations(match)[0]
    if (destination === undefined) throw new Error('no destination')
    const moved = moveMarauder(match, p1, destination)
    expect(moved.success).toBe(true)
    if (!moved.success) return
    expect(isCrisisComplete(moved.value)).toBe(true)

    const completed = completeCrisis(moved.value, p1)
    expect(completed.success).toBe(true)
    if (!completed.success) return
    expect(completed.value.lastDiceResult).toEqual({ die1: 4, die2: 3, total: 7 })
  })

  it('cannot complete while discards remain pending', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 8 }))
    match = startCrisis(match)

    const result = completeCrisis(match, p1)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('CRISIS_NOT_COMPLETE')
  })

  it('cannot complete while movement is still pending', () => {
    const match = startCrisis(matchFor())
    expect(match.crisisState?.status).toBe('movingMarauder')
    const result = completeCrisis(match, p1)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('CRISIS_NOT_COMPLETE')
  })

  it('blocks normal trade progression while crisis work remains unresolved', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 8 }))
    match = startCrisis(match)

    const result = advanceToTradePhase(match, p1)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_PHASE')
  })

  it('rejects crisis actions when the match is not in progress', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 8 }))
    match = startCrisis(match)
    const finished = { ...match, status: 'complete' as const }

    const result = submitCrisisDiscard(finished, p1, p1, inventory({ alloy: 4 }))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('MATCH_NOT_IN_PROGRESS')
  })
})

describe('immutability and determinism', () => {
  it('does not mutate the input match or its inventories', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 8 }))
    const beforeSnapshot = JSON.parse(JSON.stringify(match)) as unknown
    startCrisis(match)
    expect(JSON.parse(JSON.stringify(match))).toEqual(beforeSnapshot)
  })

  it('event sequence numbers increase deterministically across the full crisis flow', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 8 }))
    match = startCrisis(match)
    const discard = submitCrisisDiscard(match, p1, p1, inventory({ alloy: 4 }))
    expect(discard.success).toBe(true)
    if (!discard.success) return

    const destination = getLegalMarauderDestinations(discard.value)[0]
    if (destination === undefined) throw new Error('no destination')
    const moved = moveMarauder(discard.value, p1, destination)
    expect(moved.success).toBe(true)
    if (!moved.success) return

    const completed = completeCrisis(moved.value, p1)
    expect(completed.success).toBe(true)
    if (!completed.success) return

    const sequences = completed.value.events.map((e) => e.sequence)
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b))
    expect(new Set(sequences).size).toBe(sequences.length)
  })
})

describe('rollDice integration', () => {
  function findSevenSeed(match: Match): number {
    let candidate = match.randomState
    for (let i = 0; i < 200; i += 1) {
      const rolled = rollDice({ ...match, phase: 'roll', randomState: candidate }, match.activePlayerId)
      if (rolled.success && rolled.value.lastDiceResult?.total === 7) {
        return candidate
      }
      candidate += 1
    }
    throw new Error('could not find a 7 seed')
  }

  it('a roll of 7 starts the crisis with computed discard state', () => {
    let match = matchFor({ phase: 'roll' })
    match = withResources(match, p1, inventory({ alloy: 8 }))
    const seed = findSevenSeed(match)
    match = { ...match, randomState: seed }

    const rolled = rollDice(match, p1)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return
    expect(rolled.value.phase).toBe('crisisPending')
    expect(rolled.value.crisisState?.status).toBe('discarding')
    expect(getPendingDiscardPlayers(rolled.value)).toEqual([p1])
  })

  it('a roll of 7 with nobody over the threshold proceeds directly to Marauder movement', () => {
    let match = matchFor({ phase: 'roll' })
    match = withResources(match, p1, inventory({ alloy: 2 }))
    match = withResources(match, p2, inventory({ alloy: 2 }))
    const seed = findSevenSeed(match)
    match = { ...match, randomState: seed }

    const rolled = rollDice(match, p1)
    expect(rolled.success).toBe(true)
    if (!rolled.success) return
    expect(rolled.value.crisisState?.status).toBe('movingMarauder')
  })
})
