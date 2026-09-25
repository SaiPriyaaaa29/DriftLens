# DriftLens

**Repository environment drift detector** — a developer-productivity tool that scans a local software repository, extracts configuration facts from multiple file types, detects contradictions between those facts, and presents findings through a clean web dashboard.

Built for the **IBM Bob 2.0 Hackathon**.

---

## The Problem

Software repositories routinely hold contradictory environment information spread across README files, `package.json`, lockfiles, Dockerfiles, CI workflow files and `.env` templates. These inconsistencies cause "works on my machine" failures, slow down onboarding, and erode trust in documentation. Manually auditing every file is tedious and error-prone.

## What DriftLens Does

1. **Scans** a local repository directory for supported configuration files.
2. **Extracts** structured facts: runtime versions, dependency information, environment variables, install commands, and CI configuration.
3. **Detects** contradictions between those facts using a rule-based engine.
4. **Classifies** each finding as Critical, Warning, or Informational with full evidence tracing.
5. **Generates** an AI-assisted repair plan and reproducibility checklist (when an LLM API key is configured).
6. **Displays** everything in a real-time web dashboard.

---

## Key Features

- **Six parsers** covering the files that matter most: README, `package.json`, lockfiles, Dockerfile, GitHub Actions workflows, and `.env` templates.
- **Five contradiction rules** that fire on real-world drift patterns.
- **Severity classification** (Critical / Warning / Info) with per-rule rationale.
- **Expandable evidence** — every finding links back to the exact source file and line.
- **Provider-agnostic AI repair plan** via any OpenAI-compatible LLM API; runs without it if no key is set.
- **Interactive reproducibility checklist** extracted from the AI response.
- **Zero persistent storage** — each analysis is stateless and returns a single JSON response.

---

## Architecture and Data Flow

```
User enters local repo path
         │
         ▼
POST /api/analyze
         │
    ┌────▼────┐
    │ Scanner │  ← only layer that does file I/O
    └────┬────┘
         │  ExtractedFact[]
    ┌────▼────────┐
    │   Parsers   │  README · package.json · lockfile · Dockerfile · CI · .env
    └────┬────────┘
         │  ExtractedFact[]
    ┌────▼──────────┐
    │   Detector    │  runs all IRule implementations
    └────┬──────────┘
         │  RuleViolation[]
    ┌────▼──────────┐
    │  Classifier   │  applies severity table → Finding[]
    └────┬──────────┘
         │  Finding[]
    ┌────▼──────────────┐
    │  AI Repair Plan   │  calls LLM API (optional) → repairPlan + checklist
    └────┬──────────────┘
         │  AnalysisResult
         ▼
    React Dashboard
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js 18+ |
| Backend framework | Express 4 + TypeScript 5 |
| YAML parsing | js-yaml |
| File globbing | glob |
| Frontend framework | React 18 + Vite 5 + TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Testing | Vitest 1 + Supertest |
| AI integration | Any OpenAI-compatible REST API |

---

## Project Structure

```
DriftLens/
├── backend/
│   ├── src/
│   │   ├── index.ts                    Express server entry point
│   │   ├── models/types.ts             All shared TypeScript interfaces
│   │   ├── parsers/                    Six IParser implementations
│   │   │   ├── parser.interface.ts
│   │   │   ├── readme.parser.ts
│   │   │   ├── package-json.parser.ts
│   │   │   ├── lockfile.parser.ts
│   │   │   ├── dockerfile.parser.ts
│   │   │   ├── ci-workflow.parser.ts
│   │   │   └── env-template.parser.ts
│   │   ├── scanner/
│   │   │   ├── file-resolver.ts        Globs supported files in a repo dir
│   │   │   └── index.ts                Orchestrates parsers; owns all file I/O
│   │   ├── detector/
│   │   │   ├── index.ts                Runs all rules, returns Finding[]
│   │   │   └── rules/                  Five IRule implementations
│   │   ├── classifier/index.ts         Maps rule IDs → Severity
│   │   ├── ai/repair-plan.ts           LLM caller + safe fallback
│   │   └── api/analyze.router.ts       POST /api/analyze
│   ├── tests/
│   │   ├── api/                        Supertest integration tests
│   │   ├── parsers/                    Parser unit tests (inline fixtures)
│   │   ├── detector/                   Rule unit tests (synthetic facts)
│   │   └── fixtures/                   Four synthetic drift scenario repos
│   ├── tsconfig.json                   Covers src/ + tests/ (typecheck + Vitest)
│   ├── tsconfig.build.json             Covers src/ only (npm run build)
│   └── vitest.config.ts
├── frontend/
│   ├── src/
│   │   ├── App.tsx                     Root layout + state machine
│   │   ├── api/analyze.ts              fetch wrapper for POST /api/analyze
│   │   ├── types/api.ts                Mirror of backend types
│   │   └── components/
│   │       ├── RepoInput.tsx           Path input + Analyze button
│   │       ├── FindingsList.tsx        Filter tabs + list
│   │       ├── FindingCard.tsx         Expandable finding with evidence
│   │       ├── RepairPlan.tsx          Markdown renderer for AI output
│   │       └── Checklist.tsx           Interactive reproducibility checklist
│   └── vite.config.ts                  Proxies /api → :3001
├── AGENTS.md                           AI agent guidance for this repo
├── driftlens-plan.md                   Approved implementation plan
└── README.md
```

---

## Setup and Installation

**Prerequisites:** Node.js ≥ 18, npm.

```bash
# 1. Clone the repository
git clone <repo-url>
cd DriftLens

