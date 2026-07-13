import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseReleases, buildRecentChangelog, checkForUpdate, type GithubRelease } from './UpdateService';

const rel = (tag: string, prerelease = false, draft = false, body = ''): GithubRelease => ({
  tag_name: tag,
  name: tag,
  body,
  prerelease,
  draft,
  assets: [],
  published_at: '2026-07-11T00:00:00Z',
});

describe('parseReleases', () => {
  it('stable channel ignores prereleases and drafts', () => {
    const releases = [rel('v2.3.0-beta.1', true), rel('v2.2.0-draft', false, true), rel('v2.1.0')];
    const r = parseReleases(releases, 'stable', '2.0.0');
    expect(r.available).toBe(true);
    expect(r.latestVersion).toBe('v2.1.0');
  });

  it('prerelease channel takes the newest including prereleases (still not drafts)', () => {
    const releases = [rel('v2.3.0-beta.1', true), rel('v2.1.0')];
    const r = parseReleases(releases, 'prerelease', '2.0.0');
    expect(r.available).toBe(true);
    expect(r.latestVersion).toBe('v2.3.0-beta.1');
  });

  it('is not-available when the newest eligible release is not newer', () => {
    const r = parseReleases([rel('v2.1.0', false, false, 'current notes')], 'stable', '2.1.0');
    expect(r.available).toBe(false);
    expect(r.latestVersion).toBe('v2.1.0');
    expect(r.changelog).toContain('current notes');
  });

  it('is not-available when there are no eligible releases', () => {
    expect(parseReleases([rel('v9.9.9', true)], 'stable', '2.0.0').available).toBe(false);
  });

  it('carries the recent releases as the changelog, newest first, folded under minor headers', () => {
    const r = parseReleases(
      [rel('v2.2.0', false, false, '### Added'), rel('v2.1.0', false, false, '### Fixed'), rel('v2.0.0', false, false, 'old')],
      'stable',
      '2.1.0',
    );
    expect(r.changelog).toContain('## 2.2');
    expect(r.changelog).toContain('### v2.2.0');
    expect(r.changelog).toContain('**Added**');
    expect(r.changelog).toContain('## 2.1');
    expect(r.changelog!.indexOf('## 2.2')).toBeLessThan(r.changelog!.indexOf('## 2.1'));
  });
});

describe('buildRecentChangelog', () => {
  it('folds the last 3 releases under minor headers, and fills blank bodies', () => {
    const md = buildRecentChangelog([
      rel('v3.0.0', false, false, 'three'),
      rel('v2.0.0', false, false, ''),
      rel('v1.0.0', false, false, 'one'),
      rel('v0.9.0', false, false, 'too old'),
    ]);
    expect(md).toContain('## 3.0');
    expect(md).toContain('### v3.0.0');
    expect(md).toContain('## 1.0');
    expect(md).not.toContain('## 0.9'); // capped at 3
    expect(md).toContain('_No release notes._'); // blank body filled
  });

  it('groups patch versions of the same minor under one header, each version its own heading', () => {
    const md = buildRecentChangelog([
      rel('v2.1.1', false, false, '### Fixed\n- a'),
      rel('v2.1.0', false, false, '### Added\n- b\n\n### Fixed\n- c'),
      rel('v2.0.3', false, false, '### Fixed\n- d'),
    ]);
    // Both 2.1.x patches sit under a single "## 2.1" header.
    expect(md.match(/## 2\.1$/gm)).toHaveLength(1);
    // Each version is its own heading; categories are separate bold caption labels (never merged onto the version).
    expect(md).toContain('### v2.1.1');
    expect(md).toContain('### v2.1.0');
    expect(md).toContain('**Added**');
    expect(md).toContain('**Fixed**');
    expect(md).not.toContain('·'); // no version·category merge
    expect(md).toContain('## 2.0');
    expect(md).toContain('### v2.0.3');
  });
});

describe('checkForUpdate', () => {
  const stubFetch = (releases: unknown, ok = true, status = 200) =>
    vi.stubGlobal(
      'fetch',
      // Minimal Response-like shape; cast through unknown since we only touch ok/status/text.
      vi.fn(() => Promise.resolve({ ok, status, text: () => Promise.resolve(JSON.stringify(releases)) } as unknown as Response)),
    );

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('resolves success with a parsed available result and caches the raw releases', async () => {
    stubFetch([rel('v2.2.0', false, false, 'notes')]);
    const res = await checkForUpdate('stable', '2.1.0');
    expect(res.success).toBe(true);
    expect(res.result?.available).toBe(true);
    expect(res.result?.latestVersion).toBe('v2.2.0');
    expect(localStorage.getItem('FORMAMORPH_updateCache')).toContain('v2.2.0');
  });

  it('falls back to cache on a network failure', async () => {
    stubFetch([rel('v2.2.0')]);
    await checkForUpdate('stable', '2.1.0'); // seeds the cache
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const res = await checkForUpdate('stable', '2.1.0');
    expect(res.success).toBe(true);
    expect(res.fromCache).toBe(true);
    expect(res.result?.latestVersion).toBe('v2.2.0');
  });

  it('returns success:false when the fetch fails and there is no cache', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const res = await checkForUpdate('stable', '2.1.0');
    expect(res.success).toBe(false);
    expect(res.error).toBe('offline');
  });

  it('treats a non-200 response as a failure (with no cache)', async () => {
    stubFetch([], false, 503);
    const res = await checkForUpdate('stable', '2.1.0');
    expect(res.success).toBe(false);
    expect(res.error).toContain('503');
  });
});
