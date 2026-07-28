import type { EdgeId } from '../board/edge'
import type { PlayerId } from '../types/ids'

/**
 * A trade route occupying a canonical board edge.
 *
 * Setup only needs ownership and location. Network connectivity and
 * longest-network scoring belong to later milestones.
 */
export type TradeRoute = Readonly<{
  edgeId: EdgeId
  ownerId: PlayerId
}>

export function createTradeRoute(edgeId: EdgeId, ownerId: PlayerId): TradeRoute {
  return { edgeId, ownerId }
}
