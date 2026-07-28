import type { VertexId } from '../board/vertex'
import type { PlayerId } from '../types/ids'

/** Closed set of structure types a player may occupy a corner with. */
export const STRUCTURE_TYPES = ['outpost', 'colony', 'nexus'] as const

export type StructureType = (typeof STRUCTURE_TYPES)[number]

/**
 * A structure occupying a canonical board corner. `type` discriminates
 * between an Outpost, a Colony (Outpost upgrade), and a Nexus (Colony
 * upgrade) — all three share the same shape otherwise, so callers switch on
 * `type` rather than juggling unrelated parallel models.
 */
export type Structure = Readonly<{
  type: StructureType
  vertexId: VertexId
  ownerId: PlayerId
}>

export function createStructure(
  type: StructureType,
  vertexId: VertexId,
  ownerId: PlayerId,
): Structure {
  return { type, vertexId, ownerId }
}

/** Resource units this structure yields per matching production roll. */
const STRUCTURE_PRODUCTION_VALUES: Readonly<Record<StructureType, number>> = {
  outpost: 1,
  colony: 2,
  nexus: 3,
}

export function getStructureProductionValue(type: StructureType): number {
  return STRUCTURE_PRODUCTION_VALUES[type]
}
