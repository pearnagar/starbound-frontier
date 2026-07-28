# Project Status

_Last updated: 2026-07-29_

## Current milestone

Milestone 7 — Crisis and Void Marauder: **complete and verified**. (Milestones 1–6: complete
and verified.)

## Verified completed work

- Vite + React 19 + TypeScript app scaffolded directly in the project root (no nested dir).
- Runtime deps installed: zustand, pixi.js, zod, howler, idb.
- Dev deps installed: TypeScript, Vite, ESLint, Prettier, Vitest, jsdom, React Testing
  Library, jest-dom, user-event, Playwright, plus type packages.
- Strict TypeScript enabled in `tsconfig.app.json` / `tsconfig.node.json`, all nine required
  flags on. Path aliases (`@/`, `@app/`, `@game/`, `@components/`, `@assets/`) configured
  identically in `tsconfig.app.json`, `vite.config.ts`, and `vitest.config.ts`.
- Lean architecture folders created under `src/`; deeper gameplay-specific subfolders
  intentionally deferred (documented in `docs/ARCHITECTURE.md`).
- Application shell (`src/app/App.tsx`) renders title, subtitle, status panel (version,
  milestone, status), and a "gameplay not yet implemented" notice — no fake gameplay
  controls. Confirmed responsive with no horizontal overflow at 1366×768 and 1920×1080.
- Styling foundation (`src/styles/tokens.css`, `src/styles/global.css`): CSS variables,
  typography, spacing scale, radius, focus-visible ring, base button style,
  `prefers-reduced-motion` handling.
- Playwright installed (Chromium browser downloaded successfully) and configured to run
  against the production preview build; smoke test passing, fails only on page errors or
  console-error messages.
- ESLint (flat config, ESLint 10) + Prettier + `.editorconfig` configured; `lint` and
  `format:check` both passing.
- Production build (`tsc -b && vite build`) passing.
- Git initialized locally on `main`; no commit made yet (per explicit instruction — user
  will review and commit manually).
- **Pure domain model** under `src/game/domain/`:
  - `types/resources.ts` — the five Starbound Frontier resources (`alloy`, `plasma`,
    `cryonite`, `biofiber`, `quantumCore`), `ResourceInventory`,
    `createEmptyResourceInventory`, `getTotalResourceCount`, `isValidResourceInventory`.
  - `types/piece-supply.ts` — `PieceSupply` (15 trade routes / 5 outposts / 4 colonies / 2
    nexus), `createInitialPieceSupply`, `isValidPieceSupply`.
  - `types/ids.ts` — branded `PlayerId`, `CaptainId`, `FactionColorId`.
  - `types/player-configuration.ts` — `PlayerControlType`, `AiDifficulty`
    (`cadet`/`commander`/`admiral`), discriminated `PlayerControlConfiguration`
    (`HumanPlayerConfiguration` | `AiPlayerConfiguration`).
  - `types/result.ts` — shared `DomainValidationError` / `DomainResult<T>` convention.
  - `types/player.ts` — `Player` type (identity, control config, resources, piece supply,
    milestone IDs, trade/exploration counters, cached victory points) and the `createPlayer`
    factory, which returns a `DomainResult<Player>` rather than throwing.
  - `types/index.ts` and `domain/index.ts` — the public export surface.
  - `domain-purity.test.ts` — architectural test asserting no file under
    `src/game/domain/` imports React, React DOM, Zustand, PixiJS, Howler, or idb.
  - No React/PixiJS/browser-API/storage/sound imports anywhere in this code. Not yet wired
    into the UI (production bundle size is unchanged since nothing imports it yet — expected
    for a domain-only milestone).
  - This replaces an earlier, less-specified domain pass from this same milestone slot that
    used generic placeholder resources (`energy`/`minerals`/`food`/`research`) and a minimal
    `Player` shape — superseded once the precise game spec (exact resources, piece counts,
    AI difficulties, full player fields) was provided.
