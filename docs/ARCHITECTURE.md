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

`src/game/domain/` contains the pure domain model: gameplay types (`types/`), the data-driven
board and flight graph (`board/`), the seeded random source (`random/`), rule constants
(`rules/`), structures and ships (`buildings/`), beginner setup (`setup/`), supply trading
(`trading/`), scoring (`scoring/`), and match/turn state (`turns/`). `application/`,
`infrastructure/`, and `presentation/` are still empty layer folders.

The domain was substantially rewritten by the rulebook alignment refactor; see
`docs/RULEBOOK_ALIGNMENT.md` for what replaced what.

### Seeded randomness

`src/game/domain/random/` holds a pure mulberry32 generator (`createSeededRandom`) plus
`deriveAttemptSeed`. It lives in the domain because it is pure arithmetic with no I/O, and
`domain/` may not import from `infrastructure/`. Anything that genuinely touches the outside
world — choosing a fresh seed at app start, persisting it — belongs in `infrastructure/random`
later. `Math.random()` is never used.

Every consumer threads the generator state explicitly: a function takes the current
`randomState` and returns the next one alongside its result, rather than sharing a mutable
generator. This is what makes the Reserve shuffle, dice, starting-player rolls, and weighted
theft all replayable from a single seed.

## Board model

The board is **data, not geometry**. The reference beginner layout is published only as a
diagram, so no module generates or infers a topology — a `BoardConfiguration` supplies the
whole thing from outside the domain (see `docs/RULEBOOK_GAPS.md`).

`space-board.ts` defines the vocabulary: `Planet`, `PlanetarySystem`, `HomeColonySystem`,
`AlienOutpost`, `SpaceSector`, `Intersection`, `ColonySite`, `SpaceportSite`, `Dock`, and
`NumberDisc`. Identity is a branded string id per entity, and every collection is a keyed
record so lookups stay O(1) and the whole board serializes as-is.

**Adjacency** lives on `Intersection.adjacentIntersectionIds` as an explicit mirrored edge
list. `validateSpaceBoard` rejects an asymmetric link, a self-link, or a reference to an
unknown id, which is what makes the graph safe for the future flight system to trust.
`validateBoardComposition` separately checks the published component counts (4 home systems,
8 planetary systems, 4 outposts, 15 sectors, 5 docks per outpost), so a deliberately small
test fixture can still be structurally valid without pretending to be a full board.

**Production eligibility** is a property of the planet, not the board: `isPlanetProducing`
requires a revealed disc and no hazard. A planet carrying a pirate base or ice planet has no
disc at all — `validateSpaceBoard` rejects a planet holding both — so a blocked planet cannot
accidentally produce.

`flight-graph.ts` holds read-only graph queries (adjacency, BFS distance, range, connectivity).
It deliberately contains no movement rules; ship movement is a later milestone, and shipping a
half-implemented mover would be worse than shipping none.

## Pieces, structures, and ships

The physical piece model drives the type model. A player's `PieceSupply` tracks only the four
real piece kinds (9 Colonies, 7 Trade Stations, 3 Transport Ships, 3 Shipyards). Composite
pieces are _relationships_, not stored types:

- Transport Ship + Colony = Colony Ship
- Transport Ship + Trade Station = Trade Ship
- Colony + Shipyard = Spaceport

This is why building a Colony Ship deducts a Transport Ship **and** a Colony, and why upgrading
to a Spaceport deducts only a Shipyard — the Colony is already on the board and stays part of
the Spaceport. Modelling it the other way (a `spaceport` piece in supply) would have made the
"a Spaceport is worth 2 points including its Colony" rule impossible to state cleanly.

`Structure` is a discriminated union split by _where it sits_: `SiteStructure` (Colony or
Spaceport, on an intersection) and `TradeStationStructure` (on a dock at an outpost). They are
stored in separate records on `Match` because they are keyed differently and never compete for
the same position.

