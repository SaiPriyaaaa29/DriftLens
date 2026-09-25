import { describe, it, expect } from 'vitest';
import { EnvTemplateParser } from '../../src/parsers/env-template.parser';

const parser = new EnvTemplateParser();

describe('EnvTemplateParser.supports()', () => {
  it('matches .env.example', () => expect(parser.supports('.env.example')).toBe(true));
  it('matches .env.template', () => expect(parser.supports('.env.template')).toBe(true));
  it('matches .env.sample', () => expect(parser.supports('.env.sample')).toBe(true));
  it('rejects .env', () => expect(parser.supports('.env')).toBe(false));
  it('rejects .env.local', () => expect(parser.supports('.env.local')).toBe(false));
  it('rejects README.md', () => expect(parser.supports('README.md')).toBe(false));
});

describe('EnvTemplateParser.parse() — key extraction', () => {
  it('extracts a key with value', async () => {
    const content = 'DATABASE_URL=postgres://localhost/mydb\n';
    const facts = await parser.parse('.env.example', content);
    expect(facts[0]).toMatchObject({
      key: 'ENV-TEMPLATE:DATABASE_URL',
      value: 'postgres://localhost/mydb',
      category: 'env-var',
    });
  });

  it('extracts a key with empty value', async () => {
    const content = 'SECRET_KEY=\n';
    const facts = await parser.parse('.env.example', content);
    expect(facts[0]).toMatchObject({ key: 'ENV-TEMPLATE:SECRET_KEY', value: '' });
  });

  it('extracts a bare key with no equals sign', async () => {
    const content = 'API_KEY\n';
    const facts = await parser.parse('.env.example', content);
    expect(facts[0]).toMatchObject({ key: 'ENV-TEMPLATE:API_KEY', value: '' });
  });

  it('ignores comment lines', async () => {
    const content = '# This is a comment\nPORT=3000\n';
    const facts = await parser.parse('.env.example', content);
    expect(facts).toHaveLength(1);
    expect(facts[0].key).toBe('ENV-TEMPLATE:PORT');
  });

  it('ignores blank lines', async () => {
    const content = '\nPORT=3000\n\n';
    const facts = await parser.parse('.env.example', content);
    expect(facts).toHaveLength(1);
  });

  it('extracts multiple keys', async () => {
    const content = 'PORT=3000\nDATABASE_URL=\nSECRET_KEY=abc\n';
    const facts = await parser.parse('.env.example', content);
    expect(facts).toHaveLength(3);
    const keys = facts.map((f) => f.key);
    expect(keys).toContain('ENV-TEMPLATE:PORT');
    expect(keys).toContain('ENV-TEMPLATE:DATABASE_URL');
    expect(keys).toContain('ENV-TEMPLATE:SECRET_KEY');
  });

  it('records source line numbers', async () => {
    const content = '# comment\nPORT=3000\n';
    const facts = await parser.parse('.env.example', content);
    expect(facts[0].line).toBe(2);
  });
});

describe('EnvTemplateParser.parse() — error handling', () => {
  it('returns [] for empty content', async () => {
    expect(await parser.parse('.env.example', '')).toEqual([]);
  });
});
