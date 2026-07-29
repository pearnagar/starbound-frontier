import type { BoardConfiguration } from './board-configuration'
import {
  COLONY_SITE_PLANET_SLOTS,
  DEFAULT_BOARD_ID,
  DOCKS_PER_OUTPOST,
  FLIGHT_LINKS,
  HOME_SYSTEM_KEYS,
  HOME_SYSTEM_LAYOUTS,
  OPEN_INTERSECTION_LAYOUTS,
  OUTPOST_KEYS,
  PLANETARY_SYSTEM_KEYS,
  PLANETARY_SYSTEM_LAYOUTS,
  SEAT_HOME_SYSTEMS,
  SECTOR_LAYOUTS,
  THREE_PLAYER_NEUTRAL_HOME,
  type HomeSystemKey,
  type PlanetarySystemKey,
  type SystemLayout,
} from './default-board-layout'
import {
  asDockId,
  asIntersectionId,
  asOutpostId,
  asPlanetId,
  asSectorId,
  asSystemId,
  type AlienOutpost,
  type ColonySite,
  type HomeColonySystem,
  type Intersection,
  type IntersectionId,
  type IntersectionKind,
  type Planet,
  type PlanetarySystem,
  type SpaceBoard,
  type SpaceSector,
  type SpaceportSite,
  type StarSystem,
} from './space-board'

/**
 * Assembles the default board from the declarative data in
 * `default-board-layout.ts`. This module owns the *shape* transformation only:
 * layout keys become branded ids, the link list becomes mirrored adjacency, and
 * the whole thing becomes a `BoardConfiguration`. It performs no validation —
 * `validateDefaultBoardConfiguration` (in `board-configuration.ts`) does that,
 * so the layout and the checks on it stay independent.
 *
 * Output is deterministic: ids come from stable literal keys and every
 * collection is built in a fixed declaration order, so two calls serialize
 * identically.
 */

// --- Key → id helpers ----------------------------------------------------

/** Colony-site intersection key for a system, e.g. `home-a/colony/1`. */
function colonySiteKey(systemKey: string, index: number): string {
  return `${systemKey}/colony/${String(index)}`
}

/** Spaceport-site intersection key for a home system, e.g. `home-a/port/0`. */
function spaceportSiteKey(systemKey: string, index: number): string {
  return `${systemKey}/port/${String(index)}`
}

/** Docking-point intersection key for an outpost, e.g. `outpost-veyra`. */
function dockingPointKey(outpostKey: string): string {
  return `outpost-${outpostKey}`
}

function planetKey(systemKey: string, slot: number): string {
  return `${systemKey}/planet/${String(slot)}`
}

/** The kind of intersection a layout key denotes, from its key shape alone. */
function intersectionKindForKey(key: string): IntersectionKind {
  if (key.includes('/colony/')) {
    return 'colonySite'
  }
  if (key.includes('/port/')) {
    return 'spaceportSite'
  }
  if (key.startsWith('outpost-')) {
    return 'dockingPoint'
  }
  return 'open'
}

// --- Planets and sites ---------------------------------------------------

/**
 * The three planets of a system. Home-system discs begin revealed because those
 * systems are already settled; explorable-system discs begin face down and
 * produce nothing until a later milestone reveals them.
 */
function buildPlanets(systemKey: string, layout: SystemLayout, revealed: boolean): Planet[] {
  return layout.planets.map((spec) => ({
    id: asPlanetId(planetKey(systemKey, spec.slot)),
    systemId: asSystemId(systemKey),
    resource: spec.resource,
    disc: { value: spec.disc, revealed },
  }))
}

/**
 * The three colony sites of a system. Sites border planet slot pairs (0,1),
 * (1,2) and (2,0), so every site borders exactly two planets and every planet
 * is bordered by exactly two sites.
 */
