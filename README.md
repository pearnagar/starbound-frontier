# Starbound Frontier

An original digital space-strategy board game for Web and PC.

This repository contains the **pure gameplay domain plus the application shell**. The domain
implements resources, the board model, pieces and structures, beginner setup, turn flow,
production, the roll of 7, supply trading, construction, and scoring. Ship movement,
encounters, friendship cards, AI, persistence, and the full UI are not implemented yet.

The board topology is supplied as configuration rather than generated, so there is no playable
default board yet — see [docs/RULEBOOK_GAPS.md](docs/RULEBOOK_GAPS.md).

See [docs/GAME_RULES.md](docs/GAME_RULES.md) for the rules as implemented,
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the milestone roadmap, and
[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for current status.

## Stack

- React 19 + TypeScript + Vite
- Zustand (state), PixiJS (rendering), Zod (validation), Howler.js (audio), idb (storage)
- Vitest + React Testing Library (unit/component tests)
- Playwright (end-to-end smoke tests)
- ESLint + Prettier (code quality)

## Getting started

```bash
npm install
npm run dev
```

The dev server prints a local URL to open in your browser.

## Scripts

| Script                  | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | Start the Vite dev server                      |
| `npm run build`         | Type-check and build for production            |
| `npm run preview`       | Preview the production build locally           |
| `npm run typecheck`     | Type-check the project without emitting output |
| `npm run lint`          | Run ESLint                                     |
| `npm run lint:fix`      | Run ESLint with autofix                        |
| `npm run format`        | Format the codebase with Prettier              |
| `npm run format:check`  | Check formatting without writing changes       |
| `npm run test`          | Run Vitest in watch mode                       |
| `npm run test:run`      | Run Vitest once                                |
| `npm run test:coverage` | Run Vitest once with coverage                  |
| `npm run test:e2e`      | Run Playwright end-to-end tests                |

## Project structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the layering
(domain / application / infrastructure / presentation) and the full planned folder tree.

## Documentation

| Document                                              | Contents                                     |
| ----------------------------------------------------- | -------------------------------------------- |
| [GAME_RULES.md](docs/GAME_RULES.md)                   | The rules as implemented                     |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)               | Layering and domain design                   |
| [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Milestone roadmap                            |
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md)           | What is built and verified                   |
| [DECISIONS.md](docs/DECISIONS.md)                     | Design decision log                          |
| [RULEBOOK_ALIGNMENT.md](docs/RULEBOOK_ALIGNMENT.md)   | Rules migration record                       |
| [RULEBOOK_GAPS.md](docs/RULEBOOK_GAPS.md)             | Unresolved rules questions, never guessed at |

## Path aliases

`@/*`, `@app/*`, `@game/*`, `@components/*`, `@assets/*` all resolve to their matching
folders under `src/`, and work identically in TypeScript, Vite, and Vitest.
