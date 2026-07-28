# Decision Log

Record architecturally significant decisions here as they are made. One entry per decision.
Do not add speculative or fabricated entries — only decisions actually made and required.

## Template

### YYYY-MM-DD — Title

**Context:** What problem or question prompted this decision.

**Decision:** What was decided.

**Consequences:** What this makes easier or harder going forward.

---

## 2026-07-28 — Let the Vite scaffolder resolve dependency versions

**Context:** The project foundation needs "stable, mutually compatible package versions" for
React, TypeScript, Vite, and related tooling. Hand-picking exact version numbers risks
picking versions that are no longer current or that don't resolve cleanly together.

**Decision:** Used `npm create vite@latest . -- --template react-ts` and plain `npm install`
for additional dependencies, letting npm's live registry resolve current mutually-compatible
versions rather than pinning numbers up front.

**Consequences:** Versions in `package.json` reflect whatever was current/stable at
scaffold time, not versions chosen in advance. `package-lock.json` is committed so the exact
resolved tree is reproducible via `npm ci`.

## 2026-07-28 — Lean initial folder structure, deep folders created per-milestone

**Context:** The originally specified architecture includes many deep subfolders (e.g.
`domain/actions`, `domain/ai`, `infrastructure/audio`) that have no code yet at the
Foundation milestone.

**Decision:** Create only the top-level layer folders now (`domain/`, `application/`,
`infrastructure/`, `presentation/`, etc.). Document the full planned deep tree in
`docs/ARCHITECTURE.md` and create each subfolder only when the milestone that needs it
begins.

**Consequences:** Avoids empty, ownerless folders sitting unused for many milestones; the
tree in the repo always reflects what actually has code in it. Contributors must check
`docs/ARCHITECTURE.md` to see the intended future shape.

## 2026-07-28 — Branded IDs for player-related identifiers

**Context:** Milestone 2's `Player` type needed `PlayerId`, `CaptainId`, and
`FactionColorId`. As plain strings, these are structurally interchangeable — a `CaptainId`
could be passed anywhere a `PlayerId` is expected and TypeScript would not catch it.

**Decision:** Used a lightweight nominal-typing brand (`Brand<T, TBrand>` in
`src/game/domain/types/brand.ts`) for all three ID types, with no external branding library.
IDs are always supplied by the caller (`asPlayerId`/`asCaptainId`/`asFactionColorId` are
plain brand casts, not validating constructors) — the domain layer does not generate IDs
itself.

**Consequences:** Unrelated ID types can no longer be passed interchangeably at compile
time. Callers (a future infrastructure-layer ID generator) are responsible for producing
the underlying string values; the domain layer only brands them.

## 2026-07-28 — `DomainResult<T>` over exceptions for `createPlayer`

**Context:** `createPlayer` can fail for several independent reasons at once (empty name,
invalid seat index, invalid control configuration). Throwing on the first invalid field
would hide the others and force callers into try/catch for routine, expected validation
failures.

**Decision:** `createPlayer` returns `DomainResult<Player>` — either
`{ success: true, value: Player }` or `{ success: false, errors: DomainValidationError[] }`
— collecting _all_ validation failures in one pass, rather than throwing. This establishes
the minimal reusable `DomainResult`/`DomainValidationError` convention in
`src/game/domain/types/result.ts`, without building the future centralized gameplay-action
validation framework.

**Consequences:** Callers must check `result.success` before using `result.value` (the
discriminated union makes this a compile-time requirement, not just a convention). Future
domain factories that can fail validation should reuse the same `DomainResult` shape for
consistency, rather than mixing throw-based and result-based error handling.

## 2026-07-28 — Superseded: `cachedVictoryPoints` is explicitly a cache, not authoritative state

**Superseded 2026-07-29 by the rulebook alignment refactor** — see `docs/RULEBOOK_ALIGNMENT.md`.

**Context:** The `Player` type needs some victory-point field even though scoring rules
don't exist yet (Milestone 11, "Scoring and victory"). Naming it ambiguously (e.g.
`victoryPoints`) would make it unclear later whether the field is the source of truth or a
value that must be recomputed.

**Decision:** Named the field `cachedVictoryPoints` and documented on the type itself that
it is **not authoritative** — it starts at 0 and must be recalculated by the scoring system
introduced in a later milestone. Other counters on `Player` (`tradeCount`,
`exploredSectorCount`) are documented as authoritative counters by contrast.

**Consequences:** When the scoring milestone lands, it must treat `cachedVictoryPoints` as a
derived/recomputed value (e.g. refreshed after each action), not as state to increment
directly from scattered call sites.

## 2026-07-28 — Superseded: generic placeholder resource set

