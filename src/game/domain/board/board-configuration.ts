import type { PlayerId } from '../types/ids'
import type { DomainResult, DomainValidationError } from '../types/result'
import {
  asIntersectionId,
  isPlanetProductionNumber,
  listColonySites,
  listOutposts,
  listPlanets,
  listSpaceportSites,
  listSystems,
  type IntersectionId,
  type SpaceBoard,
  type SystemId,
} from './space-board'

/**
 * Expected component counts for a full board. The reference beginner layout is
 * published as a diagram rather than as coordinates, so the topology itself is
 * supplied externally; these counts let a supplied board be checked for
 * completeness. See `docs/RULEBOOK_GAPS.md`.
 */
export const EXPECTED_BOARD_COMPOSITION = {
  homeColonySystems: 4,
  planetarySystems: 8,
  alienOutposts: 4,
  spaceSectors: 15,
  /** Colony sites per system — each sits between two planets. */
  colonySitesPerSystem: 3,
  /** Free docks arranged around each alien outpost. */
  docksPerOutpost: 5,
} as const

/**
 * A player's starting placement for the beginner layout. Coordinates are data,
 * never derived — the reference beginner picture is not machine-readable.
 */
export type BeginnerStartingPlacement = Readonly<{
  /** Seat this placement belongs to (0-based), matched to a player at setup. */
  seatIndex: number
  /** Two colony sites that begin with a Colony. */
  colonyIntersectionIds: readonly [IntersectionId, IntersectionId]
  /** The colony site that begins upgraded to a Spaceport. */
  spaceportIntersectionId: IntersectionId
  /** The spaceport site the starting Colony Ship occupies. */
  colonyShipIntersectionId: IntersectionId
  /** Home system this seat starts in. */
  homeSystemId: SystemId
}>

/**
 * Placements for colours not in play. In a 3-player game the unused fourth
 * colour's pieces block their colony sites and never act again.
 */
export type NeutralBlockingPlacement = Readonly<{
  colonyIntersectionIds: readonly IntersectionId[]
  spaceportIntersectionId?: IntersectionId
}>

/**
 * Everything needed to start a match on a specific physical layout. Supplied
 * by configuration; the domain never invents it.
 */
export type BoardConfiguration = Readonly<{
  id: string
  board: SpaceBoard
  startingPlacements: readonly BeginnerStartingPlacement[]
  /** Applied only when fewer than 4 players are seated, keyed by player count. */
  neutralBlockingByPlayerCount: Readonly<Record<number, NeutralBlockingPlacement>>
}>

function error(code: string, message: string, field: string): DomainValidationError {
  return { code, message, field }
}

/**
 * Structural validation of a supplied board: graph symmetry, resolvable ids,
 * and the hazard/disc exclusivity rule. Component counts are checked
 * separately by `validateBoardComposition`, so partial fixtures used in tests
 * can still be validated for internal consistency.
 */
export function validateSpaceBoard(board: SpaceBoard): DomainResult<SpaceBoard> {
  const errors: DomainValidationError[] = []

  for (const intersection of Object.values(board.intersections)) {
    for (const neighbourId of intersection.adjacentIntersectionIds) {
      const neighbour = board.intersections[neighbourId]
      if (neighbour === undefined) {
        errors.push(
          error(
            'UNKNOWN_INTERSECTION',
            `Intersection "${intersection.id}" links to unknown "${neighbourId}".`,
            'intersections',
          ),
        )
        continue
      }
      if (!neighbour.adjacentIntersectionIds.includes(intersection.id)) {
        errors.push(
          error(
            'ASYMMETRIC_ADJACENCY',
            `Adjacency "${intersection.id}" -> "${neighbourId}" is not mirrored.`,
            'intersections',
          ),
        )
      }
    }
    if (intersection.adjacentIntersectionIds.includes(intersection.id)) {
      errors.push(
        error(
          'SELF_ADJACENCY',
          `Intersection "${intersection.id}" is adjacent to itself.`,
          'intersections',
        ),
      )
    }
  }

  for (const planet of listPlanets(board)) {
    if (board.systems[planet.systemId] === undefined) {
      errors.push(
        error(
          'UNKNOWN_SYSTEM',
          `Planet "${planet.id}" references unknown system "${planet.systemId}".`,
          'planets',
        ),
      )
    }
    if (planet.hazard !== undefined && planet.disc !== undefined) {
      errors.push(
        error(
          'HAZARD_WITH_PRODUCTION_NUMBER',
          `Planet "${planet.id}" carries both a hazard and a production disc.`,
          'planets',
        ),
      )
    }
    if (planet.disc !== undefined && !isPlanetProductionNumber(planet.disc.value)) {
      errors.push(
        error(
          'INVALID_PRODUCTION_NUMBER',
          `Planet "${planet.id}" has an invalid production disc value.`,
          'planets',
        ),
      )
    }
  }

  for (const site of listColonySites(board)) {
    if (board.intersections[site.intersectionId] === undefined) {
      errors.push(
        error(
          'UNKNOWN_INTERSECTION',
          `Colony site references unknown intersection "${site.intersectionId}".`,
          'colonySites',
        ),
      )
    }
    for (const planetId of site.planetIds) {
      if (board.planets[planetId] === undefined) {
        errors.push(
          error(
            'UNKNOWN_PLANET',
            `Colony site "${site.intersectionId}" references unknown planet "${planetId}".`,
            'colonySites',
          ),
        )
      }
    }
  }

  for (const site of listSpaceportSites(board)) {
    if (board.intersections[site.intersectionId] === undefined) {
      errors.push(
        error(
          'UNKNOWN_INTERSECTION',
          `Spaceport site references unknown intersection "${site.intersectionId}".`,
          'spaceportSites',
        ),
      )
    }
  }

  for (const outpost of listOutposts(board)) {
    if (board.intersections[outpost.dockingPointIntersectionId] === undefined) {
      errors.push(
        error(
          'UNKNOWN_INTERSECTION',
          `Outpost "${outpost.id}" references an unknown docking point.`,
          'outposts',
        ),
      )
    }
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }
  return { success: true, value: board }
}

