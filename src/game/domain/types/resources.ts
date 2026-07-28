export const RESOURCE_TYPES = ['alloy', 'plasma', 'cryonite', 'biofiber', 'quantumCore'] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]

export type ResourceInventory = Readonly<Record<ResourceType, number>>

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
