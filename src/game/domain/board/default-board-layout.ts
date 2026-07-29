import type { PlanetProductionNumber } from './space-board'
import type { ResourceType } from '../types/resources'

/**
 * Declarative layout data for the default Starbound Frontier board — an
 * original design, not a transcription of any published diagram. This module
 * holds **only data**: no validation, no graph construction, no behaviour.
 * `default-board.ts` assembles a `BoardConfiguration` from it, and
 * `board-configuration.ts` validates the result.
 *
 * See `docs/BOARD_LAYOUT.md` for the design rationale.
 *
 * ## Coordinates
 *
 * Positions are **integer logical grid coordinates**, not pixels and not
 * authoritative geometry. Nothing in the domain derives adjacency, identity, or
 * legality from them — the flight graph is an explicit link list below. They
 * exist so a future renderer has a stable, deterministic starting arrangement,
 * and so this file reads as a map rather than as an opaque id soup.
 *
 * The frontier runs left-to-right along `y = 0`, with deep space at higher `y`:
 *
 * ```
 *   y = 8   deep space rim ...... P5   P6   P7   P8      (far planetary systems)
 *   y = 6   .......................  O1   O2   O3   O4   (alien outposts)
 *   y = 4   ....................... P1   P2   P3   P4    (near planetary systems)
 *   y = 2   ....... open space corridor ...............
 *   y = 0   H1 ....... H2 ....... H3 ....... H4          (home colony systems)
 * ```
 */

export type GridPoint = Readonly<{ x: number; y: number }>

// --- Identifier prefixes -------------------------------------------------

/**
 * Id prefixes. Every board id is built from a prefix plus stable literal parts,
 * so ids never depend on iteration order and serialize identically every run.
 */
export const DEFAULT_BOARD_ID = 'starbound-frontier-default'

// --- Systems -------------------------------------------------------------

/** The four player colours' home systems, in seat order 0-3. */
export const HOME_SYSTEM_KEYS = ['home-a', 'home-b', 'home-c', 'home-d'] as const

export type HomeSystemKey = (typeof HOME_SYSTEM_KEYS)[number]

/** The eight explorable systems: `near-*` at y=4, `far-*` at y=8. */
export const PLANETARY_SYSTEM_KEYS = [
  'near-a',
  'near-b',
  'near-c',
  'near-d',
  'far-a',
  'far-b',
  'far-c',
  'far-d',
] as const

export type PlanetarySystemKey = (typeof PLANETARY_SYSTEM_KEYS)[number]

/** The four alien outposts at y=6, between the near and far system bands. */
export const OUTPOST_KEYS = ['veyra', 'thessi', 'okarun', 'lumene'] as const

export type OutpostKey = (typeof OUTPOST_KEYS)[number]

/**
 * Original civilisation names for the four outposts. Purely flavour: no
 * friendship-card effects are attached, and nothing in the rules reads them.
 */
export const OUTPOST_CIVILIZATIONS: Readonly<Record<OutpostKey, string>> = {
  veyra: 'Veyra Concord',
  thessi: 'Thessi Weavers',
  okarun: 'Okarun Freeholders',
  lumene: 'Lumene Archivists',
}

/**
 * A system's three planets. `slot` 0/1/2 fixes the planet's position within its
 * system, which in turn fixes which colony sites border it (see
 * `COLONY_SITE_PLANET_SLOTS`).
 */
export type PlanetSpec = Readonly<{
  slot: 0 | 1 | 2
  resource: ResourceType
  /** Production number on this planet's disc. */
  disc: PlanetProductionNumber
}>

/**
 * Colony sites border planet pairs (0,1), (1,2) and (2,0) — a triangle, so each
 * planet is bordered by exactly two of its system's three sites and each site
 * borders exactly two planets.
 */
export const COLONY_SITE_PLANET_SLOTS = [
  [0, 1],
  [1, 2],
  [2, 0],
] as const satisfies readonly (readonly [number, number])[]

export type SystemLayout = Readonly<{
  /** Logical centre of the system on the layout grid. */
  center: GridPoint
  planets: readonly [PlanetSpec, PlanetSpec, PlanetSpec]
}>

