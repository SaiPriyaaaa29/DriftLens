/** Mirror of backend/src/models/types.ts — keep in sync manually. */

export type FactCategory =
  | 'runtime-version'
  | 'dependency'
  | 'env-var'
  | 'install-command'
  | 'ci-config';

export type Severity = 'critical' | 'warning' | 'info';

export interface ExtractedFact {
  source: string;
  category: FactCategory;
  key: string;
  value: string;
  line?: number;
}

export interface Evidence {
  source: string;
  key: string;
  value: string;
  line?: number;
}

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  evidence: Evidence[];
  explanation: string;
}

export interface AnalysisResult {
  repoPath: string;
  scannedFiles: string[];
  facts: ExtractedFact[];
  findings: Finding[];
  repairPlan: string;
  checklist: string[];
  analysedAt: string;
}
