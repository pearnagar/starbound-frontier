import type { PlayerId } from '../types/ids'
import { RESOURCE_TYPES, type ResourceType } from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import { getIntersectionDistance, isGraphConnected } from './flight-graph'
import {
  asIntersectionId,
  isHomeColonySystem,
  isPlanetProductionNumber,
  listColonySites,
  listIntersections,
  listOutposts,
  listPlanets,
  listSectors,
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
  /** Planets per system — each colony site sits between two of them. */
  planetsPerSystem: 3,
  /** Planets a single colony site borders. */
  planetsPerColonySite: 2,
  /** Free docks arranged around each alien outpost. */
  docksPerOutpost: 5,
  /** Docking points per alien outpost — the one intersection a Trade Ship reaches. */
  dockingPointsPerOutpost: 1,
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

/**
 * Full validation for a board intended to be played on, as opposed to a
 * deliberately partial test fixture. Layers three checks that a playable board
 * must all pass:
 *
 * 1. `validateSpaceBoard` — internal structural consistency.
 * 2. `validateBoardComposition` — the published component counts.
 * 3. the checks below — per-system invariants, graph connectivity, resource
 *    coverage, disc visibility, and starting-placement legality.
 *
 * Error codes are specific so a caller can tell *which* invariant failed
 * without parsing a message.
 */
export function validatePlayableBoardConfiguration(
  configuration: BoardConfiguration,
): DomainResult<BoardConfiguration> {
  const configurationResult = validateBoardConfiguration(configuration)
  if (!configurationResult.success) {
    return configurationResult
  }
  const compositionResult = validateBoardComposition(configuration.board)
  if (!compositionResult.success) {
    return compositionResult
  }

  const errors: DomainValidationError[] = [
    ...collectIdentityErrors(configuration.board),
    ...collectSystemErrors(configuration.board),
    ...collectOutpostErrors(configuration.board),
    ...collectSectorErrors(configuration.board),
    ...collectGraphErrors(configuration.board),
    ...collectDiscErrors(configuration.board),
    ...collectPlacementErrors(configuration),
  ]

  if (errors.length > 0) {
    return { success: false, errors }
  }
  return { success: true, value: configuration }
}

/** Duplicate ids across the whole board, and links that repeat or self-refer. */
function collectIdentityErrors(board: SpaceBoard): DomainValidationError[] {
  const errors: DomainValidationError[] = []

  for (const intersection of listIntersections(board)) {
    const seen = new Set<string>()
    for (const neighbourId of intersection.adjacentIntersectionIds) {
      if (neighbourId === intersection.id) {
        errors.push(
          error(
            'SELF_ADJACENCY',
            `Intersection "${intersection.id}" links to itself.`,
            'intersections',
          ),
        )
        continue
      }
      if (seen.has(neighbourId)) {
        errors.push(
          error(
            'DUPLICATE_LINK',
            `Intersection "${intersection.id}" links to "${neighbourId}" more than once.`,
            'intersections',
          ),
        )
      }
      seen.add(neighbourId)
    }
  }

  // A colony site and a spaceport site must never claim the same intersection,
  // and no two sites of the same kind may either.
  const claimed = new Map<string, string>()
  function claim(id: IntersectionId, kind: string): void {
    const existing = claimed.get(id)
    if (existing !== undefined) {
      errors.push(
        error(
          'DUPLICATE_SITE_INTERSECTION',
          `Intersection "${id}" is claimed by both a ${existing} and a ${kind}.`,
          'intersections',
        ),
      )
      return
    }
    claimed.set(id, kind)
  }
  for (const site of listColonySites(board)) {
    claim(site.intersectionId, 'colony site')
  }
  for (const site of listSpaceportSites(board)) {
    claim(site.intersectionId, 'spaceport site')
  }
  for (const outpost of listOutposts(board)) {
    claim(outpost.dockingPointIntersectionId, 'docking point')
  }

  const dockIds = new Set<string>()
  for (const outpost of listOutposts(board)) {
    for (const dock of outpost.docks) {
      if (dockIds.has(dock.id)) {
        errors.push(error('DUPLICATE_DOCK_ID', `Dock id "${dock.id}" is used twice.`, 'outposts'))
      }
      dockIds.add(dock.id)
    }
  }

  return errors
}

/** Per-system planet and colony-site invariants, plus resource coverage. */
function collectSystemErrors(board: SpaceBoard): DomainValidationError[] {
  const errors: DomainValidationError[] = []
  const representedResources = new Set<ResourceType>()

  for (const system of listSystems(board)) {
    if (system.planetIds.length !== EXPECTED_BOARD_COMPOSITION.planetsPerSystem) {
      errors.push(
        error(
          'UNEXPECTED_PLANET_COUNT',
          `System "${system.id}" has ${String(system.planetIds.length)} planets, expected ${String(EXPECTED_BOARD_COMPOSITION.planetsPerSystem)}.`,
          'systems',
        ),
      )
    }
    if (system.colonySites.length !== EXPECTED_BOARD_COMPOSITION.colonySitesPerSystem) {
      errors.push(
        error(
          'UNEXPECTED_COLONY_SITE_COUNT',
          `System "${system.id}" has ${String(system.colonySites.length)} colony sites, expected ${String(EXPECTED_BOARD_COMPOSITION.colonySitesPerSystem)}.`,
          'systems',
        ),
      )
    }

    const systemPlanetIds = new Set<string>(system.planetIds)
    for (const planetId of system.planetIds) {
      const planet = board.planets[planetId]
      if (planet === undefined) {
        errors.push(
          error(
            'UNKNOWN_PLANET',
            `System "${system.id}" references unknown planet "${planetId}".`,
            'systems',
          ),
        )
        continue
      }
      if (planet.systemId !== system.id) {
        errors.push(
          error(
            'PLANET_SYSTEM_MISMATCH',
            `Planet "${planet.id}" is listed by system "${system.id}" but belongs to "${planet.systemId}".`,
            'planets',
          ),
        )
      }
      representedResources.add(planet.resource)
    }

    for (const site of system.colonySites) {
      if (site.planetIds.length !== EXPECTED_BOARD_COMPOSITION.planetsPerColonySite) {
        errors.push(
          error(
            'UNEXPECTED_SITE_PLANET_COUNT',
            `Colony site "${site.intersectionId}" borders ${String(site.planetIds.length)} planets, expected ${String(EXPECTED_BOARD_COMPOSITION.planetsPerColonySite)}.`,
            'colonySites',
          ),
        )
      }
      if (site.planetIds[0] === site.planetIds[1]) {
        errors.push(
          error(
            'DUPLICATE_SITE_PLANET',
            `Colony site "${site.intersectionId}" borders the same planet twice.`,
            'colonySites',
          ),
        )
      }
      for (const planetId of site.planetIds) {
        if (!systemPlanetIds.has(planetId)) {
          errors.push(
            error(
              'SITE_PLANET_OUTSIDE_SYSTEM',
              `Colony site "${site.intersectionId}" borders planet "${planetId}" outside system "${system.id}".`,
              'colonySites',
            ),
          )
        }
      }
      const intersection = board.intersections[site.intersectionId]
      if (intersection !== undefined && intersection.kind !== 'colonySite') {
        errors.push(
          error(
            'INVALID_INTERSECTION_KIND',
            `Colony site "${site.intersectionId}" sits on a "${intersection.kind}" intersection.`,
            'colonySites',
          ),
        )
      }
    }

    if (isHomeColonySystem(system)) {
      for (const site of system.spaceportSites) {
        if (site.systemId !== system.id) {
          errors.push(
            error(
              'SPACEPORT_SITE_SYSTEM_MISMATCH',
              `Spaceport site "${site.intersectionId}" names system "${site.systemId}" but is listed by "${system.id}".`,
              'spaceportSites',
            ),
          )
        }
        const intersection = board.intersections[site.intersectionId]
        if (intersection !== undefined && intersection.kind !== 'spaceportSite') {
          errors.push(
            error(
              'INVALID_INTERSECTION_KIND',
              `Spaceport site "${site.intersectionId}" sits on a "${intersection.kind}" intersection.`,
              'spaceportSites',
            ),
          )
        }
      }
    }
  }

  for (const resource of RESOURCE_TYPES) {
    if (!representedResources.has(resource)) {
      errors.push(
        error(
          'RESOURCE_NOT_REPRESENTED',
          `No planet on the board produces "${resource}".`,
          'planets',
        ),
      )
    }
  }

  return errors
}

/** One docking point and exactly `docksPerOutpost` unique docks per outpost. */
function collectOutpostErrors(board: SpaceBoard): DomainValidationError[] {
  const errors: DomainValidationError[] = []

  for (const outpost of listOutposts(board)) {
    const intersection = board.intersections[outpost.dockingPointIntersectionId]
    if (intersection !== undefined && intersection.kind !== 'dockingPoint') {
      errors.push(
        error(
          'INVALID_INTERSECTION_KIND',
          `Outpost "${outpost.id}" docks at a "${intersection.kind}" intersection.`,
          'outposts',
        ),
      )
    }
    for (const dock of outpost.docks) {
      if (dock.outpostId !== outpost.id) {
        errors.push(
          error(
            'DOCK_OUTPOST_MISMATCH',
            `Dock "${dock.id}" names outpost "${dock.outpostId}" but is listed by "${outpost.id}".`,
            'outposts',
          ),
        )
      }
    }
  }

  // Docks are Trade Station berths, not movement nodes: a dock id must never
  // also be an intersection id.
  for (const outpost of listOutposts(board)) {
    for (const dock of outpost.docks) {
      if (board.intersections[dock.id] !== undefined) {
        errors.push(
          error(
            'DOCK_IS_INTERSECTION',
            `Dock "${dock.id}" is also a movement intersection.`,
            'outposts',
          ),
        )
      }
    }
  }

  return errors
}

/** Sectors must reference real intersections and must not overlap each other. */
function collectSectorErrors(board: SpaceBoard): DomainValidationError[] {
  const errors: DomainValidationError[] = []
  const seen = new Set<string>()

  for (const sector of listSectors(board)) {
    if (sector.intersectionIds.length === 0) {
      errors.push(
        error('EMPTY_SECTOR', `Sector "${sector.id}" groups no intersections.`, 'sectors'),
      )
    }
    for (const id of sector.intersectionIds) {
      if (board.intersections[id] === undefined) {
        errors.push(
          error(
            'UNKNOWN_INTERSECTION',
            `Sector "${sector.id}" references unknown intersection "${id}".`,
            'sectors',
          ),
        )
      }
      if (seen.has(id)) {
        errors.push(
          error(
            'OVERLAPPING_SECTORS',
            `Intersection "${id}" belongs to more than one sector.`,
            'sectors',
          ),
        )
      }
      seen.add(id)
    }
  }

  return errors
}

/** One connected flight graph, with every system and outpost reachable. */
function collectGraphErrors(board: SpaceBoard): DomainValidationError[] {
  const errors: DomainValidationError[] = []
  const homeSystems = listSystems(board).filter(isHomeColonySystem)

  const anyIntersection = listIntersections(board)[0]
  if (anyIntersection === undefined) {
    return [error('EMPTY_GRAPH', 'The board has no intersections.', 'intersections')]
  }
  if (!isGraphConnected(board, anyIntersection.id)) {
    errors.push(
      error(
        'DISCONNECTED_GRAPH',
        'The flight graph has more than one connected component.',
        'intersections',
      ),
    )
    // Per-home reachability would report the same fault many times over.
    return errors
  }

  // Connectivity is global, so reachability from each home is implied — but
  // check it explicitly per home so a future non-uniform layout cannot regress
  // silently, and so the error names the unreachable target.
  const targets: readonly IntersectionId[] = [
    ...listSystems(board).flatMap((system) =>
      system.colonySites.map((site) => site.intersectionId),
    ),
    ...listOutposts(board).map((outpost) => outpost.dockingPointIntersectionId),
  ]

  for (const home of homeSystems) {
    const origin = home.spaceportSites[0]?.intersectionId
    if (origin === undefined) {
      errors.push(
        error(
          'MISSING_SPACEPORT_SITE',
          `Home system "${home.id}" defines no spaceport site to launch from.`,
          'spaceportSites',
        ),
      )
      continue
    }
    for (const target of targets) {
      if (getIntersectionDistance(board, origin, target) === undefined) {
        errors.push(
          error(
            'UNREACHABLE_FROM_HOME',
            `Intersection "${target}" is unreachable from home system "${home.id}".`,
            'intersections',
          ),
        )
      }
    }
  }

  return errors
}

/**
 * Home-system discs must begin revealed (those systems are settled) and
 * explorable-system discs must begin face down. Every disc must carry a legal
 * production number.
 */
function collectDiscErrors(board: SpaceBoard): DomainValidationError[] {
  const errors: DomainValidationError[] = []

  for (const system of listSystems(board)) {
    const shouldBeRevealed = isHomeColonySystem(system)
    for (const planetId of system.planetIds) {
      const planet = board.planets[planetId]
      if (planet === undefined) {
        continue
      }
      if (planet.hazard !== undefined) {
        // A hazard legitimately replaces a disc; `validateSpaceBoard` already
        // rejects carrying both.
        continue
      }
      if (planet.disc === undefined) {
        errors.push(
          error('MISSING_NUMBER_DISC', `Planet "${planet.id}" carries no number disc.`, 'planets'),
        )
        continue
      }
      if (!isPlanetProductionNumber(planet.disc.value)) {
        errors.push(
          error(
            'INVALID_PRODUCTION_NUMBER',
            `Planet "${planet.id}" has an invalid production number.`,
            'planets',
          ),
        )
      }
      if (planet.disc.revealed !== shouldBeRevealed) {
        errors.push(
          error(
            shouldBeRevealed ? 'HOME_DISC_NOT_REVEALED' : 'FRONTIER_DISC_NOT_HIDDEN',
            shouldBeRevealed
              ? `Home-system planet "${planet.id}" must begin revealed.`
              : `Unexplored planet "${planet.id}" must begin face down.`,
            'planets',
          ),
        )
      }
    }
  }

  return errors
}

/**
 * Starting placements: one per seat on distinct, correctly-typed locations,
 * inside the seat's own home system, with neutral blockers doing the same.
 */
function collectPlacementErrors(configuration: BoardConfiguration): DomainValidationError[] {
  const errors: DomainValidationError[] = []
  const { board } = configuration

  const homeCount = listSystems(board).filter(isHomeColonySystem).length
  if (configuration.startingPlacements.length !== homeCount) {
    errors.push(
      error(
        'INCOMPLETE_STARTING_PLACEMENTS',
        `Expected ${String(homeCount)} starting placements but found ${String(configuration.startingPlacements.length)}.`,
        'startingPlacements',
      ),
    )
  }

  const occupied = new Map<string, string>()
  function occupy(id: IntersectionId, label: string): void {
    const existing = occupied.get(id)
    if (existing !== undefined) {
      errors.push(
        error(
          'OVERLAPPING_STARTING_PLACEMENT',
          `Intersection "${id}" is claimed by both ${existing} and ${label}.`,
          'startingPlacements',
        ),
      )
      return
    }
    occupied.set(id, label)
  }

  function requireKind(id: IntersectionId, expected: string, label: string): void {
    const intersection = board.intersections[id]
    if (intersection !== undefined && intersection.kind !== expected) {
      errors.push(
        error(
          'INVALID_STARTING_LOCATION_KIND',
          `${label} sits on a "${intersection.kind}" intersection, expected "${expected}".`,
          'startingPlacements',
        ),
      )
    }
  }

  for (const placement of configuration.startingPlacements) {
    const label = `seat ${String(placement.seatIndex)}`
    const home = board.systems[placement.homeSystemId]
    const homeSiteIds = new Set<string>(
      home === undefined ? [] : home.colonySites.map((site) => site.intersectionId),
    )
    const homePortIds = new Set<string>(
      home !== undefined && isHomeColonySystem(home)
        ? home.spaceportSites.map((site) => site.intersectionId)
        : [],
    )

    if (home !== undefined && !isHomeColonySystem(home)) {
      errors.push(
        error(
          'STARTING_SYSTEM_NOT_HOME',
          `${label} starts in "${placement.homeSystemId}", which is not a home colony system.`,
          'startingPlacements',
        ),
      )
    }

    for (const id of [...placement.colonyIntersectionIds, placement.spaceportIntersectionId]) {
      occupy(id, `${label}'s starting structure`)
      requireKind(id, 'colonySite', `${label}'s starting structure`)
      if (home !== undefined && !homeSiteIds.has(id)) {
        errors.push(
          error(
            'STARTING_STRUCTURE_OUTSIDE_HOME',
            `${label} starts a structure on "${id}", outside home system "${placement.homeSystemId}".`,
            'startingPlacements',
          ),
        )
      }
    }

    occupy(placement.colonyShipIntersectionId, `${label}'s Colony Ship`)
    requireKind(placement.colonyShipIntersectionId, 'spaceportSite', `${label}'s Colony Ship`)
    if (home !== undefined && !homePortIds.has(placement.colonyShipIntersectionId)) {
      errors.push(
        error(
          'STARTING_SHIP_OUTSIDE_HOME',
          `${label}'s Colony Ship starts on "${placement.colonyShipIntersectionId}", not a spaceport site of "${placement.homeSystemId}".`,
          'startingPlacements',
        ),
      )
    }
  }

  for (const [playerCount, blocking] of Object.entries(
    configuration.neutralBlockingByPlayerCount,
  )) {
    const seatsInPlay = Number(playerCount)
    const label = `the ${playerCount}-player neutral blocker`
    const blockedIds = [
      ...blocking.colonyIntersectionIds,
      ...(blocking.spaceportIntersectionId === undefined ? [] : [blocking.spaceportIntersectionId]),
    ]

    for (const id of blockedIds) {
      requireKind(id, 'colonySite', label)
      // A neutral blocker may not stand where a seat that is actually playing
      // starts. Seats are filled in index order, so seats < seatsInPlay play.
      for (const placement of configuration.startingPlacements) {
        if (placement.seatIndex >= seatsInPlay) {
          continue
        }
        const claimed = [
          ...placement.colonyIntersectionIds,
          placement.spaceportIntersectionId,
          placement.colonyShipIntersectionId,
        ]
        if (claimed.includes(id)) {
          errors.push(
            error(
              'NEUTRAL_BLOCKER_OVERLAP',
              `${label} occupies "${id}", where seat ${String(placement.seatIndex)} starts.`,
              'neutralBlockingByPlayerCount',
            ),
          )
        }
      }
    }

    if (new Set(blockedIds).size !== blockedIds.length) {
      errors.push(
        error(
          'NEUTRAL_BLOCKER_OVERLAP',
          `${label} occupies the same intersection twice.`,
          'neutralBlockingByPlayerCount',
        ),
      )
    }
  }

  return errors
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
