import { describe, expect, it } from 'vitest'
import { createOutpost } from '../buildings/outpost'
import { createResourceBank } from './resource-bank'
import { getProductionDemand, getShortResources } from './production'
import { allVisible, baseBoard, getHexVertices, p1, p2, withSectors } from './test-fixtures'
import type { Match } from './match'
import { asMatchId } from './match-id'

const player1 = p1
const player2 = p2

/** Builds a minimal match around a given board and outposts, for production-only tests. */
function matchFor(board: ReturnType<typeof allVisible>, outposts: Match['outposts']): Match {
  return {
    matchId: asMatchId('m'),
    board,
    playersById: {},
    playerOrder: [player1, player2],
    activePlayerId: player1,
    activePlayerIndex: 0,
    turnNumber: 1,
    phase: 'resolveProduction',
    randomState: 1,
    outposts,
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

describe('getProductionDemand', () => {
  it('matching visible producing sectors grant one resource per adjacent outpost', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const outposts = { [vertexId]: createOutpost(vertexId, player1) }
    const match = matchFor(board, outposts)

    const demand = getProductionDemand(match, 8)
    expect(demand.totalDemand.alloy).toBe(1)
    expect(demand.grantsByPlayer[player1]?.alloy).toBe(1)
  })

  it('hidden sectors do not produce', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8, visibility: 'hidden' },
    })
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const outposts = { [vertexId]: createOutpost(vertexId, player1) }
    const match = matchFor(board, outposts)

    const demand = getProductionDemand(match, 8)
    expect(demand.totalDemand.alloy).toBe(0)
    expect(demand.grantsByPlayer[player1]).toBeUndefined()
  })

  it('non-matching production numbers do not produce', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const outposts = { [vertexId]: createOutpost(vertexId, player1) }
    const match = matchFor(board, outposts)

    const demand = getProductionDemand(match, 5)
    expect(demand.totalDemand.alloy).toBe(0)
  })

  it('empty space, anomaly, and the central star never produce', () => {
    // Isolate the corner: every sector touching it is overridden so only the
    // type under test can possibly explain any non-zero demand.
    const nonProducingTypes = ['centralStar', 'emptySpace', 'anomaly'] as const
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const outposts = { [vertexId]: createOutpost(vertexId, player1) }

    for (const type of nonProducingTypes) {
      const board = withSectors(allVisible(baseBoard()), {
        '0,0': { type },
        '0,-1': { type: 'emptySpace' },
        '1,-1': { type: 'anomaly' },
      })
      const match = matchFor(board, outposts)
      for (let total = 2; total <= 12; total += 1) {
        const demand = getProductionDemand(match, total)
        expect(Object.values(demand.totalDemand).every((n) => n === 0)).toBe(true)
      }
    }
  })

  it('a corner with no outpost yields nothing even if the sector matches', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const match = matchFor(board, {})
    const demand = getProductionDemand(match, 8)
    expect(demand.totalDemand.alloy).toBe(0)
  })

  it('multiple sectors and players aggregate correctly', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
      '0,-1': { type: 'plasmaNebula', productionNumber: 8 },
    })
    // Corner touching both (0,0) and (0,-1): find it via shared north vertex overlap.
    const cornersOfOrigin = getHexVertices({ q: 0, r: 0 })
    const cornersOfNeighbour = getHexVertices({ q: 0, r: -1 })
    const shared = cornersOfOrigin.find((v) => cornersOfNeighbour.includes(v))
    expect(shared).toBeDefined()
    if (shared === undefined) return

    const [originOnlyVertex] = cornersOfOrigin.filter((v) => v !== shared)
    expect(originOnlyVertex).toBeDefined()
    if (originOnlyVertex === undefined) return

    const outposts = {
      [shared]: createOutpost(shared, player1),
      [originOnlyVertex]: createOutpost(originOnlyVertex, player2),
    }
    const match = matchFor(board, outposts)
    const demand = getProductionDemand(match, 8)

    // player1's outpost touches both alloy and plasma sectors (2 grants);
    // player2's outpost touches only the alloy sector (1 grant).
    expect(demand.totalDemand.alloy).toBe(2)
    expect(demand.totalDemand.plasma).toBe(1)
    expect(demand.grantsByPlayer[player1]?.alloy).toBe(1)
    expect(demand.grantsByPlayer[player1]?.plasma).toBe(1)
    expect(demand.grantsByPlayer[player2]?.alloy).toBe(1)
  })
})

