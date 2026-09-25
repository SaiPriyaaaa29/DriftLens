import fs from 'fs/promises';
import path from 'path';
import type { ExtractedFact } from '../models/types';
import type { IParser } from '../parsers/parser.interface';
import { ReadmeParser } from '../parsers/readme.parser';
import { PackageJsonParser } from '../parsers/package-json.parser';
import { LockfileParser } from '../parsers/lockfile.parser';
import { DockerfileParser } from '../parsers/dockerfile.parser';
import { CiWorkflowParser } from '../parsers/ci-workflow.parser';
import { EnvTemplateParser } from '../parsers/env-template.parser';
import { resolveFiles } from './file-resolver';

/** All registered parsers — order does not matter. */
const PARSERS: IParser[] = [
  new ReadmeParser(),
  new PackageJsonParser(),
  new LockfileParser(),
  new DockerfileParser(),
  new CiWorkflowParser(),
  new EnvTemplateParser(),
];

export interface ScanResult {
  scannedFiles: string[];
  facts: ExtractedFact[];
}

/**
 * Scans a repository directory.
 *
 * This is the only layer that performs file I/O.
 * All parsers receive raw string content.
 *
 * @param repoPath - Absolute or relative path to the repository root
 */
export async function scanRepository(repoPath: string): Promise<ScanResult> {
  const absoluteRoot = path.resolve(repoPath);
  const relativeFiles = await resolveFiles(absoluteRoot);

  const allFacts: ExtractedFact[] = [];

  for (const relFile of relativeFiles) {
    const absFile = path.join(absoluteRoot, relFile);
    let content: string;
    try {
      content = await fs.readFile(absFile, 'utf-8');
    } catch {
      // Unreadable file — skip silently
      continue;
    }

    for (const parser of PARSERS) {
      if (parser.supports(relFile)) {
        const facts = await parser.parse(relFile, content);
        allFacts.push(...facts);
      }
    }
  }

  return {
    scannedFiles: relativeFiles,
    facts: allFacts,
  };
}
