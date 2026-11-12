
import request from 'supertest';
import path from 'path';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import app from '../../src/index';

vi.mock('../../src/scanner/github-repository', () => ({
  downloadPublicGitHubRepository: vi.fn(),
  cleanupDownloadedRepository: vi.fn(),
}));

import {
  downloadPublicGitHubRepository,
  cleanupDownloadedRepository,
} from '../../src/scanner/github-repository';

const FIXTURES = path.resolve(__dirname, '../fixtures');

const REPOSITORIES: Record<string, string> = {
  'https://github.com/test/fixture-clean': 'fixture-clean',
  'https://github.com/test/fixture-node-mismatch': 'fixture-node-mismatch',
  'https://github.com/test/fixture-pkg-manager': 'fixture-pkg-manager',
  'https://github.com/test/fixture-env-drift': 'fixture-env-drift',
};

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(downloadPublicGitHubRepository).mockImplementation(
    async (repoUrl: string) => {
      const fixtureName = REPOSITORIES[repoUrl];

      if (!fixtureName) {
        throw new Error('Unexpected test repository URL');
      }

      return {
        repoPath: path.join(FIXTURES, fixtureName),
        tempDir: path.join(FIXTURES, 'temporary-test-directory'),
      };
    },
  );
});

describe('POST /api/analyze', () => {
  it('returns 400 when repoUrl is missing', async () => {
    const res = await request(app).post('/api/analyze').send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'repoUrl is required' });
  });

  it('returns 400 when repoUrl is an empty string', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoUrl: '   ' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'repoUrl is required' });
  });

  it('returns a valid AnalysisResult for fixture-clean', async () => {
    const repoUrl = 'https://github.com/test/fixture-clean';

    const res = await request(app)
      .post('/api/analyze')
      .send({ repoUrl });

    expect(res.status).toBe(200);
    expect(res.body.repoPath).toBe(repoUrl);
    expect(Array.isArray(res.body.scannedFiles)).toBe(true);
    expect(Array.isArray(res.body.facts)).toBe(true);
    expect(Array.isArray(res.body.findings)).toBe(true);
    expect(typeof res.body.repairPlan).toBe('string');
    expect(Array.isArray(res.body.checklist)).toBe(true);
    expect(typeof res.body.analysedAt).toBe('string');
  });

  it('detects node version mismatch in fixture-node-mismatch', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({
        repoUrl: 'https://github.com/test/fixture-node-mismatch',
      });

    expect(res.status).toBe(200);

    const findings: Array<{ ruleId: string }> = res.body.findings;
    const ruleIds = findings.map((f) => f.ruleId);

    expect(ruleIds).toContain('node-version-mismatch');
  });

  it('detects package manager conflict in fixture-pkg-manager', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({
        repoUrl: 'https://github.com/test/fixture-pkg-manager',
      });

    expect(res.status).toBe(200);

    const findings: Array<{ ruleId: string }> = res.body.findings;
    const ruleIds = findings.map((f) => f.ruleId);

    expect(ruleIds).toContain('package-manager-conflict');
  });

  it('detects env var drift in fixture-env-drift', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({
        repoUrl: 'https://github.com/test/fixture-env-drift',
      });

    expect(res.status).toBe(200);

    const findings: Array<{ ruleId: string }> = res.body.findings;
    const ruleIds = findings.map((f) => f.ruleId);

    expect(ruleIds).toContain('env-var-missing-from-template');
  });

  it('findings include severity, evidence, and explanation', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({
        repoUrl: 'https://github.com/test/fixture-node-mismatch',
      });

    expect(res.status).toBe(200);

    const findings: Array<{
      id: string;
      ruleId: string;
      severity: string;
      evidence: unknown[];
      explanation: string;
    }> = res.body.findings;

    expect(findings.length).toBeGreaterThan(0);

    for (const f of findings) {
      expect(typeof f.id).toBe('string');
      expect(['critical', 'warning', 'info']).toContain(f.severity);
      expect(Array.isArray(f.evidence)).toBe(true);
      expect(typeof f.explanation).toBe('string');
    }
  });

  it('uses the fallback repair plan when LLM_API_KEY is not set', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({
        repoUrl: 'https://github.com/test/fixture-node-mismatch',
      });

    expect(res.status).toBe(200);
    expect(res.body.repairPlan).toContain('LLM_API_KEY not configured');
  });

  it('cleans up the downloaded repository after analysis', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({
        repoUrl: 'https://github.com/test/fixture-clean',
      });

    expect(res.status).toBe(200);
    expect(cleanupDownloadedRepository).toHaveBeenCalled();
  });
});
