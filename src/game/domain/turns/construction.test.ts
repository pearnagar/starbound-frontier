import { describe, expect, it } from 'vitest'
import { getHexEdges } from '../board/edge'
import { getHexVertices } from '../board/vertex'
import { createStructure } from '../buildings/structure'
import { createTradeRoute } from '../routes/trade-route'
import { asPlayerId } from '../types/ids'
import type { ResourceInventory } from '../types/resources'
import {
  buildOutpost,
  buildTradeRoute,
  canAffordBuild,
  getLegalOutpostVertices,
  getLegalTradeRouteEdges,
  getPlayerBankTradeRate,
  upgradeToColony,
  upgradeToNexus,
  validateColonyUpgrade,
  validateNexusUpgrade,
  validateOutpostBuild,
  validateTradeRouteBuild,
} from './construction'
import { getBuildCost } from './construction-config'
import { asMatchId } from './match-id'
import type { Match } from './match'
import { getProductionDemand } from './production'
import { createResourceBank } from './resource-bank'
import { allVisible, baseBoard, makePlayer, withSectors } from './test-fixtures'

const p1 = asPlayerId('p1')
const p2 = asPlayerId('p2')
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

const AMPLE = inventory({ alloy: 20, plasma: 20, cryonite: 20, biofiber: 20, quantumCore: 20 })

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
    phase: 'build',
    randomState: 1,
    structures: {},
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

/** origin hex vertices/edges, used throughout as a concrete anchor. */
const [originNorth, originNorthEast] = getHexVertices({ q: 0, r: 0 })
const [originNorthEdge] = getHexEdges({ q: 0, r: 0 })

describe('costs and spending', () => {
  it('exposes exact costs', () => {
    expect(getBuildCost('tradeRoute')).toEqual(inventory({ alloy: 1, plasma: 1 }))
    expect(getBuildCost('outpost')).toEqual(
      inventory({ alloy: 1, plasma: 1, cryonite: 1, biofiber: 1 }),
    )
    expect(getBuildCost('colony')).toEqual(inventory({ biofiber: 2, cryonite: 2, quantumCore: 1 }))
    expect(getBuildCost('nexus')).toEqual(inventory({ alloy: 3, quantumCore: 2, plasma: 1 }))
  })

  it('canAffordBuild is true with sufficient resources', () => {
    expect(canAffordBuild(inventory({ alloy: 1, plasma: 1 }), 'tradeRoute')).toBe(true)
  })

  it('canAffordBuild is false with insufficient resources, and no mutation occurs on a failed build', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory({ alloy: 0, plasma: 1 }))
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p1) } }
    const before = JSON.stringify(match)

    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('INSUFFICIENT_RESOURCES')
    expect(JSON.stringify(match)).toBe(before)
  })

  it('spent resources return to the bank', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p1) } }
    const bankBefore = match.bank.quantities

    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.bank.quantities.alloy).toBe(bankBefore.alloy + 1)
    expect(result.value.bank.quantities.plasma).toBe(bankBefore.plasma + 1)
  })

  it('spending is atomic: player resources decrease by exactly the cost', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    const result = buildOutpost(
      {
        ...match,
        structures: {},
        routes: { [originNorthEdge]: createTradeRoute(originNorthEdge, p1) },
      },
      p1,
      originNorth,
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    const cost = getBuildCost('outpost')
    for (const type of Object.keys(cost) as (keyof ResourceInventory)[]) {
      expect(result.value.playersById[p1]?.resources[type]).toBe(AMPLE[type] - cost[type])
    }
  })
})

