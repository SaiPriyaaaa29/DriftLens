import type { ExtractedFact } from '../../models/types';
import type { IRule, RuleViolation } from './rule.interface';

/**
 * R3 — env-var-missing-from-template
 *
 * Fires when the Dockerfile declares an ENV variable that is not present
 * in any .env.example / .env.template / .env.sample file in the repo.
 *
 * Dockerfile ENV facts have key === "ENV:<NAME>".
 * Template facts have key === "ENV-TEMPLATE:<NAME>".
 */
export class EnvVarRule implements IRule {
  readonly id = 'env-var-missing-from-template';
  readonly title = 'Dockerfile ENV variable missing from .env template';

  check(facts: ExtractedFact[]): RuleViolation | null {
    const dockerEnvFacts = facts.filter(
      (f) => f.category === 'env-var' && f.key.startsWith('ENV:'),
    );
    const templateFacts = facts.filter(
      (f) => f.category === 'env-var' && f.key.startsWith('ENV-TEMPLATE:'),
    );

    // Only fire if there is at least one template file present
    if (templateFacts.length === 0) return null;

    // Build a set of template key names (strip "ENV-TEMPLATE:" prefix)
    const templateKeys = new Set(
      templateFacts.map((f) => f.key.slice('ENV-TEMPLATE:'.length)),
    );

    // Find Dockerfile ENV keys not in the template
    const missing = dockerEnvFacts.filter((f) => {
      const varName = f.key.slice('ENV:'.length);
      return !templateKeys.has(varName);
    });

    if (missing.length === 0) return null;

    return {
      evidence: missing.map((f) => ({
        source: f.source,
        key: f.key,
        value: f.value,
        line: f.line,
      })),
      explanation:
        'One or more environment variables declared in the Dockerfile are not ' +
        'present in the .env template file. Developers cloning the repository ' +
        'will not know these variables are required, causing runtime failures.',
    };
  }
}
