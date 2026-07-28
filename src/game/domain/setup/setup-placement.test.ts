import { describe, expect, it } from 'vitest'
import type { Board } from '../board/board'
import { generateBoard } from '../board/board-generation'
import {
  createBoardTopology,
  getAdjacentBoardVertexIds,
  getBoardEdgeIdsTouchingVertex,
  getSectorsAdjacentToVertex,
  type BoardTopology,
} from '../board/board-topology'
import { getEdgeVertices, getHexEdges, type EdgeId } from '../board/edge'
import { hexCoordinateKey } from '../board/hex-coordinate'
import type { SectorType, SectorVisibility } from '../board/sector'
import { getHexVertices, type VertexId } from '../board/vertex'
import { asPlayerId } from '../types/ids'
import { RESOURCE_TYPES, type ResourceType } from '../types/resources'
import {
  getLegalSetupOutpostVertices,
  getLegalSetupRouteEdges,
  getSetupResourceGrantForVertex,
  placeSetupOutpost,
  placeSetupRoute,
} from './setup-placement'
import {
  createInitialSetupState,
  getActiveSetupPlayer,
  getOutpostAt,
  getRouteAt,
  listOutposts,
  listRoutes,
  type SetupState,
} from './setup-state'

const p1 = asPlayerId('p1')
const p2 = asPlayerId('p2')

function baseBoard(seed = 11): Board {
  const result = generateBoard(seed)
  if (!result.success) throw new Error('expected a valid board fixture')
  return result.value
}

/** Rewrites sector type/visibility so a test can pin down what a corner touches. */
function withSectors(
  board: Board,
  overrides: Readonly<Record<string, { type?: SectorType; visibility?: SectorVisibility }>>,
): Board {
  const sectors = { ...board.sectors }
  for (const [key, sector] of Object.entries(sectors)) {
    const override = overrides[key]
    sectors[key] = {
      ...sector,
      ...(override?.type === undefined ? {} : { type: override.type }),
      ...(override?.visibility === undefined ? {} : { visibility: override.visibility }),
    }
  }
  return { ...board, sectors }
}

/** All sectors visible, so visibility never interferes unless a test says so. */
function allVisible(board: Board): Board {
  const sectors = { ...board.sectors }
  for (const [key, sector] of Object.entries(sectors)) {
    sectors[key] = { ...sector, visibility: 'visible' }
  }
  return { ...board, sectors }
}

function newSetup(players: readonly ReturnType<typeof asPlayerId>[] = [p1, p2]): SetupState {
  const result = createInitialSetupState(players)
  if (!result.success) throw new Error('expected a valid setup state')
  return result.value
}

function placeOutpostOrThrow(
  state: SetupState,
  topology: BoardTopology,
  playerId: ReturnType<typeof asPlayerId>,
  vertexId: VertexId,
): SetupState {
  const result = placeSetupOutpost(state, topology, playerId, vertexId)
  if (!result.success) throw new Error(`outpost rejected: ${result.errors[0]?.code ?? '?'}`)
  return result.value
}

/** Plays one full outpost + route pair using the first legal options available. */
function playPair(state: SetupState, topology: BoardTopology): SetupState {
  const player = getActiveSetupPlayer(state)
  if (player === undefined) throw new Error('setup already complete')
  const [vertexId] = getLegalSetupOutpostVertices(state, topology)
  if (vertexId === undefined) throw new Error('no legal outpost remains')
  const afterOutpost = placeOutpostOrThrow(state, topology, player, vertexId)
  const [edgeId] = getLegalSetupRouteEdges(afterOutpost, topology)
  if (edgeId === undefined) throw new Error('no legal route remains')
  const routeResult = placeSetupRoute(afterOutpost, topology, player, edgeId)
  if (!routeResult.success) throw new Error(`route rejected: ${routeResult.errors[0]?.code ?? '?'}`)
  return routeResult.value.state
}

const visibleBoard = allVisible(baseBoard())
const visibleTopology = createBoardTopology(visibleBoard)
const [originNorth] = getHexVertices({ q: 0, r: 0 })