- **Board geometry** under `src/game/domain/board/`:
  - `hex-coordinate.ts` — `HexCoordinate` (axial), `HexDirection` (clockwise from East),
    `createHexCoordinate`/`isValidHexCoordinate`, `hexCoordinateKey`,
    `hexCoordinatesEqual`, `getHexNeighbor`/`tryGetHexNeighbor`/`getHexNeighbors`,
    `getOppositeHexDirection`, `getHexDistance`, `areHexesAdjacent`, `isHexDirection`.
  - `lattice.ts` — the tripled cube lattice (`LatticePoint`, `CORNER_OFFSETS`,
    `hexCentreLatticePoint`, add/subtract/equality, key/parse) that makes corner identity
    exact integer arithmetic.
  - `vertex.ts` — `VertexId`, `getHexVertices` (clockwise from North), `getVertexPoint`,
    `vertexIdKey`, `areVerticesConnected`.
  - `edge.ts` — `EdgeId`, `createEdgeId` (order-independent; rejects degenerate and
    unconnected endpoints), `getHexEdges`, `getEdgeVertices`, `doEdgesShareVertex`,
    `edgeHasVertex`, `edgeIdKey`.
  - `index.ts` — public board barrel, re-exported from `src/game/domain/index.ts`.
  - Structural tests confirm a radius-1 patch has exactly 24 corners / 30 edges and a
    radius-2 patch exactly 54 / 72, with Euler's formula holding in both — i.e. no duplicate
    or split identities.
- **Board generation** under `src/game/domain/board/` and `src/game/domain/random/`:
  - `random/seeded-random.ts` — pure mulberry32 `createSeededRandom` (unbiased `nextInt`,
    non-mutating `shuffle`, `pick`) plus `deriveAttemptSeed`. No `Math.random()` anywhere.
  - `board-shape.ts` — radius-3 hexagon (37 sectors), boundary detection, deterministic
    coordinate ordering.
  - `board-configuration.ts` — the single home for sector counts, production-token counts,
    hidden-sector count, and the attempt limit.
  - `sector.ts` / `production-number.ts` — sector vocabulary and producing/non-producing
    split; production values 2-12 excluding 7, with `getProductionProbabilityWeight`.
  - `board.ts` / `board-generation.ts` / `board-validation.ts` — serializable `Board`,
    `generateBoard` with deterministic bounded retry, and `validateBoard` returning the
    shared `DomainResult`.
  - Measured across 200 seeds: zero failures, mean 1.015 attempts, worst case 3.
- **Setup placement** under `src/game/domain/setup/`, plus supporting ownership types:
  - `board/board-topology.ts` — `createBoardTopology` derives every corner (96) and edge
    (132) of the standard board, plus corner→sectors and corner→edges indexes.
  - `board/sector.ts` — added `getSectorResourceType`, mapping each producing sector type to
    the resource it yields.
  - `buildings/outpost.ts`, `routes/trade-route.ts` — minimal `Outpost` / `TradeRoute`
    ownership records on canonical `VertexId` / `EdgeId`.
  - `setup/setup-state.ts` — immutable `SetupState`, snake-order construction, accessors.
  - `setup/setup-placement.ts` — legality checks, legal-move listings, `placeSetupOutpost` /
    `placeSetupRoute`, and the second-outpost resource grant.
  - Not wired into the UI (production bundle size unchanged, as expected for domain work).
- **Match and turn state** under `src/game/domain/turns/`:
  - `match-id.ts` — externally supplied `MatchId` (branded, not generated by the domain).
  - `turn-phase.ts` — closed `TurnPhase` union: `startTurn`, `roll`, `resolveProduction`,
    `crisisPending`, `trade`, `build`, `endTurn`.
  - `resource-bank.ts` — immutable, serializable `ResourceBank` with one configurable initial
    quantity per resource (default 19 — see `docs/DECISIONS.md`), `deductFromBank`, and
    `bankHasAtLeast`.
  - `match-events.ts` — minimal serializable events (`TurnStarted`, `DiceRolled`,
    `SectorProduced`, `ResourcesGranted`, `ResourceShortage`, `ProductionResolved`,
    `TurnEnded`), each with a deterministic `sequence` and no timestamps.
  - `match.ts` — immutable `Match` state (board, players, turn order, active player, phase,
    random state, last dice result, outposts/routes, bank, event log, status) plus read-only
    accessors.
  - `match-initialization.ts` — `createMatchFromCompletedSetup`: validates a finished
    `SetupState`, applies setup resource grants, deducts 2 outposts + 2 trade routes per
    player, and starts turn 1 with the first player, all without mutating its inputs.
  - `dice.ts` — `rollTwoDice`, a pure function from a random-state seed to a two-dice result
    and the next state, via the existing seeded random service (no `Math.random()`).
  - `production.ts` — `getProductionDemand`/`getShortResources`: finds outposts adjacent (via
    `BoardTopology`) to visible sectors matching the roll, aggregates demand per player and
    per resource, only outposts produce.
  - `turn-transitions.ts` — `beginTurn`, `rollDice`, `resolveProduction`,
    `advanceToTradePhase`, `advanceToBuildPhase`, `endTurn`, enforcing active-player/phase
    validation, a roll of 7 entering `crisisPending` with no production, all-or-nothing
    resource shortages, and player-order wrap with turn-number increment.
  - Not wired into the UI (production bundle size unchanged, as expected for domain work).