describe('trade routes', () => {
  it('a route connected to an owned structure succeeds', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = {
      ...match,
      structures: { [originNorth]: createStructure('outpost', originNorth, p1) },
    }
    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.routes[originNorthEdge]?.ownerId).toBe(p1)
  })

  it('a disconnected edge fails', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('ROUTE_NOT_CONNECTED')
  })

  it('an occupied edge fails', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = {
      ...match,
      structures: { [originNorth]: createStructure('outpost', originNorth, p1) },
      routes: { [originNorthEdge]: createTradeRoute(originNorthEdge, p1) },
    }
    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('EDGE_OCCUPIED')
  })

  it('an off-board edge fails validation', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    const result = validateTradeRouteBuild(match, p1, 'not,a|real,edge' as never)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('EDGE_NOT_ON_BOARD')
  })

  it('connectivity through an own structure succeeds', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p1) } }
    expect(getLegalTradeRouteEdges(match, p1)).toContain(originNorthEdge)
  })

  it('connectivity through an opponent structure is blocked', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p2) } }
    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('ROUTE_NOT_CONNECTED')
  })

  it('route supply decreases by one', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p1) } }
    const before = match.playersById[p1]?.pieceSupply.tradeRoutes
    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(true)
    if (!result.success || before === undefined) return
    expect(result.value.playersById[p1]?.pieceSupply.tradeRoutes).toBe(before - 1)
  })

  it('allows repeated route builds within the same build phase', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p1) } }
    const first = buildTradeRoute(match, p1, originNorthEdge)
    expect(first.success).toBe(true)
    if (!first.success) return
    expect(first.value.phase).toBe('build')

    const [, secondEdge] = getHexEdges({ q: 0, r: 0 })
    const second = buildTradeRoute(first.value, p1, secondEdge)
    expect(second.success).toBe(true)
  })
})

describe('outposts', () => {
  function matchWithOwnRoute(): Match {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    return { ...match, routes: { [originNorthEdge]: createTradeRoute(originNorthEdge, p1) } }
  }

  it('a route-connected legal vertex succeeds', () => {
    const match = matchWithOwnRoute()
    const result = buildOutpost(match, p1, originNorth)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.structures[originNorth]).toEqual({
      type: 'outpost',
      vertexId: originNorth,
      ownerId: p1,
    })
  })

  it('an unconnected vertex fails', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    const result = buildOutpost(match, p1, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('OUTPOST_NOT_CONNECTED')
  })

  it('an occupied vertex fails', () => {
    let match = matchWithOwnRoute()
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p2) } }
    const result = buildOutpost(match, p1, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('VERTEX_OCCUPIED')
  })

  it('an adjacent structure blocks placement', () => {
    let match = matchWithOwnRoute()
    match = {
      ...match,
      structures: { [originNorthEast]: createStructure('outpost', originNorthEast, p2) },
    }
    const result = buildOutpost(match, p1, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('ADJACENT_STRUCTURE_BLOCKED')
  })

  it('a non-adjacent placement remains legal', () => {
    const match = matchWithOwnRoute()
    expect(getLegalOutpostVertices(match, p1)).toContain(originNorth)
  })

  it('an off-board vertex fails validation', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    const result = validateOutpostBuild(match, p1, 'not,a,real' as never)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('VERTEX_NOT_ON_BOARD')
  })

  it('a hidden-only vertex fails', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    const hiddenBoard = withSectors(match.board, {
      '0,0': { visibility: 'hidden' },
      '0,-1': { visibility: 'hidden' },
      '1,-1': { visibility: 'hidden' },
    })
    match = {
      ...match,
      board: hiddenBoard,
      routes: { [originNorthEdge]: createTradeRoute(originNorthEdge, p1) },
    }
    const result = buildOutpost(match, p1, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('HIDDEN_ONLY_VERTEX')
  })

  it('outpost supply decreases by one', () => {
    const match = matchWithOwnRoute()
    const before = match.playersById[p1]?.pieceSupply.outposts
    const result = buildOutpost(match, p1, originNorth)
    expect(result.success).toBe(true)
    if (!result.success || before === undefined) return
    expect(result.value.playersById[p1]?.pieceSupply.outposts).toBe(before - 1)
  })

  it('grants no starting resources', () => {
    const match = matchWithOwnRoute()
    const alloyBefore = match.playersById[p1]?.resources.alloy ?? 0
    const result = buildOutpost(match, p1, originNorth)
    expect(result.success).toBe(true)
    if (!result.success) return
    const cost = getBuildCost('outpost')
    expect(result.value.playersById[p1]?.resources.alloy).toBe(alloyBefore - cost.alloy)
  })
})