**Context:** An earlier pass at this same milestone slot (before the precise game
specification — exact resource names, piece-supply counts, AI difficulty tiers, and full
`Player` field list — was provided) implemented a minimal, generic domain model using
placeholder resources (`energy`, `minerals`, `food`, `research`) and a bare `Player` shape
(`id`, `name`, `color`).

**Decision:** Replaced that placeholder implementation entirely once the detailed spec was
available, rather than keeping both. `RESOURCE_TYPES` is now the five Starbound
Frontier–specific resources (`alloy`, `plasma`, `cryonite`, `biofiber`, `quantumCore`), and
`Player` carries the full field set described in the spec (seat index, captain/faction IDs,
control configuration, piece supply, milestones, counters, cached score).

**Consequences:** The old `ResourceKind`/`ResourceBundle`/`PlayerColor` names and the
`addResources`/`subtractResources`/`hasSufficientResources` helpers no longer exist —
resource spending/production logic is out of scope for this milestone and was removed along
with the placeholder resource set it was built on.

## 2026-07-28 — Superseded: tripled cube lattice for canonical corner and edge identity

**Superseded 2026-07-29 by the rulebook alignment refactor** — see `docs/RULEBOOK_ALIGNMENT.md`.

**Context:** A board corner is shared by up to three hexes and an edge by up to two.
Identifying a corner as `{ hex, cornerIndex }` would let each touching hex mint a different
id for the same physical point, producing duplicate vertices and edges. Deriving pixel
positions and comparing them would introduce floating-point equality, which is not
acceptable for authoritative identity.

**Decision:** Store hex centres on a **tripled cube lattice** — `(3q, -3q - 3r, 3r)` — so
all six corners land on exact integer points of the same lattice. `VertexId` is the
`"x,y,z"` key of that point; `EdgeId` is its two endpoint `VertexId`s joined in
lexicographic order, making edge identity independent of endpoint order. Equality is plain
`===` on strings.

Corner points are always congruent to `(1,1,1)` or `(2,2,2)` modulo 3 while hex centres are
congruent to `(0,0,0)`, so the two never collide. That parity property also makes corner
adjacency an exact integer test: a difference matching any of the six corner offsets implies
a real edge, because offsets of the wrong parity always land on a non-corner point.

