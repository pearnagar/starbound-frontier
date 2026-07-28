import { listSectors, type Board } from '../board/board'
import {
  createBoardTopology,
  getSectorsAdjacentToVertex,
  type BoardTopology,
} from '../board/board-topology'
import { generateBoard } from '../board/board-generation'
import type { SectorType, SectorVisibility } from '../board/sector'
import { getHexVertices, type VertexId } from '../board/vertex'
import { hexCoordinateKey } from '../board/hex-coordinate'
import { asCaptainId, asFactionColorId, asPlayerId, type PlayerId } from '../types/ids'
import { createPlayer, type Player } from '../types/player'
import type { SetupState } from '../setup/setup-state'
import { createInitialSetupState, getActiveSetupPlayer } from '../setup/setup-state'
import {
  getLegalSetupOutpostVertices,
  getLegalSetupRouteEdges,
  placeSetupOutpost,
  placeSetupRoute,
  type SetupResourceGrant,
} from '../setup/setup-placement'
import type { Outpost } from '../buildings/outpost'
import type { TradeRoute } from '../routes/trade-route'

export const p1 = asPlayerId('p1')
export const p2 = asPlayerId('p2')

export function baseBoard(seed = 11): Board {
  const result = generateBoard(seed)
  if (!result.success) throw new Error('expected a valid board fixture')
  return result.value
}

/** All sectors visible, so visibility never interferes unless a test says so. */
export function allVisible(board: Board): Board {
  const sectors = { ...board.sectors }
  for (const [key, sector] of Object.entries(sectors)) {
    sectors[key] = { ...sector, visibility: 'visible' }
  }
  return { ...board, sectors }
}

const NON_PRODUCING_SECTOR_TYPES: readonly SectorType[] = ['emptySpace', 'anomaly', 'centralStar']

/**
 * Rewrites sector type/visibility/productionNumber so tests can pin down what
 * a corner touches. Switching to a non-producing type always clears any
 * existing production number, matching how generated boards are shaped.
 */
export function withSectors(
  board: Board,
  overrides: Readonly<
    Record<string, { type?: SectorType; visibility?: SectorVisibility; productionNumber?: number }>
  >,
): Board {
  const sectors = { ...board.sectors }
  for (const [key, sector] of Object.entries(sectors)) {
    const override = overrides[key]
    if (override === undefined) {
      continue
    }
    const nextType = override.type ?? sector.type
    const clearsProductionNumber = NON_PRODUCING_SECTOR_TYPES.includes(nextType)

    sectors[key] = {
      ...sector,
      type: nextType,
      ...(override.visibility === undefined ? {} : { visibility: override.visibility }),
      ...(clearsProductionNumber
        ? {}
        : override.productionNumber === undefined
          ? {}
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { productionNumber: override.productionNumber as any }),
    }
    if (clearsProductionNumber) {
      delete (sectors[key] as { productionNumber?: number }).productionNumber
    }
  }
  return { ...board, sectors }
}

export function makePlayer(id: PlayerId, seatIndex: number): Player {
  const result = createPlayer({
    id,
    name: id,
    seatIndex,
    captainId: asCaptainId(`captain-${id}`),
    factionColorId: asFactionColorId(`color-${id}`),
    control: { controlType: 'human' },
  })
  if (!result.success) throw new Error('expected a valid player fixture')
  return result.value
}

/**
 * Plays a full, valid setup sequence for the given players on the given
 * board, using the first legal option at each step, and returns the finished
 * setup state plus every resource grant it produced.
 */
export function playFullSetup(
  board: Board,
  players: readonly PlayerId[] = [p1, p2],
): Readonly<{ setup: SetupState; topology: BoardTopology; grants: readonly SetupResourceGrant[] }> {
  const topology = createBoardTopology(board)
  const initial = createInitialSetupState(players)
  if (!initial.success) throw new Error('expected a valid setup state')
  let state = initial.value
  const grants: SetupResourceGrant[] = []

  while (!state.complete) {
    const player = getActiveSetupPlayer(state)
    if (player === undefined) throw new Error('setup already complete')

    const [vertexId] = getLegalSetupOutpostVertices(state, topology)
    if (vertexId === undefined) throw new Error('no legal outpost remains')
    const afterOutpost = placeSetupOutpost(state, topology, player, vertexId)
    if (!afterOutpost.success) throw new Error('outpost rejected')

    const [edgeId] = getLegalSetupRouteEdges(afterOutpost.value, topology)
    if (edgeId === undefined) throw new Error('no legal route remains')
    const routeResult = placeSetupRoute(afterOutpost.value, topology, player, edgeId)
    if (!routeResult.success) throw new Error('route rejected')

    if (routeResult.value.grant !== undefined) {
      grants.push(routeResult.value.grant)
    }
    state = routeResult.value.state
  }

  return { setup: state, topology, grants }
}

export {
  getHexVertices,
  getSectorsAdjacentToVertex,
  hexCoordinateKey,
  listSectors,
  type Outpost,
  type TradeRoute,
  type VertexId,
}
