import { describe, expect, it } from 'vitest'
import { asIntersectionId } from '../board/space-board'
import { getBuildCost } from '../rules/rules-config'
import { createResourceInventory } from '../types/resources'
import {
  buildMothershipUpgrade,
  buildShip,
  buildSpaceport,
  getAvailableSpaceportSites,
  getUpgradeableColonies,
  validateShipBuild,
  validateSpaceportBuild,
} from './construction'
import type { Match } from './match'
import { listPlayerShips, listPlayerSiteStructures } from './match'
import { createTestMatch } from './test-fixtures'

function expectSuccess<T>(result: { success: boolean; value?: T; errors?: unknown }): T {
  expect(result.success).toBe(true)
  if (!result.success || result.value === undefined) {
    throw new Error(`Expected success, got ${JSON.stringify(result.errors)}`)
  }
  return result.value
}

/** A match in Trade & Build with the active player richly supplied. */
function buildableMatch(): Match {
  const base = createTestMatch()
  const activeId = base.activePlayerId
  return {
    ...base,
    phase: 'tradeAndBuild',
    playersById: {
      ...base.playersById,
      [activeId]: {
        ...base.playersById[activeId]!,
        resources: createResourceInventory({
          alloy: 10,
          plasma: 10,
          cryonite: 10,
          biofiber: 10,
          quantumCore: 10,
        }),
      },
    },
  }
}

describe('spaceport construction', () => {
  it('costs 3 cryonite and 2 biofiber', () => {
    expect(getBuildCost('spaceport')).toEqual(createResourceInventory({ cryonite: 3, biofiber: 2 }))
  })

  it('upgrades an owned Colony and consumes one Shipyard', () => {
    const match = buildableMatch()
    const target = asIntersectionId('i-colony-a')
    const before = match.playersById[match.activePlayerId]!

    const after = expectSuccess(buildSpaceport(match, match.activePlayerId, target))
    const player = after.playersById[after.activePlayerId]!

    expect(after.structures[target]?.type).toBe('spaceport')
    expect(player.pieceSupply.shipyards).toBe(before.pieceSupply.shipyards - 1)
    // The Colony piece stays part of the Spaceport, so none is returned.
    expect(player.pieceSupply.colonies).toBe(before.pieceSupply.colonies)
  })

  it('pays the cost into the Supply', () => {
    const match = buildableMatch()
    const before = match.supply.quantities
    const after = expectSuccess(
      buildSpaceport(match, match.activePlayerId, asIntersectionId('i-colony-a')),
    )
    expect(after.supply.quantities.cryonite).toBe(before.cryonite + 3)
    expect(after.supply.quantities.biofiber).toBe(before.biofiber + 2)

    const player = after.playersById[after.activePlayerId]!
    expect(player.resources.cryonite).toBe(7)
    expect(player.resources.biofiber).toBe(8)
  })

  it('rejects upgrading a site that is already a Spaceport', () => {
    const match = buildableMatch()
    const result = validateSpaceportBuild(
      match,
      match.activePlayerId,
      asIntersectionId('i-colony-c'),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('NOT_A_COLONY')
    }
  })

  it('rejects upgrading another player’s Colony', () => {
    const match = buildableMatch()
    const result = validateSpaceportBuild(
      match,
      match.activePlayerId,
      asIntersectionId('i-colony-d'),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('NOT_OWNER')
    }
  })

  it('rejects building without enough resources', () => {
    const base = createTestMatch()
    const poor: Match = { ...base, phase: 'tradeAndBuild' }
    const result = validateSpaceportBuild(poor, poor.activePlayerId, asIntersectionId('i-colony-a'))
    expect(result.success).toBe(false)
  })

  it('lists only the player’s own Colonies as upgradeable', () => {
    const match = buildableMatch()
    const upgradeable = getUpgradeableColonies(match, match.activePlayerId)
    expect(upgradeable.slice().sort()).toEqual(['i-colony-a', 'i-colony-b'])
  })

  it('rejects building outside Trade & Build', () => {
    const match: Match = { ...buildableMatch(), phase: 'roll' }
    const result = validateSpaceportBuild(
      match,
      match.activePlayerId,
      asIntersectionId('i-colony-a'),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('WRONG_PHASE')
    }
  })
})

