// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fetchArgs } from './fetchPinnedCommits.mjs';
import pins from './pinnedCommits.json';

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const testJob = ci.slice(ci.indexOf('\n  test:\n'));

describe('the CI test job', () => {
  it('fetches the pinned commits through the script, never from a list of its own', () => {
    expect(ci).not.toMatch(/\b[0-9a-f]{40}\b/);
    expect(ci).not.toMatch(/git fetch/);
    const fetch = testJob.indexOf('run: node scripts/fetchPinnedCommits.mjs');
    expect(fetch).toBeGreaterThan(-1);
    expect(fetch).toBeLessThan(testJob.indexOf('run: npm test'));
  });

  it('fetches every pinned commit a shallow clone lacks, and leaves a full clone alone', () => {
    expect(Object.values(pins).length).toBeGreaterThan(0);
    expect(fetchArgs(() => false)).toEqual(expect.arrayContaining(Object.values(pins)));
    expect(fetchArgs(() => true)).toBeNull();
  });

  it('runs every shard of the suite through the logged runner', () => {
    expect(testJob).toMatch(/run: npm test -- --shard=\$\{\{ matrix\.shard \}\}\/4\n/);
    expect(testJob).toMatch(/shard: \[1, 2, 3, 4\]/);
    expect(ci).not.toMatch(/vitest/);
  });

  it('uploads each shard\'s rerun log, even when the shard goes red', () => {
    expect(testJob).toMatch(/TEST_RERUN_LOG: test-reruns\.jsonl/);
    expect(testJob).toMatch(/upload-artifact@v\d+\n\s+if: always\(\)\n\s+with:\n\s+name: test-reruns-shard-\$\{\{ matrix\.shard \}\}\n\s+path: test-reruns\.jsonl/);
  });
});