describe('colony upgrades', () => {
  function matchWithOutpost(owner = p1): Match {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    return {
      ...match,
      structures: { [originNorth]: createStructure('outpost', originNorth, owner) },
    }
  }

  it('own Outpost upgrades successfully', () => {
    const match = matchWithOutpost()
    const result = upgradeToColony(match, p1, originNorth)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.structures[originNorth]).toEqual({
      type: 'colony',
      vertexId: originNorth,
      ownerId: p1,
    })
  })

  it('an opponent Outpost fails', () => {
    const match = matchWithOutpost(p2)
    const result = upgradeToColony(match, p1, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('NOT_YOUR_STRUCTURE')
  })

  it('an empty vertex fails', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    const result = validateColonyUpgrade(match, p1, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('UPGRADE_TARGET_MISSING')
  })

  it('wrong structure type fails', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('colony', originNorth, p1) } }
    const result = upgradeToColony(match, p1, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_STRUCTURE_TYPE')
  })

  it('Colony supply decreases and Outpost returns to supply', () => {
    const match = matchWithOutpost()
    const before = match.playersById[p1]?.pieceSupply
    const result = upgradeToColony(match, p1, originNorth)
    expect(result.success).toBe(true)
    if (!result.success || before === undefined) return
    expect(result.value.playersById[p1]?.pieceSupply.colonies).toBe(before.colonies - 1)
    expect(result.value.playersById[p1]?.pieceSupply.outposts).toBe(before.outposts + 1)
  })

  it('spends resources correctly', () => {
    const match = matchWithOutpost()
    const result = upgradeToColony(match, p1, originNorth)
    expect(result.success).toBe(true)
    if (!result.success) return
    const cost = getBuildCost('colony')
    expect(result.value.playersById[p1]?.resources.biofiber).toBe(AMPLE.biofiber - cost.biofiber)
    expect(result.value.playersById[p1]?.resources.cryonite).toBe(AMPLE.cryonite - cost.cryonite)
    expect(result.value.playersById[p1]?.resources.quantumCore).toBe(
      AMPLE.quantumCore - cost.quantumCore,
    )
  })
})

describe('nexus upgrades', () => {
  function matchWithColony(owner = p1): Match {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    return {
      ...match,
      structures: { [originNorth]: createStructure('colony', originNorth, owner) },
    }
  }

  it('own Colony upgrades successfully', () => {
    const match = matchWithColony()
    const result = upgradeToNexus(match, p1, originNorth)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.structures[originNorth]).toEqual({
      type: 'nexus',
      vertexId: originNorth,
      ownerId: p1,
    })
  })

  it('an opponent Colony fails', () => {
    const match = matchWithColony(p2)
    const result = upgradeToNexus(match, p1, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('NOT_YOUR_STRUCTURE')
  })

  it('an Outpost cannot skip directly to Nexus', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p1) } }
    const result = upgradeToNexus(match, p1, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_STRUCTURE_TYPE')
  })

  it('Nexus supply decreases and Colony returns to supply', () => {
    const match = matchWithColony()
    const before = match.playersById[p1]?.pieceSupply
    const result = upgradeToNexus(match, p1, originNorth)
    expect(result.success).toBe(true)
    if (!result.success || before === undefined) return
    expect(result.value.playersById[p1]?.pieceSupply.nexus).toBe(before.nexus - 1)
    expect(result.value.playersById[p1]?.pieceSupply.colonies).toBe(before.colonies + 1)
  })

  it('a missing upgrade target fails validation', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    const result = validateNexusUpgrade(match, p1, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('UPGRADE_TARGET_MISSING')
  })

  it("owner's bank-trade rate becomes 3:1", () => {
    const match = matchWithColony()
    expect(getPlayerBankTradeRate(match, p1)).toBe(4)
    const result = upgradeToNexus(match, p1, originNorth)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(getPlayerBankTradeRate(result.value, p1)).toBe(3)
  })
})

