import { describe, it, expect } from 'vitest';
import { PackageJsonParser } from '../../src/parsers/package-json.parser';

const parser = new PackageJsonParser();

describe('PackageJsonParser.supports()', () => {
  it('matches package.json', () => expect(parser.supports('package.json')).toBe(true));
  it('matches nested path', () => expect(parser.supports('backend/package.json')).toBe(true));
  it('rejects package-lock.json', () => expect(parser.supports('package-lock.json')).toBe(false));
  it('rejects README.md', () => expect(parser.supports('README.md')).toBe(false));
});

describe('PackageJsonParser.parse() — engines', () => {
  it('extracts engines.node', async () => {
    const content = JSON.stringify({ engines: { node: '>=18.0.0' } });
    const facts = await parser.parse('package.json', content);
    const f = facts.find((x) => x.key === 'node-version');
    expect(f).toMatchObject({ category: 'runtime-version', value: '>=18.0.0' });
  });

  it('extracts engines.npm', async () => {
    const content = JSON.stringify({ engines: { npm: '>=9' } });
    const facts = await parser.parse('package.json', content);
    const f = facts.find((x) => x.key === 'npm-version');
    expect(f).toMatchObject({ category: 'runtime-version', value: '>=9' });
  });

  it('produces no runtime-version facts when engines is absent', async () => {
    const content = JSON.stringify({ name: 'foo' });
    const facts = await parser.parse('package.json', content);
    expect(facts.filter((f) => f.category === 'runtime-version')).toHaveLength(0);
  });
});

describe('PackageJsonParser.parse() — dependencies', () => {
  it('extracts direct dependency versions', async () => {
    const content = JSON.stringify({ dependencies: { express: '^4.18.0' } });
    const facts = await parser.parse('package.json', content);
    const f = facts.find((x) => x.key === 'npm-package:express');
    expect(f).toMatchObject({ category: 'dependency', value: '^4.18.0' });
  });

  it('extracts devDependency versions', async () => {
    const content = JSON.stringify({ devDependencies: { vitest: '^1.0.0' } });
    const facts = await parser.parse('package.json', content);
    const f = facts.find((x) => x.key === 'npm-package:vitest');
    expect(f).toMatchObject({ category: 'dependency', value: '^1.0.0' });
  });
});

describe('PackageJsonParser.parse() — package manager detection', () => {
  it('detects yarn from scripts', async () => {
    const content = JSON.stringify({ scripts: { build: 'yarn build:prod' } });
    const facts = await parser.parse('package.json', content);
    const f = facts.find((x) => x.key === 'package-manager');
    expect(f?.value).toBe('yarn');
  });

  it('detects pnpm from scripts', async () => {
    const content = JSON.stringify({ scripts: { start: 'pnpm run serve' } });
    const facts = await parser.parse('package.json', content);
    const f = facts.find((x) => x.key === 'package-manager');
    expect(f?.value).toBe('pnpm');
  });
});

describe('PackageJsonParser.parse() — error handling', () => {
  it('returns [] for invalid JSON', async () => {
    expect(await parser.parse('package.json', 'not json')).toEqual([]);
  });

  it('returns [] for empty string', async () => {
    expect(await parser.parse('package.json', '')).toEqual([]);
  });
});
