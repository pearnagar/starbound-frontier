import { describe, expect, it } from 'vitest'
import { asMatchId } from '../turns/match-id'
import { makeTestPlayers } from '../turns/test-fixtures'
import { createBeginnerMatch } from '../setup/beginner-setup'
import { RESOURCE_TYPES, type ResourceType } from '../types/resources'
import {
  EXPECTED_BOARD_COMPOSITION,
  validateBoardComposition,
  validatePlayableBoardConfiguration,
  validateSpaceBoard,
  type BoardConfiguration,
} from './board-configuration'
import { createDefaultBoardConfiguration, createDefaultSpaceBoard } from './default-board'
import { DEFAULT_BOARD_ID, THREE_PLAYER_NEUTRAL_HOME } from './default-board-layout'
import { getIntersectionDistance, isGraphConnected } from './flight-graph'
import {
  asIntersectionId,
  isHomeColonySystem,
  isPlanetarySystem,
  listColonySites,
  listIntersections,
  listOutposts,
  listPlanets,
  listSectors,
  listSystems,
  type HomeColonySystem,
  type IntersectionId,
  type SpaceBoard,
} from './space-board'

const configuration = createDefaultBoardConfiguration()
const board = configuration.board

function homeSystems(target: SpaceBoard = board): readonly HomeColonySystem[] {
  return listSystems(target).filter(isHomeColonySystem)
}

/** Probability weight of a two-dice total, out of 36. */
function rollWeight(total: number): number {
  return 6 - Math.abs(total - 7)
}

describe('default board configuration', () => {
  it('passes full playable validation', () => {
    const result = validatePlayableBoardConfiguration(configuration)
    if (!result.success) {
      throw new Error(result.errors.map((error) => `${error.code}: ${error.message}`).join('\n'))
    }
    expect(result.success).toBe(true)
  })

  it('passes the structural and composition validators individually', () => {
    expect(validateSpaceBoard(board).success).toBe(true)
    expect(validateBoardComposition(board).success).toBe(true)
  })

  it('carries a stable configuration id', () => {
    expect(configuration.id).toBe(DEFAULT_BOARD_ID)
  })
})

describe('default board composition', () => {
  it('has the exact published object counts', () => {
    expect(homeSystems()).toHaveLength(EXPECTED_BOARD_COMPOSITION.homeColonySystems)
    expect(listSystems(board).filter(isPlanetarySystem)).toHaveLength(
      EXPECTED_BOARD_COMPOSITION.planetarySystems,
    )
    expect(listOutposts(board)).toHaveLength(EXPECTED_BOARD_COMPOSITION.alienOutposts)
    expect(listSectors(board)).toHaveLength(EXPECTED_BOARD_COMPOSITION.spaceSectors)
  })

  it('gives every system 3 planets and 3 colony sites', () => {
    for (const system of listSystems(board)) {
      expect(system.planetIds).toHaveLength(EXPECTED_BOARD_COMPOSITION.planetsPerSystem)
      expect(system.colonySites).toHaveLength(EXPECTED_BOARD_COMPOSITION.colonySitesPerSystem)
    }
    // 12 systems x 3 planets.
    expect(listPlanets(board)).toHaveLength(36)
  })

  it('gives every colony site exactly 2 distinct planets in its own system', () => {
    for (const system of listSystems(board)) {
      const systemPlanets = new Set<string>(system.planetIds)
      for (const site of system.colonySites) {
        expect(site.planetIds).toHaveLength(EXPECTED_BOARD_COMPOSITION.planetsPerColonySite)
        expect(site.planetIds[0]).not.toBe(site.planetIds[1])
        for (const planetId of site.planetIds) {
          expect(systemPlanets.has(planetId)).toBe(true)
        }
      }
    }
  })

  it('borders every planet with exactly two of its system colony sites', () => {
    for (const system of listSystems(board)) {
      for (const planetId of system.planetIds) {
        const bordering = system.colonySites.filter((site) => site.planetIds.includes(planetId))
        expect(bordering).toHaveLength(2)
      }
    }
  })

  it('gives every home system two spaceport sites', () => {
    for (const system of homeSystems()) {
      expect(system.spaceportSites).toHaveLength(2)
      for (const site of system.spaceportSites) {
        expect(site.systemId).toBe(system.id)
      }
    }
  })
})

