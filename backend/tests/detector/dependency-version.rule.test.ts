import { describe, it, expect } from 'vitest';
import { DependencyVersionRule } from '../../src/detector/rules/dependency-version.rule';
import type { ExtractedFact } from '../../src/models/types';

const rule = new DependencyVersionRule();

const pmFact = (source: string, value: string): ExtractedFact => ({
  source,
  category: 'install-command',
  key: 'package-manager',
  value,
});

describe('DependencyVersionRule (lockfile-package-manager-mismatch)', () => {
  it('has correct id', () => {
    expect(rule.id).toBe('lockfile-package-manager-mismatch');
  });

  it('returns null with no facts', () => {
    expect(rule.check([])).toBeNull();
  });

  it('returns null when only a lockfile fact exists (no script fact)', () => {
    expect(rule.check([pmFact('package-lock.json', 'npm')])).toBeNull();
  });

  it('returns null when only a script fact exists (no lockfile)', () => {
    expect(rule.check([pmFact('package.json', 'yarn')])).toBeNull();
  });

  it('returns null when lockfile and scripts agree on npm', () => {
    const facts: ExtractedFact[] = [
      pmFact('package-lock.json', 'npm'),
      pmFact('package.json', 'npm'),
    ];
    expect(rule.check(facts)).toBeNull();
  });

  it('returns null when lockfile and scripts agree on yarn', () => {
    const facts: ExtractedFact[] = [
      pmFact('yarn.lock', 'yarn'),
      pmFact('package.json', 'yarn'),
    ];
    expect(rule.check(facts)).toBeNull();
  });

  it('fires when yarn.lock is present but scripts reference npm', () => {
    const facts: ExtractedFact[] = [
      pmFact('yarn.lock', 'yarn'),
      pmFact('package.json', 'npm'),
    ];
    const result = rule.check(facts);
    expect(result).not.toBeNull();
    expect(result?.evidence.map((e) => e.source)).toContain('yarn.lock');
    expect(result?.evidence.map((e) => e.source)).toContain('package.json');
  });

  it('fires when package-lock.json is present but scripts reference yarn', () => {
    const facts: ExtractedFact[] = [
      pmFact('package-lock.json', 'npm'),
      pmFact('package.json', 'yarn'),
    ];
    expect(rule.check(facts)).not.toBeNull();
  });

  it('fires when pnpm-lock.yaml is present but scripts reference npm', () => {
    const facts: ExtractedFact[] = [
      pmFact('pnpm-lock.yaml', 'pnpm'),
      pmFact('package.json', 'npm'),
    ];
    expect(rule.check(facts)).not.toBeNull();
  });
});
