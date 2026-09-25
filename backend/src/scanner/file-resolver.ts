import { glob } from 'glob';
import path from 'path';

/**
 * Patterns that match all files the parsers are interested in.
 * Uses glob syntax relative to the repo root.
 */
const SUPPORTED_PATTERNS = [
  'README.md',
  'README.rst',
  'README.txt',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Dockerfile',
  'Dockerfile.*',
  '.github/workflows/*.yml',
  '.github/workflows/*.yaml',
  '.env.example',
  '.env.template',
  '.env.sample',
];

/**
 * Returns relative file paths (forward-slash separated) for all supported
 * files found under `repoPath`, sorted alphabetically.
 *
 * Ignores node_modules and .git directories.
 */
export async function resolveFiles(repoPath: string): Promise<string[]> {
  const absoluteRoot = path.resolve(repoPath);

  const results = await Promise.all(
    SUPPORTED_PATTERNS.map((pattern) =>
      glob(pattern, {
        cwd: absoluteRoot,
        dot: true,           // match dotfiles like .env.example
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
      }),
    ),
  );

  // Flatten, deduplicate, sort
  const seen = new Set<string>();
  const files: string[] = [];
  for (const batch of results) {
    for (const f of batch) {
      const normalized = f.replace(/\\/g, '/');
      if (!seen.has(normalized)) {
        seen.add(normalized);
        files.push(normalized);
      }
    }
  }
  files.sort();
  return files;
}
