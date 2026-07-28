# Project Status

_Last updated: 2026-07-29_

## Current milestone

Milestone 9 — Rulebook alignment refactor: **complete and verified**.

Milestones 1–8 built a plausible but incorrect rules model. Milestone 9 replaced it with the
mechanics of the reference space-trading rules. This was a deliberate breaking migration:
incompatible modules and tests were deleted rather than kept behind compatibility shims. See
`docs/RULEBOOK_ALIGNMENT.md` for the full migration table.

## Verified completed work

### Foundation (Milestone 1)

- Vite + React 19 + TypeScript app scaffolded directly in the project root (no nested dir).
- Strict TypeScript across the project, including `exactOptionalPropertyTypes` and
  `noUncheckedIndexedAccess`.
- Path aliases (`@/`, `@game/`, `@app/`, `@components/`, `@assets/`) working in TypeScript,
  Vite, and Vitest.
- ESLint + Prettier + EditorConfig configured; application shell renders with no fake gameplay
  controls.

### Domain model

- Five resources with documented gameplay roles: `alloy`=ore, `plasma`=fuel, `cryonite`=carbon,
  `biofiber`=food, `quantumCore`=goods. Serialized identifiers are unchanged, so no data
  migration layer was required.
- Branded ids, the `DomainResult<T>` validation convention, and immutable state throughout.
- Player state: hidden resource hand, piece supply, Mothership, victory points, seat order.
- Architectural purity test asserting the domain imports no React, Zustand, PixiJS, Howler, or
  idb.

### Board

- Data-driven model: `Planet`, `PlanetarySystem`, `HomeColonySystem`, `AlienOutpost`,
  `SpaceSector`, `Intersection`, `ColonySite`, `SpaceportSite`, `Dock`, `NumberDisc`.
- Topology supplied through `BoardConfiguration` — never generated or inferred.
- `validateSpaceBoard` checks mirrored adjacency, resolvable ids, and hazard/disc exclusivity;
  `validateBoardComposition` checks the published counts (4 home systems, 8 planetary systems,
  4 outposts, 15 sectors, 5 docks each).
- Read-only flight-graph queries: adjacency, BFS distance, range, connectivity.

### Pieces and structures

- 9 Colonies, 7 Trade Stations, 3 Transport Ships, 3 Shipyards per player.
- Composite semantics: Transport+Colony = Colony Ship, Transport+Trade Station = Trade Ship,
  Colony+Shipyard = Spaceport.
- Structures split by position: Colonies/Spaceports on intersections, Trade Stations on docks.
  A Spaceport replaces its Colony, so a site is never counted twice.

### Setup

- Beginner setup: 2 Colonies, 1 Spaceport, 1 Colony Ship, 4 victory points, 3 hidden Reserve
  cards, 1 Fame Medal piece, 1 Booster.
- Starting player by highest two-die roll, ties broken by seat index.
- Neutral blocking pieces for the unused colour in a 3-player game.
- No starting production from adjacent planets.

### Turns and production

- Phases: `startTurn → roll → resolveProduction → tradeAndBuild → flight → endTurn`, with
  `sevenPending` branching off the roll.
- Trading and building share one phase and may be interleaved without limit.
- Production grants exactly 1 resource per adjacent Colony **and** per adjacent Spaceport.
- Unrevealed number discs and hazard-blocked planets never produce.
- All-or-nothing per-resource shortage handling against the Supply.
- Reserve entitlement for the active player only: 4–7 → 2 cards, 8–9 → 1, 10+ → 0.

### Roll of 7

- Discard half (rounded down) above 7 cards, fixed at the moment the 7 is rolled.
- Direct weighted theft from any chosen opponent — no board token, no adjacency requirement.
- One Reserve card to every opponent, starting from the active player's left.
- Void Marauder removed entirely.

### Trading and construction

- Supply trade at 3:1, and 2:1 for `quantumCore` — derived from the resource role, not from any
  owned structure.
- Build costs: Spaceport (3 cryonite + 2 biofiber), Colony Ship (1 alloy + 1 plasma +
  1 cryonite + 1 biofiber), Trade Ship (1 alloy + 1 plasma + 2 quantumCore), Cannon (2 cryonite,
  max 6), Freight Pod (2 alloy, max 5), Booster (2 plasma, max 6).
- Correct piece consumption on every build, including the Colony that stays inside a Spaceport.

### Scoring

- Colony 1, Spaceport 2 in total, Friendship Marker 2, cleared pirate base 1, terraformed ice
  planet 1, each complete Fame Medal pair 1.
- 15-point target, checked only for the active player on their own turn.

## Current blockers

**The exact beginner board layout is unavailable.** The reference rules publish it as a
diagram, not as coordinates, so the domain ships without a playable default board — a
`BoardConfiguration` must be supplied externally. See `docs/RULEBOOK_GAPS.md` gaps 1 and 2.

This does not block further domain milestones, which proceed against configured fixtures, but
it does block a playable build.

## Next milestone

Milestone 10 — Supply and player trading: executable player-to-player offers and counteroffers,
enforcing that only the active player finalizes a deal and that inactive players trade only
with the active player.

## Last verification commands

Run 2026-07-29, all passing:

| Command                | Result                |
| ---------------------- | --------------------- |
| `npm run typecheck`    | Clean                 |
| `npm run lint`         | Clean                 |
| `npm run format:check` | Clean                 |
| `npm run test:run`     | 207 passed (17 files) |
| `npm run build`        | Clean                 |

Playwright end-to-end tests were not run in this session; the application shell is unchanged by
this refactor.
