import { describe, it, expect } from 'vitest';
import { CiWorkflowParser } from '../../src/parsers/ci-workflow.parser';

const parser = new CiWorkflowParser();

const WORKFLOW_PATH = '.github/workflows/ci.yml';

describe('CiWorkflowParser.supports()', () => {
  it('matches .github/workflows/ci.yml', () =>
    expect(parser.supports('.github/workflows/ci.yml')).toBe(true));
  it('matches .github/workflows/build.yaml', () =>
    expect(parser.supports('.github/workflows/build.yaml')).toBe(true));
  it('rejects root-level yml', () =>
    expect(parser.supports('docker-compose.yml')).toBe(false));
  it('rejects non-workflow yml', () =>
    expect(parser.supports('.github/dependabot.yml')).toBe(false));
});

describe('CiWorkflowParser.parse() — matrix node versions', () => {
  const matrixWorkflow = `
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
`;

  it('extracts all matrix node versions', async () => {
    const facts = await parser.parse(WORKFLOW_PATH, matrixWorkflow);
    const versions = facts
      .filter((f) => f.key === 'node-version')
      .map((f) => f.value);
    expect(versions).toContain('18');
    expect(versions).toContain('20');
    expect(versions).toContain('22');
  });
});

describe('CiWorkflowParser.parse() — setup-node action', () => {
  const setupNodeWorkflow = `
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
`;

  it('extracts node-version from setup-node with block', async () => {
    const facts = await parser.parse(WORKFLOW_PATH, setupNodeWorkflow);
    const f = facts.find((x) => x.key === 'node-version');
    expect(f?.value).toBe('20');
  });

  it('extracts install command from run step', async () => {
    const facts = await parser.parse(WORKFLOW_PATH, setupNodeWorkflow);
    const f = facts.find((x) => x.key === 'install-command');
    expect(f?.value).toBe('npm ci');
  });
});

describe('CiWorkflowParser.parse() — yarn install', () => {
  const yarnWorkflow = `
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: yarn install
`;

  it('extracts yarn install as install command', async () => {
    const facts = await parser.parse(WORKFLOW_PATH, yarnWorkflow);
    const f = facts.find((x) => x.key === 'install-command');
    expect(f?.value).toBe('yarn install');
  });
});

describe('CiWorkflowParser.parse() — error handling', () => {
  it('returns [] for empty content', async () => {
    expect(await parser.parse(WORKFLOW_PATH, '')).toEqual([]);
  });

  it('returns [] for invalid YAML', async () => {
    expect(await parser.parse(WORKFLOW_PATH, '{ bad yaml: [')).toEqual([]);
  });

  it('returns [] for YAML with no jobs', async () => {
    const content = 'on: [push]\nname: CI\n';
    expect(await parser.parse(WORKFLOW_PATH, content)).toEqual([]);
  });
});
