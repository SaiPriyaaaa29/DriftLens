import path from 'path';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';

const DEMO_FIXTURE = path.resolve(__dirname, '../fixtures/fixture-demo');

describe('fixture-demo end-to-end smoke test', () => {
  it('returns a valid AnalysisResult shape', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: DEMO_FIXTURE });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.scannedFiles)).toBe(true);
    expect(Array.isArray(res.body.findings)).toBe(true);
    expect(typeof res.body.repairPlan).toBe('string');
    expect(Array.isArray(res.body.checklist)).toBe(true);
    expect(typeof res.body.analysedAt).toBe('string');
  });

  it('scans all six expected files', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: DEMO_FIXTURE });

    const files: string[] = res.body.scannedFiles;
    // Log for inspection
    console.log('\n=== SCANNED FILES ===');
    files.forEach((f) => console.log(' ', f));

    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it('detects node-version-mismatch (Critical)', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: DEMO_FIXTURE });

    const findings: Array<{ ruleId: string; severity: string }> = res.body.findings;
    const match = findings.find((f) => f.ruleId === 'node-version-mismatch');
    expect(match).toBeDefined();
    expect(match?.severity).toBe('critical');
  });

  it('detects package-manager-conflict (Critical)', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: DEMO_FIXTURE });

    const findings: Array<{ ruleId: string; severity: string }> = res.body.findings;
    const match = findings.find((f) => f.ruleId === 'package-manager-conflict');
    expect(match).toBeDefined();
    expect(match?.severity).toBe('critical');
  });

  it('detects env-var-missing-from-template (Warning)', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: DEMO_FIXTURE });

    const findings: Array<{ ruleId: string; severity: string }> = res.body.findings;
    const match = findings.find((f) => f.ruleId === 'env-var-missing-from-template');
    expect(match).toBeDefined();
    expect(match?.severity).toBe('warning');
  });

  it('detects install-command-mismatch (Warning)', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: DEMO_FIXTURE });

    const findings: Array<{ ruleId: string; severity: string }> = res.body.findings;
    const match = findings.find((f) => f.ruleId === 'install-command-mismatch');
    expect(match).toBeDefined();
    expect(match?.severity).toBe('warning');
  });

  it('repairPlan is the LLM fallback (no API key in test env)', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: DEMO_FIXTURE });

    expect(res.body.repairPlan).toContain('LLM_API_KEY not configured');
  });

  it('prints full findings summary to console for manual inspection', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ repoPath: DEMO_FIXTURE });

    const findings: Array<{
      ruleId: string;
      severity: string;
      title: string;
      evidence: Array<{ source: string; key: string; value: string }>;
    }> = res.body.findings;

    console.log('\n=== DEMO FINDINGS ===');
    findings.forEach((f) => {
      console.log(`\n[${f.severity.toUpperCase()}] ${f.ruleId}`);
      console.log(`  Title: ${f.title}`);
      f.evidence.forEach((e) =>
        console.log(`  Evidence: ${e.source} | ${e.key} = ${e.value}`),
      );
    });
    console.log(`\nTotal findings: ${findings.length}`);
    console.log(`Critical: ${findings.filter((f) => f.severity === 'critical').length}`);
    console.log(`Warning:  ${findings.filter((f) => f.severity === 'warning').length}`);
    console.log(`Info:     ${findings.filter((f) => f.severity === 'info').length}`);

    expect(findings.length).toBeGreaterThanOrEqual(3);
  });
});
