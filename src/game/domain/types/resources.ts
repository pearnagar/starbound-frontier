export const RESOURCE_TYPES = ['alloy', 'plasma', 'cryonite', 'biofiber', 'quantumCore'] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]

export type ResourceInventory = Readonly<Record<ResourceType, number>>

/**
 * Gameplay role each Starbound Frontier resource fills in the reference rules.
 * Serialized identifiers stay unchanged; only the role mapping is documented
 * here (see `docs/RULEBOOK_ALIGNMENT.md`). `goods` carries the special 2:1
 * supply-trade rate, which in this project belongs to `quantumCore`.
 */
export const RESOURCE_ROLES = ['ore', 'fuel', 'carbon', 'food', 'goods'] as const

export type ResourceRole = (typeof RESOURCE_ROLES)[number]

const RESOURCE_ROLE_BY_TYPE: Readonly<Record<ResourceType, ResourceRole>> = {
  alloy: 'ore',
  plasma: 'fuel',
  cryonite: 'carbon',
  biofiber: 'food',
  quantumCore: 'goods',
}

const RESOURCE_TYPE_BY_ROLE: Readonly<Record<ResourceRole, ResourceType>> = {
  ore: 'alloy',
  fuel: 'plasma',
  carbon: 'cryonite',
  food: 'biofiber',
  goods: 'quantumCore',
}

export function getResourceRole(type: ResourceType): ResourceRole {
  return RESOURCE_ROLE_BY_TYPE[type]
}

export function getResourceTypeForRole(role: ResourceRole): ResourceType {
  return RESOURCE_TYPE_BY_ROLE[role]
}

/**
 * The resource whose supply trade rate is 2:1 rather than 3:1. Derived from the
 * `goods` role so the rate can never drift from the mapping above.
 */
export const GOODS_RESOURCE_TYPE: ResourceType = RESOURCE_TYPE_BY_ROLE.goods

export function createEmptyResourceInventory(): ResourceInventory {
  // Object.fromEntries loses the literal key union; RESOURCE_TYPES guarantees
  // every ResourceType key is present, so this cast is isolated and safe.
  return Object.fromEntries(RESOURCE_TYPES.map((type) => [type, 0])) as ResourceInventory
}

export function getTotalResourceCount(inventory: ResourceInventory): number {
  return RESOURCE_TYPES.reduce((total, type) => total + inventory[type], 0)
}

export function isValidResourceInventory(inventory: ResourceInventory): boolean {
  return RESOURCE_TYPES.every((type) => Number.isInteger(inventory[type]) && inventory[type] >= 0)
}

/** Adds two inventories field by field. Neither input is mutated. */
export function addResourceInventories(
  left: ResourceInventory,
  right: ResourceInventory,
): ResourceInventory {
  const result: Record<string, number> = {}
  for (const type of RESOURCE_TYPES) {
    result[type] = left[type] + right[type]
  }
  return result as ResourceInventory
}

/** Subtracts `right` from `left`, clamping at zero. Neither input is mutated. */
export function subtractResourceInventories(
  left: ResourceInventory,
  right: ResourceInventory,
): ResourceInventory {
  const result: Record<string, number> = {}
  for (const type of RESOURCE_TYPES) {
    result[type] = Math.max(0, left[type] - right[type])
  }
  return result as ResourceInventory
}

/** Whether `inventory` covers every unit of `cost`, type by type. */
export function hasAtLeastResources(
  inventory: ResourceInventory,
  cost: ResourceInventory,
): boolean {
  return RESOURCE_TYPES.every((type) => inventory[type] >= cost[type])
}

/** Builds an inventory from a sparse partial, filling omitted types with 0. */
export function createResourceInventory(
  amounts: Partial<Record<ResourceType, number>>,
): ResourceInventory {
  const result: Record<string, number> = {}
  for (const type of RESOURCE_TYPES) {
    result[type] = amounts[type] ?? 0
  }
  return result as ResourceInventory
}
