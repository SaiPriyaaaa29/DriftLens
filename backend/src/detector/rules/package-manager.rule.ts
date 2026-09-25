import type { ExtractedFact } from '../../models/types';
import type { IRule, RuleViolation } from './rule.interface';

/**
 * R2 — package-manager-conflict
 *
 * Fires when more than one package manager is implied across sources.
 * Sources: lockfiles (package-lock.json → npm, yarn.lock → yarn,
 * pnpm-lock.yaml → pnpm), package.json scripts, README, CI workflows.
 * All emit facts with key === "package-manager".
 */
export class PackageManagerRule implements IRule {
  readonly id = 'package-manager-conflict';
  readonly title = 'Multiple package managers detected';

  check(facts: ExtractedFact[]): RuleViolation | null {
    const pmFacts = facts.filter((f) => f.key === 'package-manager');
    if (pmFacts.length < 2) return null;

    const distinctManagers = new Set(pmFacts.map((f) => f.value));
    if (distinctManagers.size < 2) return null;

    return {
      evidence: pmFacts.map((f) => ({
        source: f.source,
        key: f.key,
        value: f.value,
        line: f.line,
      })),
      explanation:
        'More than one package manager is implied by repository files. ' +
        'Mixing npm, yarn, and pnpm corrupts lockfiles and produces ' +
        'inconsistent dependency trees across environments.',
    };
  }
}
