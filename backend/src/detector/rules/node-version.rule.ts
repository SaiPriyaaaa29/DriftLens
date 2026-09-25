import type { ExtractedFact } from '../../models/types';
import type { IRule, RuleViolation } from './rule.interface';

/**
 * R1 — node-version-mismatch
 *
 * Fires when two or more sources declare different Node.js versions.
 * Collects all facts with key === "node-version", normalises the value
 * (strips ".x" suffix and leading "v"), then checks for distinct versions.
 */
export class NodeVersionRule implements IRule {
  readonly id = 'node-version-mismatch';
  readonly title = 'Node.js version mismatch across sources';

  check(facts: ExtractedFact[]): RuleViolation | null {
    const nodeFacts = facts.filter((f) => f.key === 'node-version');
    if (nodeFacts.length < 2) return null;

    // Normalise: strip leading "v", strip ".x" suffix, keep only major.minor.patch
    const normalise = (v: string) =>
      v.replace(/^v/, '').replace(/\.x$/i, '').split('-')[0];

    const distinctVersions = new Set(nodeFacts.map((f) => normalise(f.value)));
    if (distinctVersions.size < 2) return null;

    return {
      evidence: nodeFacts.map((f) => ({
        source: f.source,
        key: f.key,
        value: f.value,
        line: f.line,
      })),
      explanation:
        'Different Node.js versions are specified across repository files. ' +
        'This causes "works on my machine" failures because runtime behaviour ' +
        'differs between major versions.',
    };
  }
}
