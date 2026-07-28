# Project Status

_Last updated: 2026-07-28_

## Current milestone

Milestone 2 — Domain model: **complete and verified**. (Milestone 1 — Foundation: complete
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

## Current blockers

None. Global git identity (`user.name`/`user.email`) is not configured on this machine, but
this is informational only since no commit was attempted:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## Next milestone

Milestone 3 — Board geometry. No board/hex-coordinate code exists yet.

## Last verification commands

Run from `C:\Users\pearn\Desktop\Catan\Starbound Frontier`, all passing (most recently after
Milestone 2):

```bash
npm run typecheck     # tsc -b — clean
npm run lint          # eslint . — clean
npm run format:check  # prettier --check . — clean
npm run test:run      # vitest run — 35/35 passed (6 files)
npm run build         # tsc -b && vite build — succeeded
npm run test:coverage # vitest run --coverage — 35/35 passed, ~97% statements on domain code
```

`npm run test:e2e` was **not** re-run this milestone — no application/UI behavior changed
(the domain model isn't wired into the app yet), so no new end-to-end verification was
needed. It was last run and passed (1/1) during Milestone 1, against the production preview
build.

Dev server (`npm run dev`) started and verified in-browser during Milestone 1: page text,
console messages (info/debug only, no errors), and viewport checks at 1366×768 and
1920×1080 (no horizontal overflow) all confirmed.
