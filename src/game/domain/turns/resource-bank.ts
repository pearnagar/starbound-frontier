import { createSeededRandom } from '../random/seeded-random'
import { RESERVE_CARDS_PER_RESOURCE } from '../rules/rules-config'
import {
  createEmptyResourceInventory,
  RESOURCE_TYPES,
  type ResourceInventory,
  type ResourceType,
} from '../types/resources'

/**
 * The face-up Supply. Players trade with it, spend into it, and discard to it.
 * Distinct from the face-down Reserve pile below, which is drawn blind.
 */
export type ResourceSupply = Readonly<{
  quantities: ResourceInventory
}>

/**
 * The face-down Reserve pile, held as an ordered list of cards. Order is
 * authoritative: draws come off the front, and the order is produced by a
 * deterministic shuffle so a seed always replays the same pile.
 */
export type ReservePile = Readonly<{
  cards: readonly ResourceType[]
}>

/** Default face-up Supply size per resource type. */
export const DEFAULT_INITIAL_SUPPLY_QUANTITY = 24

export function createResourceSupply(
  initialQuantityPerResource: number = DEFAULT_INITIAL_SUPPLY_QUANTITY,
): ResourceSupply {
  const quantities: Record<string, number> = { ...createEmptyResourceInventory() }
  for (const type of RESOURCE_TYPES) {
    quantities[type] = initialQuantityPerResource
  }
  return { quantities: quantities as ResourceInventory }
}

export function isValidResourceSupply(supply: ResourceSupply): boolean {
  return RESOURCE_TYPES.every(
    (type) => Number.isInteger(supply.quantities[type]) && supply.quantities[type] >= 0,
  )
}

export function supplyHasAtLeast(
  supply: ResourceSupply,
  resource: ResourceType,
  amount: number,
): boolean {
  return supply.quantities[resource] >= amount
}

/**
 * Deducts an inventory from the Supply. Callers must have verified sufficiency
 * first, so this never produces a negative quantity.
 */
export function deductFromSupply(
  supply: ResourceSupply,
  amounts: ResourceInventory,
): ResourceSupply {
  const quantities: Record<string, number> = { ...supply.quantities }
  for (const type of RESOURCE_TYPES) {
    if (amounts[type] > 0) {
      quantities[type] = Math.max(0, supply.quantities[type] - amounts[type])
    }
  }
  return { quantities: quantities as ResourceInventory }
}

/** Returns an inventory to the Supply (spending, discards, trades). */
export function addToSupply(supply: ResourceSupply, amounts: ResourceInventory): ResourceSupply {
  const quantities: Record<string, number> = { ...supply.quantities }
  for (const type of RESOURCE_TYPES) {
    if (amounts[type] > 0) {
      quantities[type] = supply.quantities[type] + amounts[type]
    }
  }
  return { quantities: quantities as ResourceInventory }
}

/**
 * Builds a fresh Reserve pile: 8 cards of each resource type, shuffled with
 * the seeded generator. Returns the pile and the next random state so callers
 * keep determinism without a shared mutable generator.
 */
export function createReservePile(randomState: number): {
  pile: ReservePile
  nextRandomState: number
} {
  const cards: ResourceType[] = []
  for (const type of RESOURCE_TYPES) {
    for (let index = 0; index < RESERVE_CARDS_PER_RESOURCE; index += 1) {
      cards.push(type)
    }
  }
  const random = createSeededRandom(randomState)
  const shuffled = random.shuffle(cards)
  return { pile: { cards: shuffled }, nextRandomState: random.nextUint32() }
}

export function getReserveCount(pile: ReservePile): number {
  return pile.cards.length
}

export function isReserveEmpty(pile: ReservePile): boolean {
  return pile.cards.length === 0
}

/** Outcome of drawing from the Reserve pile. */
export type ReserveDrawResult = Readonly<{
  /** Cards actually drawn, in draw order. */
  drawn: readonly ResourceType[]
  /** Drawn cards aggregated for adding to a player's hand. */
  inventory: ResourceInventory
  pile: ReservePile
  nextRandomState: number
  /** True when the pile ran out mid-draw and was rebuilt. */
  rebuilt: boolean
}>

/**
 * Draws `count` cards off the front of the Reserve pile, rebuilding it with a
 * fresh shuffled 8-per-resource pile whenever it empties mid-draw. Drawn cards
 * are hidden information — callers must not leak them into public events.
 */
export function drawFromReserve(
  pile: ReservePile,
  count: number,
  randomState: number,
): ReserveDrawResult {
  const drawn: ResourceType[] = []
  let remaining = [...pile.cards]
  let state = randomState
  let rebuilt = false

  for (let index = 0; index < count; index += 1) {
    if (remaining.length === 0) {
      const rebuiltPile = createReservePile(state)
      remaining = [...rebuiltPile.pile.cards]
      state = rebuiltPile.nextRandomState
      rebuilt = true
    }
    const card = remaining.shift()
    if (card === undefined) {
      break
    }
    drawn.push(card)
  }

  const inventory: Record<string, number> = { ...createEmptyResourceInventory() }
  for (const card of drawn) {
    inventory[card] = (inventory[card] ?? 0) + 1
  }

  return {
    drawn,
    inventory: inventory as ResourceInventory,
    pile: { cards: remaining },
    nextRandomState: state,
    rebuilt,
  }
}