describe('setup outpost legality', () => {
  it('accepts a free corner for the active player', () => {
    const result = placeSetupOutpost(newSetup(), visibleTopology, p1, originNorth)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.outposts[originNorth]?.ownerId).toBe(p1)
    expect(result.value.expects).toBe('route')
    expect(result.value.pendingOutpostVertexId).toBe(originNorth)
    expect(result.value.stepIndex).toBe(0)
  })

  it('rejects an occupied corner', () => {
    const state = newSetup()
    const afterOutpost = placeOutpostOrThrow(state, visibleTopology, p1, originNorth)
    const [routeEdge] = getLegalSetupRouteEdges(afterOutpost, visibleTopology)
    if (routeEdge === undefined) throw new Error('expected a legal route')
    const routeResult = placeSetupRoute(afterOutpost, visibleTopology, p1, routeEdge)
    if (!routeResult.success) throw new Error('expected the route to be accepted')

    const result = placeSetupOutpost(routeResult.value.state, visibleTopology, p2, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('VERTEX_OCCUPIED')
  })

  it('rejects a directly connected corner', () => {
    const state = newSetup()
    const afterOutpost = placeOutpostOrThrow(state, visibleTopology, p1, originNorth)
    const [routeEdge] = getLegalSetupRouteEdges(afterOutpost, visibleTopology)
    if (routeEdge === undefined) throw new Error('expected a legal route')
    const routeResult = placeSetupRoute(afterOutpost, visibleTopology, p1, routeEdge)
    if (!routeResult.success) throw new Error('expected the route to be accepted')

    const [neighbour] = getAdjacentBoardVertexIds(visibleTopology, originNorth)
    if (neighbour === undefined) throw new Error('expected a neighbouring corner')
    const result = placeSetupOutpost(routeResult.value.state, visibleTopology, p2, neighbour)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('ADJACENT_STRUCTURE_BLOCKED')
  })

  it('still allows a corner two steps away', () => {
    const state = newSetup()
    const afterOutpost = placeOutpostOrThrow(state, visibleTopology, p1, originNorth)
    const [routeEdge] = getLegalSetupRouteEdges(afterOutpost, visibleTopology)
    if (routeEdge === undefined) throw new Error('expected a legal route')
    const routeResult = placeSetupRoute(afterOutpost, visibleTopology, p1, routeEdge)
    if (!routeResult.success) throw new Error('expected the route to be accepted')

    const blocked = new Set([
      originNorth,
      ...getAdjacentBoardVertexIds(visibleTopology, originNorth),
    ])
    const twoAway = getAdjacentBoardVertexIds(visibleTopology, originNorth)
      .flatMap((neighbour) => getAdjacentBoardVertexIds(visibleTopology, neighbour))
      .find((candidate) => !blocked.has(candidate))
    expect(twoAway).toBeDefined()
    if (twoAway === undefined) return
    expect(placeSetupOutpost(routeResult.value.state, visibleTopology, p2, twoAway).success).toBe(
      true,
    )
  })

  it('rejects a corner off the board', () => {
    const [offBoard] = getHexVertices({ q: 99, r: -99 })
    const result = placeSetupOutpost(newSetup(), visibleTopology, p1, offBoard)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('VERTEX_NOT_ON_BOARD')
  })

  it('rejects a corner touching only hidden sectors', () => {
    const board = baseBoard()
    const topology = createBoardTopology(board)
    // A corner belonging to exactly one sector, which we then hide.
    const lonely = topology.vertexIds.find(
      (vertexId) => getSectorsAdjacentToVertex(topology, vertexId).length === 1,
    )
    expect(lonely).toBeDefined()
    if (lonely === undefined) return
    const [owner] = getSectorsAdjacentToVertex(topology, lonely)
    if (owner === undefined) return

    const hiddenBoard = withSectors(allVisible(board), {
      [hexCoordinateKey(owner.coordinate)]: { visibility: 'hidden' },
    })
    const hiddenTopology = createBoardTopology(hiddenBoard)
    const result = placeSetupOutpost(newSetup(), hiddenTopology, p1, lonely)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('HIDDEN_ONLY_SETUP_VERTEX')
  })

  it('rejects a player who is not active', () => {
    const result = placeSetupOutpost(newSetup(), visibleTopology, p2, originNorth)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_SETUP_PLAYER')
  })

  it('rejects an outpost while a route is expected', () => {
    const afterOutpost = placeOutpostOrThrow(newSetup(), visibleTopology, p1, originNorth)
    const twoAway = visibleTopology.vertexIds.find(
      (vertexId) =>
        vertexId !== originNorth &&
        !getAdjacentBoardVertexIds(visibleTopology, originNorth).includes(vertexId),
    )
    if (twoAway === undefined) return
    const result = placeSetupOutpost(afterOutpost, visibleTopology, p1, twoAway)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('EXPECTED_SETUP_ROUTE')
  })

  it('offers only legal corners, and none once a route is due', () => {
    const state = newSetup()
    const legal = getLegalSetupOutpostVertices(state, visibleTopology)
    expect(legal.length).toBeGreaterThan(0)
    for (const vertexId of legal) {
      expect(placeSetupOutpost(state, visibleTopology, p1, vertexId).success).toBe(true)
    }
    const afterOutpost = placeOutpostOrThrow(state, visibleTopology, p1, originNorth)
    expect(getLegalSetupOutpostVertices(afterOutpost, visibleTopology)).toEqual([])
  })

  it('drops the placed corner and its neighbours from the legal list', () => {
    const state = newSetup()
    const afterOutpost = placeOutpostOrThrow(state, visibleTopology, p1, originNorth)
    const [routeEdge] = getLegalSetupRouteEdges(afterOutpost, visibleTopology)
    if (routeEdge === undefined) return
    const routeResult = placeSetupRoute(afterOutpost, visibleTopology, p1, routeEdge)
    if (!routeResult.success) return

    const legal = getLegalSetupOutpostVertices(routeResult.value.state, visibleTopology)
    expect(legal).not.toContain(originNorth)
    for (const neighbour of getAdjacentBoardVertexIds(visibleTopology, originNorth)) {
      expect(legal).not.toContain(neighbour)
    }
  })
})

