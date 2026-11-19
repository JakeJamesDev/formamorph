// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { stashMaps } from './stashSourceMaps.mjs';

let root;
afterEach(() => rmSync(root, { recursive: true, force: true }));

const write = (file, text = '') => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};

describe('stashMaps', () => {
  it('moves every map out of the output and keeps everything else', () => {
    root = mkdtempSync(path.join(tmpdir(), 'stash-maps-'));
    const out = path.join(root, 'dist');
    const stash = path.join(root, 'sourcemaps');
    write(path.join(out, 'assets', 'index-a.js'));
    write(path.join(out, 'assets', 'index-a.js.map'));
    write(path.join(out, 'assets', 'worker-b.js.map'));
    write(path.join(stash, 'assets', 'old-build.js.map'));

    expect(stashMaps(out, stash).sort()).toEqual(['assets/index-a.js.map', 'assets/worker-b.js.map']);
    expect(existsSync(path.join(out, 'assets', 'index-a.js'))).toBe(true);
    expect(existsSync(path.join(out, 'assets', 'index-a.js.map'))).toBe(false);
    expect(existsSync(path.join(stash, 'assets', 'worker-b.js.map'))).toBe(true);
    expect(existsSync(path.join(stash, 'assets', 'old-build.js.map'))).toBe(false);
  });
});
