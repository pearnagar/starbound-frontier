import {
  createEmptyResourceInventory,
  RESOURCE_TYPES,
  type ResourceInventory,
} from '../types/resources'

/**
 * The finite shared supply of resources. Serializable, immutable — every
 * transition below returns a new bank rather than mutating in place.
 */
export type ResourceBank = Readonly<{
  quantities: ResourceInventory
}>

/**
 * Default initial supply per resource. Chosen to match the physical Catan-
 * style bank size (19 of each resource type) for a standard board — see
 * docs/DECISIONS.md.
 */
export const DEFAULT_INITIAL_BANK_QUANTITY = 19

export function createResourceBank(
  initialQuantityPerResource: number = DEFAULT_INITIAL_BANK_QUANTITY,
): ResourceBank {
  const quantities: Record<string, number> = { ...createEmptyResourceInventory() }
  for (const type of RESOURCE_TYPES) {
    quantities[type] = initialQuantityPerResource
  }
  return { quantities: quantities as ResourceInventory }
}

export function isValidResourceBank(bank: ResourceBank): boolean {
  return RESOURCE_TYPES.every(
    (type) => Number.isInteger(bank.quantities[type]) && bank.quantities[type] >= 0,
  )
}

/** Whether the bank currently holds at least `amount` of `resource`. */
export function bankHasAtLeast(
  bank: ResourceBank,
  resource: keyof ResourceInventory,
  amount: number,
): boolean {
  return bank.quantities[resource] >= amount
}

/**
 * Deducts a full resource inventory from the bank. Callers must have already
 * verified sufficiency (e.g. via `bankHasAtLeast`) — this never produces a
 * negative quantity because it is only ever called after that check.
 */
export function deductFromBank(bank: ResourceBank, amounts: ResourceInventory): ResourceBank {
  const quantities: Record<string, number> = { ...bank.quantities }
  for (const type of RESOURCE_TYPES) {
    const amount = amounts[type]
    const current = bank.quantities[type]
    if (amount > 0) {
      quantities[type] = Math.max(0, current - amount)
    }
  }
  return { quantities: quantities as ResourceInventory }
}

/** Returns a full resource inventory to the bank (e.g. a crisis discard). */
export function addToBank(bank: ResourceBank, amounts: ResourceInventory): ResourceBank {
  const quantities: Record<string, number> = { ...bank.quantities }
  for (const type of RESOURCE_TYPES) {
    const amount = amounts[type]
    if (amount > 0) {
      quantities[type] = bank.quantities[type] + amount
    }
  }
  return { quantities: quantities as ResourceInventory }
}
