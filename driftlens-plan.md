# DriftLens — Implementation Plan

## Overview

DriftLens is a developer-productivity tool that scans a software repository, extracts
environment/configuration facts from multiple source files, detects contradictions between
those facts, classifies findings by severity, and produces an AI-assisted repair plan and
reproducibility checklist — all presented through a clean web dashboard.

**Stack:** Node.js + TypeScript (backend) · React + Vite + TypeScript (frontend)  
**AI:** LLM API (provider-agnostic; switchable via env var) used at runtime for repair-plan generation  
**IBM Bob:** Core workflow tool for planning, implementation, debugging, testing, and documentation  
**Scope of MVP:** Local repository analysis only; modular design allows remote Git and new parsers later  

---

## 1. Project Folder Structure

```
driftlens/
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Express server entry point
│   │   ├── api/
│   │   │   └── analyze.router.ts     # POST /api/analyze route
│   │   ├── scanner/
│   │   │   ├── index.ts              # Orchestrates all parsers for a given repo path
│   │   │   └── file-resolver.ts      # Discovers supported files in a repo directory
│   │   ├── parsers/
│   │   │   ├── parser.interface.ts   # IParser contract
│   │   │   ├── readme.parser.ts
│   │   │   ├── package-json.parser.ts
│   │   │   ├── lockfile.parser.ts    # package-lock.json / yarn.lock / pnpm-lock.yaml
│   │   │   ├── dockerfile.parser.ts
│   │   │   ├── ci-workflow.parser.ts # .github/workflows/*.yml
│   │   │   └── env-template.parser.ts# .env.example / .env.template
│   │   ├── detector/
│   │   │   ├── index.ts              # Runs all contradiction rules, returns Finding[]
│   │   │   └── rules/
│   │   │       ├── rule.interface.ts # IRule contract
│   │   │       ├── node-version.rule.ts
│   │   │       ├── package-manager.rule.ts
│   │   │       ├── env-var.rule.ts
│   │   │       ├── install-command.rule.ts
│   │   │       └── dependency-version.rule.ts
│   │   ├── classifier/
│   │   │   └── index.ts              # Maps rule violations → Critical / Warning / Info
│   │   ├── ai/
│   │   │   └── repair-plan.ts        # Calls LLM API; returns repair plan + checklist
│   │   ├── models/
│   │   │   └── types.ts              # All shared TypeScript interfaces
│   │   └── utils/
│   │       └── file-utils.ts         # Safe file read, YAML parse, glob helpers
│   ├── tests/
│   │   ├── parsers/
│   │   ├── detector/
│   │   └── api/
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/
│   │   │   └── analyze.ts            # fetch wrapper for POST /api/analyze
│   │   ├── components/
│   │   │   ├── RepoInput.tsx         # Local path input + Analyze button
│   │   │   ├── FindingsList.tsx      # Severity-filtered findings list
│   │   │   ├── FindingCard.tsx       # Single finding: title, evidence, severity badge
│   │   │   ├── RepairPlan.tsx        # Markdown render of AI-generated repair plan
│   │   │   └── Checklist.tsx        # Reproducibility checklist with checkboxes
│   │   ├── types/
│   │   │   └── api.ts                # Mirror of backend response types
│   │   └── styles/
│   │       └── index.css             # Tailwind base
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── AGENTS.md                         # Bob agent guidance for this repo
└── driftlens-plan.md                 # This file
```

---

## 2. Data Models / Interfaces

File: `backend/src/models/types.ts`

### ExtractedFact
Represents a single piece of information extracted by any parser.

```
ExtractedFact {
  source:   string       // e.g. "Dockerfile", "package.json", ".github/workflows/ci.yml"
  category: FactCategory // "runtime-version" | "dependency" | "env-var" | "install-command" | "ci-config"
  key:      string       // e.g. "node-version", "npm-package:react", "ENV:DATABASE_URL"
  value:    string       // The raw extracted value
  line?:    number       // Source line number for evidence tracing
}
```

### FactCategory (enum/union)
`"runtime-version" | "dependency" | "env-var" | "install-command" | "ci-config"`

### Finding
The output of the contradiction detector for one detected drift.

```
Finding {
  id:         string        // uuid
  ruleId:     string        // e.g. "node-version-mismatch"
  title:      string        // Short human description
  severity:   Severity      // "critical" | "warning" | "info"
  evidence:   Evidence[]    // All facts involved in the contradiction
  explanation: string       // Why this is a problem
}
```

