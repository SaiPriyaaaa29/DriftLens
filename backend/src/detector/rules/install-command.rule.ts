import type { ExtractedFact } from '../../models/types';
import type { IRule, RuleViolation } from './rule.interface';

/** Canonical package-manager implied by an install command string */
function managerFromCommand(cmd: string): 'npm' | 'yarn' | 'pnpm' | null {
  const c = cmd.toLowerCase().trim();
  if (c.startsWith('pnpm')) return 'pnpm';
  if (c.startsWith('yarn')) return 'yarn';
  if (c.startsWith('npm')) return 'npm';
  return null;
}

/**
 * R4 — install-command-mismatch
 *
 * Fires when install commands found in README code blocks and CI workflow
 * steps imply different package managers, OR when npm install vs npm ci
 * are mixed between README and CI (informational).
 *
 * Facts involved: key === "install-command", sources README.md and
 * .github/workflows/*.yml.
 */
export class InstallCommandRule implements IRule {
  readonly id = 'install-command-mismatch';
  readonly title = 'Install command inconsistency between README and CI';

  check(facts: ExtractedFact[]): RuleViolation | null {
    const installFacts = facts.filter((f) => f.key === 'install-command');
    if (installFacts.length < 2) return null;

    // Separate README facts from CI facts
    const readmeFacts = installFacts.filter((f) =>
      /readme/i.test(f.source),
    );
    const ciFacts = installFacts.filter((f) =>
      /\.github[/\\]workflows/i.test(f.source),
    );

    if (readmeFacts.length === 0 || ciFacts.length === 0) return null;

    // Check for package-manager divergence OR npm install vs npm ci
    const conflicting: ExtractedFact[] = [];

    for (const readme of readmeFacts) {
      for (const ci of ciFacts) {
        const readmeMgr = managerFromCommand(readme.value);
        const ciMgr = managerFromCommand(ci.value);

        const differentManager =
          readmeMgr !== null && ciMgr !== null && readmeMgr !== ciMgr;

        const npmInstallVsCi =
          readme.value.toLowerCase().includes('npm install') &&
          ci.value.toLowerCase().includes('npm ci');

        if (differentManager || npmInstallVsCi) {
          if (!conflicting.includes(readme)) conflicting.push(readme);
          if (!conflicting.includes(ci)) conflicting.push(ci);
        }
      }
    }

    if (conflicting.length === 0) return null;

    return {
      evidence: conflicting.map((f) => ({
        source: f.source,
        key: f.key,
        value: f.value,
        line: f.line,
      })),
      explanation:
        'The install command documented in the README differs from the command ' +
        'used in CI. This means the local developer setup may install different ' +
        'dependency versions or use a different package manager than CI.',
    };
  }
}
