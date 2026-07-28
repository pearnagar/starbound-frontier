import { createEmptyResourceInventory, type ResourceInventory } from '../types/resources'

/** Closed set of things a player may build or upgrade during the build phase. */
export const CONSTRUCTION_ACTIONS = ['tradeRoute', 'outpost', 'colony', 'nexus'] as const

export type ConstructionAction = (typeof CONSTRUCTION_ACTIONS)[number]

/**
 * One typed home for every construction cost, so validators and transitions
 * never repeat resource literals. `colony`/`nexus` costs are upgrade costs
 * (paid on top of an already-placed Outpost/Colony), not full-piece costs.
 */
const CONSTRUCTION_COSTS: Readonly<Record<ConstructionAction, ResourceInventory>> = {
  tradeRoute: { ...createEmptyResourceInventory(), alloy: 1, plasma: 1 },
  outpost: { ...createEmptyResourceInventory(), alloy: 1, plasma: 1, cryonite: 1, biofiber: 1 },
  colony: { ...createEmptyResourceInventory(), biofiber: 2, cryonite: 2, quantumCore: 1 },
  nexus: { ...createEmptyResourceInventory(), alloy: 3, quantumCore: 2, plasma: 1 },
}

export function getBuildCost(action: ConstructionAction): ResourceInventory {
  return CONSTRUCTION_COSTS[action]
}

/** Whether `resources` covers every unit of `cost`, type by type. */
export function canAffordCost(resources: ResourceInventory, cost: ResourceInventory): boolean {
  const keys = Object.keys(cost) as (keyof ResourceInventory)[]
  return keys.every((type) => resources[type] >= cost[type])
}
