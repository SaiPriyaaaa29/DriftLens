import type { Finding } from '../models/types';

/** Result returned by the repair-plan generator. */
export interface RepairPlanResult {
  repairPlan: string;
  checklist: string[];
}

/** OpenAI-compatible chat completion response (minimal shape we use). */
interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/** Concrete fix advice per rule. Unknown rules get a generic fix. */
const RULE_FIXES: Record<string, { cause: string; fix: string }> = {
  'node-version-mismatch': {
    cause:
      'Different files declare different Node.js versions, so local, CI and Docker runs behave differently.',
    fix:
      'Choose one Node.js major version and set it everywhere: "engines" in package.json, an .nvmrc file, the Dockerfile base image (FROM node:<version>), the CI setup-node step, and the README prerequisites.',
  },
  'package-manager-conflict': {
    cause:
      'More than one package manager is implied, which corrupts lockfiles and produces inconsistent dependency trees.',
    fix:
      'Choose one package manager. Delete the other lockfiles, then update the README, Dockerfile and CI to use that manager only. Optionally add a "packageManager" field to package.json.',
  },
  'env-var-missing-from-template': {
    cause:
      'Variables used by the project are not documented in the .env template, so new developers do not know they are required.',
    fix:
      'Add each missing variable to .env.example (with a safe placeholder value and a short comment), and keep it in sync with the Dockerfile ENV lines.',
  },
  'install-command-mismatch': {
    cause:
      'The README and CI install dependencies differently, so local setups can diverge from CI.',
    fix:
      'Use the same install command in the README and CI. For reproducible installs, prefer the lockfile-strict form (for example "npm ci").',
  },
};

const GENERIC_FIX = {
  cause: 'Two or more repository files disagree about the same setting.',
  fix: 'Compare the files listed under evidence and make them agree, so one value is the single source of truth.',
};

/** Distinct evidence lines for a finding, capped for readability. */
function evidenceLines(finding: Finding, max = 6): string[] {
  const lines = new Set(
    finding.evidence.map((e) => `${e.source}: ${e.key} = ${e.value}`),
  );
  return [...lines].slice(0, max);
}

/**
 * Builds a deterministic repair plan and checklist from the findings.
 * Used when no LLM key is configured or the LLM call fails.
 */
function buildRuleBasedPlan(findings: Finding[]): RepairPlanResult {
  if (findings.length === 0) {
    return {
      repairPlan:
        '## Repair plan\n\nNo configuration drift was detected. Your setup files agree with each other.',
      checklist: [],
    };
  }

  const sorted = [...findings].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  );

  const sections = sorted.map((f, i) => {
    const rule = RULE_FIXES[f.ruleId] ?? GENERIC_FIX;
    const evidence = evidenceLines(f)
      .map((line) => `   - ${line}`)
      .join('\n');

    return (
      `### ${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\n\n` +
      `**Why it matters:** ${rule.cause}\n\n` +
      `**Fix:** ${rule.fix}\n\n` +
      `**Evidence:**\n${evidence}`
    );
  });

  const repairPlan =
    '## Rule-based repair plan\n\n' +
    'Fixes are ordered by severity, so start at the top.\n\n' +
    sections.join('\n\n');

  const checklist = [
    ...sorted.map((f) => `Resolve: ${f.title}`),
    'Install the single agreed Node.js version',
    'Install dependencies with the single agreed package manager',
    'Copy .env.example to .env and fill in every variable',
    'Run the build and tests from a clean checkout to confirm they pass',
  ];

  return { repairPlan, checklist };
}

/**
 * Builds a human-readable summary of the findings for the prompt.
 */
function buildFindingsSummary(findings: Finding[]): string {
  if (findings.length === 0) return 'No inconsistencies were detected.';
  return findings
    .map(
      (f, i) =>
        `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\n` +
        `   ${f.explanation}\n` +
        `   Evidence:\n` +
        f.evidence
          .map((e) => `     - ${e.source}: ${e.key} = ${e.value}`)
          .join('\n'),
    )
    .join('\n\n');
}

/**
 * Parses the LLM's Markdown response to extract a checklist section.
 * Returns the full Markdown and a string[] of checklist items.
 */
function parseResponse(markdown: string): RepairPlanResult {
  const checklistItems: string[] = [];

  // Look for a section starting with "Reproducibility Checklist" and grab
  // numbered or bulleted list items that follow it.
  const checklistSectionRe =
    /reproducibility checklist[\s\S]*?\n((?:\s*[-*\d]+[\.\)]\s*.+\n?)+)/i;
  const sectionMatch = checklistSectionRe.exec(markdown);
  if (sectionMatch) {
    const lines = sectionMatch[1].split('\n');
    for (const line of lines) {
      const item = line.replace(/^\s*[-*\d]+[\.\)]\s*/, '').trim();
      if (item) checklistItems.push(item);
    }
  }

  return { repairPlan: markdown, checklist: checklistItems };
}

/**
 * Generates a repair plan and reproducibility checklist from the findings.
 *
 * If LLM_API_KEY is set, an OpenAI-compatible LLM writes the plan.
 * Otherwise (or if the LLM call fails) a rule-based plan is returned.
 *
 * Configuration via environment variables:
 *   LLM_API_KEY   — optional; enables the AI-written plan
 *   LLM_BASE_URL  — optional; defaults to https://api.openai.com/v1
 *   LLM_MODEL     — optional; defaults to gpt-4o-mini
 */
export async function generateRepairPlan(
  findings: Finding[],
): Promise<RepairPlanResult> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return buildRuleBasedPlan(findings);

  const baseUrl =
    (process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL ?? 'gpt-4o-mini';

  const findingsSummary = buildFindingsSummary(findings);

  const prompt =
    `You are a senior DevOps engineer reviewing a repository configuration