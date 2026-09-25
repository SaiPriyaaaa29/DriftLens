import type { Finding, Severity } from '../models/types';
import type { RuleViolation } from '../detector/rules/rule.interface';

/** Input to the classifier: a rule identity plus its violation payload. */
export interface ClassifyInput {
  id: string;
  ruleId: string;
  title: string;
  violation: RuleViolation;
}

/**
 * Severity table — every rule has a fixed default severity.
 * Add new rules here when they are registered in the detector.
 */
const SEVERITY_MAP: Record<string, Severity> = {
  'node-version-mismatch': 'critical',
  'package-manager-conflict': 'critical',
  'env-var-missing-from-template': 'warning',
  'install-command-mismatch': 'warning',
  'lockfile-package-manager-mismatch': 'critical',
  'node-engines-lockfile-mismatch': 'info',
};

const DEFAULT_SEVERITY: Severity = 'info';

/**
 * Converts a rule violation into a fully-formed Finding by applying the
 * severity table. Unknown rule IDs fall back to "info".
 */
export function classify(input: ClassifyInput): Finding {
  const severity = SEVERITY_MAP[input.ruleId] ?? DEFAULT_SEVERITY;
  return {
    id: input.id,
    ruleId: input.ruleId,
    title: input.title,
    severity,
    evidence: input.violation.evidence,
    explanation: input.violation.explanation,
  };
}
