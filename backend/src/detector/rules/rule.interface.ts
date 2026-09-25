import type { Evidence, ExtractedFact } from '../../models/types';

/**
 * The output of a rule when it detects a contradiction.
 * Evidence lists all facts that are in conflict.
 */
export interface RuleViolation {
  evidence: Evidence[];
  explanation: string;
}

/**
 * Contract every contradiction-detection rule must satisfy.
 *
 * Rules:
 * - `check()` must never throw — return null if no violation is found.
 * - Rules are stateless; all context comes from the facts array.
 */
export interface IRule {
  /** Unique identifier for the rule, e.g. "node-version-mismatch" */
  readonly id: string;
  /** Short human-readable title shown in findings */
  readonly title: string;

  /**
   * Examines the full set of extracted facts and returns a violation
   * if a contradiction is detected, or null if everything is consistent.
   */
  check(facts: ExtractedFact[]): RuleViolation | null;
}
