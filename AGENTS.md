# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project

DriftLens — a repository environment drift analysis tool.  
Monorepo with two independent packages: `backend/` (Node.js + Express + TypeScript) and `frontend/` (React + Vite + TypeScript).

## Commands

All commands must be run from within the relevant subdirectory.

```bash
# Backend
cd backend
npm install
npm run typecheck          # tsc --noEmit — run before every commit
npm test                   # vitest run (all tests)
npm test -- tests/parsers/readme.parser.test.ts   # single test file
npm run dev                # ts-node-dev server on :3001

# Frontend
cd frontend
npm install
npm run typecheck          # tsc --noEmit
npm run dev                # Vite dev server on :5173 (proxies /api → :3001)
npm run build              # production build — must pass before submitting
```

## Critical Architecture Conventions

- **File I/O only in the scanner.** Parsers (`IParser.parse`) receive raw `string` content and never read files. This is what makes them unit-testable with inline fixtures.
- **Rules and parsers never throw.** Both must return `null` / `[]` on bad input — never propagate exceptions.
- **`NODE_ENV=test` suppresses `app.listen()`** in `src/index.ts`. Supertest imports the app directly.
- **All shared backend types live in `backend/src/models/types.ts`.** Do not redeclare `Finding`, `ExtractedFact`, etc. anywhere else in the backend.
- **Frontend mirrors backend types** in `frontend/src/types/api.ts` — keep in sync manually (no codegen for MVP).
- **Vite proxies `/api/*` → `http://localhost:3001`** in dev. Never hardcode the backend URL in frontend fetch calls.

## Test Import Paths

Test files at `backend/tests/parsers/` and `backend/tests/detector/` import source with `../../src/…`  
Test files at `backend/tests/api/` import source with `../../src/…`  
(Two levels up from `tests/<subdir>/` reaches `backend/`, then into `src/`.)

## Extension Points

**Add a parser:** implement `IParser` in `backend/src/parsers/`, register in `backend/src/scanner/index.ts`.  
**Add a rule:** implement `IRule` in `backend/src/detector/rules/`, register in `backend/src/detector/index.ts`, add severity entry to `backend/src/classifier/index.ts`.

## Fixture Repos for Tests

`backend/tests/fixtures/` contains four synthetic directories:

| Directory | Drift present |
|---|---|
| `fixture-clean` | None — all sources consistent |
| `fixture-node-mismatch` | README: Node 18, Dockerfile: Node 20 |
| `fixture-pkg-manager` | Both `package-lock.json` and `yarn.lock` present |
| `fixture-env-drift` | Dockerfile `ENV SECRET_KEY=` missing from `.env.example` |

## AI Repair Plan (runtime)

Set these env vars before starting the backend dev server to enable the LLM feature:

```bash
LLM_API_KEY=<your-key>         # required — any OpenAI-compatible key
LLM_BASE_URL=https://...       # optional — defaults to https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini          # optional — defaults to gpt-4o-mini
```

If `LLM_API_KEY` is absent the pipeline still completes; `repairPlan` contains a static fallback message.

## Build Config Split

- `backend/tsconfig.json` — covers `src/` + `tests/` (used by `tsc --noEmit` and Vitest)
- `backend/tsconfig.build.json` — covers `src/` only with `rootDir`/`outDir` (used by `npm run build`)
