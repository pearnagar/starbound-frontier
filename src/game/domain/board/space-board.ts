import type { Brand } from '../types/brand'
import type { ResourceType } from '../types/resources'

/**
 * Data-driven board model for the corrected rules. Nothing here is generated:
 * a board is supplied as configuration (see `board-configuration.ts`) because
 * the reference beginner layout is published as a picture, not as coordinates.
 * See `docs/RULEBOOK_GAPS.md`.
 */

export type IntersectionId = Brand<string, 'IntersectionId'>
export type PlanetId = Brand<string, 'PlanetId'>
export type SystemId = Brand<string, 'SystemId'>
export type OutpostId = Brand<string, 'OutpostId'>
export type SectorId = Brand<string, 'SectorId'>
export type DockId = Brand<string, 'DockId'>

export function asIntersectionId(value: string): IntersectionId {
  return value as IntersectionId
}
export function asPlanetId(value: string): PlanetId {
  return value as PlanetId
}
export function asSystemId(value: string): SystemId {
  return value as SystemId
}
export function asOutpostId(value: string): OutpostId {
  return value as OutpostId
}
export function asSectorId(value: string): SectorId {
  return value as SectorId
}
export function asDockId(value: string): DockId {
  return value as DockId
}

/** Production numbers a disc may carry. 7 never appears. */
export const PLANET_PRODUCTION_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12] as const

export type PlanetProductionNumber = (typeof PLANET_PRODUCTION_NUMBERS)[number]

export function isPlanetProductionNumber(value: number): value is PlanetProductionNumber {
  return (PLANET_PRODUCTION_NUMBERS as readonly number[]).includes(value)
}

/**
 * A number disc on a planet. Discs in unexplored systems start face down and
 * are revealed when a ship reaches an adjacent intersection; a hidden disc
 * never produces.
 */
export type NumberDisc = Readonly<{
  value: PlanetProductionNumber
  revealed: boolean
}>

/**
 * A hazard occupying a planet in place of an ordinary production number.
 * Neither is implemented in this migration — the model exists so a planet
 * carrying one can never be given a production number by mistake.
 */
export type PlanetHazard = Readonly<{
  kind: 'pirateBase' | 'icePlanet'
  /** Cannons (pirate base) or freight pods (ice planet) required to clear it. */
  strength: number
}>

/**
 * A single planet. Exactly one of `disc` / `hazard` is meaningful: a planet
 * blocked by a hazard must not carry a production disc until the hazard is
 * resolved, which `validateSpaceBoard` enforces.
 */
export type Planet = Readonly<{
  id: PlanetId
  systemId: SystemId
  /** The resource this planet yields when its number is rolled. */
  resource: ResourceType
  disc?: NumberDisc
  hazard?: PlanetHazard
}>

/** An intersection between two planets where a Colony may be established. */
export type ColonySite = Readonly<{
  intersectionId: IntersectionId
  /** The two planets this site borders. */
  planetIds: readonly [PlanetId, PlanetId]
}>

/** An intersection adjacent to a Spaceport, from which ships launch. */
export type SpaceportSite = Readonly<{
  intersectionId: IntersectionId
  /** The system whose Spaceport this site serves. */
  systemId: SystemId
}>

/** A planetary system that begins the game unexplored. */
export type PlanetarySystem = Readonly<{
  kind: 'planetary'
  id: SystemId
  planetIds: readonly PlanetId[]
  colonySites: readonly ColonySite[]
}>

/** One of the four settled home systems where players begin. */
export type HomeColonySystem = Readonly<{
  kind: 'home'
  id: SystemId
  planetIds: readonly PlanetId[]
  colonySites: readonly ColonySite[]
  spaceportSites: readonly SpaceportSite[]
}>

export type StarSystem = PlanetarySystem | HomeColonySystem

/** A berth at an alien outpost where a Trade Station may be established. */
export type Dock = Readonly<{
  id: DockId
  outpostId: OutpostId
}>

/**
 * An alien outpost. A Trade Ship must finish its flight on the single central
 * docking point, then places its Trade Station on one of the free docks.
 */
