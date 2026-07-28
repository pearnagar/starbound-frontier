# Implementation Plan — Milestone Checklist

Work proceeds one milestone at a time. A milestone's box is only checked once its code is
written **and** verified (tests/build/lint run and passing) — not when planned.

Milestones 1-8 were built against an earlier, incorrect rules model and were substantially
replaced by the rulebook alignment refactor (Milestone 9). Their entries below record what
survives; see `docs/RULEBOOK_ALIGNMENT.md` for the full migration table.

## 1. Foundation

- [x] Vite + React + TypeScript app scaffolded, no nested project directory
- [x] Runtime deps installed: zustand, pixi.js, zod, howler, idb
- [x] Dev deps installed: TypeScript, Vite, ESLint, Prettier, Vitest, jsdom, RTL, jest-dom,
      user-event, Playwright, relevant type packages
- [x] Strict TypeScript enabled (`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`,
      `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`,
      `noUnusedParameters`, `exactOptionalPropertyTypes`, `forceConsistentCasingInFileNames`)
- [x] Path aliases working in TypeScript, Vite, and Vitest
- [x] Lean architecture folders created
- [x] Application shell renders with no fake gameplay controls
- [x] Styling foundation
- [x] ESLint + Prettier + EditorConfig configured
- [x] Production build passing

## 2. Domain model

- [x] Core gameplay types as pure TypeScript with no React/PixiJS/browser dependency
- [x] Resource identifiers and inventories
- [x] Player identity and control configuration

_Superseded in part by Milestone 9: piece supply, player victory points, and Mothership state
were replaced._

## 3. Board geometry

- [x] Axial hex coordinates, canonical vertex/edge identity on a tripled cube lattice

_Removed by Milestone 9. The corrected rules use an intersection graph, not hex geometry, so
these modules were deleted rather than left as unused abstractions._

## 4. Board generation

- [x] Pure seeded random source (`domain/random`, mulberry32) — **retained**
- [x] Randomized 37-sector board generation

_Board generation removed by Milestone 9; the layout is supplied as configuration. The seeded
RNG survives unchanged and now drives the Reserve shuffle, dice, and theft._

## 5. Setup placement

- [x] Snake-order placement with legality rules

_Removed by Milestone 9 and replaced with beginner setup._

## 6. Turn and production

- [x] Immutable match state and deterministic domain events
- [x] Deterministic two-dice rolling

_Phases, production values, and the resource bank were replaced by Milestone 9._

## 7. Crisis system

- [x] Roll-of-7 discard, Void Marauder movement, adjacency-limited theft

_Removed entirely by Milestone 9. The Void Marauder does not exist in the corrected rules._

## 8. Construction

- [x] Centralized costs and atomic validate-then-spend

_Actions replaced by Milestone 9; the cost-configuration and spending patterns survive._

## 9. Rulebook alignment refactor

- [x] Resource role mapping (`alloy`=ore, `plasma`=fuel, `cryonite`=carbon, `biofiber`=food,
      `quantumCore`=goods) with serialized identifiers unchanged
- [x] Data-driven board domain: `Planet`, `PlanetarySystem`, `HomeColonySystem`,
      `AlienOutpost`, `SpaceSector`, `Intersection`, `ColonySite`, `SpaceportSite`,
      `DockingPoint`, `Dock`, hidden/revealed number discs
- [x] Externally configurable topology with structural and composition validation
- [x] Piece model: 9 Colonies / 7 Trade Stations / 3 Transport Ships / 3 Shipyards, with
      composite Colony Ship / Trade Ship / Spaceport semantics
- [x] Structures (Colony, Spaceport, Trade Station) and ships on graph intersections
- [x] Beginner setup: 2 Colonies, 1 Spaceport, 1 Colony Ship, 4 VP, 3 Reserve cards, 1 Fame
      Medal piece, 1 Booster; highest-roll starting player; neutral blockers for 3 players
