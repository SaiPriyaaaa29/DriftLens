import type { ExtractedFact } from '../models/types';
import type { IParser } from './parser.interface';

/**
 * Parses Dockerfile and Dockerfile.* files.
 * Extracts:
 *  - FROM base image Node version (runtime-version, key: "node-version")
 *  - ENV declarations (env-var)
 *  - RUN install commands (install-command)
 */
export class DockerfileParser implements IParser {
  readonly name = 'dockerfile.parser';

  supports(filePath: string): boolean {
    const base = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
    return /^Dockerfile(\..+)?$/i.test(base);
  }

  async parse(filePath: string, content: string): Promise<ExtractedFact[]> {
    try {
      const facts: ExtractedFact[] = [];
      const lines = content.split('\n');

      // Matches: FROM node:18, FROM node:18-alpine, FROM node:18.12.0-slim
      const fromNodeRe = /^\s*FROM\s+(?:\S+\/)?node:(\d+(?:\.\d+)*(?:-\S+)?)/i;
      // ENV KEY=VALUE  or  ENV KEY VALUE
      const envEqRe = /^\s*ENV\s+([A-Z_][A-Z0-9_]*)=(\S*)/i;
      const envSpaceRe = /^\s*ENV\s+([A-Z_][A-Z0-9_]*)\s+(\S+)/i;
      // RUN lines that contain install commands
      const runInstallRe = /^\s*RUN\s+.*(npm\s+(?:install|ci)|yarn(?:\s+install)?|pnpm\s+install)/i;

      lines.forEach((line, idx) => {
        const fromMatch = fromNodeRe.exec(line);
        if (fromMatch) {
          // Normalise "18-alpine" → "18"
          const raw = fromMatch[1];
          const version = raw.split('-')[0];
          facts.push({
            source: filePath,
            category: 'runtime-version',
            key: 'node-version',
            value: version,
            line: idx + 1,
          });
        }

        const envEqMatch = envEqRe.exec(line);
        if (envEqMatch) {
          facts.push({
            source: filePath,
            category: 'env-var',
            key: `ENV:${envEqMatch[1]}`,
            value: envEqMatch[2] || '',
            line: idx + 1,
          });
          return;
        }
        const envSpaceMatch = envSpaceRe.exec(line);
        if (envSpaceMatch) {
          facts.push({
            source: filePath,
            category: 'env-var',
            key: `ENV:${envSpaceMatch[1]}`,
            value: envSpaceMatch[2],
            line: idx + 1,
          });
          return;
        }

        const runMatch = runInstallRe.exec(line);
        if (runMatch) {
          facts.push({
            source: filePath,
            category: 'install-command',
            key: 'install-command',
            value: runMatch[1].trim().replace(/\s+/g, ' '),
            line: idx + 1,
          });
        }
      });

      return facts;
    } catch {
      return [];
    }
  }
}