describe('setup route legality', () => {
  const afterOutpost = placeOutpostOrThrow(newSetup(), visibleTopology, p1, originNorth)

  it('accepts an edge touching the pending outpost', () => {
    const [edgeId] = getBoardEdgeIdsTouchingVertex(visibleTopology, originNorth)
    if (edgeId === undefined) throw new Error('expected an edge')
    const result = placeSetupRoute(afterOutpost, visibleTopology, p1, edgeId)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.state.routes[edgeId]?.ownerId).toBe(p1)
    expect(result.value.state.pendingOutpostVertexId).toBeUndefined()
    expect(result.value.state.expects).toBe('outpost')
  })

  it('rejects an unrelated edge', () => {
    const unrelated = visibleTopology.edgeIds.find(
      (edgeId) => !getEdgeVertices(edgeId).includes(originNorth),
    )
    if (unrelated === undefined) throw new Error('expected an unrelated edge')
    const result = placeSetupRoute(afterOutpost, visibleTopology, p1, unrelated)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('ROUTE_NOT_CONNECTED_TO_NEW_OUTPOST')
  })

  it('rejects an occupied edge', () => {
    const [firstEdge] = getBoardEdgeIdsTouchingVertex(visibleTopology, originNorth)
    if (firstEdge === undefined) return
    const occupied: SetupState = {
      ...afterOutpost,
      routes: { ...afterOutpost.routes, [firstEdge]: { edgeId: firstEdge, ownerId: p2 } },
    }
    const result = placeSetupRoute(occupied, visibleTopology, p1, firstEdge)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('EDGE_OCCUPIED')
  })

  it('rejects an edge off the board', () => {
    const [offBoardEdge] = getHexEdges({ q: 99, r: -99 })
    const result = placeSetupRoute(afterOutpost, visibleTopology, p1, offBoardEdge)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('EDGE_NOT_ON_BOARD')
  })

  it('rejects a player who is not active', () => {
    const [edgeId] = getBoardEdgeIdsTouchingVertex(visibleTopology, originNorth)
    if (edgeId === undefined) return
    const result = placeSetupRoute(afterOutpost, visibleTopology, p2, edgeId)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('WRONG_SETUP_PLAYER')
  })

  it('rejects a route before any outpost', () => {
    const [edgeId] = getBoardEdgeIdsTouchingVertex(visibleTopology, originNorth)
    if (edgeId === undefined) return
    const result = placeSetupRoute(newSetup(), visibleTopology, p1, edgeId)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('EXPECTED_SETUP_OUTPOST')
  })

  it('does not advance the sequence until the route is placed', () => {
    expect(afterOutpost.stepIndex).toBe(0)
    expect(getActiveSetupPlayer(afterOutpost)).toBe(p1)
    expect(afterOutpost.expects).toBe('route')
  })

  it('offers only edges touching the pending outpost, and none otherwise', () => {
    const legal = getLegalSetupRouteEdges(afterOutpost, visibleTopology)
    expect(legal.length).toBeGreaterThan(0)
    for (const edgeId of legal) {
      expect(getEdgeVertices(edgeId)).toContain(originNorth)
    }
    expect(getLegalSetupRouteEdges(newSetup(), visibleTopology)).toEqual([])
  })
})

