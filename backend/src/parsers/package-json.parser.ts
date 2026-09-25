import type { ExtractedFact } from '../models/types';
import type { IParser } from './parser.interface';

interface PackageJson {
  engines?: { node?: string; npm?: string };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Parses package.json files.
 * Extracts:
 *  - engines.node / engines.npm  (runtime-version)
 *  - install/start/build scripts (install-command)
 *  - direct + dev dependency versions (dependency)
 */
export class PackageJsonParser implements IParser {
  readonly name = 'package-json.parser';

  supports(filePath: string): boolean {
    const base = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
    return base === 'package.json';
  }

  async parse(filePath: string, content: string): Promise<ExtractedFact[]> {
    try {
      const pkg = JSON.parse(content) as PackageJson;
      const facts: ExtractedFact[] = [];

      // engines
      if (pkg.engines?.node) {
        facts.push({
          source: filePath,
          category: 'runtime-version',
          key: 'node-version',
          value: pkg.engines.node,
        });
      }
      if (pkg.engines?.npm) {
        facts.push({
          source: filePath,
          category: 'runtime-version',
          key: 'npm-version',
          value: pkg.engines.npm,
        });
      }

      // scripts: install, start, build
      const interestingScripts = ['install', 'start', 'build', 'ci'];
      for (const scriptName of interestingScripts) {
        const cmd = pkg.scripts?.[scriptName];
        if (cmd) {
          facts.push({
            source: filePath,
            category: 'install-command',
            key: `script:${scriptName}`,
            value: cmd,
          });
        }
      }

      // detect package manager implied by scripts
      const allScripts = Object.values(pkg.scripts ?? {}).join(' ');
      if (/\byarn\b/.test(allScripts)) {
        facts.push({
          source: filePath,
          category: 'install-command',
          key: 'package-manager',
          value: 'yarn',
        });
      } else if (/\bpnpm\b/.test(allScripts)) {
        facts.push({
          source: filePath,
          category: 'install-command',
          key: 'package-manager',
          value: 'pnpm',
        });
      }

      // dependencies
      const allDeps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };
      for (const [name, version] of Object.entries(allDeps)) {
        facts.push({
          source: filePath,
          category: 'dependency',
          key: `npm-package:${name}`,
          value: version,
        });
      }

      return facts;
    } catch {
      return [];
    }
  }
}
