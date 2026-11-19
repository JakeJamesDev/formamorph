// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WIKI_CHANGELOG_URL } from '../src/services/UpdateService';
import { parseReleaseSummary } from '../src/lib/whatsNew/releaseSummary';
import { FULL_CHANGELOG_URL } from './validateReleaseSummary.mjs';

const run = (...args) => spawnSync('node', ['scripts/validateReleaseSummary.mjs', ...args], { encoding: 'utf8' });

describe('the Release Summary validator', () => {
  it('passes the 3.7.0 seed silently', () => {
    const result = run('docs/whats-new/3.7.0.md');
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('fails an invalid summary and prints each problem with its line', () => {
    const result = run('scripts/fixtures/release-summary/3.7.0.md');
    expect(result.status).toBe(1);
    expect(result.stderr.trim().split('\n')).toEqual([
      'error: scripts/fixtures/release-summary/3.7.0.md:7: The emoji 🦄 on "Unmapped icon" has no icon. Use one from the icon map.',
      'error: scripts/fixtures/release-summary/3.7.0.md:9: Unknown heading "## Highlights". Use only "## Major", "## New" and "## Fixes".',
    ]);
  });

  it('fails when the version has no summary', () => {
    const result = run('docs/whats-new/0.0.0.md');
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('error: No Release Summary at docs/whats-new/0.0.0.md.\n');
  });

  it('prints the release body as the summary plus a Full changelog link the parser ignores', () => {
    const seed = readFileSync('docs/whats-new/3.7.0.md', 'utf8');
    const result = run('docs/whats-new/3.7.0.md', '--body');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${seed.trimEnd()}\n\n---\n\n[Full changelog](${WIKI_CHANGELOG_URL})\n`);
    expect(FULL_CHANGELOG_URL).toBe(WIKI_CHANGELOG_URL);
    expect(parseReleaseSummary(result.stdout)).toEqual(parseReleaseSummary(seed));
  });

  it('prints no body for an invalid summary', () => {
    expect(run('scripts/fixtures/release-summary/3.7.0.md', '--body').stdout).toBe('');
  });
});

describe('the release workflow', () => {
  const release = readFileSync('.github/workflows/release.yml', 'utf8');
  const job = (name) => {
    const start = release.indexOf(`\n  ${name}:\n`);
    const next = release.slice(start + 1).search(/\n {2}[\w-]+:\n/);
    return release.slice(start, next === -1 ? undefined : start + 1 + next);
  };
  const VALIDATE = 'node scripts/validateReleaseSummary.mjs "docs/whats-new/${GITHUB_REF_NAME#v}.md"';

  it('validates the tag\'s summary in the build job before anything builds or publishes', () => {
    const build = job('build');
    const validate = build.indexOf(VALIDATE);
    expect(validate).toBeGreaterThan(-1);
    expect(validate).toBeLessThan(build.indexOf('run: npm ci'));
    expect(validate).toBeLessThan(build.indexOf('run: npm run ${{ matrix.script }}'));
  });

  it('publishes the summary plus a Full changelog link as the release body', () => {
    const publish = job('publish');
    expect(publish).toContain(`${VALIDATE} --body > notes.md`);
    expect(publish).toContain('body_path: notes.md');
    expect(release).not.toContain('extractReleaseNotes');
  });
});