/**
 * Home systems. Their planets are settled, so every disc here begins
 * **revealed** and produces from turn one.
 *
 * Resource spread is deliberate: each home system holds three of the five
 * resources, and across the four homes every resource appears at least twice.
 * `quantumCore` (goods, the 2:1 trade resource) appears only on the two flank
 * homes, on a low-probability number, so no seat opens with cheap goods on a
 * hot number.
 *
 * Probability is equalised: every home totals 10/36 across its three discs, so
 * no seat opens ahead on raw production odds. The flanks split it 4+4+2 and the
 * centres 4+3+3, which trades a strong single planet for a steadier spread
 * without changing the total. Neither 6 nor 8 appears on a home system — the
 * two most productive numbers sit in unexplored space and must be flown to.
 */
export const HOME_SYSTEM_LAYOUTS: Readonly<Record<HomeSystemKey, SystemLayout>> = {
  // Left flank. Strong 5/9 pair, weak 11.
  'home-a': {
    center: { x: 3, y: 0 },
    planets: [
      { slot: 0, resource: 'alloy', disc: 5 },
      { slot: 1, resource: 'biofiber', disc: 9 },
      { slot: 2, resource: 'quantumCore', disc: 11 },
    ],
  },
  // Left centre. 4 + 3 + 3 rather than 4 + 4 + 2: the same total odds as the
  // flanks, spread more evenly instead of concentrated on one strong planet.
  'home-b': {
    center: { x: 11, y: 0 },
    planets: [
      { slot: 0, resource: 'plasma', disc: 5 },
      { slot: 1, resource: 'cryonite', disc: 10 },
      { slot: 2, resource: 'biofiber', disc: 4 },
    ],
  },
  // Right centre. Mirrors home-b's probability profile with different resources.
  'home-c': {
    center: { x: 19, y: 0 },
    planets: [
      { slot: 0, resource: 'cryonite', disc: 4 },
      { slot: 1, resource: 'alloy', disc: 9 },
      { slot: 2, resource: 'plasma', disc: 10 },
    ],
  },
  // Right flank. Mirrors home-a's probability profile.
  'home-d': {
    center: { x: 27, y: 0 },
    planets: [
      { slot: 0, resource: 'biofiber', disc: 9 },
      { slot: 1, resource: 'plasma', disc: 5 },
      { slot: 2, resource: 'quantumCore', disc: 3 },
    ],
  },
}

/**
 * Explorable systems. Every disc here begins **face down** and produces nothing
 * until a later exploration milestone reveals it.
 *
 * The two 6s and the two 8s are split across the near and far bands and across
 * opposite flanks, so no local area concentrates high-probability production.
 */
export const PLANETARY_SYSTEM_LAYOUTS: Readonly<Record<PlanetarySystemKey, SystemLayout>> = {
  // --- Near band (y = 4): one 6 on the left, one 8 on the right ------------
  'near-a': {
    center: { x: 5, y: 4 },
    planets: [
      { slot: 0, resource: 'cryonite', disc: 6 },
      { slot: 1, resource: 'plasma', disc: 11 },
      { slot: 2, resource: 'biofiber', disc: 3 },
    ],
  },
  'near-b': {
    center: { x: 13, y: 4 },
    planets: [
      { slot: 0, resource: 'alloy', disc: 9 },
      { slot: 1, resource: 'quantumCore', disc: 12 },
      { slot: 2, resource: 'cryonite', disc: 5 },
    ],
  },
  'near-c': {
    center: { x: 21, y: 4 },
    planets: [
      { slot: 0, resource: 'biofiber', disc: 4 },
      { slot: 1, resource: 'alloy', disc: 10 },
      { slot: 2, resource: 'plasma', disc: 2 },
    ],
  },
  'near-d': {
    center: { x: 29, y: 4 },
    planets: [
      { slot: 0, resource: 'plasma', disc: 8 },
      { slot: 1, resource: 'cryonite', disc: 3 },
      { slot: 2, resource: 'alloy', disc: 11 },
    ],
  },
  // --- Far band (y = 8): one 8 on the left, one 6 on the right -------------
  'far-a': {
    center: { x: 5, y: 8 },
    planets: [
      { slot: 0, resource: 'biofiber', disc: 8 },
      { slot: 1, resource: 'alloy', disc: 2 },
      { slot: 2, resource: 'quantumCore', disc: 10 },
    ],
  },
  'far-b': {
    center: { x: 13, y: 8 },
    planets: [
      { slot: 0, resource: 'cryonite', disc: 9 },
      { slot: 1, resource: 'biofiber', disc: 5 },
      { slot: 2, resource: 'plasma', disc: 12 },
    ],
  },
  'far-c': {
    center: { x: 21, y: 8 },
    planets: [
      { slot: 0, resource: 'quantumCore', disc: 4 },
      { slot: 1, resource: 'biofiber', disc: 11 },
      { slot: 2, resource: 'alloy', disc: 3 },
    ],
  },
  'far-d': {
    center: { x: 29, y: 8 },
    planets: [
      { slot: 0, resource: 'alloy', disc: 6 },
      { slot: 1, resource: 'plasma', disc: 10 },
      { slot: 2, resource: 'cryonite', disc: 12 },
    ],
  },
}

