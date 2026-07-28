import { describe, expect, it } from 'vitest'
import { asIntersectionId } from '../board/space-board'
import { createColony, createSpaceport } from '../buildings/structure'
import { getStructureProductionValue } from '../buildings/structure'
import type { Match } from './match'
import { getPlayerGrant, getProductionDemand } from './production'
import { createTestMatch, makePlayerId } from './test-fixtures'

/**
 * The fixture board gives seat 0 a Colony on `i-colony-a` (bordering the ore
 * planet on 5 and the carbon planet on 6) and `i-colony-b` (carbon on 6, food
 * on 8), with a Spaceport on `i-colony-c` (food on 8, and a face-down 9).
 */
function baseMatch(): Match {
  return createTestMatch()
}

describe('planet production', () => {
  it('grants exactly 1 resource per adjacent Colony', () => {
    const match = baseMatch()
    const demand = getProductionDemand(match, 5)
    // Only i-colony-a borders the ore planet on 5.
    expect(getPlayerGrant(demand, makePlayerId(0)).alloy).toBe(1)
  })

  it('grants exactly 1 resource to a Spaceport, never 2 or 3', () => {
    const match = baseMatch()
    // i-colony-c holds seat 0's Spaceport and borders the food planet on 8.
    const demand = getProductionDemand(match, 8)
    const grant = getPlayerGrant(demand, makePlayerId(0))
    // i-colony-b (Colony) and i-colony-c (Spaceport) both border food on 8.
    expect(grant.biofiber).toBe(2)

    const spaceportOnly: Match = {
      ...match,
      structures: {
        [asIntersectionId('i-colony-c')]: createSpaceport(
          asIntersectionId('i-colony-c'),
          makePlayerId(0),
        ),
      },
    }
    expect(getPlayerGrant(getProductionDemand(spaceportOnly, 8), makePlayerId(0)).biofiber).toBe(1)
  })

  it('gives a Colony and a Spaceport the same single card', () => {
    expect(getStructureProductionValue('colony')).toBe(1)
    expect(getStructureProductionValue('spaceport')).toBe(1)
  })

  it('gives Trade Stations no planetary production', () => {
    expect(getStructureProductionValue('tradeStation')).toBe(0)
  })

  it('produces for every adjacent structure when a shared planet is rolled', () => {
    const match = baseMatch()
    // The carbon planet on 6 borders both i-colony-a and i-colony-b.
    const demand = getProductionDemand(match, 6)
    expect(getPlayerGrant(demand, makePlayerId(0)).cryonite).toBe(2)
    expect(demand.producingPlanets).toHaveLength(1)
    expect(demand.producingPlanets[0]?.structureCount).toBe(2)
  })

  it('produces nothing from an unrevealed number disc', () => {
    const match = baseMatch()
    // planet-hidden carries a 9 that is face down.
    const demand = getProductionDemand(match, 9)
    expect(demand.producingPlanets).toHaveLength(0)
    expect(getPlayerGrant(demand, makePlayerId(0)).plasma).toBe(0)
  })

  it('produces nothing for a number no revealed planet carries', () => {
    const demand = getProductionDemand(baseMatch(), 12)
    expect(demand.producingPlanets).toHaveLength(0)
  })

  it('produces nothing from a planet blocked by a hazard', () => {
    const match = baseMatch()
    const blocked: Match = {
      ...match,
      board: {
        ...match.board,
        planets: {
          ...match.board.planets,
          'planet-ore': {
            id: match.board.planets['planet-ore']!.id,
            systemId: match.board.planets['planet-ore']!.systemId,
            resource: match.board.planets['planet-ore']!.resource,
            hazard: { kind: 'pirateBase', strength: 3 },
          },
        },
      },
    }
    expect(getProductionDemand(blocked, 5).producingPlanets).toHaveLength(0)
  })

  it('produces nothing for a player with no adjacent structure', () => {
    const match = baseMatch()
    const demand = getProductionDemand(match, 5)
    expect(getPlayerGrant(demand, makePlayerId(1)).alloy).toBe(0)
  })

  it('has no Marauder blocking concept', () => {
    const demand = getProductionDemand(baseMatch(), 5)
    expect(demand).not.toHaveProperty('blockedSectors')
  })
})

describe('production demand shape', () => {
  it('aggregates total demand across players', () => {
    const match = baseMatch()
    // i-colony-a borders the ore planet on 5; hand it to another player so two
    // seats draw from the same planet.
    const other = createColony(asIntersectionId('i-colony-a'), makePlayerId(1))
    const shared: Match = {
      ...match,
      structures: {
        ...match.structures,
        [asIntersectionId('i-colony-b')]: createColony(
          asIntersectionId('i-colony-b'),
          makePlayerId(0),
        ),
        [other.intersectionId]: other,
      },
    }
    const demand = getProductionDemand(shared, 6)
    expect(demand.totalDemand.cryonite).toBe(2)
    expect(getPlayerGrant(demand, makePlayerId(0)).cryonite).toBe(1)
    expect(getPlayerGrant(demand, makePlayerId(1)).cryonite).toBe(1)
  })

  it('does not mutate the match', () => {
    const match = baseMatch()
    const snapshot = JSON.parse(JSON.stringify(match)) as unknown
    getProductionDemand(match, 6)
    expect(JSON.parse(JSON.stringify(match)) as unknown).toEqual(snapshot)
  })
})
