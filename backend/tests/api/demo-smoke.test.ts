import path from 'path';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// vi.mock is hoisted above imports, so shared values must come from vi.hoisted.
const mocks = vi.hoisted(() => {
  const nodePath = require('path') as typeof import('path');
  return {
    DEMO_FIXTURE: nodePath.resolve(__dirname, '../fixtures/fixture-demo'),
    TEMP_DIR: 'mock-temp-dir-do-not-delete',
    download: vi.fn(),
    cleanup: vi.fn(),
  };
});

vi.mock('../../src/scanner/github-repository', () => ({
  downloadPublicGitHubRepository: mocks.download,
  // MUST be mocked: the real cleanup would delete whatever tempDir points to.
  cleanupDownloadedRepository: mocks.cleanup,
  sweepStaleTempDirs: vi.fn(),
}));

import app from '../../src/index';

const REPO_URL = 'https://github.com/example/fixture-demo';

type Finding = {
  ruleId: string;
  severity: string;
  title: string;
  evidence: Array<{ source: string; key: string; value: string }>;
};

describe('fixture-demo end-to-end smoke test (repoUrl flow)', () => {
  let res: request.Response;

  beforeAll(async () => {
    mocks.download.mockResolvedValue({
      repoPath: mocks.DEMO_FIXTURE,
      tempDir: mocks.TEMP_DIR,
    });
    mocks.cleanup.mockResolvedValue(undefined);

    res = await request(app).post('/api/analyze').send({ repoUrl: REPO_URL });
  });

  it('returns a valid AnalysisResult shape', () => {
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.scannedFiles)).toBe(true);
    expect(Array.isArray(res.body.findings)).toBe(true);
    expect(typeof res.body.repairPlan).toBe('string');
    expect(Array.isArray(res.body.checklist)).toBe(true);
    expect(typeof res.body.analysedAt).toBe('string');
  });

  it('passes the submitted URL to the downloader', () => {
    expect(mocks.download).toHaveBeenCalledWith(REPO_URL);
  });

  it('cleans up the temporary directory after analysis', async () => {
    await vi.waitFor(() =>
      expect(mocks.cleanup).toHaveBeenCalledWith(mocks.TEMP_DIR),
    );
  });

  it('scans all expected files', () => {
    const files: string[] = res.body.scannedFiles;
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it.each([
    ['node-version-mismatch', 'critical'],
    ['package-manager-conflict', 'critical'],
    ['env-var-missing-from-template', 'warning'],
    ['install-command-mismatch', 'warning'],
  ])('detects %s (%s)', (ruleId, severity) => {
    const findings: Finding[] = res.body.findings;
    const match = findings.find((f) => f.ruleId === ruleId);

    expect(match).toBeDefined();
    expect(match?.severity).toBe(severity);
  });

  it('repairPlan is the LLM fallback when no API key is set', () => {
    expect(res.body.repairPlan).toContain('LLM_API_KEY not configured');
  });

  it('returns at least 3 findings', () => {
    const findings: Finding[] = res.body.findings;
    expect(findings.length).toBeGreaterThanOrEqual(3);
  });
});

describe('invalid input', () => {
  it('rejects a request without repoUrl', async () => {
    const bad = await request(app).post('/api/analyze').send({});
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.status).toBeLessThan(500);
  });
});