import { glob } from 'glob';
import path from 'path';

/**
 * Patterns that match all files the parsers are interested in.
 * Uses glob syntax relative to the repo root.
 * Searches recursively through repository subdirectories.
 */
const SUPPORTED_PATTERNS = [
  '**/README.md',
  '**/README.rst',
  '**/README.txt',
  '**/package.json',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/Dockerfile',
  '**/Dockerfile.*',
  '**/.github/workflows/**/*.yml',
  '**/.github/workflows/**/*.yaml',
  '**/.env.example',
  '**/.env.template',
  '**/.env.sample',
];

/**
 * Directories that never describe the real project's environment:
 * dependencies, build output, tests, fixtures and examples.
 * Keep this list in sync with EXCLUDED_PATH in github-repository.ts.
 */
const IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'vendor',
  'test',
  'tests',
  '__tests__',
  'fixture',
  'fixtures',
  '__fixtures__',
  'example',
  'examples',
];

const IGNORE_GLOBS = IGNORED_DIRECTORIES.map((dir) => `**/${dir}/**`);

/**
 * Returns relative file paths (forward-slash separated) for all supported
 * files found under repoPath, sorted alphabetically.
 *
 * Paths are matched relative to repoPath, so a repository that itself lives
 * inside a "tests" folder (like the test fixtures) is still scanned.
 */
export async function resolveFiles(repoPath: string): Promise<string[]> {
  const absoluteRoot = path.resolve(repoPath);

  const results = await Promise.all(
    SUPPORTED_PATTERNS.map((pattern) =>
      glob(pattern, {
        cwd: absoluteRoot,
        dot: true,
        nodir: true,
        ignore: IGNORE_GLOBS,
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