A Spaceport replaces its Colony in `Match.structures` rather than sitting alongside it, so
scoring counts the site exactly once at 2 points and production grants it exactly 1 resource.

## Supply and Reserve

`turns/resource-bank.ts` holds two deliberately different stores:

- **`ResourceSupply`** — face up, modelled as per-resource counts. Order is meaningless.
- **`ReservePile`** — face down, modelled as an _ordered list of cards_. Order is
  authoritative: draws come off the front, and the order comes from a seeded shuffle.

They are separate types rather than one bank because the rules treat them differently — you
trade with the Supply and draw blind from the Reserve — and because a count-based model cannot
represent "the next card" at all.

`drawFromReserve` rebuilds the pile in place when it empties mid-draw (8 of each resource,
reshuffled) and reports `rebuilt` so callers can observe it. Draw results are hidden
information: events record a count, never the cards.

## Match and turn state

`Match` is one immutable, serializable snapshot; every transition returns a new one. IDs and
seeds are supplied by callers, never minted inside the domain, except `nextShipNumber` — a
monotonic counter that lets ship ids be derived without a clock or an RNG draw.

**Phases.** `startTurn → roll → resolveProduction → tradeAndBuild → flight → endTurn`, with
`sevenPending` branching off the roll. Trading and building share `tradeAndBuild` and may be
interleaved without limit, which is why construction never advances the phase itself.

**Production.** `getProductionDemand` walks each Colony/Spaceport, resolves its colony site,
and grants 1 resource per adjacent planet matching the roll. Demand is aggregated per player
and per resource before the Supply is touched; a resource whose total demand exceeds the Supply
is withheld from everyone that roll, all-or-nothing, while other resources resolve normally.

**Reserve entitlement.** Only the roller draws, by victory points (4-7 → 2, 8-9 → 1, 10+ → 0),
resolved inside `resolveProduction` so the entitlement cannot be skipped or taken twice.

**Roll of 7.** `SevenState` is a discriminated union — `discarding | selectingTarget |
drawing` — present only while work remains. Discard requirements are computed once, when the 7
is rolled, so one player's discard cannot change another's obligation. Theft builds a flat
weighted list (one entry per card held) and draws with the seeded generator, making selection
exactly proportional to hand size and fully replayable; the stolen resource is deliberately
absent from the emitted event. There is no board token: the Void Marauder does not exist in
these rules.

**Events.** Minimal serializable records with a deterministic `sequence` and no timestamps.
Hidden information never enters an event.

## Construction

`turns/construction.ts` implements building, legal only during `tradeAndBuild` and only for the
active player. Every action validates fully before mutating anything, then deducts the cost and
returns it to the Supply atomically.

All costs and limits live in `rules/rules-config.ts`. No resource literal appears in a
validator or transition, so a cost change touches exactly one file. The same module holds the
victory target, reserve tiers, trade rates, and upgrade caps.

The 2:1 supply trade rate is derived from the resource's _role_ (`GOODS_RESOURCE_TYPE`), not
from owning a structure — the improved rate belongs to the goods-equivalent resource itself.

## Scoring

`scoring/scoring.ts` recomputes points from board state rather than trusting a counter. Awards
that no implemented system grants yet (Friendship Markers, cleared-hazard tokens) are passed in
as an explicit `PlayerAwards` argument defaulting to zero, so scoring never invents a source it
cannot see. `Player.victoryPoints` remains stored because the physical victory-point track is
itself authoritative for Friendship Marker transfers.

Victory is checked only for the active player, in `endTurn` — a player cannot win on someone
else's turn.

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
      board/
      buildings/
      encounters/
      exploration/
      friendship/
      random/
      rules/
      scoring/
      setup/
      trading/
      turns/
      types/

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

These subfolders are created when the milestone that needs them begins (see
`docs/IMPLEMENTATION_PLAN.md`), not pre-scaffolded — an empty folder with no clear owner is
harder to reason about than one created alongside the code that fills it.
