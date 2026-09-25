import { describe, it, expect } from 'vitest';
import { ReadmeParser } from '../../src/parsers/readme.parser';

const parser = new ReadmeParser();

describe('ReadmeParser.supports()', () => {
  it('matches README.md', () => expect(parser.supports('README.md')).toBe(true));
  it('matches README.rst', () => expect(parser.supports('README.rst')).toBe(true));
  it('matches nested path', () => expect(parser.supports('docs/README.md')).toBe(true));
  it('rejects package.json', () => expect(parser.supports('package.json')).toBe(false));
  it('rejects Dockerfile', () => expect(parser.supports('Dockerfile')).toBe(false));
});

describe('ReadmeParser.parse() — node versions', () => {
  it('extracts a plain Node.js version mention', async () => {
    const content = 'Requires Node.js 18 or higher.';
    const facts = await parser.parse('README.md', content);
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ key: 'node-version', value: '18', category: 'runtime-version' });
  });

  it('extracts version with .x suffix', async () => {
    const content = 'Use node: 20.x in CI.';
    const facts = await parser.parse('README.md', content);
    const nodeVersions = facts.filter((f) => f.key === 'node-version');
    expect(nodeVersions[0].value).toBe('20.x');
  });

  it('deduplicates the same version mentioned twice', async () => {
    const content = 'Node.js 18 is required. Install Node.js 18 first.';
    const facts = await parser.parse('README.md', content);
    const nodeVersions = facts.filter((f) => f.key === 'node-version');
    expect(nodeVersions).toHaveLength(1);
  });

  it('extracts multiple different versions', async () => {
    const content = 'Tested with Node.js 18 and Node.js 20.';
    const facts = await parser.parse('README.md', content);
    const versions = facts.filter((f) => f.key === 'node-version').map((f) => f.value);
    expect(versions).toContain('18');
    expect(versions).toContain('20');
  });
});

describe('ReadmeParser.parse() — install commands', () => {
  it('extracts npm install from a code block', async () => {
    const content = '```\nnpm install\n```';
    const facts = await parser.parse('README.md', content);
    const cmd = facts.find((f) => f.key === 'install-command');
    expect(cmd?.value).toBe('npm install');
  });

  it('extracts yarn install', async () => {
    const content = 'Run `yarn install` to set up.';
    const facts = await parser.parse('README.md', content);
    const cmd = facts.find((f) => f.key === 'install-command');
    expect(cmd?.value).toBe('yarn install');
  });

  it('extracts npm ci', async () => {
    const content = '$ npm ci';
    const facts = await parser.parse('README.md', content);
    const cmd = facts.find((f) => f.key === 'install-command');
    expect(cmd?.value).toBe('npm ci');
  });
});

describe('ReadmeParser.parse() — error handling', () => {
  it('returns [] for empty content', async () => {
    expect(await parser.parse('README.md', '')).toEqual([]);
  });

  it('returns [] for content with no relevant data', async () => {
    expect(await parser.parse('README.md', '# Hello World\n\nThis is a project.')).toEqual([]);
  });
});
