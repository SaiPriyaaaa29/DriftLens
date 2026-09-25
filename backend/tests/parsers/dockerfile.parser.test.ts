import { describe, it, expect } from 'vitest';
import { DockerfileParser } from '../../src/parsers/dockerfile.parser';

const parser = new DockerfileParser();

describe('DockerfileParser.supports()', () => {
  it('matches Dockerfile', () => expect(parser.supports('Dockerfile')).toBe(true));
  it('matches Dockerfile.prod', () => expect(parser.supports('Dockerfile.prod')).toBe(true));
  it('matches nested Dockerfile', () => expect(parser.supports('docker/Dockerfile')).toBe(true));
  it('rejects README.md', () => expect(parser.supports('README.md')).toBe(false));
  it('rejects docker-compose.yml', () => expect(parser.supports('docker-compose.yml')).toBe(false));
});

describe('DockerfileParser.parse() — FROM node version', () => {
  it('extracts plain node version', async () => {
    const content = 'FROM node:18\nRUN npm ci';
    const facts = await parser.parse('Dockerfile', content);
    const f = facts.find((x) => x.key === 'node-version');
    expect(f).toMatchObject({ category: 'runtime-version', value: '18' });
  });

  it('strips alpine suffix from version', async () => {
    const content = 'FROM node:20-alpine\n';
    const facts = await parser.parse('Dockerfile', content);
    const f = facts.find((x) => x.key === 'node-version');
    expect(f?.value).toBe('20');
  });

  it('extracts three-part version', async () => {
    const content = 'FROM node:18.12.0-slim\n';
    const facts = await parser.parse('Dockerfile', content);
    const f = facts.find((x) => x.key === 'node-version');
    expect(f?.value).toBe('18.12.0');
  });

  it('returns no version for non-node base image', async () => {
    const content = 'FROM python:3.11\n';
    const facts = await parser.parse('Dockerfile', content);
    expect(facts.filter((f) => f.key === 'node-version')).toHaveLength(0);
  });
});

describe('DockerfileParser.parse() — ENV declarations', () => {
  it('extracts KEY=VALUE env var', async () => {
    const content = 'FROM node:18\nENV PORT=3000\n';
    const facts = await parser.parse('Dockerfile', content);
    const f = facts.find((x) => x.key === 'ENV:PORT');
    expect(f).toMatchObject({ category: 'env-var', value: '3000' });
  });

  it('extracts KEY VALUE (space) syntax', async () => {
    const content = 'FROM node:18\nENV NODE_ENV production\n';
    const facts = await parser.parse('Dockerfile', content);
    const f = facts.find((x) => x.key === 'ENV:NODE_ENV');
    expect(f?.value).toBe('production');
  });

  it('extracts env var with empty value', async () => {
    const content = 'ENV SECRET_KEY=\n';
    const facts = await parser.parse('Dockerfile', content);
    const f = facts.find((x) => x.key === 'ENV:SECRET_KEY');
    expect(f).toBeDefined();
    expect(f?.value).toBe('');
  });
});

describe('DockerfileParser.parse() — RUN install commands', () => {
  it('extracts npm ci from RUN step', async () => {
    const content = 'FROM node:18\nRUN npm ci\n';
    const facts = await parser.parse('Dockerfile', content);
    const f = facts.find((x) => x.key === 'install-command');
    expect(f?.value).toBe('npm ci');
  });

  it('extracts yarn install from RUN step', async () => {
    const content = 'FROM node:18\nRUN yarn install --frozen-lockfile\n';
    const facts = await parser.parse('Dockerfile', content);
    const f = facts.find((x) => x.key === 'install-command');
    expect(f?.value).toBe('yarn install');
  });
});

describe('DockerfileParser.parse() — error handling', () => {
  it('returns [] for empty content', async () => {
    expect(await parser.parse('Dockerfile', '')).toEqual([]);
  });
});
