import type { BoardConfiguration } from '../board/board-configuration'
import {
  asDockId,
  asIntersectionId,
  asOutpostId,
  asPlanetId,
  asSectorId,
  asSystemId,
  type AlienOutpost,
  type ColonySite,
  type Intersection,
  type IntersectionId,
  type Planet,
  type PlanetProductionNumber,
  type SpaceBoard,
  type SpaceSector,
  type StarSystem,
} from '../board/space-board'
import { createBeginnerMatch } from '../setup/beginner-setup'
import { asCaptainId, asFactionColorId, asPlayerId, type PlayerId } from '../types/ids'
import { createPlayer, type Player } from '../types/player'
import type { ResourceType } from '../types/resources'
import { asMatchId, type MatchId } from './match-id'

/**
 * Deliberately small hand-built fixtures. The real beginner layout comes from
 * board configuration data that the basic rules publish only as a picture
 * (see `docs/RULEBOOK_GAPS.md`), so tests use a compact board that exercises
 * the same rules rather than a guessed reproduction of the physical one.
 */

export const TEST_MATCH_ID: MatchId = asMatchId('test-match')

export function makePlayerId(index: number): PlayerId {
  return asPlayerId(`player-${String(index)}`)
}

export function makeTestPlayer(index: number): Player {
  const result = createPlayer({
    id: makePlayerId(index),
    name: `Player ${String(index)}`,
    seatIndex: index,
    captainId: asCaptainId(`captain-${String(index)}`),
    factionColorId: asFactionColorId(`color-${String(index)}`),
    control: { controlType: 'human' },
  })
  if (!result.success) {
    throw new Error('Test player fixture failed to build')
  }
  return result.value
}

export function makeTestPlayers(count: number): readonly Player[] {
  return Array.from({ length: count }, (_unused, index) => makeTestPlayer(index))
}

type PlanetSpec = Readonly<{
  id: string
  resource: ResourceType
  number?: PlanetProductionNumber
  revealed?: boolean
  hazard?: Readonly<{ kind: 'pirateBase' | 'icePlanet'; strength: number }>
}>

function makePlanet(systemId: string, spec: PlanetSpec): Planet {
  const base = {
    id: asPlanetId(spec.id),
    systemId: asSystemId(systemId),
    resource: spec.resource,
  }
  if (spec.hazard !== undefined) {
    return { ...base, hazard: spec.hazard }
  }
  if (spec.number !== undefined) {
    return { ...base, disc: { value: spec.number, revealed: spec.revealed ?? true } }
  }
  return base
}

const TEST_PLANETS: readonly PlanetSpec[] = [
  { id: 'planet-ore', resource: 'alloy', number: 5 },
  { id: 'planet-carbon', resource: 'cryonite', number: 6 },
  { id: 'planet-food', resource: 'biofiber', number: 8 },
  // Face-down disc: present but unrevealed, so it must never produce.
  { id: 'planet-hidden', resource: 'plasma', number: 9, revealed: false },
  // No disc at all — an unexplored planet awaiting one.
  { id: 'planet-barren', resource: 'quantumCore' },
]

const TEST_INTERSECTION_IDS = [
  'i-colony-a',
  'i-colony-b',
  'i-colony-c',
  'i-port-a',
  'i-port-b',
  'i-open-a',
  'i-dock-1',
  // Extra sites so three seats can each be deployed without overlapping.
  'i-colony-d',
  'i-colony-e',
  'i-colony-f',
  'i-colony-g',
  'i-colony-h',
  'i-colony-i',
  'i-port-c',
  'i-port-d',
] as const

function intersectionKindFor(id: string): Intersection['kind'] {
  if (id.startsWith('i-colony-')) {
    return 'colonySite'
  }
  if (id.startsWith('i-port-')) {
    return 'spaceportSite'
  }
  if (id.startsWith('i-dock-')) {
    return 'dockingPoint'
  }
  return 'open'
}

/**
 * Builds a linear chain of intersections plus one home system whose colony
 * sites sit on the `i-colony-*` nodes and spaceport sites on the `i-port-*`
 * nodes. Enough structure for production, construction, setup, and
 * flight-graph tests without guessing the physical layout.
 */
