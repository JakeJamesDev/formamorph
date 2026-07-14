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
  // A shared history, newest→oldest, spanning three minors with a multi-patch 2.2.
  const history = () => [
    rel('v2.4.0', false, false, 'four'),
    rel('v2.3.1', false, false, '### Fixed\n- a'),
    rel('v2.3.0', false, false, '### Added\n- b'),
    rel('v2.2.3', false, false, 'p3'),
    rel('v2.2.2', false, false, ''),
    rel('v2.2.1', false, false, 'p1'),
    rel('v2.2.0', false, false, 'p0'),
    rel('v2.1.4', false, false, 'q4'),
    rel('v2.1.0', false, false, 'q0'),
    rel('v2.0.0', false, false, 'old'),
  ];

  it('up to date: shows the full current minor + previous two, then a gap for older', () => {
    const md = buildRecentChangelog(history(), '2.4.0');
    expect(md).toContain('### v2.4.0'); // current minor (rule 1 / rule 0)
    expect(md).toContain('### v2.3.1'); // previous two (rule 3)
    expect(md).toContain('### v2.3.0');
    expect(md).not.toContain('### v2.2.3'); // older hidden
    expect(md).toContain('...'); // gap marker for the hidden tail
  });

  it('behind by exactly one into a new minor: rule 0 still surfaces the newest release', () => {
    const md = buildRecentChangelog(history(), '2.3.1'); // missing only v2.4.0 → rule 2 off
    expect(md).toContain('## 2.4');
    expect(md).toContain('### v2.4.0'); // never omit an available update
    expect(md).toContain('### v2.3.1'); // current minor
    expect(md).toContain('### v2.3.0');
    expect(md).toContain('### v2.2.3'); // previous two (older than 2.3.1)
  });

  it('behind by many: latest 3 + full current minor, with gaps marking hidden ranges', () => {
    const md = buildRecentChangelog(history(), '2.1.0');
    // Rule 2 (behind by >1) → newest three across two minors.
    expect(md).toContain('## 2.4');
    expect(md).toContain('### v2.4.0');
    expect(md).toContain('### v2.3.1');
    expect(md).toContain('### v2.3.0');
    // Rule 1 → the full current minor (both 2.1 patches), under one header.
    expect(md.match(/## 2\.1$/gm)).toHaveLength(1);
    expect(md).toContain('### v2.1.4');
    expect(md).toContain('### v2.1.0');
    expect(md).not.toContain('## 2.2'); // the whole 2.2 range is hidden
    expect(md).toContain('### v2.0.0'); // previous-two (older than 2.1.0) reaches down to 2.0.0
    expect(md.match(/^\.\.\.$/gm)).toHaveLength(1); // exactly one gap: the hidden 2.2 range
    expect(md).not.toContain('·'); // no version·category merge
    expect(md).toContain('**Added**'); // category labels preserved
  });

  it('fills blank release bodies', () => {
    const md = buildRecentChangelog(history(), '2.2.2');
    expect(md).toContain('_No release notes._'); // v2.2.2 has an empty body
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
