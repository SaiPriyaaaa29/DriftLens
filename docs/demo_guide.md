# DriftLens Demo Guide

## Demo Repository

DriftLens includes a demonstration repository containing intentionally inconsistent configuration.

Demo fixture:

```text
backend/tests/fixtures/fixture-demo
Running the Demo

Start the DriftLens application and enter the demo fixture path.

Click:

Analyze

Expected Result

The demo fixture currently produces:

7 files scanned
5 findings
3 critical findings
2 warning findings
Detected Issues
1. Node.js Version Mismatch

Different Node.js versions are specified across repository files.

Severity: Critical

2. Multiple Package Managers

The repository contains conflicting package-manager signals.

Severity: Critical

3. Lockfile Package Manager Mismatch

The package manager indicated by package.json conflicts with the lockfile.

Severity: Critical

4. Missing Environment Variables

Environment variables declared in the Dockerfile are missing from the environment template.

Severity: Warning

5. Installation Command Mismatch

The README and CI configuration specify different installation commands.

Severity: Warning

Dashboard

The DriftLens dashboard allows users to:

View all findings
Filter by severity
Expand findings
Inspect supporting evidence
View the AI repair-plan area
Test Verification

The final backend test suite contains:

167 passing tests across 15 test files.
