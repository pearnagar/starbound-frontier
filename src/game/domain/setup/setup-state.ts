import type { EdgeId } from '../board/edge'
import type { VertexId } from '../board/vertex'
import type { Outpost } from '../buildings/outpost'
import type { TradeRoute } from '../routes/trade-route'
import type { DomainResult } from '../types/result'
import type { PlayerId } from '../types/ids'

/** Setup alternates between these two: an outpost, then its connected route. */
export type SetupExpectation = 'outpost' | 'route'

/** Each player places this many outpost + route pairs during setup. */
export const SETUP_PAIRS_PER_PLAYER = 2

/**
 * Immutable snapshot of setup progress. Every transition returns a new state;
 * nothing here is mutated in place.
 */
export type SetupState = Readonly<{
  /** Seat order, as supplied. */
  playerOrder: readonly PlayerId[]
  /** Snake order: seat order forwards, then backwards. One entry per pair. */
  placementOrder: readonly PlayerId[]
  /** Index into `placementOrder`; equals its length once setup is complete. */
  stepIndex: number
  /** Whether the current step is waiting for an outpost or its route. */
  expects: SetupExpectation
  /** Set between an outpost and its mandatory route. */
  pendingOutpostVertexId?: VertexId
  /** Completed pairs per player, keyed by player id. */
  completedPairsByPlayer: Readonly<Record<string, number>>
  /** Placed outposts, keyed by canonical vertex id. */
  outposts: Readonly<Record<string, Outpost>>
  /** Placed routes, keyed by canonical edge id. */
  routes: Readonly<Record<string, TradeRoute>>
  complete: boolean
}>

/**
 * Snake order for `[P1, P2, P3, P4]` is `P1 P2 P3 P4 P4 P3 P2 P1`, so the last
 * seat places its two pairs back to back and the first seat's advantage on the
 * opening pick is offset by picking last on the second.
 */
export function getSetupPlacementOrder(playerOrder: readonly PlayerId[]): readonly PlayerId[] {
  return [...playerOrder, ...[...playerOrder].reverse()]
}

export function createInitialSetupState(
  playerOrder: readonly PlayerId[],
): DomainResult<SetupState> {
  if (playerOrder.length < 2) {
    return {
      success: false,
      errors: [
        {
          code: 'TOO_FEW_PLAYERS',
          message: 'Setup needs at least two players.',
          field: 'playerOrder',
        },
      ],
    }
  }
  if (new Set(playerOrder).size !== playerOrder.length) {
    return {
      success: false,
      errors: [
        {
          code: 'DUPLICATE_PLAYER',
          message: 'Each player may appear only once in the seat order.',
          field: 'playerOrder',
        },
      ],
    }
  }

  return {
    success: true,
    value: {
      playerOrder: [...playerOrder],
      placementOrder: getSetupPlacementOrder(playerOrder),
      stepIndex: 0,
      expects: 'outpost',
      completedPairsByPlayer: Object.fromEntries(playerOrder.map((id) => [id, 0])),
      outposts: {},
      routes: {},
      complete: false,
    },
  }
}

/** The player whose placement is expected now, or `undefined` once complete. */
export function getActiveSetupPlayer(state: SetupState): PlayerId | undefined {
  return state.placementOrder[state.stepIndex]
}

export function isSetupComplete(state: SetupState): boolean {
  return state.complete
}

export function getCompletedSetupPairs(state: SetupState, playerId: PlayerId): number {
  return state.completedPairsByPlayer[playerId] ?? 0
}

export function getOutpostAt(state: SetupState, vertexId: VertexId): Outpost | undefined {
  return state.outposts[vertexId]
}

export function getRouteAt(state: SetupState, edgeId: EdgeId): TradeRoute | undefined {
  return state.routes[edgeId]
}

export function listOutposts(state: SetupState): readonly Outpost[] {
  return Object.values(state.outposts)
}

export function listRoutes(state: SetupState): readonly TradeRoute[] {
  return Object.values(state.routes)
}