function buildColonySites(systemKey: string): ColonySite[] {
  return COLONY_SITE_PLANET_SLOTS.map((slots, index) => ({
    intersectionId: asIntersectionId(colonySiteKey(systemKey, index)),
    planetIds: [
      asPlanetId(planetKey(systemKey, slots[0])),
      asPlanetId(planetKey(systemKey, slots[1])),
    ] as const,
  }))
}

/** The two launch sites of a home system. */
function buildSpaceportSites(systemKey: HomeSystemKey): SpaceportSite[] {
  return [0, 1].map((index) => ({
    intersectionId: asIntersectionId(spaceportSiteKey(systemKey, index)),
    systemId: asSystemId(systemKey),
  }))
}

function buildHomeSystem(key: HomeSystemKey): HomeColonySystem {
  return {
    kind: 'home',
    id: asSystemId(key),
    planetIds: HOME_SYSTEM_LAYOUTS[key].planets.map((spec) =>
      asPlanetId(planetKey(key, spec.slot)),
    ),
    colonySites: buildColonySites(key),
    spaceportSites: buildSpaceportSites(key),
  }
}

function buildPlanetarySystem(key: PlanetarySystemKey): PlanetarySystem {
  return {
    kind: 'planetary',
    id: asSystemId(key),
    planetIds: PLANETARY_SYSTEM_LAYOUTS[key].planets.map((spec) =>
      asPlanetId(planetKey(key, spec.slot)),
    ),
    colonySites: buildColonySites(key),
  }
}

// --- Board assembly ------------------------------------------------------

/**
 * Every intersection key the layout defines, in a fixed order: home sites,
 * planetary sites, outpost docking points, then open space.
 */
function listIntersectionKeys(): readonly string[] {
  const keys: string[] = []
  for (const systemKey of HOME_SYSTEM_KEYS) {
    for (let index = 0; index < COLONY_SITE_PLANET_SLOTS.length; index += 1) {
      keys.push(colonySiteKey(systemKey, index))
    }
    keys.push(spaceportSiteKey(systemKey, 0), spaceportSiteKey(systemKey, 1))
  }
  for (const systemKey of PLANETARY_SYSTEM_KEYS) {
    for (let index = 0; index < COLONY_SITE_PLANET_SLOTS.length; index += 1) {
      keys.push(colonySiteKey(systemKey, index))
    }
  }
  for (const outpostKey of OUTPOST_KEYS) {
    keys.push(dockingPointKey(outpostKey))
  }
  keys.push(...Object.keys(OPEN_INTERSECTION_LAYOUTS))
  return keys
}

/**
 * Turns the one-entry-per-pair link list into mirrored adjacency. Neighbours
 * are sorted so the serialized board does not depend on link declaration order.
 * Duplicate and self-referencing links are dropped here rather than silently
 * doubling an edge; `validateDefaultBoardConfiguration` independently rejects a
 * layout that contains either, so this cannot mask a bad layout.
 */
function buildAdjacency(keys: readonly string[]): Map<string, IntersectionId[]> {
  const adjacency = new Map<string, Set<string>>()
  for (const key of keys) {
    adjacency.set(key, new Set())
  }

  for (const [from, to] of FLIGHT_LINKS) {
    if (from === to) {
      continue
    }
    adjacency.get(from)?.add(to)
    adjacency.get(to)?.add(from)
  }

  const result = new Map<string, IntersectionId[]>()
  for (const key of keys) {
    const neighbours = [...(adjacency.get(key) ?? [])].sort()
    result.set(key, neighbours.map(asIntersectionId))
  }
  return result
}

function buildIntersections(): Record<string, Intersection> {
  const keys = listIntersectionKeys()
  const adjacency = buildAdjacency(keys)

  const intersections: Record<string, Intersection> = {}
  for (const key of keys) {
    intersections[key] = {
      id: asIntersectionId(key),
      kind: intersectionKindForKey(key),
      adjacentIntersectionIds: adjacency.get(key) ?? [],
    }
  }
  return intersections
}