describe('ship construction', () => {
  it('costs 1 alloy + 1 plasma + 1 cryonite + 1 biofiber for a Colony Ship', () => {
    expect(getBuildCost('colonyShip')).toEqual(
      createResourceInventory({ alloy: 1, plasma: 1, cryonite: 1, biofiber: 1 }),
    )
  })

  it('costs 1 alloy + 1 plasma + 2 quantumCore for a Trade Ship', () => {
    expect(getBuildCost('tradeShip')).toEqual(
      createResourceInventory({ alloy: 1, plasma: 1, quantumCore: 2 }),
    )
  })

  it('consumes a Transport Ship and a Colony for a Colony Ship', () => {
    const match = buildableMatch()
    const before = match.playersById[match.activePlayerId]!
    const site = getAvailableSpaceportSites(match, match.activePlayerId)[0]!

    const after = expectSuccess(
      buildShip(match, match.activePlayerId, 'colonyShip', site.intersectionId),
    )
    const player = after.playersById[after.activePlayerId]!

    expect(player.pieceSupply.transportShips).toBe(before.pieceSupply.transportShips - 1)
    expect(player.pieceSupply.colonies).toBe(before.pieceSupply.colonies - 1)
    expect(player.pieceSupply.tradeStations).toBe(before.pieceSupply.tradeStations)
  })

  it('consumes a Transport Ship and a Trade Station for a Trade Ship', () => {
    const match = buildableMatch()
    const before = match.playersById[match.activePlayerId]!
    const site = getAvailableSpaceportSites(match, match.activePlayerId)[0]!

    const after = expectSuccess(
      buildShip(match, match.activePlayerId, 'tradeShip', site.intersectionId),
    )
    const player = after.playersById[after.activePlayerId]!

    expect(player.pieceSupply.transportShips).toBe(before.pieceSupply.transportShips - 1)
    expect(player.pieceSupply.tradeStations).toBe(before.pieceSupply.tradeStations - 1)
    expect(player.pieceSupply.colonies).toBe(before.pieceSupply.colonies)
  })

  it('places the ship on the chosen spaceport site', () => {
    const match = buildableMatch()
    const site = getAvailableSpaceportSites(match, match.activePlayerId)[0]!
    const after = expectSuccess(
      buildShip(match, match.activePlayerId, 'colonyShip', site.intersectionId),
    )
    const ships = listPlayerShips(after, after.activePlayerId)
    const built = ships.find((ship) => ship.intersectionId === site.intersectionId)
    expect(built).toBeDefined()
    expect(built?.type).toBe('colonyShip')
  })

  it('marks a newly built ship as movable this turn', () => {
    const match = buildableMatch()
    const site = getAvailableSpaceportSites(match, match.activePlayerId)[0]!
    const after = expectSuccess(
      buildShip(match, match.activePlayerId, 'tradeShip', site.intersectionId),
    )
    const built = listPlayerShips(after, after.activePlayerId).find(
      (ship) => ship.intersectionId === site.intersectionId,
    )
    expect(built?.builtThisTurn).toBe(true)
  })

  it('rejects an occupied spaceport site', () => {
    const match = buildableMatch()
    // The starting Colony Ship already sits on i-port-a.
    const result = validateShipBuild(
      match,
      match.activePlayerId,
      'colonyShip',
      asIntersectionId('i-port-a'),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('INVALID_SPACEPORT_SITE')
    }
  })

  it('rejects a site the player has no Spaceport for', () => {
    const base = createTestMatch()
    const other = base.playerOrder[1]!
    const match: Match = {
      ...base,
      phase: 'tradeAndBuild',
      activePlayerId: other,
      activePlayerIndex: 1,
      playersById: {
        ...base.playersById,
        [other]: {
          ...base.playersById[other]!,
          resources: createResourceInventory({
            alloy: 5,
            plasma: 5,
            cryonite: 5,
            biofiber: 5,
            quantumCore: 5,
          }),
        },
      },
    }
    // Seat 1's Spaceport is at i-colony-f; the fixture puts every spaceport
    // site in one system, so ownership is what gates the build.
    const result = validateShipBuild(match, other, 'colonyShip', asIntersectionId('i-port-a'))
    expect(result.success).toBe(false)
  })

  it('rejects building with no Transport Ship left', () => {
    const match = buildableMatch()
    const activeId = match.activePlayerId
    const drained: Match = {
      ...match,
      playersById: {
        ...match.playersById,
        [activeId]: {
          ...match.playersById[activeId]!,
          pieceSupply: { ...match.playersById[activeId]!.pieceSupply, transportShips: 0 },
        },
      },
    }
    const site = getAvailableSpaceportSites(drained, activeId)[0]!
    const result = validateShipBuild(drained, activeId, 'colonyShip', site.intersectionId)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('NO_PIECE_AVAILABLE')
    }
  })
})