describe('starting resources', () => {
  // The north corner of the origin touches (0,0), (0,-1) and (1,-1).
  const touchingKeys = ['0,0', '0,-1', '1,-1']

  function grantFor(
    overrides: Readonly<Record<string, { type?: SectorType; visibility?: SectorVisibility }>>,
  ): Record<ResourceType, number> {
    const board = withSectors(allVisible(baseBoard()), overrides)
    return getSetupResourceGrantForVertex(createBoardTopology(board), originNorth)
  }

  it('confirms the fixture corner touches the three expected sectors', () => {
    const sectors = getSectorsAdjacentToVertex(visibleTopology, originNorth)
    expect(sectors.map((sector) => hexCoordinateKey(sector.coordinate)).sort()).toEqual(
      [...touchingKeys].sort(),
    )
  })

  it('grants one resource per visible producing sector', () => {
    const grant = grantFor({
      '0,-1': { type: 'alloyAsteroidField' },
      '1,-1': { type: 'plasmaNebula' },
    })
    expect(grant.alloy).toBe(1)
    expect(grant.plasma).toBe(1)
    expect(grant.cryonite).toBe(0)
  })

  it('grants two of the same resource from two matching sectors', () => {
    const grant = grantFor({
      '0,-1': { type: 'cryoniteWorld' },
      '1,-1': { type: 'cryoniteWorld' },
      '0,0': { type: 'cryoniteWorld' },
    })
    expect(grant.cryonite).toBe(3)
  })

  it('grants nothing for hidden producing sectors', () => {
    const grant = grantFor({
      '0,-1': { type: 'alloyAsteroidField', visibility: 'hidden' },
      '1,-1': { type: 'plasmaNebula', visibility: 'hidden' },
      '0,0': { type: 'biofiberPlanet', visibility: 'hidden' },
    })
    for (const resource of RESOURCE_TYPES) {
      expect(grant[resource]).toBe(0)
    }
  })

  it('grants nothing for empty space, anomalies, or the central star', () => {
    const grant = grantFor({
      '0,0': { type: 'centralStar' },
      '0,-1': { type: 'emptySpace' },
      '1,-1': { type: 'anomaly' },
    })
    for (const resource of RESOURCE_TYPES) {
      expect(grant[resource]).toBe(0)
    }
  })

  it('maps every producing sector type to its own resource', () => {
    const pairs: readonly (readonly [SectorType, ResourceType])[] = [
      ['alloyAsteroidField', 'alloy'],
      ['plasmaNebula', 'plasma'],
      ['cryoniteWorld', 'cryonite'],
      ['biofiberPlanet', 'biofiber'],
      ['quantumRift', 'quantumCore'],
    ]
    for (const [type, resource] of pairs) {
      const grant = grantFor({
        '0,0': { type: 'emptySpace' },
        '0,-1': { type },
        '1,-1': { type: 'emptySpace' },
      })
      expect(grant[resource]).toBe(1)
    }
  })
})

describe('setup progression', () => {
  it('grants nothing on the first pair and resources on the second', () => {
    const topology = visibleTopology
    let state = newSetup()
    const grants: (string | undefined)[] = []

    for (let pair = 0; pair < 4; pair += 1) {
      const player = getActiveSetupPlayer(state)
      if (player === undefined) break
      const [vertexId] = getLegalSetupOutpostVertices(state, topology)
      if (vertexId === undefined) break
      const afterOutpost = placeOutpostOrThrow(state, topology, player, vertexId)
      const [edgeId] = getLegalSetupRouteEdges(afterOutpost, topology)
      if (edgeId === undefined) break
      const routeResult = placeSetupRoute(afterOutpost, topology, player, edgeId)
      if (!routeResult.success) break
      grants.push(routeResult.value.grant?.playerId)
      state = routeResult.value.state
    }

    // Two players, snake order p1 p2 p2 p1: pairs 3 and 4 are the second ones.
    expect(grants).toEqual([undefined, undefined, p2, p1])
  })

  it('walks the whole snake order and completes', () => {
    let state = newSetup()
    const seen: string[] = []
    while (!state.complete) {
      const player = getActiveSetupPlayer(state)
      if (player === undefined) break
      seen.push(player)
      state = playPair(state, visibleTopology)
    }
    expect(seen).toEqual([p1, p2, p2, p1])
    expect(state.complete).toBe(true)
    expect(getActiveSetupPlayer(state)).toBeUndefined()
  })

  it('ends with two outposts and two routes per player', () => {
    let state = newSetup()
    while (!state.complete) {
      state = playPair(state, visibleTopology)
    }
    expect(Object.keys(state.outposts)).toHaveLength(4)
    expect(Object.keys(state.routes)).toHaveLength(4)
    for (const player of [p1, p2]) {
      expect(Object.values(state.outposts).filter((o) => o.ownerId === player)).toHaveLength(2)
      expect(Object.values(state.routes).filter((r) => r.ownerId === player)).toHaveLength(2)
    }
  })

  it('records only canonical board vertices and edges', () => {
    let state = newSetup()
    while (!state.complete) {
      state = playPair(state, visibleTopology)
    }
    for (const outpost of Object.values(state.outposts)) {
      expect(visibleTopology.vertexIdSet.has(outpost.vertexId)).toBe(true)
    }
    for (const route of Object.values(state.routes)) {
      expect(visibleTopology.edgeIdSet.has(route.edgeId)).toBe(true)
    }
  })

  it('refuses further placement once complete', () => {
    let state = newSetup()
    while (!state.complete) {
      state = playPair(state, visibleTopology)
    }
    const [free] = getLegalSetupOutpostVertices(state, visibleTopology)
    expect(free).toBeUndefined()
    const outpostResult = placeSetupOutpost(state, visibleTopology, p1, originNorth)
    expect(outpostResult.success).toBe(false)
    if (outpostResult.success) return
    expect(outpostResult.errors[0]?.code).toBe('SETUP_COMPLETE')
  })
})