describe('default board identity', () => {
  it('uses unique ids across every entity collection', () => {
    const collections: readonly (readonly string[])[] = [
      listIntersections(board).map((entry) => entry.id),
      listPlanets(board).map((entry) => entry.id),
      listSystems(board).map((entry) => entry.id),
      listOutposts(board).map((entry) => entry.id),
      listSectors(board).map((entry) => entry.id),
      listOutposts(board).flatMap((outpost) => outpost.docks.map((dock) => dock.id)),
    ]
    for (const ids of collections) {
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('anchors every colony site on a distinct colonySite intersection', () => {
    const sites = listColonySites(board)
    const ids = sites.map((site) => site.intersectionId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(board.intersections[id]?.kind).toBe('colonySite')
    }
  })

  it('resolves every referenced id against the board', () => {
    for (const planet of listPlanets(board)) {
      expect(board.systems[planet.systemId]).toBeDefined()
    }
    for (const site of listColonySites(board)) {
      expect(board.intersections[site.intersectionId]).toBeDefined()
      for (const planetId of site.planetIds) {
        expect(board.planets[planetId]).toBeDefined()
      }
    }
    for (const sector of listSectors(board)) {
      for (const id of sector.intersectionIds) {
        expect(board.intersections[id]).toBeDefined()
      }
    }
  })

  it('assigns each grouped intersection to exactly one sector', () => {
    const grouped = listSectors(board).flatMap((sector) => sector.intersectionIds)
    expect(new Set(grouped).size).toBe(grouped.length)
  })
})

describe('default board flight graph', () => {
  it('is one connected component', () => {
    const first = listIntersections(board)[0]
    expect(first).toBeDefined()
    expect(isGraphConnected(board, first!.id)).toBe(true)
  })

  it('has no self-referencing or duplicated links', () => {
    for (const intersection of listIntersections(board)) {
      const neighbours = intersection.adjacentIntersectionIds
      expect(neighbours).not.toContain(intersection.id)
      expect(new Set(neighbours).size).toBe(neighbours.length)
    }
  })

  it('mirrors every link', () => {
    for (const intersection of listIntersections(board)) {
      for (const neighbourId of intersection.adjacentIntersectionIds) {
        expect(board.intersections[neighbourId]?.adjacentIntersectionIds).toContain(intersection.id)
      }
    }
  })

  it('leaves no intersection isolated', () => {
    for (const intersection of listIntersections(board)) {
      expect(intersection.adjacentIntersectionIds.length).toBeGreaterThan(0)
    }
  })

  it('reaches every system and outpost from every home system', () => {
    const targets: readonly IntersectionId[] = [
      ...listColonySites(board).map((site) => site.intersectionId),
      ...listOutposts(board).map((outpost) => outpost.dockingPointIntersectionId),
    ]
    for (const home of homeSystems()) {
      const origin = home.spaceportSites[0]?.intersectionId
      expect(origin).toBeDefined()
      for (const target of targets) {
        expect(getIntersectionDistance(board, origin!, target)).toBeDefined()
      }
    }
  })

  it('offers more than one route out of the frontier', () => {
    // Removing any single corridor edge must not sever a home from an outpost.
    // Each home launches from two spaceport sites onto two different lanes.
    for (const home of homeSystems()) {
      const lanes = home.spaceportSites.flatMap(
        (site) => board.intersections[site.intersectionId]?.adjacentIntersectionIds ?? [],
      )
      const openLanes = lanes.filter((id) => board.intersections[id]?.kind === 'open')
      expect(new Set(openLanes).size).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('default board alien outposts', () => {
  it('gives each outpost one docking point and five unique docks', () => {
    const dockingPoints = new Set<string>()
    for (const outpost of listOutposts(board)) {
      expect(board.intersections[outpost.dockingPointIntersectionId]?.kind).toBe('dockingPoint')
      expect(dockingPoints.has(outpost.dockingPointIntersectionId)).toBe(false)
      dockingPoints.add(outpost.dockingPointIntersectionId)

      expect(outpost.docks).toHaveLength(EXPECTED_BOARD_COMPOSITION.docksPerOutpost)
      const dockIds = outpost.docks.map((dock) => dock.id)
      expect(new Set(dockIds).size).toBe(dockIds.length)
      for (const dock of outpost.docks) {
        expect(dock.outpostId).toBe(outpost.id)
      }
    }
    expect(dockingPoints.size).toBe(EXPECTED_BOARD_COMPOSITION.alienOutposts)
  })

  it('keeps docks out of the movement graph', () => {
    for (const outpost of listOutposts(board)) {
      for (const dock of outpost.docks) {
        expect(board.intersections[dock.id]).toBeUndefined()
      }
    }
  })
})

describe('default board resources and number discs', () => {
  it('represents every resource role meaningfully', () => {
    const counts = new Map<ResourceType, number>()
    for (const planet of listPlanets(board)) {
      counts.set(planet.resource, (counts.get(planet.resource) ?? 0) + 1)
    }
    for (const resource of RESOURCE_TYPES) {
      // Every resource appears on multiple planets, not just once.
      expect(counts.get(resource) ?? 0).toBeGreaterThanOrEqual(4)
    }
  })

  it('never places a 7 and only uses legal production numbers', () => {
    const legal = new Set([2, 3, 4, 5, 6, 8, 9, 10, 11, 12])
    for (const planet of listPlanets(board)) {
      expect(planet.disc).toBeDefined()
      expect(legal.has(planet.disc!.value)).toBe(true)
    }
  })

  it('reveals home-system discs and hides frontier discs', () => {
    for (const system of listSystems(board)) {
      const shouldReveal = isHomeColonySystem(system)
      for (const planetId of system.planetIds) {
        expect(board.planets[planetId]?.disc?.revealed).toBe(shouldReveal)
      }
    }
  })

  it('keeps 6 and 8 out of the home systems and off any shared colony site', () => {
    for (const system of homeSystems()) {
      for (const planetId of system.planetIds) {
        expect([6, 8]).not.toContain(board.planets[planetId]?.disc?.value)
      }
    }
    // No colony site anywhere borders two high-probability planets at once.
    for (const site of listColonySites(board)) {
      const values = site.planetIds.map((id) => board.planets[id]?.disc?.value)
      const hot = values.filter((value) => value === 6 || value === 8)
      expect(hot.length).toBeLessThanOrEqual(1)
    }
  })

  it('spreads the 6s and 8s across different systems', () => {
    const hotSystems = listPlanets(board)
      .filter((planet) => planet.disc?.value === 6 || planet.disc?.value === 8)
      .map((planet) => planet.systemId)
    expect(hotSystems.length).toBeGreaterThanOrEqual(4)
    expect(new Set(hotSystems).size).toBe(hotSystems.length)
  })
})

describe('default board starting placements', () => {
  it('defines one placement per seat, each in its own home system', () => {
    expect(configuration.startingPlacements).toHaveLength(4)
    const seats = configuration.startingPlacements.map((placement) => placement.seatIndex)
    expect(seats).toEqual([0, 1, 2, 3])

    const homes = configuration.startingPlacements.map((placement) => placement.homeSystemId)
    expect(new Set(homes).size).toBe(4)
    for (const homeId of homes) {
      expect(board.systems[homeId]?.kind).toBe('home')
    }
  })

  it('places every starting piece on a distinct valid location', () => {
    const occupied: string[] = []
    for (const placement of configuration.startingPlacements) {
      for (const id of [...placement.colonyIntersectionIds, placement.spaceportIntersectionId]) {
        expect(board.intersections[id]?.kind).toBe('colonySite')
        occupied.push(id)
      }
      expect(board.intersections[placement.colonyShipIntersectionId]?.kind).toBe('spaceportSite')
      occupied.push(placement.colonyShipIntersectionId)
    }
    // 4 seats x (2 Colonies + 1 Spaceport + 1 Colony Ship), all distinct.
    expect(occupied).toHaveLength(16)
    expect(new Set(occupied).size).toBe(16)
  })

  it('keeps each seat wholly inside its own home system', () => {
    for (const placement of configuration.startingPlacements) {
      const home = board.systems[placement.homeSystemId]
      expect(home).toBeDefined()
      const siteIds = new Set<string>(home!.colonySites.map((site) => site.intersectionId))
      for (const id of [...placement.colonyIntersectionIds, placement.spaceportIntersectionId]) {
        expect(siteIds.has(id)).toBe(true)
      }
      expect(isHomeColonySystem(home!)).toBe(true)
      const portIds = new Set<string>(
        isHomeColonySystem(home!) ? home.spaceportSites.map((site) => site.intersectionId) : [],
      )
      expect(portIds.has(placement.colonyShipIntersectionId)).toBe(true)
    }
  })
})

describe('default board seat balance', () => {
  it('gives every seat the same starting production probability', () => {
    const weights = homeSystems().map((system) =>
      system.planetIds.reduce((total, planetId) => {
        const value = board.planets[planetId]?.disc?.value
        return total + (value === undefined ? 0 : rollWeight(value))
      }, 0),
    )
    expect(new Set(weights).size).toBe(1)
    expect(weights[0]).toBeGreaterThan(0)
  })

  it('gives every seat at least three distinct starting resources', () => {
    for (const system of homeSystems()) {
      const resources = new Set(
        system.planetIds.map((planetId) => board.planets[planetId]?.resource),
      )
      expect(resources.size).toBe(3)
    }
  })

  it('gives every seat comparable access to outposts and planetary systems', () => {
    const nearestOutpost: number[] = []
    const nearestPlanetary: number[] = []
    const departures: number[] = []

    for (const home of homeSystems()) {
      const origin = home.spaceportSites[0]!.intersectionId
      nearestOutpost.push(
        Math.min(
          ...listOutposts(board).map(
            (outpost) =>
              getIntersectionDistance(board, origin, outpost.dockingPointIntersectionId) ??
              Number.POSITIVE_INFINITY,
          ),
        ),
      )
      nearestPlanetary.push(
        Math.min(
          ...listSystems(board)
            .filter(isPlanetarySystem)
            .flatMap((system) =>
              system.colonySites.map(
                (site) =>
                  getIntersectionDistance(board, origin, site.intersectionId) ??
                  Number.POSITIVE_INFINITY,
              ),
            ),
        ),
      )
      departures.push(board.intersections[origin]?.adjacentIntersectionIds.length ?? 0)
    }

    // No seat is closer or further to the nearest outpost than any other.
    expect(new Set(nearestOutpost).size).toBe(1)
    expect(new Set(nearestPlanetary).size).toBe(1)
    expect(new Set(departures).size).toBe(1)
    expect(nearestOutpost[0]).toBeLessThan(Number.POSITIVE_INFINITY)
  })
})

describe('default board three-player neutral setup', () => {
  const blocking = configuration.neutralBlockingByPlayerCount[3]

  it('blocks two colonies and one spaceport in the unused home system', () => {
    expect(blocking).toBeDefined()
    expect(blocking!.colonyIntersectionIds).toHaveLength(2)
    expect(blocking!.spaceportIntersectionId).toBeDefined()

    const home = board.systems[THREE_PLAYER_NEUTRAL_HOME]
    expect(home).toBeDefined()
    const siteIds = new Set<string>(home!.colonySites.map((site) => site.intersectionId))
    for (const id of [...blocking!.colonyIntersectionIds, blocking!.spaceportIntersectionId!]) {
      expect(siteIds.has(id)).toBe(true)
      expect(board.intersections[id]?.kind).toBe('colonySite')
    }
  })

  it('never blocks a site any of the three playing seats starts on', () => {
    const blocked = new Set<string>([
      ...blocking!.colonyIntersectionIds,
      blocking!.spaceportIntersectionId!,
    ])
    for (const placement of configuration.startingPlacements) {
      if (placement.seatIndex >= 3) {
        continue
      }
      for (const id of [
        ...placement.colonyIntersectionIds,
        placement.spaceportIntersectionId,
        placement.colonyShipIntersectionId,
      ]) {
        expect(blocked.has(id)).toBe(false)
      }
    }
  })

  it('defines no blocking for a full four-player match', () => {
    expect(configuration.neutralBlockingByPlayerCount[4]).toBeUndefined()
  })
})

describe('default board determinism', () => {
  it('produces structurally identical output on every call', () => {
    const first = createDefaultBoardConfiguration()
    const second = createDefaultBoardConfiguration()
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it('serializes the board itself identically', () => {
    expect(JSON.stringify(createDefaultSpaceBoard())).toBe(
      JSON.stringify(createDefaultSpaceBoard()),
    )
  })

  it('returns a fresh object graph, so a mutated result cannot leak', () => {
    const first = createDefaultBoardConfiguration()
    const snapshot = JSON.stringify(first)

    const mutable = first.board.intersections as Record<string, unknown>
    mutable['injected'] = { id: 'injected', kind: 'open', adjacentIntersectionIds: [] }

    const second = createDefaultBoardConfiguration()
    expect(second.board.intersections['injected']).toBeUndefined()
    expect(JSON.stringify(second)).toBe(snapshot)
  })
})

describe('beginner match on the default board', () => {
  it('initializes a 4-player match when no configuration is supplied', () => {
    const result = createBeginnerMatch({
      matchId: asMatchId('default-4p'),
      players: makeTestPlayers(4),
      seed: 4242,
    })
    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    const match = result.value
    expect(match.boardConfiguration.id).toBe(DEFAULT_BOARD_ID)
    expect(Object.keys(match.playersById)).toHaveLength(4)
    // 4 seats x (2 Colonies + 1 Spaceport).
    expect(Object.keys(match.structures)).toHaveLength(12)
    expect(Object.keys(match.ships)).toHaveLength(4)
    expect(match.neutralBlockedIntersectionIds).toHaveLength(0)

    for (const player of Object.values(match.playersById)) {
      expect(player.victoryPoints).toBe(4)
      expect(player.mothership.boosters).toBe(1)
      expect(player.mothership.fameMedalPieces).toBe(1)
      expect(player.pieceSupply.colonies).toBe(5)
      expect(player.pieceSupply.shipyards).toBe(2)
      expect(player.pieceSupply.transportShips).toBe(2)
    }
  })

  it('initializes a 3-player match with neutral blockers', () => {
    const result = createBeginnerMatch({
      matchId: asMatchId('default-3p'),
      players: makeTestPlayers(3),
      seed: 4242,
    })
    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    const match = result.value
    expect(Object.keys(match.playersById)).toHaveLength(3)
    expect(Object.keys(match.structures)).toHaveLength(9)
    expect(Object.keys(match.ships)).toHaveLength(3)

    // 2 neutral Colonies + 1 neutral Spaceport in the unused home system.
    expect(match.neutralBlockedIntersectionIds).toHaveLength(3)
    const home = match.board.systems[THREE_PLAYER_NEUTRAL_HOME]
    const siteIds = new Set<string>(home!.colonySites.map((site) => site.intersectionId))
    for (const id of match.neutralBlockedIntersectionIds) {
      expect(siteIds.has(id)).toBe(true)
      // Neutral pieces are not player structures: they block, nothing more.
      expect(match.structures[id]).toBeUndefined()
    }
  })

  it('produces an identical match from the same seed', () => {
    const build = () =>
      createBeginnerMatch({
        matchId: asMatchId('default-deterministic'),
        players: makeTestPlayers(4),
        seed: 999,
      })
    const first = build()
    const second = build()
    expect(first.success && second.success).toBe(true)
    if (first.success && second.success) {
      expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value))
    }
  })

  it('still accepts an explicitly supplied configuration', () => {
    const custom: BoardConfiguration = { ...createDefaultBoardConfiguration(), id: 'custom-layout' }
    const result = createBeginnerMatch({
      matchId: asMatchId('custom'),
      configuration: custom,
      players: makeTestPlayers(4),
      seed: 7,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.boardConfiguration.id).toBe('custom-layout')
    }
  })

  it('rejects an invalid custom configuration rather than substituting the default', () => {
    const base = createDefaultBoardConfiguration()
    const broken: BoardConfiguration = {
      ...base,
      id: 'broken-layout',
      startingPlacements: base.startingPlacements.map((placement) =>
        placement.seatIndex === 0
          ? { ...placement, spaceportIntersectionId: asIntersectionId('does-not-exist') }
          : placement,
      ),
    }

    const result = createBeginnerMatch({
      matchId: asMatchId('broken'),
      configuration: broken,
      players: makeTestPlayers(4),
      seed: 7,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((error) => error.code === 'UNKNOWN_INTERSECTION')).toBe(true)
    }
  })

  it('leaves the supplied configuration unchanged', () => {
    const supplied = createDefaultBoardConfiguration()
    const before = JSON.stringify(supplied)
    const result = createBeginnerMatch({
      matchId: asMatchId('unchanged'),
      configuration: supplied,
      players: makeTestPlayers(4),
      seed: 31,
    })
    expect(result.success).toBe(true)
    expect(JSON.stringify(supplied)).toBe(before)
  })
})

describe('playable validation rejects broken layouts', () => {
  function expectRejection(mutate: (base: BoardConfiguration) => BoardConfiguration, code: string) {
    const result = validatePlayableBoardConfiguration(mutate(createDefaultBoardConfiguration()))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.map((error) => error.code)).toContain(code)
    }
  }

  it('rejects a disconnected flight graph', () => {
    expectRejection((base) => {
      const intersections = { ...base.board.intersections }
      // Sever the far-eastern lane from the rest of the corridor.
      for (const [id, intersection] of Object.entries(intersections)) {
        intersections[id] = {
          ...intersection,
          adjacentIntersectionIds: intersection.adjacentIntersectionIds.filter(
            (neighbour) => neighbour !== 'lane-9' && id !== 'lane-9',
          ),
        }
      }
      return { ...base, board: { ...base.board, intersections } }
    }, 'DISCONNECTED_GRAPH')
  })

  it('rejects a revealed disc in an unexplored system', () => {
    expectRejection((base) => {
      const planetId = 'near-a/planet/0'
      const planet = base.board.planets[planetId]!
      return {
        ...base,
        board: {
          ...base.board,
          planets: {
            ...base.board.planets,
            [planetId]: { ...planet, disc: { value: planet.disc!.value, revealed: true } },
          },
        },
      }
    }, 'FRONTIER_DISC_NOT_HIDDEN')
  })

  it('rejects a hidden disc in a home system', () => {
    expectRejection((base) => {
      const planetId = 'home-a/planet/0'
      const planet = base.board.planets[planetId]!
      return {
        ...base,
        board: {
          ...base.board,
          planets: {
            ...base.board.planets,
            [planetId]: { ...planet, disc: { value: planet.disc!.value, revealed: false } },
          },
        },
      }
    }, 'HOME_DISC_NOT_REVEALED')
  })

  it('rejects two seats starting on the same intersection', () => {
    expectRejection(
      (base) => ({
        ...base,
        startingPlacements: base.startingPlacements.map((placement) =>
          placement.seatIndex === 1
            ? {
                ...placement,
                colonyIntersectionIds: base.startingPlacements[0]!.colonyIntersectionIds,
              }
            : placement,
        ),
      }),
      'OVERLAPPING_STARTING_PLACEMENT',
    )
  })

  it('rejects a Colony Ship starting on a colony site', () => {
    expectRejection(
      (base) => ({
        ...base,
        startingPlacements: base.startingPlacements.map((placement) =>
          placement.seatIndex === 0
            ? { ...placement, colonyShipIntersectionId: asIntersectionId('home-a/colony/0') }
            : placement,
        ),
      }),
      'OVERLAPPING_STARTING_PLACEMENT',
    )
  })

  it('rejects an outpost with the wrong number of docks', () => {
    expectRejection((base) => {
      const outpost = base.board.outposts['veyra']!
      return {
        ...base,
        board: {
          ...base.board,
          outposts: {
            ...base.board.outposts,
            veyra: { ...outpost, docks: outpost.docks.slice(0, 3) },
          },
        },
      }
    }, 'UNEXPECTED_COMPONENT_COUNT')
  })

  it('rejects a colony site bordering the same planet twice', () => {
    expectRejection((base) => {
      const system = base.board.systems['near-a']!
      const site = system.colonySites[0]!
      return {
        ...base,
        board: {
          ...base.board,
          systems: {
            ...base.board.systems,
            'near-a': {
              ...system,
              colonySites: [
                { ...site, planetIds: [site.planetIds[0], site.planetIds[0]] as const },
                ...system.colonySites.slice(1),
              ],
            },
          },
        },
      }
    }, 'DUPLICATE_SITE_PLANET')
  })

  it('rejects a neutral blocker standing where a playing seat starts', () => {
    expectRejection(
      (base) => ({
        ...base,
        neutralBlockingByPlayerCount: {
          3: {
            colonyIntersectionIds: base.startingPlacements[0]!.colonyIntersectionIds,
          },
        },
      }),
      'NEUTRAL_BLOCKER_OVERLAP',
    )
  })
})
