import { describe, it, expect } from 'vitest';
import { NodeVersionRule } from '../../src/detector/rules/node-version.rule';
import type { ExtractedFact } from '../../src/models/types';

const rule = new NodeVersionRule();

const fact = (source: string, value: string): ExtractedFact => ({
  source,
  category: 'runtime-version',
  key: 'node-version',
  value,
});

describe('NodeVersionRule', () => {
  it('has correct id and title', () => {
    expect(rule.id).toBe('node-version-mismatch');
    expect(rule.title).toBeDefined();
  });

  it('returns null when there are no node-version facts', () => {
    expect(rule.check([])).toBeNull();
  });

  it('returns null when only one source declares a version', () => {
    expect(rule.check([fact('README.md', '18')])).toBeNull();
  });

  it('returns null when all sources agree on the same version', () => {
    const facts: ExtractedFact[] = [
      fact('README.md', '18'),
      fact('Dockerfile', '18'),
      fact('.github/workflows/ci.yml', '18'),
    ];
    expect(rule.check(facts)).toBeNull();
  });

  it('fires when README and Dockerfile disagree', () => {
    const facts: ExtractedFact[] = [
      fact('README.md', '18'),
      fact('Dockerfile', '20'),
    ];
    const result = rule.check(facts);
    expect(result).not.toBeNull();
    expect(result?.evidence).toHaveLength(2);
    expect(result?.evidence.map((e) => e.value)).toContain('18');
    expect(result?.evidence.map((e) => e.value)).toContain('20');
  });

  it('fires when CI matrix has multiple versions differing from README', () => {
    const facts: ExtractedFact[] = [
      fact('README.md', '18'),
      fact('.github/workflows/ci.yml', '18'),
      fact('.github/workflows/ci.yml', '20'),
      fact('.github/workflows/ci.yml', '22'),
    ];
    const result = rule.check(facts);
    expect(result).not.toBeNull();
  });

  it('treats 18 and 18.x as the same version — no violation', () => {
    const facts: ExtractedFact[] = [
      fact('README.md', '18.x'),
      fact('Dockerfile', '18'),
    ];
    expect(rule.check(facts)).toBeNull();
  });

  it('treats v20 and 20 as the same version — no violation', () => {
    const facts: ExtractedFact[] = [
      fact('README.md', 'v20'),
      fact('Dockerfile', '20'),
    ];
    expect(rule.check(facts)).toBeNull();
  });

  it('includes explanation in the violation', () => {
    const facts: ExtractedFact[] = [fact('README.md', '18'), fact('Dockerfile', '20')];
    const result = rule.check(facts);
    expect(typeof result?.explanation).toBe('string');
    expect(result!.explanation.length).toBeGreaterThan(10);
  });
});