function buildOutpost(key: (typeof OUTPOST_KEYS)[number]): AlienOutpost {
  return {
    id: asOutpostId(key),
    dockingPointIntersectionId: asIntersectionId(dockingPointKey(key)),
    docks: Array.from({ length: DOCKS_PER_OUTPOST }, (_unused, index) => ({
      id: asDockId(`${key}/dock/${String(index)}`),
      outpostId: asOutpostId(key),
    })),
  }
}

function buildSectors(): Record<string, SpaceSector> {
  const sectors: Record<string, SpaceSector> = {}
  for (const layout of SECTOR_LAYOUTS) {
    const sector: SpaceSector = {
      id: asSectorId(layout.key),
      intersectionIds: layout.intersectionKeys.map(asIntersectionId),
    }
    sectors[sector.id] = sector
  }
  return sectors
}

/**
 * Builds the default `SpaceBoard`: 4 home colony systems, 8 explorable
 * planetary systems, 4 alien outposts, and 15 space sectors on one connected
 * flight graph.
 */
export function createDefaultSpaceBoard(): SpaceBoard {
  const planets: Record<string, Planet> = {}
  const systems: Record<string, StarSystem> = {}

  for (const key of HOME_SYSTEM_KEYS) {
    for (const planet of buildPlanets(key, HOME_SYSTEM_LAYOUTS[key], true)) {
      planets[planet.id] = planet
    }
    const system = buildHomeSystem(key)
    systems[system.id] = system
  }

  for (const key of PLANETARY_SYSTEM_KEYS) {
    for (const planet of buildPlanets(key, PLANETARY_SYSTEM_LAYOUTS[key], false)) {
      planets[planet.id] = planet
    }
    const system = buildPlanetarySystem(key)
    systems[system.id] = system
  }

  const outposts: Record<string, AlienOutpost> = {}
  for (const key of OUTPOST_KEYS) {
    const outpost = buildOutpost(key)
    outposts[outpost.id] = outpost
  }

  return {
    intersections: buildIntersections(),
    planets,
    systems,
    outposts,
    sectors: buildSectors(),
  }
}

/**
 * The full default board configuration, including beginner starting placements
 * for four seats and the neutral blocking pieces used in a 3-player match.
 *
 * Deterministic: the same object graph is produced on every call, and a fresh
 * one each time, so a caller mutating a returned board cannot affect the next.
 */
export function createDefaultBoardConfiguration(): BoardConfiguration {
  const board = createDefaultSpaceBoard()

  const startingPlacements = Object.entries(SEAT_HOME_SYSTEMS)
    .map(([seat, systemKey]) => ({ seatIndex: Number(seat), systemKey }))
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .map(({ seatIndex, systemKey }) => ({
      seatIndex,
      colonyIntersectionIds: [
        asIntersectionId(colonySiteKey(systemKey, 0)),
        asIntersectionId(colonySiteKey(systemKey, 1)),
      ] as const,
      spaceportIntersectionId: asIntersectionId(colonySiteKey(systemKey, 2)),
      colonyShipIntersectionId: asIntersectionId(spaceportSiteKey(systemKey, 0)),
      homeSystemId: asSystemId(systemKey),
    }))

  return {
    id: DEFAULT_BOARD_ID,
    board,
    startingPlacements,
    // With three players the fourth colour's home stays settled but inert: its
    // 2 Colonies and 1 Spaceport block those sites and never act again.
    neutralBlockingByPlayerCount: {
      3: {
        colonyIntersectionIds: [
          asIntersectionId(colonySiteKey(THREE_PLAYER_NEUTRAL_HOME, 0)),
          asIntersectionId(colonySiteKey(THREE_PLAYER_NEUTRAL_HOME, 1)),
        ],
        spaceportIntersectionId: asIntersectionId(colonySiteKey(THREE_PLAYER_NEUTRAL_HOME, 2)),
      },
    },
  }
}