**Consequences:** Identity is deterministic, serializable, and free of floating-point
tolerance, and shared corners/edges deduplicate automatically across hexes (verified by
Euler's-formula tests on radius-1 and radius-2 clusters). Rendered pixel coordinates are a
separate presentation-layer concern and must be derived from these ids, never used as ids.
`getEdgeVertices` parses the id string, which is cheap but does mean edge endpoints are
recovered by parsing rather than stored structurally.

## 2026-07-28 — Seeded random source lives in the domain, not infrastructure

**Context:** `CLAUDE.md` says gameplay randomness must use a seeded random service at
`src/game/infrastructure/random`. But board generation is domain logic, and
`docs/ARCHITECTURE.md` forbids `domain/` from importing any other layer — so putting the
generator in `infrastructure/` would have forced a dependency-rule violation.

**Decision:** Put the pure generator at `src/game/domain/random/`. A seeded PRNG is
deterministic arithmetic with no I/O, no clock, and no browser API — exactly what domain
code is allowed to contain. The `infrastructure/random` slot is reserved for the genuinely
external part: obtaining a fresh seed at application start and persisting it.

**Consequences:** Domain generation stays self-contained and testable with no layer
violation. The `CLAUDE.md` rule still holds in spirit — `Math.random()` is never called in
domain logic — but the seeded service's location differs from the original wording.

## 2026-07-28 — Superseded: high production tokens placed constructively, not by rejection

**Superseded 2026-07-29 by the rulebook alignment refactor** — see `docs/RULEBOOK_ALIGNMENT.md`.

**Context:** The board must avoid adjacent 6/8 sectors. The obvious implementation is to
shuffle all 27 tokens and retry until validation passes. Measured on the standard board, a
uniform shuffle satisfies the rule only about 2% of the time, so a 25-attempt limit would
fail for most seeds.

**Decision:** Place the eight high-value tokens first, greedily, onto a mutually
non-adjacent subset of producing sectors, then distribute the remaining tokens over what is
left. Those remaining tokens are neither 6 nor 8, so they cannot break the rule. Retry is
still implemented and still validates with the same unrelaxed validator — it is now a
safety net rather than the primary mechanism.

**Consequences:** Generation succeeds on the first attempt for nearly every seed (measured
across 200 seeds: zero failures, mean 1.015 attempts, worst case 3). The generator and the
validator remain independent — the validator re-derives the adjacency check from scratch
rather than trusting the generator.

## 2026-07-28 — Superseded: the central star is marked by its sector type, not a separate flag

**Superseded 2026-07-29 by the rulebook alignment refactor** — see `docs/RULEBOOK_ALIGNMENT.md`.

**Context:** The board model called for a "central-star marker". A boolean field alongside
`type: 'centralStar'` would encode the same fact twice and could drift out of sync.

**Decision:** Treat `type === 'centralStar'` as the marker and expose an
`isCentralStarSector` helper. Validation independently enforces exactly one central star,
positioned at the origin and always visible.

**Consequences:** No duplicated derived state in serialized board data. Consumers must call
the helper (or compare the type) rather than reading a flag.

## 2026-07-28 — Superseded: `BoardTopology` as a derived index, not stored board state

**Superseded 2026-07-29 by the rulebook alignment refactor** — see `docs/RULEBOOK_ALIGNMENT.md`.

**Context:** Setup placement repeatedly asks which corners and edges exist, which corners
neighbour a corner, and which sectors touch a corner. Recomputing that from the 37 sectors
on every legality check is wasteful, but storing it on `Board` would duplicate derived
geometry in serialized state — something `docs/ARCHITECTURE.md` explicitly avoids.

**Decision:** Added `createBoardTopology(board)`, which builds the indexes once and returns
them separately. `Board` stays pure serializable content; the topology is a transient
derived view passed alongside it into placement functions.

**Consequences:** Save files never contain redundant geometry and can never disagree with
it. Callers must build the topology once per board and thread it through — placement
functions take `(state, topology, ...)` rather than `(state, board, ...)`.

## 2026-07-28 — Superseded: setup grants resources as a returned delta, not by mutating players

**Superseded 2026-07-29 by the rulebook alignment refactor** — see `docs/RULEBOOK_ALIGNMENT.md`.

**Context:** Completing a second setup pair awards starting resources. The setup module
could have taken the player list and returned updated `Player` objects.

**Decision:** `placeSetupRoute` returns an optional `SetupResourceGrant` — the player id and
a `ResourceInventory` delta — alongside the new setup state. Setup never holds or edits
`Player` objects.

**Consequences:** Setup stays focused on placement and remains testable without constructing
players. Whichever layer owns player state applies the delta; when bank supply limits arrive
they can be enforced at that application point rather than inside setup.

## 2026-07-28 — Setup validation short-circuits to a single error

**Context:** `createPlayer` (Milestone 2) collects every validation error in one pass. Setup
placement checks are sequentially dependent instead — occupancy is meaningless if the corner
is not on the board, and the distance rule is meaningless if the corner is occupied.

**Decision:** Setup validators return the first failing check as a single-element `errors`
array, still using the shared `DomainResult` shape. Ordering is: setup complete → expected
phase → active player → target legality.

**Consequences:** Callers handle one clear reason rather than a cascade of consequential
errors. The result shape stays consistent with the rest of the domain, so no second error
convention was introduced.

## 2026-07-29 — Superseded: default resource bank quantity: 19 per resource

**Superseded 2026-07-29 by the rulebook alignment refactor** — see `docs/RULEBOOK_ALIGNMENT.md`.

**Context:** Milestone 6 requires a finite, configurable resource bank, but the game
specification available to this milestone does not state an exact starting quantity per
resource.

**Decision:** Default `createResourceBank()` to 19 units of each of the five resources
(`alloy`, `plasma`, `cryonite`, `biofiber`, `quantumCore`), matching the conventional
physical-board-game bank size per resource type. The quantity is an explicit parameter, not
a hardcoded constant, so a later milestone or balance pass can override it without touching
the bank's shape.

**Consequences:** Shortage behavior (all-or-nothing per resource) is exercised by tests using
both the default and explicitly small quantities. If the eventual full specification calls
for a different number, only the default value needs to change — callers that already pass
their own quantity are unaffected.

## 2026-07-29 — Superseded: Void Marauder starts on the central star

**Superseded 2026-07-29 by the rulebook alignment refactor** — see `docs/RULEBOOK_ALIGNMENT.md`.

**Context:** Milestone 7 needs an explicit starting sector for the Void Marauder, and the
match model previously had no Marauder location at all.

**Decision:** `createMatchFromCompletedSetup` initializes `marauderCoordinate` to the board
origin `{ q: 0, r: 0 }` — the same coordinate the central star is always generated at (see
the "central star... at the origin" decision above). No separate configuration knob was
added since the origin is already the board's one fixed, unambiguous landmark.

**Consequences:** Every match starts with the Marauder occupying the central star, which
never itself produces (it isn't a producing sector type), so this has no production-blocking
effect until the Marauder is moved for the first time.

## 2026-07-29 — Superseded: a single eligible steal target is auto-selected, not chosen

**Superseded 2026-07-29 by the rulebook alignment refactor** — see `docs/RULEBOOK_ALIGNMENT.md`.

**Context:** After the Marauder moves, "exactly one eligible target" is a case the spec
explicitly allows either resolving automatically or requiring explicit selection, as long as
one approach is picked consistently.

**Decision:** `stealCrisisResource` requires the caller to pass a `targetId` in every case —
there is no implicit single-target auto-resolution inside the domain. `getEligibleStealTargets`
always returns the full eligible list (which may have exactly one entry); the caller (a future
application/UI layer) decides whether to skip a confirmation step when only one id is present.
This keeps `stealCrisisResource`'s validation uniform (it always checks `targetId` against
`eligibleTargetIds`) rather than adding a second calling convention for the one-target case.

**Consequences:** Callers with exactly one eligible target must still pass that id explicitly;
the domain never silently picks it on their behalf. Any "auto-confirm" UX is a presentation
concern layered on top of `getEligibleStealTargets`, not a domain-level shortcut.

## 2026-07-29 — Rulebook alignment: mechanics replaced rather than shimmed

**Context.** Milestones 1-8 implemented a plausible but incorrect rules model (resource hexes,
route networks, Outpost/Colony/Nexus tiers, a roaming blocker piece). The reference rules
differ structurally, not cosmetically.

**Decision.** Delete the incompatible modules and tests outright rather than keeping
compatibility aliases or alternative default rules.

**Rationale.** A compatibility layer would have preserved two contradictory rule sets in one
codebase, and the obsolete tests would have kept passing while asserting the wrong game. The
seeded RNG, `DomainResult` convention, branded ids, immutability discipline, and centralized
cost configuration were all correct and survive unchanged.

**Consequences.** Board geometry, generation, setup placement, routes, and crisis modules were
removed. See `docs/RULEBOOK_ALIGNMENT.md` for the full migration table.

## 2026-07-29 — Board topology is configuration, not generated content

**Context.** The reference beginner layout is published only as a diagram. No coordinate list,
adjacency table, or intersection numbering exists in the text.

**Decision.** Model the board as pure data supplied through `BoardConfiguration`, validated for
internal consistency but never generated or inferred.

**Rationale.** Generating a layout would have meant inventing rules content and then presenting
it as authoritative. Making it configuration keeps the fabrication out of the codebase and
isolates the gap to a documented input (`docs/RULEBOOK_GAPS.md` gaps 1-2).

**Consequences.** `createBeginnerMatch` fails with `MISSING_STARTING_PLACEMENT` rather than
placing a seat somewhere plausible. Tests use a deliberately small fixture board that exercises
the rules without pretending to reproduce the physical one.

## 2026-07-29 — Supply and Reserve are separate types

**Context.** The rules distinguish a face-up Supply from a face-down Reserve pile. The previous
model had one `ResourceBank`.

**Decision.** `ResourceSupply` holds per-resource counts; `ReservePile` holds an ordered card
list.

**Rationale.** A count-based store cannot represent "the next card", which the Reserve pile
requires. Keeping one type would have forced either a fake ordering or a hidden-information
leak. The split also makes the hidden/visible distinction explicit at the type level.

**Consequences.** Reserve draws return an explicit `ReserveDrawResult` carrying the next random
state, and events record only a drawn _count_.

## 2026-07-29 — A steal target holding no cards is rejected

**Context.** The rules say the active player chooses another player and draws a random card.
They do not say what happens when the chosen player holds nothing.

**Decision.** Exclude empty-handed opponents from `eligibleTargetIds` and reject them with
`INVALID_TARGET`. Provide `skipSteal` for when no opponent holds a card.

**Rationale.** The alternatives — a silent no-op, or a successful steal of nothing — would both
report success for an action that did not happen. This replaces the earlier auto-selection
decision, which assumed adjacency-limited targeting that no longer exists.

**Consequences.** Callers must handle a legitimately empty target list. Recorded as a
prompt-derived decision in `docs/RULEBOOK_ALIGNMENT.md`, not a rulebook rule.

## 2026-07-29 — Victory points are stored _and_ recomputable

**Context.** Scoring can be derived from board state, but Friendship Marker transfers move
points between players based on the physical victory-point track.

**Decision.** Keep `Player.victoryPoints` as stored state starting at 4, and provide
`getVictoryPointBreakdown` to recompute from structures plus explicitly passed awards.

**Rationale.** Pure derivation cannot express a marker that moves between players, and pure
storage drifts from the board. Awards that no implemented system grants yet are a required
argument defaulting to zero, so scoring never silently invents a source.

**Consequences.** The two can disagree until the Friendship Marker milestone lands; the stored
value is what `endTurn` checks against the 15-point target.
