import { describe, it, expect } from 'vitest';
import { InstallCommandRule } from '../../src/detector/rules/install-command.rule';
import type { ExtractedFact } from '../../src/models/types';

const rule = new InstallCommandRule();

const installFact = (source: string, value: string): ExtractedFact => ({
  source,
  category: 'install-command',
  key: 'install-command',
  value,
});

describe('InstallCommandRule', () => {
  it('has correct id', () => {
    expect(rule.id).toBe('install-command-mismatch');
  });

  it('returns null with no install facts', () => {
    expect(rule.check([])).toBeNull();
  });

  it('returns null when only README has an install command', () => {
    expect(rule.check([installFact('README.md', 'npm install')])).toBeNull();
  });

  it('returns null when only CI has an install command', () => {
    expect(
      rule.check([installFact('.github/workflows/ci.yml', 'npm ci')]),
    ).toBeNull();
  });

  it('returns null when README and CI both use npm install', () => {
    const facts: ExtractedFact[] = [
      installFact('README.md', 'npm install'),
      installFact('.github/workflows/ci.yml', 'npm install'),
    ];
    expect(rule.check(facts)).toBeNull();
  });

  it('fires when README says npm install but CI uses npm ci', () => {
    const facts: ExtractedFact[] = [
      installFact('README.md', 'npm install'),
      installFact('.github/workflows/ci.yml', 'npm ci'),
    ];
    const result = rule.check(facts);
    expect(result).not.toBeNull();
    expect(result?.evidence.map((e) => e.source)).toContain('README.md');
    expect(result?.evidence.map((e) => e.source)).toContain(
      '.github/workflows/ci.yml',
    );
  });

  it('fires when README uses yarn but CI uses npm ci', () => {
    const facts: ExtractedFact[] = [
      installFact('README.md', 'yarn install'),
      installFact('.github/workflows/ci.yml', 'npm ci'),
    ];
    const result = rule.check(facts);
    expect(result).not.toBeNull();
  });

  it('fires when README uses pnpm but CI uses yarn install', () => {
    const facts: ExtractedFact[] = [
      installFact('README.md', 'pnpm install'),
      installFact('.github/workflows/ci.yml', 'yarn install'),
    ];
    expect(rule.check(facts)).not.toBeNull();
  });

  it('returns null when both README and CI use yarn install', () => {
    const facts: ExtractedFact[] = [
      installFact('README.md', 'yarn install'),
      installFact('.github/workflows/ci.yml', 'yarn install'),
    ];
    expect(rule.check(facts)).toBeNull();
  });
});
