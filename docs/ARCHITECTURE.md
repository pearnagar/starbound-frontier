# Architecture

## Layering

The codebase is organized into four layers under `src/game/`, plus supporting
application/UI folders:

- **`domain/`** — Pure gameplay rules and models. Must have **no dependency** on React,
  PixiJS, browser APIs (`window`, `localStorage`, `fetch`, etc.), storage, or sound. Domain
  code should be testable with plain Vitest unit tests and no DOM.
- **`application/`** — Orchestrates domain logic for specific use cases (e.g. "resolve a
  turn", "validate an action"). May depend on `domain/`, but still avoids React/PixiJS/
  browser APIs directly — it exposes a plain interface that the presentation layer calls.
- **`infrastructure/`** — Adapters to the outside world: seeded randomness, persistent
  storage (`idb`), audio playback (`howler`), configuration loading. Implements interfaces
  defined by `domain/`/`application/` rather than the other way around.
- **`presentation/`** — React components, PixiJS rendering, animations, HUD, menus, modals,
  tutorial UI. Depends on `domain/`/`application/` through their public interfaces; never
  the reverse.

`src/app/` wires the above together (root component, providers, routing) and is the only
place allowed to know about all four layers at once.

## Dependency rule

Dependencies point inward: `presentation → application → domain`, and
`infrastructure → domain`/`application` (implementing their interfaces). `domain/` never
imports from any other layer.

## Current state

`src/game/domain/` contains the pure domain model (`types/`), board geometry and generation
(`board/`), the seeded random source (`random/`), minimal structure ownership
(`buildings/`, `routes/`), initial setup placement (`setup/`), and match/turn state
(`turns/`). `application/`, `infrastructure/`, and `presentation/` are still empty layer
folders.

### Seeded randomness

`src/game/domain/random/` holds a pure mulberry32 generator (`createSeededRandom`) plus
`deriveAttemptSeed` for reproducible retries. It lives in the domain because it is pure
arithmetic with no I/O, and `domain/` may not import from `infrastructure/`. Anything that
genuinely touches the outside world — choosing a fresh seed at app start, persisting it —
belongs in `infrastructure/random` later. `Math.random()` is never used.

## Board geometry

The geometry modules (`hex-coordinate.ts`, `lattice.ts`, `vertex.ts`, `edge.ts`) hold
coordinate math and stable identities only. They know nothing about sectors, content, or
rendering, so board generation builds on them rather than the other way round.

### Axial coordinates and direction order

Hexes use axial coordinates `{ q, r }` (finite integers only); the implied cube coordinate
is `(q, -q - r, r)`. Directions are indexed **clockwise from East**, using screen
conventions (+x right, +y down):

| Index | Direction | Axial offset |
| ----- | --------- | ------------ |
| 0     | East      | (+1, 0)      |
| 1     | Southeast | ( 0, +1)     |
| 2     | Southwest | (-1, +1)     |
| 3     | West      | (-1, 0)      |
| 4     | Northwest | ( 0, -1)     |
| 5     | Northeast | (+1, -1)     |

Directions `d` and `(d + 3) % 6` are opposites. Hexes are pointy-top, so corners sit at
North and South.

### Canonical corner and edge identity

A corner is shared by up to three hexes and an edge by up to two, so identity cannot be
`{ hex, cornerIndex }` — each touching hex would mint a different id for the same physical
point. Instead, geometry is derived on a **tripled cube lattice**: hex centres are stored at
three times their cube coordinate (`(3q, -3q - 3r, 3r)`), which leaves room for all six
corners to land on exact integer points of that same lattice.

- **`VertexId`** — the `"x,y,z"` key of the corner's lattice point.
- **`EdgeId`** — its two endpoint `VertexId`s joined in lexicographic order, so `(a, b)` and
  `(b, a)` produce the identical string.

Because every corner resolves to integers, two hexes touching the same physical corner
compute the _same_ triple, so equality is plain `===` with no floating-point tolerance and
no duplicate ids. Corner lattice points are always congruent to `(1,1,1)` or `(2,2,2)`
modulo 3, while hex centres are congruent to `(0,0,0)` — the parities never collide, which
is what makes corner adjacency an exact integer test.

Rendered pixel positions are deliberately _not_ part of this layer; they belong to a later
presentation milestone. Floating-point coordinates are never used as authoritative ids.

## Board generation

Shape and content are separate concerns: `board-shape.ts` produces coordinates only, and
generation assigns content onto them.

**Shape.** A radius-3 hexagon centred on the origin — `3r² + 3r + 1 = 37` sectors, inside
the 30-40 target. Coordinates come out ring by ring, origin first, so ordering is stable.

**Sector distribution** (`board-configuration.ts`, the single source of these numbers):
6 each of alloy / plasma / cryonite / biofiber, 3 quantum rift, 6 empty space, 3 anomaly,
and 1 central star fixed at the origin — 27 producing, 10 non-producing. Quantum Rift is
deliberately rarer than every basic resource, and validation enforces that.

**Production tokens.** 27 tokens over the values 2-6 and 8-12 (never 7), weighted toward the
middle: one 2 and one 12, four 6s and four 8s, two 11s, three of everything else.
`getProductionProbabilityWeight` exposes each value's two-dice likelihood for later UI use.

The 6/8 adjacency rule is satisfied _by construction_ rather than by rejection: the high
tokens are placed first onto a mutually non-adjacent subset of producing sectors, after
which the remaining tokens cannot violate the rule. Reject-and-retry alone would have
succeeded on roughly 2% of shuffles; this succeeds on the first attempt for almost every
seed.

**Hidden sectors.** Six outer-ring sectors start hidden, chosen deterministically from the
seed. Hidden sectors keep their generated type and production number — visibility is a
separate flag and never changes the underlying assignment. The central star sits at the
origin, so it can never be selected. Reveal behaviour is not implemented.

**Retry.** `generateBoard` runs attempts 1..`maxGenerationAttempts` (default 25), each with
a seed derived from `(seed, attempt)`, validating every candidate with the same unrelaxed
`validateBoard`. The winning attempt number is recorded on the board. Exhausting the limit
returns a `BOARD_GENERATION_FAILED` result carrying the last attempt's validation errors.
Identical seed and configuration always yield identical board state, including the attempt
number.

## Initial setup placement

`src/game/domain/setup/` sequences the opening placements. It reads the board through
`BoardTopology` (`board/board-topology.ts`), a derived index of every corner, edge, and the
sectors touching each corner — built once per board so placement checks never re-walk it.

**Snake order.** `getSetupPlacementOrder` returns seat order followed by its reverse, so
`[P1 P2 P3 P4]` becomes `P1 P2 P3 P4 P4 P3 P2 P1`. One entry per outpost + route pair, two
per player.

**State transitions.** `SetupState` is an immutable snapshot; every transition returns a new
one. Placing an outpost records it, keeps the same active player, switches `expects` to
`'route'`, and stores `pendingOutpostVertexId`. Placing the route records it, clears the
pending corner, increments that player's completed pairs, grants starting resources if that
was their second pair, advances `stepIndex`, switches `expects` back to `'outpost'`, and
sets `complete` once the final entry is done. The sequence never advances on a half-finished
pair — the route is mandatory.

**Distance rule.** An outpost is illegal on a corner that is occupied or _directly connected
by an edge_ to an existing outpost. Corners two or more steps away stay legal. During setup
an outpost need not connect to any existing route.

**Hidden-sector restriction.** A setup outpost must touch at least one visible sector, so a
player cannot claim a corner surrounded entirely by unrevealed space. Reveal behaviour is
not implemented.

**Second-outpost resources.** Starting resources are granted only when a player's _second_
pair completes, and only once its route is down — not at outpost time. The grant is one
resource per visible producing sector touching that second corner; hidden sectors yield
nothing even when their underlying type produces, and empty space, anomalies, and the
central star never yield. `placeSetupRoute` returns the delta as an explicit
`SetupResourceGrant` rather than mutating any player, so applying it stays the caller's job.

## Match and turn state

`src/game/domain/turns/` holds the immutable `Match` state and normal-turn transitions that
follow completed setup.

**Initialization.** `createMatchFromCompletedSetup` validates a finished `SetupState`
(complete, consistent player order, each seat with exactly two placed outposts/routes and
matching completed-pair counts), then builds the initial `Match`: player order and the first
active player carried over unchanged, setup resource grants applied to player inventories,
two outposts and two trade routes deducted from each player's piece supply, and a fresh
`ResourceBank` with the setup grants already deducted from it. IDs and random seeds are
supplied by the caller, never generated inside the domain.

**Phases.** A closed `TurnPhase` union — `startTurn`, `roll`, `resolveProduction`,
`crisisPending`, `trade`, `build`, `endTurn` — drives normal flow
`startTurn → roll → resolveProduction → trade → build → endTurn`. `trade` and `build` are
phase markers only; no trading or construction rules exist yet. A roll totaling 7 enters
`crisisPending` and stops there — discard, Marauder movement, and theft belong to the Crisis
System milestone. `endTurn` advances to the next player, wrapping after the last seat and
incrementing `turnNumber` only on that wrap.

**Dice.** `rollTwoDice` draws two 1-6 values from the seeded random service
(`domain/random`) as a pure function of the match's current `randomState`, returning both the
result and the next state to store — no `Math.random()`, clock, or shared mutable generator.

**Production.** `getProductionDemand` finds every outpost whose corner (via
`BoardTopology`) touches a visible sector matching the rolled number, and grants one unit of
that sector's resource per adjacent outpost. Only outposts produce in this milestone. Demand
is aggregated per player and per resource before touching the bank.

**Bank and shortage.** `ResourceBank` holds one configurable initial quantity per resource
(default 19 — see `docs/DECISIONS.md`). `resolveProduction` computes, per resource type,
whether total demand exceeds the bank's current supply; if so, that resource is withheld
from every player this resolution (all-or-nothing), while unaffected resources still resolve
normally. The bank only ever decreases and never goes negative.

**Events.** Every transition appends minimal serializable events
(`TurnStarted`, `DiceRolled`, `SectorProduced`, `ResourcesGranted`, `ResourceShortage`,
`ProductionResolved`, `TurnEnded`) to `Match.events`, each carrying a deterministic
`sequence` assigned from `Match.eventSequence` — no timestamps.

## Planned structure (created milestone-by-milestone, not yet present)

```
src/
  app/
    providers/
    routes/

  game/
    domain/
      actions/
      ai/
      buildings/
      exploration/
      players/
      resources/
      routes/
      rules/
      scoring/
      trading/
      turns/
      types/
      victory/

    infrastructure/
      audio/
      configuration/
      random/
      storage/

    presentation/
      animations/
      board/
      hud/
      menus/
      modals/
      tutorial/
```

These subfolders will be created when the milestone that needs them begins (see
`docs/IMPLEMENTATION_PLAN.md`), not pre-scaffolded — an empty folder with no clear owner is
harder to reason about than one created alongside the code that fills it.
