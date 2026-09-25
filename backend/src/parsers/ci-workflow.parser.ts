import yaml from 'js-yaml';
import type { ExtractedFact } from '../models/types';
import type { IParser } from './parser.interface';

/** Minimal shape we care about in a GitHub Actions workflow file */
interface Workflow {
  jobs?: Record<string, Job>;
}

interface Job {
  steps?: Step[];
  strategy?: {
    matrix?: {
      'node-version'?: (string | number)[];
      [key: string]: unknown;
    };
  };
}

interface Step {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

/**
 * Parses GitHub Actions workflow files (.github/workflows/*.yml / *.yaml).
 * Extracts:
 *  - node-version matrix values (runtime-version)
 *  - actions/setup-node `with.node-version` (runtime-version)
 *  - install commands in `run:` steps (install-command)
 */
export class CiWorkflowParser implements IParser {
  readonly name = 'ci-workflow.parser';

  supports(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return (
      /\.github\/workflows\/.+\.ya?ml$/i.test(normalized)
    );
  }

  async parse(filePath: string, content: string): Promise<ExtractedFact[]> {
    try {
      const workflow = yaml.load(content) as Workflow;
      if (!workflow || typeof workflow !== 'object') return [];

      const facts: ExtractedFact[] = [];
      const installRe = /\b(npm\s+(?:install|ci)|yarn(?:\s+install)?|pnpm\s+install)\b/i;

      for (const job of Object.values(workflow.jobs ?? {})) {
        // Matrix node versions
        const matrixVersions = job.strategy?.matrix?.['node-version'];
        if (Array.isArray(matrixVersions)) {
          for (const v of matrixVersions) {
            facts.push({
              source: filePath,
              category: 'runtime-version',
              key: 'node-version',
              value: String(v),
            });
          }
        }

        // Steps
        for (const step of job.steps ?? []) {
          // setup-node action
          if (
            typeof step.uses === 'string' &&
            step.uses.startsWith('actions/setup-node')
          ) {
            const nodeVersion = step.with?.['node-version'];
            if (nodeVersion !== undefined && nodeVersion !== null) {
              facts.push({
                source: filePath,
                category: 'runtime-version',
                key: 'node-version',
                value: String(nodeVersion),
              });
            }
          }

          // run: install command
          if (typeof step.run === 'string') {
            const m = installRe.exec(step.run);
            if (m) {
              facts.push({
                source: filePath,
                category: 'install-command',
                key: 'install-command',
                value: m[1].trim().replace(/\s+/g, ' '),
              });
            }
          }
        }
      }

      // Deduplicate node-version entries with the same value
      const seen = new Set<string>();
      return facts.filter((f) => {
        if (f.key !== 'node-version') return true;
        const k = `${f.source}:${f.key}:${f.value}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    } catch {
      return [];
    }
  }
}
