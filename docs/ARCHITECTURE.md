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

`src/game/domain/` contains the pure domain model (`types/`) and board geometry (`board/`).
`application/`, `infrastructure/`, and `presentation/` are still empty layer folders.

## Board geometry

`src/game/domain/board/` holds coordinate math and stable identities only — no board shape,
generation, sector types, placement, or rendering.

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