- [x] Turn flow: Production → Trade & Build (interleaved) → Flight → End Turn
- [x] Production: exactly 1 resource per adjacent Colony **and** per adjacent Spaceport
- [x] Separate face-up Supply and face-down Reserve pile with deterministic shuffle and rebuild
- [x] Reserve entitlement by victory points (4-7 → 2, 8-9 → 1, 10+ → 0)
- [x] Roll of 7: discard half over 7, direct weighted theft, opponent Reserve draws; Void
      Marauder fully removed
- [x] Supply trade rates: 3:1, and 2:1 for `quantumCore`
- [x] Build actions and exact costs for Spaceport, Colony Ship, Trade Ship, Cannon, Freight
      Pod, Booster, with correct piece consumption and upgrade limits
- [x] Mothership state (boosters, cannons, freight pods, Fame Medal pieces)
- [x] Scoring foundation and the 15-point target
- [x] Obsolete mechanics removed: Longest Network, route ownership, Outpost/Nexus tiers,
      Void Marauder, randomized resource-hex board, snake setup, 8/10/14-point targets
- [x] Verified 2026-07-29 (207/207 unit tests passing; typecheck, lint, format, build clean)

_Deliberately excluded: everything in Milestones 10-22 below._

## 10. Supply and player trading

- [ ] Executable player-to-player trade offers, counteroffers, and acceptance
- [ ] Enforcement that only the active player finalizes a deal, and that inactive players
      trade only with the active player
- [ ] Trade history and per-player trade counters

## 11. Flight graph and ship movement

- [ ] Movement along the intersection graph within a speed budget
- [ ] Passing through occupied intersections while counting them
- [ ] One piece per intersection after movement; turning back permitted
- [ ] Blockade rules (spaceport sites, colony sites, docking points) — see
      `docs/RULEBOOK_GAPS.md` gap 6

## 12. Mothership speed determination

- [ ] Explicit, documented digital substitute for the physical ball mechanism
- [ ] Base speed plus boosters; encounter trigger surfaced but unresolved here
- [ ] Decision recorded in `docs/DECISIONS.md` — see `docs/RULEBOOK_GAPS.md` gap 9

## 13. Planetary-system exploration

- [ ] Revealing all face-down discs in a system on arrival at an adjacent intersection
- [ ] Replacing hazard discs with pirate-base and ice-planet tokens
- [ ] Continuing movement after exploration

## 14. Establishing Colonies

- [ ] Colony Ship ends flight on an unoccupied colony site and establishes
- [ ] Transport Ship returns to supply; the Colony remains
- [ ] Adjacent-hazard restriction; 3-player two-colonies-per-system limit
- [ ] Colony-site vacate-or-establish obligation

## 15. Alien outposts and Trade Stations

- [ ] Trade Ship ends flight on a docking point and establishes a Trade Station on a free dock
- [ ] Freight-pod requirement scaled to existing trade stations at that outpost

## 16. Mothership upgrades in play

- [ ] Cannon and freight-pod effects on combat strength and capacity
- [ ] Booster effects on speed

## 17. Pirate bases and ice planets

- [ ] Defeating a pirate base by cannon count; terraforming by freight-pod count
- [ ] Awarding the token as a permanent 1-point fame medal
- [ ] Placing a fresh number disc on the cleared planet

## 18. Friendship Cards and Markers

- [ ] Card selection on establishing a Trade Station
- [ ] Marker award, and transfer when another player takes the outpost majority
- [ ] Card effects, including roll-of-7 discard protection — see `docs/RULEBOOK_GAPS.md` gap 5

## 19. Encounters

- [ ] Encounter deck, draw, and resolution procedure
- [ ] Fame Medal piece gain and loss — see `docs/RULEBOOK_GAPS.md` gap 4

## 20. Scoring and victory

- [ ] Full recomputation across every scoring source, including markers and tokens
- [ ] Victory-point track synchronization on marker transfer
- [ ] End-of-game detection on the holder's own turn at 15 points

## 21. AI

- [ ] Computer-controlled opponents

## 22. Persistence

- [ ] Save/load via `idb`

## 23. Full UI

- [ ] Complete PixiJS board rendering and HUD

## 24. Tutorial and accessibility

- [ ] Onboarding flow and accessibility pass

## 25. Final QA

- [ ] Full regression pass across all systems
