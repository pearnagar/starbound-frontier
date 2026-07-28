import { describe, expect, it } from 'vitest'
import { createTestBoard } from '../turns/test-fixtures'
import {
  validateBoardComposition,
  validateSpaceBoard,
  EXPECTED_BOARD_COMPOSITION,
} from './board-configuration'
import {
  areIntersectionsAdjacent,
  getIntersectionDistance,
  getIntersectionsWithinRange,
  isGraphConnected,
} from './flight-graph'
import {
  asIntersectionId,
  asPlanetId,
  getColonySiteAt,
  isPlanetProducing,
  isPlanetProductionNumber,
  listColonySites,
  listOutposts,
  listSpaceportSites,
  planetMatchesRoll,
  type Planet,
  type SpaceBoard,
} from './space-board'

describe('board model', () => {
  const board = createTestBoard()

  it('models colony sites between exactly two planets', () => {
    for (const site of listColonySites(board)) {
      expect(site.planetIds).toHaveLength(2)
    }
  })

  it('resolves a colony site from its intersection', () => {
    const site = getColonySiteAt(board, asIntersectionId('i-colony-a'))
    expect(site).toBeDefined()
    expect(site?.planetIds).toContain(asPlanetId('planet-ore'))
  })

  it('models spaceport sites separately from colony sites', () => {
    const spaceportIds = listSpaceportSites(board).map((site) => site.intersectionId)
    const colonyIds = listColonySites(board).map((site) => site.intersectionId)
    for (const id of spaceportIds) {
      expect(colonyIds).not.toContain(id)
    }
  })

  it('models an alien outpost with a docking point and docks', () => {
    const outposts = listOutposts(board)
    expect(outposts).toHaveLength(1)
    expect(outposts[0]?.docks).toHaveLength(EXPECTED_BOARD_COMPOSITION.docksPerOutpost)
    expect(outposts[0]?.dockingPointIntersectionId).toBeDefined()
  })

  it('rejects 7 as a production number', () => {
    expect(isPlanetProductionNumber(7)).toBe(false)
    for (const value of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12]) {
      expect(isPlanetProductionNumber(value)).toBe(true)
    }
  })
})

describe('number discs', () => {
  const board = createTestBoard()

  it('produces only from a revealed disc', () => {
    const revealed = board.planets['planet-ore']
    const hidden = board.planets['planet-hidden']

    expect(isPlanetProducing(revealed!)).toBe(true)
    expect(isPlanetProducing(hidden!)).toBe(false)
  })

  it('matches a roll only when revealed', () => {
    expect(planetMatchesRoll(board.planets['planet-ore']!, 5)).toBe(true)
    expect(planetMatchesRoll(board.planets['planet-ore']!, 6)).toBe(false)
    // planet-hidden carries a face-down 9.
    expect(planetMatchesRoll(board.planets['planet-hidden']!, 9)).toBe(false)
  })

  it('never produces from a planet blocked by a hazard', () => {
    const blocked: Planet = {
      id: asPlanetId('planet-blocked'),
      systemId: board.planets['planet-ore']!.systemId,
      resource: 'alloy',
      hazard: { kind: 'pirateBase', strength: 4 },
    }
    expect(isPlanetProducing(blocked)).toBe(false)
  })
})

describe('board validation', () => {
  const board = createTestBoard()

  it('accepts an internally consistent board', () => {
    expect(validateSpaceBoard(board).success).toBe(true)
  })

  it('rejects an adjacency that is not mirrored', () => {
    const broken: SpaceBoard = {
      ...board,
      intersections: {
        ...board.intersections,
        'i-colony-a': {
          ...board.intersections['i-colony-a']!,
          adjacentIntersectionIds: [asIntersectionId('i-dock-1')],
        },
      },
    }
    const result = validateSpaceBoard(broken)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((error) => error.code === 'ASYMMETRIC_ADJACENCY')).toBe(true)
    }
  })

  it('rejects a link to an unknown intersection', () => {
    const broken: SpaceBoard = {
      ...board,
      intersections: {
        ...board.intersections,
        'i-colony-a': {
          ...board.intersections['i-colony-a']!,
          adjacentIntersectionIds: [asIntersectionId('i-does-not-exist')],
        },
      },
    }
    const result = validateSpaceBoard(broken)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((error) => error.code === 'UNKNOWN_INTERSECTION')).toBe(true)
    }
  })

  it('rejects a planet carrying both a hazard and a production disc', () => {
    const broken: SpaceBoard = {
      ...board,
      planets: {
        ...board.planets,
        'planet-ore': {
          ...board.planets['planet-ore']!,
          hazard: { kind: 'icePlanet', strength: 2 },
        },
      },
    }
    const result = validateSpaceBoard(broken)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((error) => error.code === 'HAZARD_WITH_PRODUCTION_NUMBER')).toBe(
        true,
      )
    }
  })

  it('reports the expected full-game composition for an incomplete board', () => {
    // The compact fixture is deliberately smaller than a real layout.
    const result = validateBoardComposition(board)
    expect(result.success).toBe(false)
  })

  it('states the expected component counts', () => {
    expect(EXPECTED_BOARD_COMPOSITION.homeColonySystems).toBe(4)
    expect(EXPECTED_BOARD_COMPOSITION.planetarySystems).toBe(8)
    expect(EXPECTED_BOARD_COMPOSITION.alienOutposts).toBe(4)
    expect(EXPECTED_BOARD_COMPOSITION.spaceSectors).toBe(15)
  })
})

describe('flight graph', () => {
  const board = createTestBoard()

  it('reports direct adjacency in both directions', () => {
    expect(
      areIntersectionsAdjacent(
        board,
        asIntersectionId('i-colony-a'),
        asIntersectionId('i-colony-b'),
      ),
    ).toBe(true)
    expect(
      areIntersectionsAdjacent(
        board,
        asIntersectionId('i-colony-b'),
        asIntersectionId('i-colony-a'),
      ),
    ).toBe(true)
  })

  it('measures distance in intersection steps', () => {
    expect(
      getIntersectionDistance(
        board,
        asIntersectionId('i-colony-a'),
        asIntersectionId('i-colony-a'),
      ),
    ).toBe(0)
    expect(
      getIntersectionDistance(
        board,
        asIntersectionId('i-colony-a'),
        asIntersectionId('i-colony-c'),
      ),
    ).toBe(2)
  })

  it('returns undefined for an unknown intersection', () => {
    expect(
      getIntersectionDistance(board, asIntersectionId('i-colony-a'), asIntersectionId('nope')),
    ).toBeUndefined()
  })

  it('lists everything reachable within a step budget', () => {
    const within = getIntersectionsWithinRange(board, asIntersectionId('i-colony-a'), 2)
    expect(within).toContain(asIntersectionId('i-colony-b'))
    expect(within).toContain(asIntersectionId('i-colony-c'))
    expect(within).not.toContain(asIntersectionId('i-colony-a'))
    expect(within).not.toContain(asIntersectionId('i-port-b'))
  })

  it('reports a fully connected graph', () => {
    expect(isGraphConnected(board, asIntersectionId('i-colony-a'))).toBe(true)
  })
})