### Evidence
```
Evidence {
  source: string  // File name
  key:    string  // Fact key
  value:  string  // Fact value
  line?:  number
}
```

### Severity
`"critical" | "warning" | "info"`

### AnalysisResult (API response shape)
```
AnalysisResult {
  repoPath:    string
  scannedFiles: string[]
  facts:       ExtractedFact[]
  findings:    Finding[]
  repairPlan:  string    // Markdown from LLM
  checklist:   string[]  // Array of checklist item strings
  analysedAt:  string    // ISO timestamp
}
```

---

## 3. Parser Design

### Contract: `IParser`
```
interface IParser {
  name: string
  supports(filePath: string): boolean
  parse(filePath: string, content: string): Promise<ExtractedFact[]>
}
```

Each parser:
- Declares which files it handles via `supports()` (pattern match on filename/extension)
- Receives the **raw file content** as a string (the scanner owns file I/O)
- Returns zero or more `ExtractedFact` objects
- Must not throw — return `[]` on unparseable input

### Parser Responsibilities

| Parser | Files | Extracts |
|---|---|---|
| `readme.parser` | `README.md`, `README.rst` | Node/Python/runtime version badges, install commands, setup steps |
| `package-json.parser` | `package.json` | `engines.node`, `engines.npm`, dependency versions, scripts (install, start, build) |
| `lockfile.parser` | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` | Lock file format (which package manager), lockfileVersion |
| `dockerfile.parser` | `Dockerfile`, `Dockerfile.*` | `FROM` base image and tag (Node version), `RUN` install commands, `ENV` declarations |
| `ci-workflow.parser` | `.github/workflows/*.yml` | `node-version` matrix values, OS matrix, install commands (npm ci, yarn install) |
| `env-template.parser` | `.env.example`, `.env.template`, `.env.sample` | Required environment variable names (keys only) |

### Extraction Strategy by File Type

**README.md:** Regex patterns for version badges (`node >= 18`, `Node.js 20.x`) and code-block commands (`npm install`, `yarn`, `pnpm install`).

**package.json:** JSON parse; read `engines`, `dependencies`, `devDependencies`, `scripts`.

**Lockfiles:** Detect format from filename. Read `lockfileVersion` from `package-lock.json`. For yarn.lock, detect version from header comment. Treat the package manager implied by each lockfile as a fact.

**Dockerfile:** Line-by-line regex: `FROM node:(\d+)`, `ENV KEY=VALUE`, `RUN <command>`.

**CI Workflow:** YAML parse; traverse `jobs[*].steps[*]`, `jobs[*].strategy.matrix.node-version[]`, `uses: actions/setup-node` `with.node-version`.

**.env.example:** Line-by-line: extract `KEY=` names (values are intentionally blank or placeholder).

---

## 4. Scanner

File: `backend/src/scanner/index.ts`

The scanner:
1. Accepts a `repoPath: string` (absolute local path)
2. Uses `file-resolver.ts` to glob-discover all supported files under that path
3. Reads each file (UTF-8)
4. Routes each file to the appropriate parser(s) via `supports()`
5. Aggregates all returned `ExtractedFact[]` into one flat array
6. Returns `{ scannedFiles: string[], facts: ExtractedFact[] }`

The scanner is the only layer that performs file I/O. Parsers are pure string → facts transformers, making them trivially testable.

---

## 5. Contradiction Detection Rules

File: `backend/src/detector/rules/`

### Contract: `IRule`
```
interface IRule {
  id:      string
  title:   string
  check(facts: ExtractedFact[]): RuleViolation | null
}

interface RuleViolation {
  evidence:    Evidence[]
  explanation: string
}
```

### Rule Definitions

**R1 — `node-version-mismatch`**  
Collect all facts with `key === "node-version"`. If two or more have different values, fire.  
Example: README says `18`, Dockerfile says `20`, CI matrix has `[18, 20, 22]`.

**R2 — `package-manager-conflict`**  
Detect which package manager is implied by each source:  
- `package-lock.json` present → npm  
- `yarn.lock` present → yarn  
- `pnpm-lock.yaml` present → pnpm  
- `package.json` scripts use `yarn` / `pnpm` commands  
- README install commands  
- CI workflow install commands  
If more than one package manager is found across sources, fire.

**R3 — `env-var-missing-from-template`**  
Compare env var names found in Dockerfile `ENV` statements against names in `.env.example`. Any `ENV` key not present in the template fires as a potential undocumented required variable.

**R4 — `install-command-mismatch`**  
Compare the install commands found in README code blocks vs CI workflow steps. If README says `npm install` but CI runs `npm ci`, flag as informational inconsistency.

**R5 — `lockfile-package-manager-mismatch`**  
If `package.json` `scripts` reference `yarn` but a `package-lock.json` is present (or vice versa), fire.

**R6 — `node-engines-lockfile-mismatch`** *(stretch goal — add if time allows)*  
`package.json` `engines.node` specifies a range; CI matrix tests versions outside that range.

---

## 6. Severity Classification

File: `backend/src/classifier/index.ts`

Classification is rule-driven, not heuristic. Each rule carries a default severity; the classifier applies it:

| Rule ID | Default Severity | Rationale |
|---|---|---|
| `node-version-mismatch` | **Critical** | Different Node versions can cause silent runtime failures |
| `package-manager-conflict` | **Critical** | Mixing package managers corrupts lockfiles |
| `env-var-missing-from-template` | **Warning** | App may fail at runtime on a fresh checkout |
| `install-command-mismatch` | **Warning** | CI may install differently from local dev setup |
| `lockfile-package-manager-mismatch` | **Critical** | Will fail on clean install |
| `node-engines-lockfile-mismatch` | **Info** | Untested versions — may work, may not |

The classifier function signature:
```
classify(violations: RuleViolation[], ruleId: string): Finding
```

---

## 7. API Endpoints

File: `backend/src/api/analyze.router.ts`

### `POST /api/analyze`

**Request body:**
```json
{ "repoPath": "/absolute/or/relative/path/to/repo" }
```

**Response (200):** `AnalysisResult` JSON (see Data Models section)

**Response (400):** `{ "error": "repoPath is required" }`

**Response (422):** `{ "error": "Path does not exist or is not a directory" }`

**Response (500):** `{ "error": "Analysis failed: <message>" }`

The endpoint:
1. Validates `repoPath` exists and is a directory
2. Calls scanner → returns facts + scanned files
3. Calls detector → returns rule violations
4. Calls classifier → returns findings
5. Calls AI repair-plan generator (non-blocking failure: if LLM call fails, returns empty repair plan with `error` note)
6. Returns `AnalysisResult`

### `GET /api/health`
Returns `{ "status": "ok" }`. Used by frontend to confirm backend is running.

---

## 8. AI Repair-Plan Generation

File: `backend/src/ai/repair-plan.ts`

### Approach
- The backend calls an LLM API (configurable provider via `LLM_API_KEY` and `LLM_BASE_URL` env vars)
- The function constructs a structured prompt from the `Finding[]` array
- The LLM response is returned as-is (Markdown string)

### Prompt Template
```
You are a senior DevOps engineer reviewing a repository configuration audit.

The following inconsistencies were detected:

{{findings_summary}}

For each issue:
1. Explain the root cause in one sentence.
2. Provide the exact file edit(s) needed to resolve it.
3. Indicate which fix should be done first (priority order).

Then produce a "Reproducibility Checklist" — a numbered list of steps any developer
must follow to get a working local environment from a clean checkout of this repository.

Respond in Markdown.
```

### Failure Handling
- If `LLM_API_KEY` is not set, skip the LLM call and return a static message:  
  `"AI repair plan unavailable: LLM_API_KEY not configured."`
- If the API call times out or returns an error, return the static fallback — never crash the analysis pipeline.

### Provider Flexibility
The `repair-plan.ts` module accepts a provider config object. For the MVP, one concrete provider is implemented (OpenAI-compatible endpoint). Adding a new provider means implementing the same interface and switching via env var.

---

## 9. Frontend Modules

### `RepoInput.tsx`
- Text input for local repo path
- "Analyze" button triggers `POST /api/analyze`
- Shows loading spinner during request
- Shows inline error if API returns non-200

### `FindingsList.tsx`
- Receives `Finding[]`
- Severity filter tabs: All / Critical / Warning / Info
- Renders `FindingCard` per finding
- Shows empty state if no findings ("No drift detected ✓")

### `FindingCard.tsx`
- Severity badge (color-coded: red/yellow/blue)
- Finding title
- Expandable evidence list (source file → value pairs)
- Explanation text

### `RepairPlan.tsx`
- Renders the LLM-generated Markdown as formatted HTML
- Uses a lightweight Markdown renderer (e.g., `marked`)
- Falls back gracefully if `repairPlan` is the static fallback message

### `Checklist.tsx`
- Renders `checklist[]` string array as interactive checkboxes
- State is local (no persistence needed for MVP)

### `App.tsx` Layout
```
Header (DriftLens logo + subtitle)
  RepoInput
  [on results:]
    Summary bar: N files scanned · N findings (X critical, Y warning, Z info)
    Two-column layout:
      Left:  FindingsList
      Right: RepairPlan + Checklist
```

---

## 10. Testing Strategy

### Backend Unit Tests (Vitest)

**Parser tests** — `tests/parsers/`  
Each parser gets a test file with fixture inputs (inline strings representing real file contents) and assertions on the returned `ExtractedFact[]`. No file system access in parser tests.

**Detector rule tests** — `tests/detector/`  
Each rule gets a test file. Tests pass synthetic `ExtractedFact[]` arrays and assert whether a `RuleViolation` is returned and what evidence it contains.

**API integration tests** — `tests/api/`  
Uses Supertest against the Express app. Tests:
- `POST /api/analyze` with a fixture repo directory (small directory created in `tests/fixtures/`)
- Returns correct shape
- Returns 422 for nonexistent path
- Returns 400 for missing body

### Frontend Tests
- Not in MVP scope; Vitest + React Testing Library can be added post-MVP

### Test Commands
```bash
# Backend
cd backend && npm test              # run all tests
cd backend && npm test -- --reporter=verbose  # verbose output
cd backend && npm test -- tests/parsers/readme.parser.test.ts  # single test file

# Run with coverage
cd backend && npm run test:coverage
```

### Fixture Repositories
`tests/fixtures/` contains small synthetic repo directories:
- `fixture-clean/` — no drift, all consistent
- `fixture-node-mismatch/` — README says Node 18, Dockerfile says Node 20
- `fixture-pkg-manager/` — both `package-lock.json` and `yarn.lock` present
- `fixture-env-drift/` — Dockerfile has `ENV SECRET_KEY=` but `.env.example` does not

---

## 11. Bob Tasks During Development

The following are the IBM Bob workflow tasks to execute at each development phase.

| Phase | Bob Task | Purpose |
|---|---|---|
| **Setup** | Ask Bob to scaffold the monorepo folder structure, `tsconfig.json`, and `package.json` files | Avoids boilerplate errors |
| **Parsers** | Ask Bob to implement each parser one at a time, referencing `parser.interface.ts` | Keeps implementations consistent |
| **Detector** | Ask Bob to implement each rule referencing `rule.interface.ts` and the data model | Ensures rule contract is followed |
| **Tests** | Ask Bob to generate unit tests for each parser and rule using the fixture strings | Drives test coverage |
| **API** | Ask Bob to implement `analyze.router.ts` and wire up the Express server | Ensures error handling matches spec |
| **Frontend** | Ask Bob to build each React component referencing the `AnalysisResult` type | Keeps type alignment |
| **Integration** | Ask Bob to debug any type or contract mismatches between backend and frontend types | Catches drift in the codebase itself |
| **Docs** | Ask Bob to generate `AGENTS.md`, inline JSDoc comments, and a final README | Produces demo-ready documentation |
| **Demo prep** | Ask Bob to create a fixture repo with realistic drift scenarios for the demo | Makes the demo compelling |

---

## 12. MVP Implementation Order

Each sub-task below is designed to be given to Bob as an independent implementation unit.

### Sub-Task 1 — Project Scaffolding
**Status:** `[x] done`

**Intent:** Establish the monorepo skeleton with correct TypeScript configs, package managers, and scripts so all subsequent sub-tasks compile cleanly.

**Expected Outcomes:**
- `backend/` and `frontend/` directories exist with working `npm install`
- `tsc --noEmit` passes with zero errors on empty source files
- `npm test` runs (passes trivially) in backend
- `npm run dev` starts Vite dev server in frontend

**Todo:**
1. Create `backend/package.json` with deps: `express`, `js-yaml`, `glob`, `uuid`; devDeps: `typescript`, `vitest`, `supertest`, `@types/*`
2. Create `backend/tsconfig.json` (strict mode, `outDir: dist`, `rootDir: src`)
3. Create `backend/vitest.config.ts`
4. Create `backend/src/index.ts` (minimal Express app, health endpoint)
5. Create `frontend/package.json` with deps: `react`, `react-dom`, `marked`; devDeps: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `typescript`
6. Create `frontend/vite.config.ts` with proxy: `"/api" → "http://localhost:3001"`
7. Create `frontend/tailwind.config.ts`
8. Create `frontend/src/main.tsx` and `App.tsx` stubs
9. Create `AGENTS.md` with build/test commands

---

### Sub-Task 2 — Data Models
**Status:** `[x] done`

**Intent:** Define all shared TypeScript interfaces in one place so parsers, detector, classifier, and API all share the same contract.

**Expected Outcomes:**
- `backend/src/models/types.ts` exports all interfaces
- No other file defines its own versions of these types

**Todo:**
1. Implement `ExtractedFact`, `FactCategory`, `Finding`, `Evidence`, `Severity`, `AnalysisResult` as specified in Section 2
2. Implement `IParser` interface in `backend/src/parsers/parser.interface.ts`
3. Implement `IRule` and `RuleViolation` in `backend/src/detector/rules/rule.interface.ts`

---

### Sub-Task 3 — Parsers
**Status:** `[x] done`

**Intent:** Implement all six parsers. Each must satisfy `IParser` and be independently testable.

**Expected Outcomes:**
- All six parsers implemented and exported
- Unit tests pass for each parser using fixture strings

**Todo:**
1. Implement `readme.parser.ts`
2. Implement `package-json.parser.ts`
3. Implement `lockfile.parser.ts`
4. Implement `dockerfile.parser.ts`
5. Implement `ci-workflow.parser.ts` (uses `js-yaml`)
6. Implement `env-template.parser.ts`
7. Implement `file-resolver.ts` and `scanner/index.ts`
8. Write unit tests for each parser

---

### Sub-Task 4 — Contradiction Detector
**Status:** `[x] done`

**Intent:** Implement the five contradiction rules and the detector orchestrator.

**Expected Outcomes:**
- `detector/index.ts` accepts `ExtractedFact[]` and returns `Finding[]`
- Each rule has passing unit tests with synthetic fact arrays

**Todo:**
1. Implement rules R1–R5 as specified in Section 5
2. Implement `detector/index.ts` (runs all rules, collects non-null violations)
3. Implement `classifier/index.ts` (applies severity from the table in Section 6)
4. Write unit tests for each rule

---

### Sub-Task 5 — REST API
**Status:** `[x] done`

**Intent:** Wire the scanner, detector, classifier, and AI module into an Express route.

**Expected Outcomes:**
- `POST /api/analyze` returns `AnalysisResult` for a valid fixture repo path
- Error responses match the spec in Section 7
- Supertest integration tests pass

**Todo:**
1. Implement `ai/repair-plan.ts` with LLM call + fallback
2. Implement `api/analyze.router.ts`
3. Register router in `src/index.ts`
4. Create `tests/fixtures/` directories with synthetic repos
5. Write Supertest integration tests

---

### Sub-Task 6 — Frontend Dashboard
**Status:** `[x] done`

**Intent:** Build the React dashboard that calls the API and renders findings.

**Expected Outcomes:**
- `npm run dev` shows the dashboard
- Entering a valid local path and clicking Analyze shows findings
- Severity filter tabs work
- Repair plan panel renders Markdown

**Todo:**
1. Implement `api/analyze.ts` fetch wrapper
2. Implement `RepoInput.tsx`
3. Implement `FindingCard.tsx` and `FindingsList.tsx`
4. Implement `RepairPlan.tsx` (with `marked`)
5. Implement `Checklist.tsx`
6. Compose `App.tsx` layout
7. Apply Tailwind styles: severity color tokens (red/yellow/blue)

---

### Sub-Task 7 — AGENTS.md + Documentation
**Status:** `[x] done`

**Intent:** Produce the `AGENTS.md` file and a final `README.md` so the repo is demo-ready and Bob can navigate it efficiently.

**Expected Outcomes:**
- `AGENTS.md` has all build/test commands and non-obvious project conventions
- `README.md` has setup instructions, architecture summary, and a screenshot placeholder

**Todo:**
1. Write `AGENTS.md` (project-specific build commands, parser/rule extension guide)
2. Write `README.md` (setup, usage, architecture overview, Bob workflow notes)
3. Review all JSDoc coverage on public-facing functions

---

### Sub-Task 8 — Demo Fixture & End-to-End Smoke Test
**Status:** `[x] done`

**Intent:** Create a realistic demo fixture repository and verify the full pipeline end-to-end.

**Expected Outcomes:**
- Running DriftLens against the demo fixture produces at least 3 findings across all three severity levels
- The repair plan is non-empty
- The checklist has at least 5 items

**Todo:**
1. Create `tests/fixtures/fixture-demo/` with a realistic multi-file repo exhibiting Node version mismatch, package manager conflict, and env var drift
2. Run `POST /api/analyze` against it manually and review output
3. Capture screenshot of dashboard for README