describe('getShortResources', () => {
  it('flags a resource whose demand exceeds the bank supply', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const outposts = { [vertexId]: createOutpost(vertexId, player1) }
    const match = matchFor(board, outposts)
    const demand = getProductionDemand(match, 8)

    const short = getShortResources(demand, {
      alloy: 0,
      plasma: 19,
      cryonite: 19,
      biofiber: 19,
      quantumCore: 19,
    })
    expect(short).toEqual(['alloy'])
  })

  it('does not flag a resource the bank can cover', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const outposts = { [vertexId]: createOutpost(vertexId, player1) }
    const match = matchFor(board, outposts)
    const demand = getProductionDemand(match, 8)

    const short = getShortResources(demand, {
      alloy: 19,
      plasma: 19,
      cryonite: 19,
      biofiber: 19,
      quantumCore: 19,
    })
    expect(short).toEqual([])
  })
})

describe('Void Marauder blocking', () => {
  it('a sector occupied by the Marauder produces nothing', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const outposts = { [vertexId]: createOutpost(vertexId, player1) }
    const match = { ...matchFor(board, outposts), marauderCoordinate: { q: 0, r: 0 } }

    const demand = getProductionDemand(match, 8)
    expect(demand.totalDemand.alloy).toBe(0)
    expect(demand.grantsByPlayer[player1]).toBeUndefined()
    expect(demand.blockedSectors).toHaveLength(1)
    expect(demand.blockedSectors[0]?.coordinate).toEqual({ q: 0, r: 0 })
  })

  it('other matching sectors resolve normally while the Marauder blocks only its own sector', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
      '0,-1': { type: 'plasmaNebula', productionNumber: 8 },
    })
    // Isolate corners so each player's outpost touches only one of the two
    // sectors under test, keeping the origin (blocked) and neighbour
    // (unblocked) contributions cleanly separable.
    const cornersOfOrigin = getHexVertices({ q: 0, r: 0 })
    const cornersOfNeighbour = getHexVertices({ q: 0, r: -1 })
    const [originOnlyVertex] = cornersOfOrigin.filter((v) => !cornersOfNeighbour.includes(v))
    const [neighbourOnlyVertex] = cornersOfNeighbour.filter((v) => !cornersOfOrigin.includes(v))
    expect(originOnlyVertex).toBeDefined()
    expect(neighbourOnlyVertex).toBeDefined()
    if (originOnlyVertex === undefined || neighbourOnlyVertex === undefined) return

    const outposts = {
      [originOnlyVertex]: createOutpost(originOnlyVertex, player1),
      [neighbourOnlyVertex]: createOutpost(neighbourOnlyVertex, player2),
    }
    const match = { ...matchFor(board, outposts), marauderCoordinate: { q: 0, r: 0 } }

    const demand = getProductionDemand(match, 8)
    expect(demand.totalDemand.alloy).toBe(0)
    expect(demand.totalDemand.plasma).toBe(1)
    expect(demand.grantsByPlayer[player2]?.plasma).toBe(1)
    expect(demand.blockedSectors.map((s) => s.coordinate)).toEqual([{ q: 0, r: 0 }])
  })

  it('a Marauder sector that does not match the roll is not reported as blocked', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const [vertexId] = getHexVertices({ q: 0, r: 0 })
    const outposts = { [vertexId]: createOutpost(vertexId, player1) }
    const match = { ...matchFor(board, outposts), marauderCoordinate: { q: 0, r: 0 } }

    const demand = getProductionDemand(match, 5)
    expect(demand.blockedSectors).toEqual([])
  })
})
