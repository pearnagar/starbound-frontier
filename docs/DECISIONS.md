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

## 2026-07-28 — `cachedVictoryPoints` is explicitly a cache, not authoritative state

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