export function createTestBoard(): SpaceBoard {
  const systemId = 'home-1'

  const planetRecord: Record<string, Planet> = {}
  for (const spec of TEST_PLANETS) {
    const planet = makePlanet(systemId, spec)
    planetRecord[planet.id] = planet
  }

  const intersectionIds = TEST_INTERSECTION_IDS.map(asIntersectionId)

  const intersections: Record<string, Intersection> = {}
  intersectionIds.forEach((id, index) => {
    const neighbours: IntersectionId[] = []
    const previous = intersectionIds[index - 1]
    const next = intersectionIds[index + 1]
    if (previous !== undefined) {
      neighbours.push(previous)
    }
    if (next !== undefined) {
      neighbours.push(next)
    }
    intersections[id] = {
      id,
      kind: intersectionKindFor(id),
      adjacentIntersectionIds: neighbours,
    }
  })

  // Sites a-c border the numbered planets and drive the production tests; the
  // remaining sites exist so multiple seats can be deployed without overlap.
  const colonySites: readonly ColonySite[] = [
    {
      intersectionId: asIntersectionId('i-colony-a'),
      planetIds: [asPlanetId('planet-ore'), asPlanetId('planet-carbon')],
    },
    {
      intersectionId: asIntersectionId('i-colony-b'),
      planetIds: [asPlanetId('planet-carbon'), asPlanetId('planet-food')],
    },
    {
      intersectionId: asIntersectionId('i-colony-c'),
      planetIds: [asPlanetId('planet-food'), asPlanetId('planet-hidden')],
    },
    // Sites d-i border only inert planets (a face-down disc and an unnumbered
    // planet), so deploying seats 1 and 2 never perturbs production tests.
    ...(['d', 'e', 'f', 'g', 'h', 'i'] as const).map((suffix) => ({
      intersectionId: asIntersectionId(`i-colony-${suffix}`),
      planetIds: [asPlanetId('planet-hidden'), asPlanetId('planet-barren')] as const,
    })),
  ]

  const system: StarSystem = {
    kind: 'home',
    id: asSystemId(systemId),
    planetIds: TEST_PLANETS.map((spec) => asPlanetId(spec.id)),
    colonySites,
    spaceportSites: (['a', 'b', 'c', 'd'] as const).map((suffix) => ({
      intersectionId: asIntersectionId(`i-port-${suffix}`),
      systemId: asSystemId(systemId),
    })),
  }

  const outpost: AlienOutpost = {
    id: asOutpostId('outpost-1'),
    dockingPointIntersectionId: asIntersectionId('i-dock-1'),
    docks: Array.from({ length: 5 }, (_unused, index) => ({
      id: asDockId(`outpost-1-dock-${String(index)}`),
      outpostId: asOutpostId('outpost-1'),
    })),
  }

  const sector: SpaceSector = {
    id: asSectorId('sector-1'),
    intersectionIds: [asIntersectionId('i-open-a')],
  }

  return {
    intersections,
    planets: planetRecord,
    systems: { [system.id]: system },
    outposts: { [outpost.id]: outpost },
    sectors: { [sector.id]: sector },
  }
}

/**
 * A configuration whose starting placements fit `createTestBoard`. Only seat 0
 * is placed, so tests that need more deployed players place structures
 * directly on the resulting match.
 */
export function createTestBoardConfiguration(): BoardConfiguration {
  return {
    id: 'test-configuration',
    board: createTestBoard(),
    startingPlacements: [
      {
        seatIndex: 0,
        colonyIntersectionIds: [asIntersectionId('i-colony-a'), asIntersectionId('i-colony-b')],
        spaceportIntersectionId: asIntersectionId('i-colony-c'),
        colonyShipIntersectionId: asIntersectionId('i-port-a'),
        homeSystemId: asSystemId('home-1'),
      },
    ],
    neutralBlockingByPlayerCount: {},
  }
}

/**
 * A configuration deploying three seats on non-overlapping sites. Seat 0 sits
 * on the numbered planets, so production tests can use it directly.
 */
export function createThreeSeatBoardConfiguration(): BoardConfiguration {
  const base = createTestBoardConfiguration()
  const homeSystemId = asSystemId('home-1')
  return {
    ...base,
    id: 'test-configuration-3p',
    startingPlacements: [
      {
        seatIndex: 0,
        colonyIntersectionIds: [asIntersectionId('i-colony-a'), asIntersectionId('i-colony-b')],
        spaceportIntersectionId: asIntersectionId('i-colony-c'),
        colonyShipIntersectionId: asIntersectionId('i-port-a'),
        homeSystemId,
      },
      {
        seatIndex: 1,
        colonyIntersectionIds: [asIntersectionId('i-colony-d'), asIntersectionId('i-colony-e')],
        spaceportIntersectionId: asIntersectionId('i-colony-f'),
        colonyShipIntersectionId: asIntersectionId('i-port-b'),
        homeSystemId,
      },
      {
        seatIndex: 2,
        colonyIntersectionIds: [asIntersectionId('i-colony-g'), asIntersectionId('i-colony-h')],
        spaceportIntersectionId: asIntersectionId('i-colony-i'),
        colonyShipIntersectionId: asIntersectionId('i-port-c'),
        homeSystemId,
      },
    ],
    neutralBlockingByPlayerCount: {
      3: { colonyIntersectionIds: [asIntersectionId('i-open-a')] },
    },
  }
}

/** A ready-to-play 3-player match on the fixture board. */
export function createTestMatch(seed = 12345) {
  const result = createBeginnerMatch({
    matchId: TEST_MATCH_ID,
    configuration: createThreeSeatBoardConfiguration(),
    players: makeTestPlayers(3),
    seed,
    startingRolls: { 'player-0': 11, 'player-1': 7, 'player-2': 4 },
  })
  if (!result.success) {
    throw new Error(
      `Test match fixture failed: ${result.errors.map((error) => error.code).join(', ')}`,
    )
  }
  return result.value
}
