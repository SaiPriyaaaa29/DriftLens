import type { ExtractedFact } from '../models/types';
import type { IParser } from './parser.interface';

/**
 * Parses README.md / README.rst files.
 * Extracts:
 *  - Node.js / Python version mentions (runtime-version)
 *  - Install commands from code blocks (install-command)
 */
export class ReadmeParser implements IParser {
  readonly name = 'readme.parser';

  supports(filePath: string): boolean {
    const base = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
    return /^README\.(md|rst|txt)$/i.test(base);
  }

  async parse(filePath: string, content: string): Promise<ExtractedFact[]> {
    try {
      const facts: ExtractedFact[] = [];
      const lines = content.split('\n');

      // Version patterns: "Node.js 20", "node >= 18", "node: 18.x", "nodejs 20.x"
      const nodeVersionRe =
        /node(?:\.js)?(?:\s+version)?\s*[><=:~^]*\s*v?(\d+(?:\.\d+)*(?:\.x)?)/gi;
      // Install command patterns inside code blocks or inline
      const installRe = /(?:^[\s`$>]*|\s`|\s)(npm\s+(?:install|ci)|yarn(?:\s+install)?|pnpm\s+install)\b/i;

      lines.forEach((line, idx) => {
        // Node version
        let match: RegExpExecArray | null;
        const re = new RegExp(nodeVersionRe.source, 'gi');
        while ((match = re.exec(line)) !== null) {
          facts.push({
            source: filePath,
            category: 'runtime-version',
            key: 'node-version',
            value: match[1],
            line: idx + 1,
          });
        }

        // Install commands
        const installMatch = installRe.exec(line);
        if (installMatch) {
          facts.push({
            source: filePath,
            category: 'install-command',
            key: 'install-command',
            value: installMatch[1].trim().replace(/\s+/g, ' '),
            line: idx + 1,
          });
        }
      });

      // Deduplicate node-version facts with the same value
      const seen = new Set<string>();
      return facts.filter((f) => {
        if (f.key !== 'node-version') return true;
        const k = `${f.key}:${f.value}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    } catch {
      return [];
    }
  }
}
