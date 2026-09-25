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

const FALLBACK_NO_KEY: RepairPlanResult = {
  repairPlan: 'AI repair plan unavailable: LLM_API_KEY not configured.',
  checklist: [],
};

const FALLBACK_ERROR = (msg: string): RepairPlanResult => ({
  repairPlan: `AI repair plan unavailable: LLM call failed (${msg}).`,
  checklist: [],
});

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
 * Calls an OpenAI-compatible LLM API to generate a repair plan and
 * reproducibility checklist from the detected findings.
 *
 * Configuration via environment variables:
 *   LLM_API_KEY   — required; if absent, returns static fallback
 *   LLM_BASE_URL  — optional; defaults to https://api.openai.com/v1
 *   LLM_MODEL     — optional; defaults to gpt-4o-mini
 */
export async function generateRepairPlan(
  findings: Finding[],
): Promise<RepairPlanResult> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return FALLBACK_NO_KEY;

  const baseUrl =
    (process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL ?? 'gpt-4o-mini';

  const findingsSummary = buildFindingsSummary(findings);

  const prompt =
    `You are a senior DevOps engineer reviewing a repository configuration audit.\n\n` +
    `The following inconsistencies were detected:\n\n` +
    `${findingsSummary}\n\n` +
    `For each issue:\n` +
    `1. Explain the root cause in one sentence.\n` +
    `2. Provide the exact file edit(s) needed to resolve it.\n` +
    `3. Indicate which fix should be done first (priority order).\n\n` +
    `Then produce a "Reproducibility Checklist" — a numbered list of steps any developer\n` +
    `must follow to get a working local environment from a clean checkout of this repository.\n\n` +
    `Respond in Markdown.`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      return FALLBACK_ERROR(`HTTP ${response.status}: ${text}`);
    }

    const data = (await response.json()) as ChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return FALLBACK_ERROR('empty response from LLM');

    return parseResponse(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return FALLBACK_ERROR(msg);
  }
}
