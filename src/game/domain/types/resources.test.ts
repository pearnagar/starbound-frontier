import { describe, expect, it } from 'vitest'
import {
  addResourceInventories,
  createEmptyResourceInventory,
  createResourceInventory,
  getResourceRole,
  getResourceTypeForRole,
  getTotalResourceCount,
  GOODS_RESOURCE_TYPE,
  hasAtLeastResources,
  isValidResourceInventory,
  RESOURCE_ROLES,
  RESOURCE_TYPES,
  subtractResourceInventories,
} from './resources'

describe('resource role mapping', () => {
  it('maps every serialized identifier to its gameplay role', () => {
    expect(getResourceRole('alloy')).toBe('ore')
    expect(getResourceRole('plasma')).toBe('fuel')
    expect(getResourceRole('cryonite')).toBe('carbon')
    expect(getResourceRole('biofiber')).toBe('food')
    expect(getResourceRole('quantumCore')).toBe('goods')
  })

  it('round-trips role and type in both directions', () => {
    for (const type of RESOURCE_TYPES) {
      expect(getResourceTypeForRole(getResourceRole(type))).toBe(type)
    }
    for (const role of RESOURCE_ROLES) {
      expect(getResourceRole(getResourceTypeForRole(role))).toBe(role)
    }
  })

  it('assigns the goods role to quantumCore', () => {
    expect(GOODS_RESOURCE_TYPE).toBe('quantumCore')
  })

  it('keeps the serialized identifiers unchanged', () => {
    expect(RESOURCE_TYPES).toEqual(['alloy', 'plasma', 'cryonite', 'biofiber', 'quantumCore'])
  })
})

describe('resource inventories', () => {
  it('creates an empty inventory with every type at zero', () => {
    const empty = createEmptyResourceInventory()
    expect(getTotalResourceCount(empty)).toBe(0)
    expect(RESOURCE_TYPES.every((type) => empty[type] === 0)).toBe(true)
  })

  it('fills omitted types with zero when built from a partial', () => {
    const inventory = createResourceInventory({ alloy: 2, quantumCore: 1 })
    expect(inventory.alloy).toBe(2)
    expect(inventory.quantumCore).toBe(1)
    expect(inventory.plasma).toBe(0)
  })

  it('adds and subtracts without mutating either input', () => {
    const left = createResourceInventory({ alloy: 2 })
    const right = createResourceInventory({ alloy: 1, plasma: 3 })

    expect(addResourceInventories(left, right).alloy).toBe(3)
    expect(addResourceInventories(left, right).plasma).toBe(3)
    expect(left.alloy).toBe(2)
    expect(right.plasma).toBe(3)
  })

  it('clamps subtraction at zero', () => {
    const result = subtractResourceInventories(
      createResourceInventory({ alloy: 1 }),
      createResourceInventory({ alloy: 5 }),
    )
    expect(result.alloy).toBe(0)
  })

  it('reports sufficiency per resource type', () => {
    const held = createResourceInventory({ alloy: 3, plasma: 1 })
    expect(hasAtLeastResources(held, createResourceInventory({ alloy: 3 }))).toBe(true)
    expect(hasAtLeastResources(held, createResourceInventory({ alloy: 4 }))).toBe(false)
    expect(hasAtLeastResources(held, createResourceInventory({ plasma: 1, alloy: 1 }))).toBe(true)
  })

  it('rejects negative and fractional quantities', () => {
    expect(isValidResourceInventory(createResourceInventory({ alloy: 1 }))).toBe(true)
    expect(isValidResourceInventory({ ...createEmptyResourceInventory(), alloy: -1 })).toBe(false)
    expect(isValidResourceInventory({ ...createEmptyResourceInventory(), alloy: 1.5 })).toBe(false)
  })
})
