import { describe, expect, it } from 'vitest'
import {
  createEmptyResourceInventory,
  getTotalResourceCount,
  isValidResourceInventory,
  RESOURCE_TYPES,
  type ResourceInventory,
} from './resources'

describe('RESOURCE_TYPES', () => {
  it('contains exactly the five Starbound Frontier resources', () => {
    expect(RESOURCE_TYPES).toEqual(['alloy', 'plasma', 'cryonite', 'biofiber', 'quantumCore'])
  })

  it('has a deterministic iteration order across calls', () => {
    expect([...RESOURCE_TYPES]).toEqual([...RESOURCE_TYPES])
    expect(RESOURCE_TYPES.join(',')).toBe('alloy,plasma,cryonite,biofiber,quantumCore')
  })
})

describe('createEmptyResourceInventory', () => {
  it('contains every resource type', () => {
    const inventory = createEmptyResourceInventory()
    for (const type of RESOURCE_TYPES) {
      expect(inventory).toHaveProperty(type)
    }
  })

  it('initializes every quantity to zero', () => {
    const inventory = createEmptyResourceInventory()
    for (const type of RESOURCE_TYPES) {
      expect(inventory[type]).toBe(0)
    }
  })

  it('returns an independent object on each call', () => {
    const a = createEmptyResourceInventory()
    const b = createEmptyResourceInventory()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})

describe('getTotalResourceCount', () => {
  it('returns 0 for an empty inventory', () => {
    expect(getTotalResourceCount(createEmptyResourceInventory())).toBe(0)
  })

  it('returns the correct total across all resource types', () => {
    const inventory: ResourceInventory = {
      alloy: 3,
      plasma: 1,
      cryonite: 0,
      biofiber: 4,
      quantumCore: 2,
    }
    expect(getTotalResourceCount(inventory)).toBe(10)
  })
})

describe('isValidResourceInventory', () => {
  it('accepts an empty inventory', () => {
    expect(isValidResourceInventory(createEmptyResourceInventory())).toBe(true)
  })

  it('accepts non-negative integer quantities', () => {
    const inventory: ResourceInventory = {
      alloy: 5,
      plasma: 2,
      cryonite: 0,
      biofiber: 7,
      quantumCore: 1,
    }
    expect(isValidResourceInventory(inventory)).toBe(true)
  })

  it('rejects a negative quantity', () => {
    const inventory: ResourceInventory = {
      alloy: -1,
      plasma: 0,
      cryonite: 0,
      biofiber: 0,
      quantumCore: 0,
    }
    expect(isValidResourceInventory(inventory)).toBe(false)
  })

  it('rejects a fractional quantity', () => {
    const inventory: ResourceInventory = {
      alloy: 0,
      plasma: 1.5,
      cryonite: 0,
      biofiber: 0,
      quantumCore: 0,
    }
    expect(isValidResourceInventory(inventory)).toBe(false)
  })
})
