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

## Current state (Foundation milestone)

Only the top-level layer folders exist so far (`src/game/domain`, `src/game/application`,
`src/game/infrastructure`, `src/game/presentation`) — no domain code has been written yet.

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
