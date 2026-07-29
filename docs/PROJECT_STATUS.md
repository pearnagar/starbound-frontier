# Project Status

_Last updated: 2026-07-29_

## Current milestone

Milestone 9 — Rulebook alignment refactor **and** the original default board configuration:
**complete and verified**.

Milestones 1–8 built a plausible but incorrect rules model. Milestone 9 replaced it with the
mechanics of the reference space-trading rules. This was a deliberate breaking migration:
incompatible modules and tests were deleted rather than kept behind compatibility shims. See
`docs/RULEBOOK_ALIGNMENT.md` for the full migration table.

The same milestone then closed its own remaining blocker by designing an original playable
board rather than waiting for a layout that cannot be transcribed. See `docs/BOARD_LAYOUT.md`.

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
- `validatePlayableBoardConfiguration` layers the playable-board invariants on top: per-system
  planet and colony-site counts, unique ids, sector grouping, graph connectivity and
  per-home reachability, disc visibility, resource coverage, starting-placement legality, and
  neutral-blocker validity — each with its own error code.
- Read-only flight-graph queries: adjacency, BFS distance, range, connectivity.
- **Original default board** (`createDefaultBoardConfiguration()`): 4 home systems, 8
  explorable systems, 4 alien outposts, 15 sectors, 68 intersections on one connected graph,
  with beginner placements for 4 seats and neutral blockers for 3. Deterministic and
  serialization-stable. See `docs/BOARD_LAYOUT.md`.

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
- Neutral blocking pieces for the unused colour in a 3-player game, driven by the same
  configuration-consuming code path as a 4-player game.
- No starting production from adjacent planets.
- `createBeginnerMatch` may omit `configuration` and receive the default board. An explicitly
  supplied configuration is validated and used as-is — an invalid one fails rather than being
  silently replaced by the default.

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

None blocking further domain milestones.

The missing-default-board blocker is **resolved**. The reference beginner layout is still
published only as a diagram and still cannot be transcribed, but the project no longer waits
for it: `createDefaultBoardConfiguration()` ships an **original** playable layout satisfying
the same rule model. See `docs/BOARD_LAYOUT.md`. `docs/RULEBOOK_GAPS.md` gaps 1 and 2 remain
open as unresolved _reference_ questions, downgraded from blocking to informational.

One new gap was recorded rather than guessed: the pirate-base and ice-planet disc distribution
(gap 11). The default board uses ordinary hidden discs everywhere until Milestone 17.

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
| `npm run test:run`     | 258 passed (18 files) |
| `npm run build`        | Clean                 |

Playwright end-to-end tests were not run in this session; the application shell is unchanged by
the board work.
