/**
 * Category of an extracted configuration fact.
 */
export type FactCategory =
  | 'runtime-version'
  | 'dependency'
  | 'env-var'
  | 'install-command'
  | 'ci-config';

/**
 * Finding severity level.
 */
export type Severity = 'critical' | 'warning' | 'info';

/**
 * A single piece of information extracted from a repository file by a parser.
 */
export interface ExtractedFact {
  /** Relative file path, e.g. "Dockerfile", "package.json", ".github/workflows/ci.yml" */
  source: string;
  category: FactCategory;
  /** Logical key, e.g. "node-version", "npm-package:react", "ENV:DATABASE_URL" */
  key: string;
  /** The raw extracted value as a string */
  value: string;
  /** Source line number (1-based) for evidence tracing, if available */
  line?: number;
}

/**
 * A single piece of evidence cited inside a Finding.
 */
export interface Evidence {
  /** File name or relative path */
  source: string;
  key: string;
  value: string;
  line?: number;
}

/**
 * A detected configuration drift, produced by the contradiction detector.
 */
export interface Finding {
  /** UUID assigned at detection time */
  id: string;
  /** Identifier of the rule that produced this finding, e.g. "node-version-mismatch" */
  ruleId: string;
  /** Short human-readable description */
  title: string;
  severity: Severity;
  /** All facts involved in the contradiction */
  evidence: Evidence[];
  /** One-paragraph explanation of why this is a problem */
  explanation: string;
}

/**
 * The complete response shape returned by POST /api/analyze.
 */
export interface AnalysisResult {
  repoPath: string;
  scannedFiles: string[];
  facts: ExtractedFact[];
  findings: Finding[];
  /** Markdown string from the AI repair-plan generator */
  repairPlan: string;
  /** Ordered list of reproducibility checklist items */
  checklist: string[];
  /** ISO 8601 timestamp of when the analysis ran */
  analysedAt: string;
}