describe('mothership upgrades', () => {
  it('adds a cannon for 2 cryonite', () => {
    const match = buildableMatch()
    const after = expectSuccess(buildMothershipUpgrade(match, match.activePlayerId, 'cannon'))
    expect(after.playersById[after.activePlayerId]!.mothership.cannons).toBe(1)
    expect(after.playersById[after.activePlayerId]!.resources.cryonite).toBe(8)
  })

  it('adds a freight pod for 2 alloy and a booster for 2 plasma', () => {
    const match = buildableMatch()
    const pod = expectSuccess(buildMothershipUpgrade(match, match.activePlayerId, 'freightPod'))
    expect(pod.playersById[pod.activePlayerId]!.mothership.freightPods).toBe(1)
    expect(pod.playersById[pod.activePlayerId]!.resources.alloy).toBe(8)

    const booster = expectSuccess(buildMothershipUpgrade(match, match.activePlayerId, 'booster'))
    // Players start with 1 booster.
    expect(booster.playersById[booster.activePlayerId]!.mothership.boosters).toBe(2)
    expect(booster.playersById[booster.activePlayerId]!.resources.plasma).toBe(8)
  })

  it('enforces the 6-cannon limit', () => {
    const match = buildableMatch()
    const activeId = match.activePlayerId
    const maxed: Match = {
      ...match,
      playersById: {
        ...match.playersById,
        [activeId]: {
          ...match.playersById[activeId]!,
          mothership: { ...match.playersById[activeId]!.mothership, cannons: 6 },
        },
      },
    }
    const result = buildMothershipUpgrade(maxed, activeId, 'cannon')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('UPGRADE_LIMIT_REACHED')
    }
  })

  it('enforces the 5-freight-pod and 6-booster limits', () => {
    const match = buildableMatch()
    const activeId = match.activePlayerId
    for (const [kind, count] of [
      ['freightPod', 5],
      ['booster', 6],
    ] as const) {
      const maxed: Match = {
        ...match,
        playersById: {
          ...match.playersById,
          [activeId]: {
            ...match.playersById[activeId]!,
            mothership: {
              ...match.playersById[activeId]!.mothership,
              [kind === 'freightPod' ? 'freightPods' : 'boosters']: count,
            },
          },
        },
      }
      expect(buildMothershipUpgrade(maxed, activeId, kind).success).toBe(false)
    }
  })
})

describe('interleaved trade and build', () => {
  it('allows repeated builds without leaving the phase', () => {
    const match = buildableMatch()
    const first = expectSuccess(buildMothershipUpgrade(match, match.activePlayerId, 'cannon'))
    expect(first.phase).toBe('tradeAndBuild')

    const second = expectSuccess(buildMothershipUpgrade(first, first.activePlayerId, 'freightPod'))
    expect(second.phase).toBe('tradeAndBuild')
    expect(second.playersById[second.activePlayerId]!.mothership.cannons).toBe(1)
    expect(second.playersById[second.activePlayerId]!.mothership.freightPods).toBe(1)
  })

  it('does not mutate the match passed in', () => {
    const match = buildableMatch()
    const snapshot = JSON.parse(JSON.stringify(match)) as unknown
    expectSuccess(buildSpaceport(match, match.activePlayerId, asIntersectionId('i-colony-a')))
    expect(JSON.parse(JSON.stringify(match)) as unknown).toEqual(snapshot)
  })
})

describe('obsolete construction actions', () => {
  it('no longer exposes route, outpost, or nexus builders', () => {
    const constructionModule: Record<string, unknown> = {
      buildSpaceport,
      buildShip,
      buildMothershipUpgrade,
    }
    expect(constructionModule).not.toHaveProperty('buildTradeRoute')
    expect(constructionModule).not.toHaveProperty('buildOutpost')
    expect(constructionModule).not.toHaveProperty('upgradeToNexus')
  })

  it('keeps starting structures limited to Colonies and Spaceports', () => {
    const match = createTestMatch()
    for (const structure of listPlayerSiteStructures(match, match.activePlayerId)) {
      expect(['colony', 'spaceport']).toContain(structure.type)
    }
  })
})
