import { describe, it, expect } from 'vitest';
import { LockfileParser } from '../../src/parsers/lockfile.parser';

const parser = new LockfileParser();

describe('LockfileParser.supports()', () => {
  it('matches package-lock.json', () => expect(parser.supports('package-lock.json')).toBe(true));
  it('matches yarn.lock', () => expect(parser.supports('yarn.lock')).toBe(true));
  it('matches pnpm-lock.yaml', () => expect(parser.supports('pnpm-lock.yaml')).toBe(true));
  it('rejects package.json', () => expect(parser.supports('package.json')).toBe(false));
  it('rejects lockfile.ts', () => expect(parser.supports('lockfile.ts')).toBe(false));
});

describe('LockfileParser.parse() — package-lock.json', () => {
  it('emits package-manager: npm', async () => {
    const content = JSON.stringify({ name: 'foo', lockfileVersion: 3 });
    const facts = await parser.parse('package-lock.json', content);
    const pm = facts.find((f) => f.key === 'package-manager');
    expect(pm?.value).toBe('npm');
  });

  it('emits lockfile-version', async () => {
    const content = JSON.stringify({ lockfileVersion: 3 });
    const facts = await parser.parse('package-lock.json', content);
    const lv = facts.find((f) => f.key === 'lockfile-version');
    expect(lv?.value).toBe('3');
  });

  it('still emits npm even when JSON is malformed', async () => {
    const facts = await parser.parse('package-lock.json', 'not json');
    const pm = facts.find((f) => f.key === 'package-manager');
    expect(pm?.value).toBe('npm');
  });
});

describe('LockfileParser.parse() — yarn.lock', () => {
  it('emits package-manager: yarn', async () => {
    const content = '# yarn lockfile v1\n\nfoo@^1.0.0:\n  version "1.0.0"';
    const facts = await parser.parse('yarn.lock', content);
    const pm = facts.find((f) => f.key === 'package-manager');
    expect(pm?.value).toBe('yarn');
  });

  it('detects yarn classic version', async () => {
    const content = '# yarn lockfile v1\n\n';
    const facts = await parser.parse('yarn.lock', content);
    const lv = facts.find((f) => f.key === 'lockfile-version');
    expect(lv?.value).toBe('yarn-classic-1');
  });

  it('detects yarn berry version', async () => {
    const content = '__metadata:\n  version: 6\n  cacheKey: 8\n';
    const facts = await parser.parse('yarn.lock', content);
    const lv = facts.find((f) => f.key === 'lockfile-version');
    expect(lv?.value).toBe('yarn-berry-6');
  });
});

describe('LockfileParser.parse() — pnpm-lock.yaml', () => {
  it('emits package-manager: pnpm', async () => {
    const content = "lockfileVersion: '6.0'\n\npackages:\n";
    const facts = await parser.parse('pnpm-lock.yaml', content);
    const pm = facts.find((f) => f.key === 'package-manager');
    expect(pm?.value).toBe('pnpm');
  });

  it('extracts lockfile version', async () => {
    const content = "lockfileVersion: '6.0'\n";
    const facts = await parser.parse('pnpm-lock.yaml', content);
    const lv = facts.find((f) => f.key === 'lockfile-version');
    expect(lv?.value).toBe('6.0');
  });
});
