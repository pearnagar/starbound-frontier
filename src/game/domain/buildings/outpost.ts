import type { VertexId } from '../board/vertex'
import type { PlayerId } from '../types/ids'

/**
 * An outpost occupying a canonical board corner.
 *
 * Setup only needs ownership and location. Colonies, nexus upgrades, and
 * construction costs belong to the Construction milestone.
 */
export type Outpost = Readonly<{
  vertexId: VertexId
  ownerId: PlayerId
}>

export function createOutpost(vertexId: VertexId, ownerId: PlayerId): Outpost {
  return { vertexId, ownerId }
}