describe('immutability', () => {
  it('leaves the input state untouched when placing an outpost', () => {
    const state = newSetup()
    const snapshot = JSON.stringify(state)
    placeSetupOutpost(state, visibleTopology, p1, originNorth)
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('leaves earlier snapshots untouched across a whole pair', () => {
    const initial = newSetup()
    const initialSnapshot = JSON.stringify(initial)
    const afterOutpost = placeOutpostOrThrow(initial, visibleTopology, p1, originNorth)
    const afterOutpostSnapshot = JSON.stringify(afterOutpost)

    const [edgeId] = getLegalSetupRouteEdges(afterOutpost, visibleTopology)
    if (edgeId === undefined) return
    const routeResult = placeSetupRoute(afterOutpost, visibleTopology, p1, edgeId)
    expect(routeResult.success).toBe(true)

    expect(JSON.stringify(initial)).toBe(initialSnapshot)
    expect(JSON.stringify(afterOutpost)).toBe(afterOutpostSnapshot)
    expect(initial.outposts).toEqual({})
    expect(afterOutpost.routes).toEqual({})
  })

  it('does not share the outpost or route maps between states', () => {
    const state = newSetup()
    const afterOutpost = placeOutpostOrThrow(state, visibleTopology, p1, originNorth)
    expect(afterOutpost.outposts).not.toBe(state.outposts)
    expect(afterOutpost.completedPairsByPlayer).toBe(state.completedPairsByPlayer)
  })
})

describe('setup accessors', () => {
  it('looks up placed outposts and routes, and reports empty slots', () => {
    const afterOutpost = placeOutpostOrThrow(newSetup(), visibleTopology, p1, originNorth)
    expect(getOutpostAt(afterOutpost, originNorth)?.ownerId).toBe(p1)
    expect(listOutposts(afterOutpost)).toHaveLength(1)
    expect(listRoutes(afterOutpost)).toHaveLength(0)

    const [edgeId] = getLegalSetupRouteEdges(afterOutpost, visibleTopology)
    if (edgeId === undefined) return
    expect(getRouteAt(afterOutpost, edgeId)).toBeUndefined()

    const routeResult = placeSetupRoute(afterOutpost, visibleTopology, p1, edgeId)
    if (!routeResult.success) return
    expect(getRouteAt(routeResult.value.state, edgeId)?.ownerId).toBe(p1)
    expect(listRoutes(routeResult.value.state)).toHaveLength(1)
  })

  it('reports no outpost on a free corner', () => {
    const [offBoard] = getHexVertices({ q: 99, r: -99 })
    expect(getOutpostAt(newSetup(), offBoard)).toBeUndefined()
  })
})

describe('canonical edge handling', () => {
  it('treats an edge the same regardless of endpoint order', () => {
    const afterOutpost = placeOutpostOrThrow(newSetup(), visibleTopology, p1, originNorth)
    const [edgeId] = getLegalSetupRouteEdges(afterOutpost, visibleTopology)
    if (edgeId === undefined) return
    const [a, b] = getEdgeVertices(edgeId)
    const reversed = `${b}|${a}` as EdgeId
    // The canonical form is what the board stores; the reversed string is not
    // a board edge unless it happens to already be canonical.
    if (reversed === edgeId) return
    const result = placeSetupRoute(afterOutpost, visibleTopology, p1, reversed)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('EDGE_NOT_ON_BOARD')
  })
})