# 2. Install backend dependencies
cd backend && npm install

# 3. Install frontend dependencies
cd ../frontend && npm install
```

---

## Running the Application

### Start the backend (terminal 1)

```bash
cd backend
npm run dev
# Server starts on http://localhost:3001
```

### Start the frontend (terminal 2)

```bash
cd frontend
npm run dev
# Dashboard opens at http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Analyzing a Repository

1. In the dashboard, enter the **absolute path** to a local repository directory.  
   Example: `C:\Users\you\projects\my-app` or `/home/you/projects/my-app`
2. Click **Analyze**.
3. DriftLens scans the directory, detects drift, and displays findings in seconds.

> **Note:** The repository must be accessible on the local filesystem. Remote Git URLs are not supported in this MVP.

---

## Supported File Types

| Parser | Files scanned | Extracts |
|---|---|---|
| README | `README.md`, `README.rst` | Node.js version mentions, install commands |
| package.json | `package.json` | `engines.node`, `engines.npm`, scripts, dependency versions |
| Lockfile | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` | Implied package manager, lockfile version |
| Dockerfile | `Dockerfile`, `Dockerfile.*` | `FROM` node version, `ENV` declarations, `RUN` install commands |
| CI Workflow | `.github/workflows/*.yml` | `node-version` matrix, `setup-node` action, install commands |
| .env template | `.env.example`, `.env.template`, `.env.sample` | Required environment variable names |

---

## Contradiction Rules and Severity

| Rule ID | Severity | Fires when… |
|---|---|---|
| `node-version-mismatch` | 🔴 Critical | Two or more sources declare different Node.js versions |
| `package-manager-conflict` | 🔴 Critical | Multiple package managers implied across sources (npm + yarn, etc.) |
| `lockfile-package-manager-mismatch` | 🔴 Critical | Lockfile format contradicts the package manager used in `package.json` scripts |
| `env-var-missing-from-template` | 🟡 Warning | Dockerfile `ENV` key not present in `.env.example` |
| `install-command-mismatch` | 🟡 Warning | README and CI workflow use different install commands |

Version normalisation: `18`, `18.x`, `v18`, and `18.0.0` are treated as the same version to avoid false positives.

---

## API Reference

### `GET /api/health`
Returns `{ "status": "ok" }`. Used to confirm the backend is running.

### `POST /api/analyze`

**Request body:**
```json
{ "repoPath": "/absolute/path/to/repo" }
```

**Success response (200):** `AnalysisResult`
```json
{
  "repoPath": "string",
  "scannedFiles": ["string"],
  "facts": [{ "source": "string", "category": "string", "key": "string", "value": "string", "line": 0 }],
  "findings": [{
    "id": "uuid",
    "ruleId": "string",
    "title": "string",
    "severity": "critical | warning | info",
    "evidence": [{ "source": "string", "key": "string", "value": "string", "line": 0 }],
    "explanation": "string"
  }],
  "repairPlan": "markdown string",
  "checklist": ["string"],
  "analysedAt": "ISO 8601 timestamp"
}
```

**Error responses:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{ "error": "repoPath is required" }` | Missing or empty `repoPath` |
| 422 | `{ "error": "Path does not exist or is not a directory" }` | Invalid path |
| 500 | `{ "error": "Analysis failed: <message>" }` | Unexpected error |

---

## AI Repair Plan

The repair plan is generated by calling an OpenAI-compatible LLM API with a structured prompt containing all detected findings.

**Configuration via environment variables** (set before starting the backend):

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_API_KEY` | Yes* | — | API key for the LLM provider |
| `LLM_BASE_URL` | No | `https://api.openai.com/v1` | Base URL for OpenAI-compatible endpoint |
| `LLM_MODEL` | No | `gpt-4o-mini` | Model name |

*If `LLM_API_KEY` is not set, DriftLens still performs the full analysis and returns:  
`"AI repair plan unavailable: LLM_API_KEY not configured."`

The analysis pipeline **never fails** due to an LLM error — the fallback message is always returned instead.

**Example `.env` for local development (backend/):**
```
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

---

## Testing and Verification

```bash
# Backend — all 132 tests across 13 test files
cd backend
npm test

# Backend — single file
npm test -- tests/parsers/readme.parser.test.ts

# Backend — type check
npm run typecheck

# Frontend — type check
cd frontend
npm run typecheck

# Frontend — production build
npm run build
```

**Test coverage:**

| Suite | Files | Tests |
|---|---|---|
| Parser unit tests | 6 | 81 |
| Detector rule unit tests | 5 | 41 |
| API integration tests | 2 | 11 |
| **Total** | **13** | **132** |

---

## IBM Bob's Role in Development

IBM Bob was the **core development workflow tool** throughout this project. Specifically:

| Phase | How Bob was used |
|---|---|
| **Planning** | Bob analyzed the requirements, proposed the architecture, identified the MVP scope, and produced the formal `driftlens-plan.md` |
| **Implementation** | Each sub-task was implemented as a Bob agent task, referencing the approved plan and existing interfaces |
| **Testing** | Bob wrote all unit tests with inline fixture strings and Supertest integration tests against the real Express app |
| **Debugging** | Bob diagnosed and fixed the Vitest module-resolution error (wrong relative import path depth) and a regex gap in the README parser |
| **Documentation** | Bob produced `AGENTS.md`, this `README.md`, and all inline JSDoc comments |

The application runtime itself has **no dependency on Bob IDE** — it runs as a standalone Node.js + React application on any machine.

---

## Known MVP Limitations

| Limitation | Notes |
|---|---|
| **Local paths only** | Remote Git URL cloning is not implemented |
| **No persistent storage** | Each analysis is stateless; results are not saved |
| **No authentication** | The API has no auth layer; intended for local developer use |
| **Shell script parsing** | Not implemented; `scripts/` or `.sh` files are not scanned |
| **No deep lockfile analysis** | Only the package manager and lockfile version are extracted, not individual pinned versions |
| **LLM checklist extraction** | Checklist items are only extracted when the LLM formats them under a "Reproducibility Checklist" heading |
| **No frontend tests** | React Testing Library integration deferred post-MVP |

---

## Future Improvements

- Remote Git repository support (clone via URL before scanning)
- Shell script parser for setup scripts
- Deep lockfile dependency version cross-referencing
- Python / Ruby / Go runtime version detection
- Persistent analysis history and diff between runs
- GitHub App / CI integration to comment on pull requests
- Export findings as SARIF or JSON report

---

## Demo Instructions

### Quick demo with a built-in drift fixture

```bash
# Terminal 1 — start backend
cd backend && npm run dev

# Terminal 2 — start frontend
cd frontend && npm run dev
```

1. Open **http://localhost:5173**
2. Paste the absolute path to `backend/tests/fixtures/fixture-node-mismatch`  
   *(e.g. `C:\Users\you\DriftLens\backend\tests\fixtures\fixture-node-mismatch`)*
3. Click **Analyze** — DriftLens will detect a **Critical** node version mismatch between README and Dockerfile.
4. Switch to `fixture-pkg-manager` — detects a **Critical** package manager conflict (`package-lock.json` + `yarn.lock`).
5. Switch to `fixture-env-drift` — detects a **Warning** for undocumented env vars.
6. Switch to `fixture-clean` — shows the green "No drift detected ✓" empty state.

### Demo with a real repository

Paste the path to any local Node.js project that has a README, Dockerfile, and CI workflows. DriftLens will scan the real files and report any genuine drift it finds.
