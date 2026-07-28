import { describe, expect, it } from 'vitest'
import { createResourceInventory } from '../types/resources'
import {
  BUILD_ACTIONS,
  getBuildCost,
  getMothershipUpgradeLimit,
  getReserveDrawEntitlement,
  getSupplyTradeRate,
  GOODS_SUPPLY_TRADE_RATE,
  STANDARD_SUPPLY_TRADE_RATE,
  STARTING_VICTORY_POINTS,
  VICTORY_POINT_TARGET,
  VICTORY_POINT_VALUES,
} from './rules-config'

describe('build costs', () => {
  it('charges 3 cryonite + 2 biofiber for a Spaceport', () => {
    expect(getBuildCost('spaceport')).toEqual(createResourceInventory({ cryonite: 3, biofiber: 2 }))
  })

  it('charges 1 alloy + 1 plasma + 1 cryonite + 1 biofiber for a Colony Ship', () => {
    expect(getBuildCost('colonyShip')).toEqual(
      createResourceInventory({ alloy: 1, plasma: 1, cryonite: 1, biofiber: 1 }),
    )
  })

  it('charges 1 alloy + 1 plasma + 2 quantumCore for a Trade Ship', () => {
    expect(getBuildCost('tradeShip')).toEqual(
      createResourceInventory({ alloy: 1, plasma: 1, quantumCore: 2 }),
    )
  })

  it('charges 2 cryonite for a Cannon, 2 alloy for a Freight Pod, 2 plasma for a Booster', () => {
    expect(getBuildCost('cannon')).toEqual(createResourceInventory({ cryonite: 2 }))
    expect(getBuildCost('freightPod')).toEqual(createResourceInventory({ alloy: 2 }))
    expect(getBuildCost('booster')).toEqual(createResourceInventory({ plasma: 2 }))
  })

  it('defines a cost for every build action', () => {
    for (const action of BUILD_ACTIONS) {
      expect(getBuildCost(action)).toBeDefined()
    }
  })

  it('no longer exposes route, outpost, or nexus actions', () => {
    expect(BUILD_ACTIONS).not.toContain('tradeRoute')
    expect(BUILD_ACTIONS).not.toContain('outpost')
    expect(BUILD_ACTIONS).not.toContain('nexus')
  })
})

describe('mothership upgrade limits', () => {
  it('caps cannons at 6, freight pods at 5, and boosters at 6', () => {
    expect(getMothershipUpgradeLimit('cannon')).toBe(6)
    expect(getMothershipUpgradeLimit('freightPod')).toBe(5)
    expect(getMothershipUpgradeLimit('booster')).toBe(6)
  })
})

describe('supply trade rates', () => {
  it('trades ordinary resources at 3:1', () => {
    expect(getSupplyTradeRate('alloy')).toBe(STANDARD_SUPPLY_TRADE_RATE)
    expect(getSupplyTradeRate('alloy')).toBe(3)
    expect(getSupplyTradeRate('plasma')).toBe(3)
    expect(getSupplyTradeRate('cryonite')).toBe(3)
    expect(getSupplyTradeRate('biofiber')).toBe(3)
  })

  it('trades the goods-equivalent resource at 2:1', () => {
    expect(getSupplyTradeRate('quantumCore')).toBe(GOODS_SUPPLY_TRADE_RATE)
    expect(getSupplyTradeRate('quantumCore')).toBe(2)
  })
})

describe('reserve draw entitlement', () => {
  it('draws 2 cards from 4 to 7 victory points', () => {
    for (const points of [4, 5, 6, 7]) {
      expect(getReserveDrawEntitlement(points)).toBe(2)
    }
  })

  it('draws 1 card at 8 and 9 victory points', () => {
    expect(getReserveDrawEntitlement(8)).toBe(1)
    expect(getReserveDrawEntitlement(9)).toBe(1)
  })

  it('draws nothing from 10 victory points upward', () => {
    for (const points of [10, 11, 14, 15, 20]) {
      expect(getReserveDrawEntitlement(points)).toBe(0)
    }
  })
})

describe('victory points', () => {
  it('targets 15 points', () => {
    expect(VICTORY_POINT_TARGET).toBe(15)
  })

  it('starts players at 4 points', () => {
    expect(STARTING_VICTORY_POINTS).toBe(4)
  })

  it('scores a Colony at 1 and a Spaceport at 2 in total', () => {
    expect(VICTORY_POINT_VALUES.colony).toBe(1)
    expect(VICTORY_POINT_VALUES.spaceport).toBe(2)
  })

  it('scores friendship markers at 2 and cleared hazards at 1', () => {
    expect(VICTORY_POINT_VALUES.friendshipMarker).toBe(2)
    expect(VICTORY_POINT_VALUES.defeatedPirateBase).toBe(1)
    expect(VICTORY_POINT_VALUES.terraformedIcePlanet).toBe(1)
    expect(VICTORY_POINT_VALUES.fameMedalPair).toBe(1)
  })
})