- **Crisis system and Void Marauder** under `src/game/domain/turns/`:
  - `crisis-state.ts` — discriminated `CrisisState` union (`discarding`, `movingMarauder`,
    `selectingStealTarget`, `stealing`), fixed-at-start `CrisisDiscardRequirement[]`, and
    `computeRequiredDiscardCount` (half of a total, rounded down).
  - `match.ts` — added `marauderCoordinate: HexCoordinate` (always present) and
    `crisisState?: CrisisState` (present only mid-crisis) to `Match`.
  - `match-initialization.ts` — new matches start with the Marauder on the central star
    (board origin) — see `docs/DECISIONS.md`.
  - `match-events.ts` — added `CrisisStarted`, `ResourcesDiscarded`, `MarauderMoved`,
    `ResourceStolen` (deliberately omits which resource was stolen), `CrisisCompleted`,
    `ProductionBlockedByMarauder`; all serializable, deterministic `sequence`, no timestamps.
  - `resource-bank.ts` — added `addToBank` (the inverse of `deductFromBank`), used to return
    discarded resources to the bank.
  - `production.ts` — `getProductionDemand` now also returns `blockedSectors`: otherwise-
    matching sectors that produced nothing because the Marauder occupies them. Other matching
    sectors are unaffected.
  - `turn-transitions.ts` — `rollDice` calls `startCrisis` on a roll of 7 instead of leaving
    `crisisPending` a dead end; `resolveProduction` emits `ProductionBlockedByMarauder` for
    each blocked sector before its normal production events.
  - `crisis-transitions.ts` — the milestone's public API: `startCrisis`,
    `getRequiredDiscardCount`, `getPendingDiscardPlayers`, `submitCrisisDiscard`,
    `getLegalMarauderDestinations`, `moveMarauder`, `getEligibleStealTargets`,
    `stealCrisisResource`, `isCrisisComplete`, `completeCrisis`. Reuses `DomainResult`,
    branded `PlayerId`, canonical `HexCoordinate`/sector lookups, match events, and the
    existing seeded random service (`createSeededRandom` — no `Math.random()`). Theft
    selection is a flat per-card-held weighted list drawn via `rng.pick`, so probability is
    exactly proportional to cards held and fully reproducible from `Match.randomState`.
  - Not wired into the UI (production bundle size unchanged, as expected for domain work).

## Current blockers

None. Global git identity (`user.name`/`user.email`) is not configured on this machine, but
this is informational only since no commit was attempted:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## Next milestone

Milestone 8 — Construction. Building placement and construction rules do not exist yet;
`build` is currently a phase marker only.

## Last verification commands

Run from the project root, all passing (most recently after Milestone 7):

```bash
npm run typecheck     # tsc -b — clean
npm run lint          # eslint . — clean
npm run test:run      # vitest run — 321/321 passed (24 files)
npm run build         # tsc -b && vite build — succeeded
```

`npm run format:check` currently reports formatting warnings across the **entire** repository,
including files untouched by this milestone and unchanged since Milestone 5 (verified via
`git stash`) — this is a pre-existing environment/tooling issue on this machine, not something
introduced by Milestone 7's code. `npm run test:coverage` was not re-run this milestone; the
plain `test:run` suite (321/321) was used for verification instead.

`npm run test:e2e` was **not** re-run for Milestones 2–7 — no application/UI behavior
changed (the domain layer is not wired into the app yet), so no new end-to-end verification
was needed. It was last run and passed (1/1) during Milestone 1, against the production
preview build.

Dev server (`npm run dev`) started and verified in-browser during Milestone 1: page text,
console messages (info/debug only, no errors), and viewport checks at 1366×768 and
1920×1080 (no horizontal overflow) all confirmed.