export type AlienOutpost = Readonly<{
  id: OutpostId
  /** The intersection a Trade Ship must reach. */
  dockingPointIntersectionId: IntersectionId
  docks: readonly Dock[]
}>

/** Empty traversable space. Sectors carry no production. */
export type SpaceSector = Readonly<{
  id: SectorId
  intersectionIds: readonly IntersectionId[]
}>

/** What a given intersection may host. */
export type IntersectionKind = 'colonySite' | 'spaceportSite' | 'dockingPoint' | 'open'

/** A node in the flight graph. */
export type Intersection = Readonly<{
  id: IntersectionId
  kind: IntersectionKind
  /** Directly reachable neighbours; edges are undirected and mirrored. */
  adjacentIntersectionIds: readonly IntersectionId[]
}>

/**
 * A complete board. Supplied as data; `validateSpaceBoard` checks internal
 * consistency (graph symmetry, referenced ids, hazard/disc exclusivity).
 */
export type SpaceBoard = Readonly<{
  intersections: Readonly<Record<string, Intersection>>
  planets: Readonly<Record<string, Planet>>
  systems: Readonly<Record<string, StarSystem>>
  outposts: Readonly<Record<string, AlienOutpost>>
  sectors: Readonly<Record<string, SpaceSector>>
}>

export function getIntersection(board: SpaceBoard, id: IntersectionId): Intersection | undefined {
  return board.intersections[id]
}

export function getPlanet(board: SpaceBoard, id: PlanetId): Planet | undefined {
  return board.planets[id]
}

export function getSystem(board: SpaceBoard, id: SystemId): StarSystem | undefined {
  return board.systems[id]
}

export function getOutpost(board: SpaceBoard, id: OutpostId): AlienOutpost | undefined {
  return board.outposts[id]
}

export function listIntersections(board: SpaceBoard): readonly Intersection[] {
  return Object.values(board.intersections)
}

export function listPlanets(board: SpaceBoard): readonly Planet[] {
  return Object.values(board.planets)
}

export function listSystems(board: SpaceBoard): readonly StarSystem[] {
  return Object.values(board.systems)
}

export function listOutposts(board: SpaceBoard): readonly AlienOutpost[] {
  return Object.values(board.outposts)
}

export function listSectors(board: SpaceBoard): readonly SpaceSector[] {
  return Object.values(board.sectors)
}

export function isHomeColonySystem(system: StarSystem): system is HomeColonySystem {
  return system.kind === 'home'
}

export function isPlanetarySystem(system: StarSystem): system is PlanetarySystem {
  return system.kind === 'planetary'
}

/** Every colony site on the board, across home and planetary systems. */
export function listColonySites(board: SpaceBoard): readonly ColonySite[] {
  return listSystems(board).flatMap((system) => system.colonySites)
}

/** Every spaceport site on the board. Only home systems define them initially. */
export function listSpaceportSites(board: SpaceBoard): readonly SpaceportSite[] {
  return listSystems(board).flatMap((system) =>
    isHomeColonySystem(system) ? system.spaceportSites : [],
  )
}

/** The colony site anchored at `intersectionId`, if any. */
export function getColonySiteAt(
  board: SpaceBoard,
  intersectionId: IntersectionId,
): ColonySite | undefined {
  return listColonySites(board).find((site) => site.intersectionId === intersectionId)
}

/** The planets a colony site borders, in board order. */
export function getPlanetsForColonySite(board: SpaceBoard, site: ColonySite): readonly Planet[] {
  return site.planetIds
    .map((planetId) => getPlanet(board, planetId))
    .filter((planet): planet is Planet => planet !== undefined)
}

/**
 * Whether this planet currently produces on its number. A planet produces only
 * when it carries a revealed disc and no unresolved hazard.
 */
export function isPlanetProducing(planet: Planet): boolean {
  return planet.hazard === undefined && planet.disc !== undefined && planet.disc.revealed
}

/** Whether a planet's revealed disc matches `rollTotal`. */
export function planetMatchesRoll(planet: Planet, rollTotal: number): boolean {
  return isPlanetProducing(planet) && planet.disc?.value === rollTotal
}