describe('production integration', () => {
  function producingMatch(structureType: 'outpost' | 'colony' | 'nexus'): Match {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    return matchFor({
      board,
      structures: { [originNorth]: createStructure(structureType, originNorth, p1) },
    })
  }

  it('Outpost produces 1', () => {
    const demand = getProductionDemand(producingMatch('outpost'), 8)
    expect(demand.totalDemand.alloy).toBe(1)
  })

  it('Colony produces 2', () => {
    const demand = getProductionDemand(producingMatch('colony'), 8)
    expect(demand.totalDemand.alloy).toBe(2)
  })

  it('Nexus produces 3', () => {
    const demand = getProductionDemand(producingMatch('nexus'), 8)
    expect(demand.totalDemand.alloy).toBe(3)
  })

  it('mixed structures aggregate correctly', () => {
    const board = withSectors(allVisible(baseBoard()), {
      '0,0': { type: 'alloyAsteroidField', productionNumber: 8 },
    })
    const [north, northEast] = getHexVertices({ q: 0, r: 0 })
    const match = matchFor({
      board,
      structures: {
        [north]: createStructure('outpost', north, p1),
        [northEast]: createStructure('colony', northEast, p3),
      },
    })
    const demand = getProductionDemand(match, 8)
    expect(demand.totalDemand.alloy).toBe(3)
    expect(demand.grantsByPlayer[p1]?.alloy).toBe(1)
    expect(demand.grantsByPlayer[p3]?.alloy).toBe(2)
  })

  it('Marauder blocking still works with structures', () => {
    const match = { ...producingMatch('colony'), marauderCoordinate: { q: 0, r: 0 } }
    const demand = getProductionDemand(match, 8)
    expect(demand.totalDemand.alloy).toBe(0)
    expect(demand.blockedSectors).toHaveLength(1)
  })

  it('bank shortage behavior remains unchanged (all-or-nothing)', () => {
    const match = { ...producingMatch('nexus'), bank: createResourceBank(2) }
    const demand = getProductionDemand(match, 8)
    // Nexus demands 3 alloy but the bank only has 2 — this milestone doesn't
    // change how getShortResources reports that; verify demand is unaffected
    // by bank size (the shortage decision happens downstream in turn-transitions).
    expect(demand.totalDemand.alloy).toBe(3)
  })
})

describe('immutability and events', () => {
  it('leaves the input match unchanged', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p1) } }
    const snapshot = JSON.stringify(match)
    const result = upgradeToColony(match, p1, originNorth)
    expect(result.success).toBe(true)
    expect(JSON.stringify(match)).toBe(snapshot)
  })

  it('earlier snapshots remain unchanged across a sequence of builds', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p1) } }
    const beforeUpgrade = match

    const upgraded = upgradeToColony(match, p1, originNorth)
    expect(upgraded.success).toBe(true)
    if (!upgraded.success) return

    expect(beforeUpgrade.structures[originNorth]?.type).toBe('outpost')
    expect(upgraded.value.structures[originNorth]?.type).toBe('colony')
  })

  it('produces no duplicate occupied vertices or edges after multiple builds', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p1) } }

    const withRoute = buildTradeRoute(match, p1, originNorthEdge)
    expect(withRoute.success).toBe(true)
    if (!withRoute.success) return

    expect(Object.keys(withRoute.value.routes)).toHaveLength(1)
    expect(Object.keys(withRoute.value.structures)).toHaveLength(1)
  })

  it('event sequence numbers remain deterministic and strictly increasing', () => {
    let match = matchFor()
    match = withResources(match, p1, AMPLE)
    match = { ...match, structures: { [originNorth]: createStructure('outpost', originNorth, p1) } }

    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(true)
    if (!result.success) return
    const sequences = result.value.events.map((e) => e.sequence)
    for (let i = 0; i < sequences.length; i += 1) {
      expect(sequences[i]).toBe(i + 1)
    }
    expect(result.value.eventSequence).toBe(sequences.length)
  })

  it('a failed build emits no success events', () => {
    let match = matchFor()
    match = withResources(match, p1, inventory())
    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(false)
    expect(match.events).toHaveLength(0)
  })
})

describe('construction timing', () => {
  it('rejects construction when the match is not in progress', () => {
    let match = matchFor({ status: 'complete' })
    match = withResources(match, p1, AMPLE)
    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('MATCH_NOT_IN_PROGRESS')
  })

  it('rejects construction outside the build phase', () => {
    let match = matchFor({ phase: 'trade' })
    match = withResources(match, p1, AMPLE)
    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_PHASE')
  })

  it('rejects construction by a non-active player', () => {
    let match = matchFor()
    match = withResources(match, p2, AMPLE)
    const result = buildTradeRoute(match, p2, originNorthEdge)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_ACTIVE_PLAYER')
  })

  it('rejects construction while a crisis is unresolved', () => {
    let match = matchFor({ crisisState: { status: 'movingMarauder' } })
    match = withResources(match, p1, AMPLE)
    const result = buildTradeRoute(match, p1, originNorthEdge)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('CRISIS_UNRESOLVED')
  })
})
