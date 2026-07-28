# CLAUDE.md — Permanent Project Instructions

This is an **original** digital space-strategy board game. No commercial board-game names,
artwork, logos, or copied rules may be used at any point in this project.

## Architecture

- Gameplay logic (`src/game/domain`) must stay separate from React and PixiJS. Domain code
  must not import from `react`, `pixi.js`, or browser-only APIs.
- Strict TypeScript is required project-wide. Do not weaken `tsconfig` strictness to silence
  errors — resolve the underlying type issue instead.
- Gameplay randomness must use a seeded random service (`src/game/infrastructure/random`,
  once it exists). Direct use of `Math.random()` in domain logic is prohibited.
- Gameplay actions will require centralized validation once the action system exists —
  do not scatter ad hoc validation across UI components.

## Process

- Work proceeds **one milestone at a time** (see `docs/IMPLEMENTATION_PLAN.md`). Do not
  jump ahead to implement systems from a later milestone.
- Tests must run after each milestone before it is considered done.
- No fake buttons, no misleading completion claims, no unverified statements. Report only
  what was actually run and verified.
- Claude must not run `git push`.
- Claude must not rewrite Git history (no `rebase -i`, no forced history rewrites, no
  `commit --amend` on already-shared commits).
