import {
  getAdjacentBoardVertexIds,
  getBoardEdgeIdsTouchingVertex,
  getSectorsAdjacentToVertex,
  isBoardEdge,
  isBoardVertex,
  type BoardTopology,
} from '../board/board-topology'
import { getEdgeVertices, type EdgeId } from '../board/edge'
import { getSectorResourceType } from '../board/sector'
import type { VertexId } from '../board/vertex'
import { createOutpost } from '../buildings/outpost'
import { createTradeRoute } from '../routes/trade-route'
import type { PlayerId } from '../types/ids'
import { createEmptyResourceInventory, type ResourceInventory } from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import {
  getActiveSetupPlayer,
  getCompletedSetupPairs,
  SETUP_PAIRS_PER_PLAYER,
  type SetupState,
} from './setup-state'

/** Resources handed to a player when their second pair completes. */
export type SetupResourceGrant = Readonly<{
  playerId: PlayerId
  resources: ResourceInventory
}>

/**
 * Result of placing a setup route. `grant` is present only when this route
 * completed the player's second pair.
 */
export type SetupRoutePlacement = Readonly<{
  state: SetupState
  grant?: SetupResourceGrant
}>

function failure(code: string, message: string, field: string): DomainResult<never> {
  const error: DomainValidationError = { code, message, field }
  return { success: false, errors: [error] }
}

/**
 * Shared preconditions: setup still running, right player, right phase.
 * Checked in this order so the most fundamental problem is reported first.
 */
function checkTurn(
  state: SetupState,
  playerId: PlayerId,
  expects: SetupState['expects'],
): DomainResult<null> {
  if (state.complete) {
    return failure('SETUP_COMPLETE', 'Setup has already finished.', 'state')
  }
  if (state.expects !== expects) {
    return state.expects === 'outpost'
      ? failure(
          'EXPECTED_SETUP_OUTPOST',
          'An outpost must be placed before its trade route.',
          'expects',
        )
      : failure(
          'EXPECTED_SETUP_ROUTE',
          'The new outpost still needs its connected trade route.',
          'expects',
        )
  }
  if (getActiveSetupPlayer(state) !== playerId) {
    return failure('WRONG_SETUP_PLAYER', 'It is not this player’s setup turn.', 'playerId')
  }
  return { success: true, value: null }
}

/** True when at least one adjacent sector is visible. */
function touchesVisibleSector(topology: BoardTopology, vertexId: VertexId): boolean {
  return getSectorsAdjacentToVertex(topology, vertexId).some(
    (sector) => sector.visibility === 'visible',
  )
}

/**
 * Corner legality, ignoring whose turn it is: unoccupied, no neighbouring
 * outpost, and touching at least one visible sector.
 */
function checkVertexPlaceable(
  state: SetupState,
  topology: BoardTopology,
  vertexId: VertexId,
): DomainResult<null> {
  if (!isBoardVertex(topology, vertexId)) {
    return failure('VERTEX_NOT_ON_BOARD', 'That corner is not part of the board.', 'vertexId')
  }
  if (state.outposts[vertexId] !== undefined) {
    return failure('VERTEX_OCCUPIED', 'That corner already holds an outpost.', 'vertexId')
  }
  const blocked = getAdjacentBoardVertexIds(topology, vertexId).some(
    (neighbour) => state.outposts[neighbour] !== undefined,
  )
  if (blocked) {
    return failure(
      'ADJACENT_STRUCTURE_BLOCKED',
      'An outpost already sits on a directly connected corner.',
      'vertexId',
    )
  }
  if (!touchesVisibleSector(topology, vertexId)) {
    return failure(
      'HIDDEN_ONLY_SETUP_VERTEX',
      'A setup outpost must touch at least one visible sector.',
      'vertexId',
    )
  }
  return { success: true, value: null }
}