/** Alien outpost positions. Each contributes 1 docking point and 5 docks. */
export const OUTPOST_LAYOUTS: Readonly<Record<OutpostKey, GridPoint>> = {
  veyra: { x: 9, y: 6 },
  thessi: { x: 17, y: 6 },
  okarun: { x: 25, y: 6 },
  lumene: { x: 33, y: 6 },
}

/** Docks per outpost, matching `EXPECTED_BOARD_COMPOSITION.docksPerOutpost`. */
export const DOCKS_PER_OUTPOST = 5

// --- Open space ----------------------------------------------------------

/**
 * Open intersections that belong to no system or outpost. These are the lanes
 * ships travel through; they are grouped into space sectors below.
 *
 * `lane-*` runs the corridor between the frontier and the near band; `rim-*`
 * runs between the near band and the outposts; `deep-*` between the outposts
 * and the far band. `link-*` are the cross-connections that give the graph
 * more than one route between any two regions.
 */
export const OPEN_INTERSECTION_LAYOUTS: Readonly<Record<string, GridPoint>> = {
  // Corridor along y = 2, immediately outward of the home frontier.
  'lane-1': { x: 1, y: 2 },
  'lane-2': { x: 5, y: 2 },
  'lane-3': { x: 9, y: 2 },
  'lane-4': { x: 13, y: 2 },
  'lane-5': { x: 17, y: 2 },
  'lane-6': { x: 21, y: 2 },
  'lane-7': { x: 25, y: 2 },
  'lane-8': { x: 29, y: 2 },
  'lane-9': { x: 33, y: 2 },
  // Rim along y = 5, between the near systems and the outposts.
  'rim-1': { x: 1, y: 5 },
  'rim-2': { x: 9, y: 5 },
  'rim-3': { x: 17, y: 5 },
  'rim-4': { x: 25, y: 5 },
  'rim-5': { x: 33, y: 5 },
  // Deep space along y = 7, between the outposts and the far systems.
  'deep-1': { x: 5, y: 7 },
  'deep-2': { x: 13, y: 7 },
  'deep-3': { x: 21, y: 7 },
  'deep-4': { x: 29, y: 7 },
  // Flank links, giving the far band a second route home around each edge.
  'link-west': { x: 1, y: 8 },
  'link-east': { x: 33, y: 8 },
}

export type OpenIntersectionKey = keyof typeof OPEN_INTERSECTION_LAYOUTS

// --- Space sectors -------------------------------------------------------

/**
 * The 15 space sectors. A sector is a named region grouping the intersections
 * that sit in it — it carries no production and no movement rule of its own,
 * but it gives the future renderer a stable partition of the board and gives
 * players a way to name a region.
 *
 * Every intersection key listed here is either an open intersection or an
 * outpost docking point; system sites belong to their system, not to a sector.
 */
