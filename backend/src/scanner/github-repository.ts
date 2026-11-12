import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const CLONE_TIMEOUT_MS = 90_000;
const MAX_SUPPORTED_FILES = 80;
const MAX_TOTAL_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TREE_OUTPUT = 20 * 1024 * 1024;
const MAX_COMMAND_OUTPUT = 1024 * 1024;

// Stops git background work that can keep Windows file locks alive.
const GIT_SAFE_FLAGS = [
  '-c',
  'gc.auto=0',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'maintenance.auto=false',
];

const SUPPORTED_FILE_PATTERNS = [
  /(^|\/)README\.(md|rst|txt)$/,
  /(^|\/)package\.json$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)Dockerfile(?:\..*)?$/,
  /(^|\/)\.github\/workflows\/.+\.(yml|yaml)$/,
  /(^|\/)\.env\.(example|template|sample)$/,
];

/**
 * Validates a public GitHub repository URL.
 */
function validateGitHubUrl(repoUrl: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(repoUrl.trim());
  } catch {
    throw new Error('Please enter a valid GitHub repository URL.');
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== 'github.com' ||
    parsedUrl.username !== '' ||
    parsedUrl.password !== '' ||
    parsedUrl.port !== '' ||
    parsedUrl.search !== '' ||
    parsedUrl.hash !== ''
  ) {
    throw new Error('Only public GitHub repository URLs are supported.');
  }

  const match = /^\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(
    parsedUrl.pathname,
  );

  if (!match) {
    throw new Error(
      'Invalid repository URL. Use https://github.com/owner/repository',
    );
  }

  const [, owner, repository] = match;

  return `https://github.com/${owner}/${repository}.git`;
}

/**
 * Runs a Git command with a timeout and output limit.
 */
async function runGit(
  args: string[],
  maxBuffer = MAX_COMMAND_OUTPUT,
): Promise<string> {
  const { stdout } = await execFileAsync('git', [...GIT_SAFE_FLAGS, ...args], {
    timeout: CLONE_TIMEOUT_MS,
    maxBuffer,
    windowsHide: true,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });

  return stdout;
}

/**
 * Checks whether a repository file is supported by DriftLens.
 */
function isSupportedFile(filePath: string): boolean {
  return SUPPORTED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Reads the Git tree and selects supported regular files.
 * Does NOT use `ls-tree -l`: listing sizes would make git download
 * every blob one by one (partial clone lazy fetch).
 */
async function selectSupportedFiles(repoPath: string): Promise<string[]> {
  const output = await runGit(
    ['-C', repoPath, 'ls-tree', '-r', '-z', 'HEAD'],
    MAX_TREE_OUTPUT,
  );

  const selectedFiles: string[] = [];

  for (const record of output.split('\0')) {
    if (!record) continue;

    const tabIndex = record.indexOf('\t');
    if (tabIndex === -1) continue;

    const [mode, objectType] = record.slice(0, tabIndex).split(/\s+/);
    const filePath = record.slice(tabIndex + 1);

    // Exclude symlinks, directories and submodules.
    if (!['100644', '100755'].includes(mode) || objectType !== 'blob') {
      continue;
    }

    if (!isSupportedFile(filePath)) continue;

    selectedFiles.push(filePath);

    if (selectedFiles.length > MAX_SUPPORTED_FILES) {
      throw new Error(
        `Repository exceeds the limit of ${MAX_SUPPORTED_FILES} supported files.`,
      );
    }
  }

  return selectedFiles;
}

/**
 * Escapes special characters in sparse-checkout patterns and anchors
 * the pattern to the repository root so only the exact path matches.
 */
function toSparsePattern(filePath: string): string {
  return '/' + filePath.replace(/([\\*?[\]])/g, '\\$1');
}

/**
 * Removes a temporary directory. Never throws: a locked folder
 * (e.g. Windows EBUSY) must not replace the API response.
 */
async function removeTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 300,
    });
  } catch (error) {
    console.warn('Temp cleanup failed, will be swept later:', error);
  }
}

