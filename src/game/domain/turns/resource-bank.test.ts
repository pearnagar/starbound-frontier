import { describe, expect, it } from 'vitest'
import { RESERVE_CARDS_PER_RESOURCE } from '../rules/rules-config'
import { createResourceInventory, RESOURCE_TYPES } from '../types/resources'
import {
  addToSupply,
  createReservePile,
  createResourceSupply,
  deductFromSupply,
  drawFromReserve,
  getReserveCount,
  isReserveEmpty,
  isValidResourceSupply,
  supplyHasAtLeast,
} from './resource-bank'

describe('reserve pile', () => {
  it('holds 8 cards of each of the 5 resource types', () => {
    const { pile } = createReservePile(1)
    expect(getReserveCount(pile)).toBe(RESERVE_CARDS_PER_RESOURCE * RESOURCE_TYPES.length)
    expect(getReserveCount(pile)).toBe(40)

    for (const type of RESOURCE_TYPES) {
      expect(pile.cards.filter((card) => card === type)).toHaveLength(8)
    }
  })

  it('shuffles deterministically from the seed', () => {
    expect(createReservePile(4242).pile.cards).toEqual(createReservePile(4242).pile.cards)
    expect(createReservePile(1).pile.cards).not.toEqual(createReservePile(2).pile.cards)
  })

  it('advances the random state so later draws differ', () => {
    const first = createReservePile(7)
    expect(first.nextRandomState).not.toBe(7)
  })

  it('draws cards off the front of the pile', () => {
    const { pile } = createReservePile(11)
    const expected = pile.cards.slice(0, 3)
    const result = drawFromReserve(pile, 3, 99)

    expect(result.drawn).toEqual(expected)
    expect(getReserveCount(result.pile)).toBe(37)
    expect(result.rebuilt).toBe(false)
  })

  it('aggregates drawn cards into an inventory', () => {
    const { pile } = createReservePile(3)
    const result = drawFromReserve(pile, 5, 1)
    const total = RESOURCE_TYPES.reduce((sum, type) => sum + result.inventory[type], 0)
    expect(total).toBe(5)
  })

  it('rebuilds with a fresh shuffled pile when depleted mid-draw', () => {
    const { pile } = createReservePile(5)
    const emptied = drawFromReserve(pile, 40, 1)
    expect(isReserveEmpty(emptied.pile)).toBe(true)

    const afterEmpty = drawFromReserve(emptied.pile, 2, emptied.nextRandomState)
    expect(afterEmpty.rebuilt).toBe(true)
    expect(afterEmpty.drawn).toHaveLength(2)
    expect(getReserveCount(afterEmpty.pile)).toBe(38)
  })

  it('rebuilds deterministically', () => {
    const { pile } = createReservePile(5)
    const emptied = drawFromReserve(pile, 40, 1)
    const first = drawFromReserve(emptied.pile, 3, 123)
    const second = drawFromReserve(emptied.pile, 3, 123)
    expect(first.drawn).toEqual(second.drawn)
  })

  it('does not mutate the pile passed in', () => {
    const { pile } = createReservePile(9)
    const snapshot = [...pile.cards]
    drawFromReserve(pile, 4, 1)
    expect(pile.cards).toEqual(snapshot)
  })

  it('draws nothing for a count of zero', () => {
    const { pile } = createReservePile(2)
    const result = drawFromReserve(pile, 0, 1)
    expect(result.drawn).toHaveLength(0)
    expect(getReserveCount(result.pile)).toBe(40)
  })
})

describe('face-up supply', () => {
  it('starts with the configured quantity of every resource', () => {
    const supply = createResourceSupply(24)
    for (const type of RESOURCE_TYPES) {
      expect(supply.quantities[type]).toBe(24)
    }
    expect(isValidResourceSupply(supply)).toBe(true)
  })

  it('reports whether it holds enough of a resource', () => {
    const supply = createResourceSupply(2)
    expect(supplyHasAtLeast(supply, 'alloy', 2)).toBe(true)
    expect(supplyHasAtLeast(supply, 'alloy', 3)).toBe(false)
  })

  it('deducts and returns without mutating', () => {
    const supply = createResourceSupply(10)
    const spent = deductFromSupply(supply, createResourceInventory({ alloy: 4 }))
    expect(spent.quantities.alloy).toBe(6)
    expect(supply.quantities.alloy).toBe(10)

    const returned = addToSupply(spent, createResourceInventory({ alloy: 4 }))
    expect(returned.quantities.alloy).toBe(10)
  })

  it('never goes negative', () => {
    const supply = createResourceSupply(1)
    expect(deductFromSupply(supply, createResourceInventory({ alloy: 5 })).quantities.alloy).toBe(0)
  })

  it('is distinct from the reserve pile', () => {
    const supply = createResourceSupply(24)
    const { pile } = createReservePile(1)
    expect(supply).not.toHaveProperty('cards')
    expect(pile).not.toHaveProperty('quantities')
  })
})