export const SECTOR_LAYOUTS: readonly Readonly<{
  key: string
  name: string
  intersectionKeys: readonly string[]
}>[] = [
  { key: 'sector-01', name: 'West Approach', intersectionKeys: ['lane-1', 'lane-2'] },
  { key: 'sector-02', name: 'Cradle Reach', intersectionKeys: ['lane-3', 'lane-4'] },
  { key: 'sector-03', name: 'Median Drift', intersectionKeys: ['lane-5', 'lane-6'] },
  { key: 'sector-04', name: 'East Approach', intersectionKeys: ['lane-7', 'lane-8'] },
  { key: 'sector-05', name: 'Verge Shallows', intersectionKeys: ['lane-9'] },
  { key: 'sector-06', name: 'Wesward Rim', intersectionKeys: ['rim-1'] },
  { key: 'sector-07', name: 'Veyra Rim', intersectionKeys: ['rim-2', 'outpost-veyra'] },
  { key: 'sector-08', name: 'Thessi Rim', intersectionKeys: ['rim-3', 'outpost-thessi'] },
  { key: 'sector-09', name: 'Okarun Rim', intersectionKeys: ['rim-4', 'outpost-okarun'] },
  { key: 'sector-10', name: 'Lumene Rim', intersectionKeys: ['rim-5', 'outpost-lumene'] },
  { key: 'sector-11', name: 'Deep Hollow West', intersectionKeys: ['deep-1'] },
  { key: 'sector-12', name: 'Deep Hollow Centre', intersectionKeys: ['deep-2'] },
  { key: 'sector-13', name: 'Deep Hollow East', intersectionKeys: ['deep-3'] },
  { key: 'sector-14', name: 'Outer Dark', intersectionKeys: ['deep-4'] },
  { key: 'sector-15', name: 'Frontier Flanks', intersectionKeys: ['link-west', 'link-east'] },
]

// --- Flight graph --------------------------------------------------------

/**
 * Explicit undirected links between intersections, written once per pair. The
 * assembler mirrors each entry, so no link is declared twice and no entry may
 * name the same intersection twice.
 *
 * Site keys are written as `<systemKey>/colony/<index>`,
 * `<systemKey>/port/<index>`, and `outpost-<outpostKey>` for a docking point.
 * The assembler resolves these to intersection ids.
 */