export function validateSetupOutpostPlacement(
  state: SetupState,
  topology: BoardTopology,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<null> {
  const turn = checkTurn(state, playerId, 'outpost')
  if (!turn.success) {
    return turn
  }
  return checkVertexPlaceable(state, topology, vertexId)
}

export function getLegalSetupOutpostVertices(
  state: SetupState,
  topology: BoardTopology,
): readonly VertexId[] {
  if (state.complete || state.expects !== 'outpost') {
    return []
  }
  return topology.vertexIds.filter(
    (vertexId) => checkVertexPlaceable(state, topology, vertexId).success,
  )
}

export function validateSetupRoutePlacement(
  state: SetupState,
  topology: BoardTopology,
  playerId: PlayerId,
  edgeId: EdgeId,
): DomainResult<null> {
  const turn = checkTurn(state, playerId, 'route')
  if (!turn.success) {
    return turn
  }
  if (!isBoardEdge(topology, edgeId)) {
    return failure('EDGE_NOT_ON_BOARD', 'That edge is not part of the board.', 'edgeId')
  }
  if (state.routes[edgeId] !== undefined) {
    return failure('EDGE_OCCUPIED', 'That edge already holds a trade route.', 'edgeId')
  }
  const pending = state.pendingOutpostVertexId
  if (pending === undefined || !getEdgeVertices(edgeId).includes(pending)) {
    return failure(
      'ROUTE_NOT_CONNECTED_TO_NEW_OUTPOST',
      'The setup route must touch the outpost just placed.',
      'edgeId',
    )
  }
  return { success: true, value: null }
}

export function getLegalSetupRouteEdges(
  state: SetupState,
  topology: BoardTopology,
): readonly EdgeId[] {
  const pending = state.pendingOutpostVertexId
  if (state.complete || state.expects !== 'route' || pending === undefined) {
    return []
  }
  return getBoardEdgeIdsTouchingVertex(topology, pending).filter(
    (edgeId) => state.routes[edgeId] === undefined,
  )
}

/**
 * Resources from the sectors touching a corner: one per visible producing
 * sector. Hidden sectors yield nothing during setup even when their underlying
 * type produces.
 */
export function getSetupResourceGrantForVertex(
  topology: BoardTopology,
  vertexId: VertexId,
): ResourceInventory {
  const resources: Record<string, number> = { ...createEmptyResourceInventory() }
  for (const sector of getSectorsAdjacentToVertex(topology, vertexId)) {
    if (sector.visibility !== 'visible') {
      continue
    }
    const resource = getSectorResourceType(sector.type)
    if (resource === undefined) {
      continue
    }
    resources[resource] = (resources[resource] ?? 0) + 1
  }
  return resources as ResourceInventory
}

export function placeSetupOutpost(
  state: SetupState,
  topology: BoardTopology,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<SetupState> {
  const validation = validateSetupOutpostPlacement(state, topology, playerId, vertexId)
  if (!validation.success) {
    return validation
  }

  return {
    success: true,
    value: {
      ...state,
      outposts: { ...state.outposts, [vertexId]: createOutpost(vertexId, playerId) },
      expects: 'route',
      pendingOutpostVertexId: vertexId,
    },
  }
}

export function placeSetupRoute(
  state: SetupState,
  topology: BoardTopology,
  playerId: PlayerId,
  edgeId: EdgeId,
): DomainResult<SetupRoutePlacement> {
  const validation = validateSetupRoutePlacement(state, topology, playerId, edgeId)
  if (!validation.success) {
    return validation
  }

  const completedPairs = getCompletedSetupPairs(state, playerId) + 1
  const stepIndex = state.stepIndex + 1
  const complete = stepIndex >= state.placementOrder.length

  // `pendingOutpostVertexId` is dropped rather than set to undefined
  // (exactOptionalPropertyTypes).
  const { pendingOutpostVertexId, ...rest } = state
  const nextState: SetupState = {
    ...rest,
    routes: { ...state.routes, [edgeId]: createTradeRoute(edgeId, playerId) },
    completedPairsByPlayer: { ...state.completedPairsByPlayer, [playerId]: completedPairs },
    stepIndex,
    expects: 'outpost',
    complete,
  }

  // Starting resources come from the second outpost only, and only once its
  // route is down.
  if (completedPairs !== SETUP_PAIRS_PER_PLAYER || pendingOutpostVertexId === undefined) {
    return { success: true, value: { state: nextState } }
  }

  return {
    success: true,
    value: {
      state: nextState,
      grant: {
        playerId,
        resources: getSetupResourceGrantForVertex(topology, pendingOutpostVertexId),
      },
    },
  }
}
