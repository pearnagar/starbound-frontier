# Implementation Plan — Milestone Checklist

Work proceeds one milestone at a time. A milestone's box is only checked once its code is
written **and** verified (tests/build/lint run and passing) — not when planned.

## 1. Foundation

- [x] Vite + React + TypeScript app scaffolded, no nested project directory
- [x] Runtime deps installed: zustand, pixi.js, zod, howler, idb
- [x] Dev deps installed: TypeScript, Vite, ESLint, Prettier, Vitest, jsdom, RTL, jest-dom,
      user-event, Playwright, relevant type packages
- [x] Strict TypeScript enabled (`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`,
      `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`,
      `noUnusedParameters`, `exactOptionalPropertyTypes`, `forceConsistentCasingInFileNames`)
- [x] Path aliases (`@/`, `@game/`, `@app/`, `@components/`, `@assets/`) working in
      TypeScript, Vite, and Vitest
- [x] Lean architecture folders created (`app`, `game/domain`, `game/application`,
      `game/infrastructure`, `game/presentation`, `components`, `hooks`, `assets`, `styles`,
      `tests`)
- [x] Application shell renders (title, subtitle, status panel, version, "gameplay not yet
      implemented" notice) with no fake gameplay controls
- [x] Styling foundation (CSS variables, typography, spacing, radius, focus states, base
      button, reduced-motion handling)
- [x] Unit tests (Vitest + RTL) passing (2/2)
- [x] Playwright configured; smoke test passing against production preview build
- [x] ESLint + Prettier + EditorConfig configured, `lint`/`format:check` passing
- [x] Production build passing
- [x] Git initialized locally (no commit yet — pending manual commit by the user)

_(Verified 2026-07-28 — see `docs/PROJECT_STATUS.md` for the exact commands run and their
results.)_

## 2. Domain model

- [x] Core gameplay types and entities (resources, player identity/configuration, players,
      piece supply) as pure TypeScript, with no React/PixiJS/browser-API/storage/sound
      dependency, verified 2026-07-28 (35/35 unit tests passing, including an architectural
      purity test)

## 3. Board geometry

- [x] Axial hex coordinates, clockwise direction order, neighbours, and distance
- [x] Canonical corner (`VertexId`) and edge (`EdgeId`) identities on a tripled cube
      lattice — shared identity across touching hexes, no floating-point equality
- [x] Hex → vertices / hex → edges mappings, edge endpoints, and adjacency helpers
- [x] Verified 2026-07-28 (99/99 unit tests passing, including exact corner/edge counts and
      Euler's formula for radius-0/1/2 clusters)

_Deliberately excluded: board shape, generation, sector types, placement, route ownership,
and rendering._

## 4. Board generation

- [x] Pure seeded random source (`domain/random`, mulberry32) with deterministic shuffle,
      indexed/integer selection, and per-attempt seed derivation
- [x] Standard shape: radius-3 hexagon, 37 sectors, central star fixed at the origin
- [x] Sector and production-token distributions held in one configuration object
- [x] Production numbers 2-12 excluding 7, weighted toward 6/8, with no adjacent 6/8 pair
- [x] Six deterministically chosen hidden outer-ring sectors that retain their content
- [x] Board validator over the `DomainResult` convention, and bounded deterministic retry
      that records the winning attempt
- [x] Verified 2026-07-28 (177/177 unit tests passing)

_Deliberately excluded: sector reveal behaviour, anomaly effects, player placement, and
resource production._

## 5. Setup placement

- [x] `BoardTopology` index: board corners, edges, corner→sectors, corner→edges
- [x] Snake-order sequencing with immutable `SetupState` transitions
- [x] Outpost legality: on-board, unoccupied, no directly connected outpost, touches a
      visible sector
- [x] Mandatory connected route before the sequence advances
- [x] Starting resources granted on the second pair only, from visible producing sectors
- [x] Minimal outpost/trade-route ownership types (`buildings/`, `routes/`)
- [x] Verified 2026-07-28 (237/237 unit tests passing)

_Deliberately excluded: normal turns, dice, production rolls, construction costs, colonies,
nexus, trading, exploration reveal, scoring, and AI._

## 6. Turn and production

- [ ] Turn order, phases, and resource production

## 7. Crisis system

- [ ] Random/seeded event or crisis mechanics

## 8. Construction

- [ ] Building placement and construction rules

## 9. Trading

- [ ] Player-to-player and/or market trading

## 10. Exploration

- [ ] Exploration mechanics and rewards

## 11. Scoring and victory

- [ ] Victory point tracking and win conditions

## 12. AI

- [ ] Computer-controlled opponents

## 13. Full UI

- [ ] Complete PixiJS board rendering and HUD

## 14. Persistence

- [ ] Save/load via `idb`

## 15. Tutorial and accessibility

- [ ] Onboarding flow and accessibility pass

## 16. Final QA

- [ ] Full regression pass across all systems
