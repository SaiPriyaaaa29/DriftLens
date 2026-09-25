import request from 'supertest';
import path from 'path';
import { describe, it, expect } from 'vitest';
import app from '../../src/index';

const FIXTURES = path.resolve(__dirname, '../fixtures');

describe('POST /api/analyze', () => {
  it('returns 400 when repoPath is missing', async () => {
    const res = await request(app).post('/api/analyze').send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'repoPath is required' });
  });

  it('returns 400 when repoPath is an empty string', async () => {
    const res = await request(app).post('/api/analyze').send({ repoPath: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'repoPath is required' });
  });

  it('returns 422 when path does not exist', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: '/this/path/definitely/does/not/exist/12345' });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: 'Path does not exist or is not a directory' });
  });

  it('returns 422 when path is a file, not a directory', async () => {
    // Use this test file itself as the "path"
    const filePath = path.resolve(__filename);
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: filePath });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: 'Path does not exist or is not a directory' });
  });

  it('returns a valid AnalysisResult for fixture-clean', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: path.join(FIXTURES, 'fixture-clean') });

    expect(res.status).toBe(200);
    // Shape assertions
    expect(typeof res.body.repoPath).toBe('string');
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
      .send({ repoPath: path.join(FIXTURES, 'fixture-node-mismatch') });

    expect(res.status).toBe(200);
    const findings: Array<{ ruleId: string }> = res.body.findings;
    const ruleIds = findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('node-version-mismatch');
  });

  it('detects package manager conflict in fixture-pkg-manager', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: path.join(FIXTURES, 'fixture-pkg-manager') });

    expect(res.status).toBe(200);
    const findings: Array<{ ruleId: string }> = res.body.findings;
    const ruleIds = findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('package-manager-conflict');
  });

  it('detects env var drift in fixture-env-drift', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: path.join(FIXTURES, 'fixture-env-drift') });

    expect(res.status).toBe(200);
    const findings: Array<{ ruleId: string }> = res.body.findings;
    const ruleIds = findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('env-var-missing-from-template');
  });

  it('findings include severity, evidence, and explanation', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: path.join(FIXTURES, 'fixture-node-mismatch') });

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

  it('repairPlan is the fallback message when LLM_API_KEY is not set', async () => {
    // LLM_API_KEY is not set in test environment
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: path.join(FIXTURES, 'fixture-node-mismatch') });

    expect(res.status).toBe(200);
    expect(res.body.repairPlan).toContain('LLM_API_KEY not configured');
  });
});
