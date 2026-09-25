import { describe, it, expect } from 'vitest';
import { EnvVarRule } from '../../src/detector/rules/env-var.rule';
import type { ExtractedFact } from '../../src/models/types';

const rule = new EnvVarRule();

const dockerEnvFact = (key: string, source = 'Dockerfile'): ExtractedFact => ({
  source,
  category: 'env-var',
  key: `ENV:${key}`,
  value: '',
});

const templateFact = (key: string, source = '.env.example'): ExtractedFact => ({
  source,
  category: 'env-var',
  key: `ENV-TEMPLATE:${key}`,
  value: '',
});

describe('EnvVarRule', () => {
  it('has correct id', () => {
    expect(rule.id).toBe('env-var-missing-from-template');
  });

  it('returns null with no facts at all', () => {
    expect(rule.check([])).toBeNull();
  });

  it('returns null when there are dockerfile ENV facts but no template', () => {
    // No template file → cannot know what is missing
    expect(rule.check([dockerEnvFact('SECRET_KEY')])).toBeNull();
  });

  it('returns null when all dockerfile ENVs are in the template', () => {
    const facts: ExtractedFact[] = [
      dockerEnvFact('PORT'),
      dockerEnvFact('DATABASE_URL'),
      templateFact('PORT'),
      templateFact('DATABASE_URL'),
    ];
    expect(rule.check(facts)).toBeNull();
  });

  it('fires when a dockerfile ENV key is absent from the template', () => {
    const facts: ExtractedFact[] = [
      dockerEnvFact('SECRET_KEY'),
      templateFact('PORT'),
    ];
    const result = rule.check(facts);
    expect(result).not.toBeNull();
    expect(result?.evidence[0].key).toBe('ENV:SECRET_KEY');
  });

  it('fires only for the missing key, not the present one', () => {
    const facts: ExtractedFact[] = [
      dockerEnvFact('PORT'),
      dockerEnvFact('SECRET_KEY'),
      templateFact('PORT'),
    ];
    const result = rule.check(facts);
    expect(result).not.toBeNull();
    expect(result?.evidence).toHaveLength(1);
    expect(result?.evidence[0].key).toBe('ENV:SECRET_KEY');
  });

  it('returns null when template is present but dockerfile has no ENV', () => {
    const facts: ExtractedFact[] = [templateFact('PORT')];
    expect(rule.check(facts)).toBeNull();
  });
});
