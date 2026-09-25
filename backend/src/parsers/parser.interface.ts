import type { ExtractedFact } from '../models/types';

/**
 * Contract every parser must satisfy.
 *
 * Rules:
 * - `supports()` must return true for every file this parser can handle.
 * - `parse()` receives raw UTF-8 file content; it never performs file I/O.
 * - `parse()` must never throw — return [] on unparseable input.
 */
export interface IParser {
  /** Human-readable parser name, used in logs and error messages */
  readonly name: string;

  /**
   * Returns true if this parser can handle the given file path.
   * Matching is based on filename/extension patterns only.
   */
  supports(filePath: string): boolean;

  /**
   * Extracts configuration facts from the raw file content.
   *
   * @param filePath - The relative path of the file (used to populate `source` on facts)
   * @param content  - The full UTF-8 content of the file
   * @returns        Zero or more extracted facts; never throws
   */
  parse(filePath: string, content: string): Promise<ExtractedFact[]>;
}