/** Checks a board against the expected full-game component counts. */
export function validateBoardComposition(board: SpaceBoard): DomainResult<SpaceBoard> {
  const errors: DomainValidationError[] = []
  const systems = listSystems(board)
  const homeCount = systems.filter((system) => system.kind === 'home').length
  const planetaryCount = systems.filter((system) => system.kind === 'planetary').length

  function expect(actual: number, expected: number, label: string, field: string): void {
    if (actual !== expected) {
      errors.push(
        error(
          'UNEXPECTED_COMPONENT_COUNT',
          `Expected ${String(expected)} ${label} but found ${String(actual)}.`,
          field,
        ),
      )
    }
  }

  expect(homeCount, EXPECTED_BOARD_COMPOSITION.homeColonySystems, 'home colony systems', 'systems')
  expect(
    planetaryCount,
    EXPECTED_BOARD_COMPOSITION.planetarySystems,
    'planetary systems',
    'systems',
  )
  expect(
    listOutposts(board).length,
    EXPECTED_BOARD_COMPOSITION.alienOutposts,
    'alien outposts',
    'outposts',
  )
  expect(
    Object.keys(board.sectors).length,
    EXPECTED_BOARD_COMPOSITION.spaceSectors,
    'space sectors',
    'sectors',
  )

  for (const outpost of listOutposts(board)) {
    expect(
      outpost.docks.length,
      EXPECTED_BOARD_COMPOSITION.docksPerOutpost,
      `docks at outpost "${outpost.id}"`,
      'outposts',
    )
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }
  return { success: true, value: board }
}

/** Validates that a configuration's placements resolve against its board. */
export function validateBoardConfiguration(
  configuration: BoardConfiguration,
): DomainResult<BoardConfiguration> {
  const boardResult = validateSpaceBoard(configuration.board)
  if (!boardResult.success) {
    return boardResult
  }

  const errors: DomainValidationError[] = []
  const { board } = configuration

  function requireIntersection(id: IntersectionId, field: string): void {
    if (board.intersections[id] === undefined) {
      errors.push(
        error('UNKNOWN_INTERSECTION', `Placement references unknown intersection "${id}".`, field),
      )
    }
  }

  const seenSeats = new Set<number>()
  for (const placement of configuration.startingPlacements) {
    if (seenSeats.has(placement.seatIndex)) {
      errors.push(
        error(
          'DUPLICATE_SEAT_PLACEMENT',
          `Seat ${String(placement.seatIndex)} has more than one starting placement.`,
          'startingPlacements',
        ),
      )
    }
    seenSeats.add(placement.seatIndex)

    for (const id of placement.colonyIntersectionIds) {
      requireIntersection(id, 'startingPlacements')
    }
    requireIntersection(placement.spaceportIntersectionId, 'startingPlacements')
    requireIntersection(placement.colonyShipIntersectionId, 'startingPlacements')

    if (board.systems[placement.homeSystemId] === undefined) {
      errors.push(
        error(
          'UNKNOWN_SYSTEM',
          `Seat ${String(placement.seatIndex)} references an unknown home system.`,
          'startingPlacements',
        ),
      )
    }
  }

  for (const blocking of Object.values(configuration.neutralBlockingByPlayerCount)) {
    for (const id of blocking.colonyIntersectionIds) {
      requireIntersection(id, 'neutralBlockingByPlayerCount')
    }
    if (blocking.spaceportIntersectionId !== undefined) {
      requireIntersection(blocking.spaceportIntersectionId, 'neutralBlockingByPlayerCount')
    }
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }
  return { success: true, value: configuration }
}

/** The starting placement for a seat, if the configuration defines one. */
export function getStartingPlacement(
  configuration: BoardConfiguration,
  seatIndex: number,
): BeginnerStartingPlacement | undefined {
  return configuration.startingPlacements.find((placement) => placement.seatIndex === seatIndex)
}

/** Neutral blocking pieces to apply for a given player count, if any. */
export function getNeutralBlocking(
  configuration: BoardConfiguration,
  playerCount: number,
): NeutralBlockingPlacement | undefined {
  return configuration.neutralBlockingByPlayerCount[playerCount]
}

/** Intersection ids occupied by neutral blocking pieces for a player count. */
export function getNeutralBlockedIntersections(
  configuration: BoardConfiguration,
  playerCount: number,
): readonly IntersectionId[] {
  const blocking = getNeutralBlocking(configuration, playerCount)
  if (blocking === undefined) {
    return []
  }
  const ids = [...blocking.colonyIntersectionIds]
  if (blocking.spaceportIntersectionId !== undefined) {
    ids.push(blocking.spaceportIntersectionId)
  }
  return ids
}

/** Convenience for callers building ids from raw strings. */
export function toIntersectionIds(values: readonly string[]): readonly IntersectionId[] {
  return values.map(asIntersectionId)
}

/** Owner marker for neutral pieces, distinct from any real `PlayerId`. */
export const NEUTRAL_OWNER_ID = '__neutral__' as PlayerId
