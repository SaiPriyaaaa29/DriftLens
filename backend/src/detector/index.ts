import { v4 as uuidv4 } from 'uuid';
import type { ExtractedFact, Finding } from '../models/types';
import type { IRule } from './rules/rule.interface';
import { NodeVersionRule } from './rules/node-version.rule';
import { PackageManagerRule } from './rules/package-manager.rule';
import { EnvVarRule } from './rules/env-var.rule';
import { InstallCommandRule } from './rules/install-command.rule';
import { DependencyVersionRule } from './rules/dependency-version.rule';
import { classify } from '../classifier/index';

/** All registered contradiction rules — order does not affect results. */
const RULES: IRule[] = [
  new NodeVersionRule(),
  new PackageManagerRule(),
  new EnvVarRule(),
  new InstallCommandRule(),
  new DependencyVersionRule(),
];

/**
 * Runs all contradiction rules against a flat array of extracted facts
 * and returns the classified findings.
 */
export function detect(facts: ExtractedFact[]): Finding[] {
  const findings: Finding[] = [];

  for (const rule of RULES) {
    const violation = rule.check(facts);
    if (violation !== null) {
      findings.push(
        classify({
          id: uuidv4(),
          ruleId: rule.id,
          title: rule.title,
          violation,
        }),
      );
    }
  }

  return findings;
}
