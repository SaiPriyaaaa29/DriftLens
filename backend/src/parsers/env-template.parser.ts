import type { ExtractedFact } from '../models/types';
import type { IParser } from './parser.interface';

/**
 * Parses .env.example / .env.template / .env.sample files.
 * Extracts:
 *  - Environment variable names (keys only — values are intentionally blank/placeholder)
 *  Each key is stored as fact key "ENV-TEMPLATE:<KEY>" with value being whatever
 *  placeholder is present (may be empty string).
 */
export class EnvTemplateParser implements IParser {
  readonly name = 'env-template.parser';

  supports(filePath: string): boolean {
    const base = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
    return /^\.(env\.example|env\.template|env\.sample)$/i.test(base);
  }

  async parse(filePath: string, content: string): Promise<ExtractedFact[]> {
    try {
      const facts: ExtractedFact[] = [];
      const lines = content.split('\n');

      lines.forEach((raw, idx) => {
        const line = raw.trim();
        // Skip blank lines and comments
        if (!line || line.startsWith('#')) return;

        // KEY=VALUE  or  KEY= (empty)  or  KEY (bare, no =)
        const eqIdx = line.indexOf('=');
        const key = eqIdx >= 0 ? line.slice(0, eqIdx).trim() : line.trim();
        const value = eqIdx >= 0 ? line.slice(eqIdx + 1).trim() : '';

        // Only accept valid shell variable names
        if (/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
          facts.push({
            source: filePath,
            category: 'env-var',
            key: `ENV-TEMPLATE:${key}`,
            value,
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
