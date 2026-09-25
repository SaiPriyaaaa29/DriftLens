import type { ExtractedFact } from '../models/types';
import type { IParser } from './parser.interface';

/**
 * Parses lockfiles: package-lock.json, yarn.lock, pnpm-lock.yaml.
 * Extracts:
 *  - Which package manager is implied by the lockfile (install-command key: "package-manager")
 *  - lockfileVersion from package-lock.json (ci-config)
 *  - yarn lockfile version from header comment (ci-config)
 */
export class LockfileParser implements IParser {
  readonly name = 'lockfile.parser';

  supports(filePath: string): boolean {
    const base = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
    return (
      base === 'package-lock.json' ||
      base === 'yarn.lock' ||
      base === 'pnpm-lock.yaml'
    );
  }

  async parse(filePath: string, content: string): Promise<ExtractedFact[]> {
    try {
      const base = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
      const facts: ExtractedFact[] = [];

      if (base === 'package-lock.json') {
        facts.push({
          source: filePath,
          category: 'install-command',
          key: 'package-manager',
          value: 'npm',
        });
        // Extract lockfileVersion
        try {
          const parsed = JSON.parse(content) as { lockfileVersion?: number };
          if (typeof parsed.lockfileVersion === 'number') {
            facts.push({
              source: filePath,
              category: 'ci-config',
              key: 'lockfile-version',
              value: String(parsed.lockfileVersion),
            });
          }
        } catch {
          // not valid JSON — still emit the package-manager fact
        }
      } else if (base === 'yarn.lock') {
        facts.push({
          source: filePath,
          category: 'install-command',
          key: 'package-manager',
          value: 'yarn',
        });
        // Yarn Berry (v2+) has "__metadata:\n  version: N" at the top
        const berryMatch = /^__metadata:\s*\n\s*version:\s*(\d+)/m.exec(content);
        if (berryMatch) {
          facts.push({
            source: filePath,
            category: 'ci-config',
            key: 'lockfile-version',
            value: `yarn-berry-${berryMatch[1]}`,
          });
        } else {
          // Classic yarn v1 has "# yarn lockfile v1" header
          const classicMatch = /^#\s*yarn lockfile v(\d+)/m.exec(content);
          if (classicMatch) {
            facts.push({
              source: filePath,
              category: 'ci-config',
              key: 'lockfile-version',
              value: `yarn-classic-${classicMatch[1]}`,
            });
          }
        }
      } else if (base === 'pnpm-lock.yaml') {
        facts.push({
          source: filePath,
          category: 'install-command',
          key: 'package-manager',
          value: 'pnpm',
        });
        // pnpm-lock.yaml starts with "lockfileVersion: '6.0'" or "lockfileVersion: 5.4"
        const pnpmMatch = /^lockfileVersion:\s*['"]?([^'"\s]+)['"]?/m.exec(content);
        if (pnpmMatch) {
          facts.push({
            source: filePath,
            category: 'ci-config',
            key: 'lockfile-version',
            value: pnpmMatch[1],
          });
        }
      }

      return facts;
    } catch {
      return [];
    }
  }
}