export const FLIGHT_LINKS: readonly (readonly [string, string])[] = [
  // --- Inside each home system: the colony triangle plus two launch sites ---
  ...HOME_SYSTEM_KEYS.flatMap((key) => [
    [`${key}/colony/0`, `${key}/colony/1`] as const,
    [`${key}/colony/1`, `${key}/colony/2`] as const,
    [`${key}/colony/2`, `${key}/colony/0`] as const,
    [`${key}/port/0`, `${key}/colony/0`] as const,
    [`${key}/port/0`, `${key}/colony/1`] as const,
    [`${key}/port/1`, `${key}/colony/1`] as const,
    [`${key}/port/1`, `${key}/colony/2`] as const,
  ]),

  // --- Inside each planetary system: the colony triangle -------------------
  ...PLANETARY_SYSTEM_KEYS.flatMap((key) => [
    [`${key}/colony/0`, `${key}/colony/1`] as const,
    [`${key}/colony/1`, `${key}/colony/2`] as const,
    [`${key}/colony/2`, `${key}/colony/0`] as const,
  ]),

  // --- Home systems out onto the y = 2 corridor ----------------------------
  // Each home reaches the corridor from both of its spaceport sites, so no
  // seat depends on a single edge to leave home.
  ['home-a/port/0', 'lane-1'],
  ['home-a/port/1', 'lane-2'],
  ['home-b/port/0', 'lane-3'],
  ['home-b/port/1', 'lane-4'],
  ['home-c/port/0', 'lane-5'],
  ['home-c/port/1', 'lane-6'],
  ['home-d/port/0', 'lane-7'],
  ['home-d/port/1', 'lane-8'],

  // --- The corridor itself, a continuous west-east lane --------------------
  ['lane-1', 'lane-2'],
  ['lane-2', 'lane-3'],
  ['lane-3', 'lane-4'],
  ['lane-4', 'lane-5'],
  ['lane-5', 'lane-6'],
  ['lane-6', 'lane-7'],
  ['lane-7', 'lane-8'],
  ['lane-8', 'lane-9'],

  // --- Corridor out to the near planetary systems --------------------------
  // Two entry points per near system, from different corridor nodes.
  ['lane-1', 'near-a/colony/0'],
  ['lane-2', 'near-a/colony/0'],
  ['lane-3', 'near-a/colony/1'],
  ['lane-4', 'near-b/colony/0'],
  ['lane-5', 'near-b/colony/1'],
  ['lane-6', 'near-c/colony/0'],
  ['lane-7', 'near-c/colony/1'],
  ['lane-8', 'near-d/colony/0'],
  ['lane-9', 'near-d/colony/1'],

  // --- Near systems out to the rim -----------------------------------------
  ['near-a/colony/2', 'rim-1'],
  ['near-a/colony/2', 'rim-2'],
  ['near-b/colony/2', 'rim-2'],
  ['near-b/colony/2', 'rim-3'],
  ['near-c/colony/2', 'rim-3'],
  ['near-c/colony/2', 'rim-4'],
  ['near-d/colony/2', 'rim-4'],
  ['near-d/colony/2', 'rim-5'],

  // --- The rim, a second continuous west-east lane -------------------------
  ['rim-1', 'rim-2'],
  ['rim-2', 'rim-3'],
  ['rim-3', 'rim-4'],
  ['rim-4', 'rim-5'],

  // --- Rim to the outpost docking points -----------------------------------
  // Each docking point is reachable from two different rim nodes, so no single
  // edge is the only way into an outpost.
  ['rim-1', 'outpost-veyra'],
  ['rim-2', 'outpost-veyra'],
  ['rim-2', 'outpost-thessi'],
  ['rim-3', 'outpost-thessi'],
  ['rim-3', 'outpost-okarun'],
  ['rim-4', 'outpost-okarun'],
  ['rim-4', 'outpost-lumene'],
  ['rim-5', 'outpost-lumene'],

  // --- Outposts outward into deep space ------------------------------------
  ['outpost-veyra', 'deep-1'],
  ['outpost-veyra', 'deep-2'],
  ['outpost-thessi', 'deep-2'],
  ['outpost-thessi', 'deep-3'],
  ['outpost-okarun', 'deep-3'],
  ['outpost-okarun', 'deep-4'],
  ['outpost-lumene', 'deep-4'],

  // --- Deep space out to the far planetary systems -------------------------
  ['deep-1', 'far-a/colony/0'],
  ['deep-1', 'far-b/colony/0'],
  ['deep-2', 'far-b/colony/1'],
  ['deep-2', 'far-a/colony/1'],
  ['deep-3', 'far-c/colony/0'],
  ['deep-3', 'far-b/colony/2'],
  ['deep-4', 'far-d/colony/0'],
  ['deep-4', 'far-c/colony/1'],

  // --- Flank links: a second way home from the far band --------------------
  ['link-west', 'far-a/colony/2'],
  ['link-west', 'rim-1'],
  ['link-east', 'far-d/colony/1'],
  ['link-east', 'far-d/colony/2'],
  ['link-east', 'rim-5'],
  ['link-east', 'far-c/colony/2'],
]

// --- Starting placements -------------------------------------------------

/**
 * Beginner starting deployment per seat, one home system each. Every seat gets
 * the same shape: Colonies on colony sites 0 and 1, a Spaceport on site 2, and
 * the Colony Ship on spaceport site 0.
 *
 * Site 2 borders planet slots 2 and 0, so the Spaceport always sits on the
 * system's weakest-number planet pair — the same trade-off for every seat.
 */
export const SEAT_HOME_SYSTEMS: Readonly<Record<number, HomeSystemKey>> = {
  0: 'home-a',
  1: 'home-b',
  2: 'home-c',
  3: 'home-d',
}

/**
 * The home system left empty in a 3-player match. Seats 0-2 use `home-a`
 * through `home-c`, so the fourth colour's pieces block `home-d`.
 */
export const THREE_PLAYER_NEUTRAL_HOME: HomeSystemKey = 'home-d'
