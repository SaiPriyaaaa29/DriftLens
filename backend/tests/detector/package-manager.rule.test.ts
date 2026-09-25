import { describe, it, expect } from 'vitest';
import { PackageManagerRule } from '../../src/detector/rules/package-manager.rule';
import type { ExtractedFact } from '../../src/models/types';

const rule = new PackageManagerRule();

const pmFact = (source: string, value: string): ExtractedFact => ({
  source,
  category: 'install-command',
  key: 'package-manager',
  value,
});

describe('PackageManagerRule', () => {
  it('has correct id', () => {
    expect(rule.id).toBe('package-manager-conflict');
  });

  it('returns null with no pm facts', () => {
    expect(rule.check([])).toBeNull();
  });

  it('returns null when only one source exists', () => {
    expect(rule.check([pmFact('package-lock.json', 'npm')])).toBeNull();
  });

  it('returns null when all sources agree on npm', () => {
    const facts: ExtractedFact[] = [
      pmFact('package-lock.json', 'npm'),
      pmFact('package.json', 'npm'),
      pmFact('.github/workflows/ci.yml', 'npm'),
    ];
    expect(rule.check(facts)).toBeNull();
  });

  it('fires when npm lockfile and yarn.lock both present', () => {
    const facts: ExtractedFact[] = [
      pmFact('package-lock.json', 'npm'),
      pmFact('yarn.lock', 'yarn'),
    ];
    const result = rule.check(facts);
    expect(result).not.toBeNull();
    expect(result?.evidence.map((e) => e.value)).toContain('npm');
    expect(result?.evidence.map((e) => e.value)).toContain('yarn');
  });

  it('fires when scripts use yarn but package-lock.json exists', () => {
    const facts: ExtractedFact[] = [
      pmFact('package-lock.json', 'npm'),
      pmFact('package.json', 'yarn'),
    ];
    expect(rule.check(facts)).not.toBeNull();
  });

  it('fires for three-way conflict: npm + yarn + pnpm', () => {
    const facts: ExtractedFact[] = [
      pmFact('package-lock.json', 'npm'),
      pmFact('yarn.lock', 'yarn'),
      pmFact('pnpm-lock.yaml', 'pnpm'),
    ];
    const result = rule.check(facts);
    expect(result).not.toBeNull();
    expect(result?.evidence).toHaveLength(3);
  });
});