/**
 * Downloads selected files from a public GitHub repository.
 *
 * Only supported configuration files are checked out.
 */
export async function downloadPublicGitHubRepository(
  repoUrl: string,
): Promise<{ repoPath: string; tempDir: string }> {
  const cloneUrl = validateGitHubUrl(repoUrl);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'driftlens-'));

  const repoPath = path.join(tempDir, 'repository');

  try {
    // Download Git metadata without checking out all file contents.
    await runGit([
      'clone',
      '--depth',
      '1',
      '--single-branch',
      '--no-tags',
      '--filter=blob:none',
      '--no-checkout',
      '--',
      cloneUrl,
      repoPath,
    ]);

    // Inspect the Git tree (names only) to pick supported files.
    const supportedFiles = await selectSupportedFiles(repoPath);

    if (supportedFiles.length === 0) {
      throw new Error(
        'Repository does not contain any supported configuration files.',
      );
    }

    // Check out only the files DriftLens can analyze.
    const sparsePatterns = supportedFiles.map(toSparsePattern);

    await runGit(['-C', repoPath, 'sparse-checkout', 'init', '--no-cone']);

    await runGit([
      '-C',
      repoPath,
      'sparse-checkout',
      'set',
      '--no-cone',
      ...sparsePatterns,
    ]);

    // The clone used --no-checkout, so the working tree is still empty.
    // This step writes the selected files to disk (blobs fetched in one batch).
    await runGit(['-C', repoPath, 'checkout', '--force', 'HEAD']);

    // Confirm files exist on disk and enforce the total size limit.
    let filesOnDisk = 0;
    let totalSize = 0;

    for (const file of supportedFiles) {
      try {
        const stat = await fs.stat(path.join(repoPath, file));
        filesOnDisk += 1;
        totalSize += stat.size;
      } catch {
        // Missing file; counted below.
      }
    }

    if (totalSize > MAX_TOTAL_FILE_SIZE) {
      throw new Error('Repository supported files exceed the 10 MB size limit.');
    }

    if (filesOnDisk === 0) {
      throw new Error('Repository files could not be downloaded.');
    }

    return { repoPath, tempDir };
  } catch (error) {
    await removeTempDir(tempDir);

    // Our own limit/validation messages are safe to show to the caller.
    if (error instanceof Error && error.message.startsWith('Repository')) {
      throw error;
    }

    // Detailed log for debugging; the caller only gets a generic message.
    const e = error as {
      message?: string;
      cmd?: string;
      stderr?: string;
      killed?: boolean;
      signal?: string;
    };
    console.error(
      'Repository download failed:',
      e.message,
      '\nCMD:',
      e.cmd,
      '\nSTDERR:',
      e.stderr,
      '\nKILLED/TIMEOUT:',
      e.killed,
      e.signal,
    );

    throw new Error(
      'Unable to download the repository. Make sure it is public and the GitHub URL is correct.',
    );
  }
}

/**
 * Removes the temporary repository after analysis.
 * Never throws.
 */
export async function cleanupDownloadedRepository(
  tempDir: string,
): Promise<void> {
  await removeTempDir(tempDir);
}

/**
 * Deletes leftover driftlens-* folders from earlier failed cleanups.
 * Call once at server startup.
 */
export async function sweepStaleTempDirs(
  maxAgeMs = 60 * 60 * 1000,
): Promise<void> {
  const tmp = os.tmpdir();

  let names: string[];
  try {
    names = await fs.readdir(tmp);
  } catch {
    return;
  }

  for (const name of names) {
    if (!name.startsWith('driftlens-')) continue;

    const full = path.join(tmp, name);

    try {
      const stat = await fs.stat(full);
      if (Date.now() - stat.mtimeMs > maxAgeMs) {
        await removeTempDir(full);
      }
    } catch {
      // Ignore; it will be retried on the next startup.
    }
  }
}