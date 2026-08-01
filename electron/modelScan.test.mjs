import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import modelScan from './modelScan.cjs';

const { scanModels, resolveModelRef, isRootRef, MAX_DEPTH } = modelScan;

// Real folders on disk: the scan's whole job is reading a directory tree, and a mocked fs would prove
// nothing about depth caps or symlink handling.
let tmp;
const rootDir = () => path.join(tmp, 'app', 'models');
const extDir = () => path.join(tmp, 'lmstudio', 'models');

/** Create a zero-filled file of `size` bytes, making parent folders as needed. */
function write(file, size = 4) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(size));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-modelscan-'));
  fs.mkdirSync(rootDir(), { recursive: true });
  fs.mkdirSync(extDir(), { recursive: true });
});
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('scanModels: which files are listed', () => {
  it('lists GGUFs in the app folder and ignores everything else', () => {
    write(path.join(rootDir(), 'alpha.gguf'), 10);
    write(path.join(rootDir(), 'notes.txt'));
    write(path.join(rootDir(), 'beta.gguf.part')); // an interrupted download
    const out = scanModels({ rootDir: rootDir(), externalDir: null, searchSubfolders: false });
    expect(out.map((m) => m.fileName)).toEqual(['alpha.gguf']);
    expect(out[0]).toMatchObject({ id: 'alpha.gguf', source: 'root', subpath: '', size: 10 });
  });

  it('matches the .gguf suffix case-insensitively', () => {
    write(path.join(rootDir(), 'shouty.GGUF'));
    const out = scanModels({ rootDir: rootDir(), externalDir: null, searchSubfolders: false });
    expect(out.map((m) => m.fileName)).toEqual(['shouty.GGUF']);
  });

  it('never recurses into the app folder', () => {
    write(path.join(rootDir(), 'nested', 'deep.gguf'));
    const out = scanModels({ rootDir: rootDir(), externalDir: null, searchSubfolders: true });
    expect(out).toEqual([]);
  });

  it('finds nested external models only when subfolder search is on', () => {
    write(path.join(extDir(), 'bartowski', 'Some-Model-GGUF', 'model-Q4.gguf'));
    const opts = { rootDir: rootDir(), externalDir: extDir() };

    expect(scanModels({ ...opts, searchSubfolders: false })).toEqual([]);

    const deep = scanModels({ ...opts, searchSubfolders: true });
    expect(deep).toHaveLength(1);
    expect(deep[0]).toMatchObject({
      id: 'ext:bartowski/Some-Model-GGUF/model-Q4.gguf',
      fileName: 'model-Q4.gguf',
      subpath: 'bartowski/Some-Model-GGUF',
      source: 'external',
    });
  });

  it('lists both copies when the two folders share a filename, distinguished by ref', () => {
    write(path.join(rootDir(), 'twin.gguf'));
    write(path.join(extDir(), 'twin.gguf'));
    const out = scanModels({ rootDir: rootDir(), externalDir: extDir(), searchSubfolders: false });
    expect(out.map((m) => m.id)).toEqual(['ext:twin.gguf', 'twin.gguf'].sort());
    expect(new Set(out.map((m) => m.path)).size).toBe(2);
  });

  it('stops descending past the depth cap', () => {
    const deep = path.join(extDir(), ...Array(MAX_DEPTH + 2).fill('d'), 'buried.gguf');
    write(deep);
    write(path.join(extDir(), 'shallow.gguf'));
    const out = scanModels({ rootDir: rootDir(), externalDir: extDir(), searchSubfolders: true });
    expect(out.map((m) => m.fileName)).toEqual(['shallow.gguf']);
  });
});

describe('scanModels: symlinks', () => {
  /** Directory symlinks need elevation or Developer Mode on Windows; skip rather than fail the suite. */
  const trySymlink = (target, linkPath, type) => {
    try { fs.symlinkSync(target, linkPath, type); return true; } catch { return false; }
  };

  it('does not descend through a symlinked directory', () => {
    const outside = path.join(tmp, 'outside');
    write(path.join(outside, 'escaped.gguf'));
    if (!trySymlink(outside, path.join(extDir(), 'link'), 'junction')) return;
    const out = scanModels({ rootDir: rootDir(), externalDir: extDir(), searchSubfolders: true });
    expect(out).toEqual([]);
  });

  it('still lists a symlinked GGUF file (users link models between apps)', () => {
    const real = path.join(tmp, 'store', 'real.gguf');
    write(real, 7);
    if (!trySymlink(real, path.join(extDir(), 'linked.gguf'), 'file')) return;
    const out = scanModels({ rootDir: rootDir(), externalDir: extDir(), searchSubfolders: true });
    expect(out.map((m) => m.fileName)).toEqual(['linked.gguf']);
  });
});

describe('scanModels: the external folder cannot duplicate the app folder', () => {
  it('ignores an external folder set to the app folder itself', () => {
    write(path.join(rootDir(), 'solo.gguf'));
    const out = scanModels({ rootDir: rootDir(), externalDir: rootDir(), searchSubfolders: true });
    expect(out.map((m) => m.id)).toEqual(['solo.gguf']);
  });

  it('skips app-folder files when the external folder is a parent of it', () => {
    write(path.join(rootDir(), 'ours.gguf'));
    const parent = path.join(tmp, 'app');
    write(path.join(parent, 'theirs.gguf'));
    const out = scanModels({ rootDir: rootDir(), externalDir: parent, searchSubfolders: true });
    // ours.gguf appears once (as a root model), not a second time via the external walk.
    expect(out.map((m) => m.id).sort()).toEqual(['ext:theirs.gguf', 'ours.gguf']);
  });
});

describe('scanModels: a folder that is not there', () => {
  it('returns the app folder alone rather than throwing', () => {
    write(path.join(rootDir(), 'alpha.gguf'));
    const out = scanModels({ rootDir: rootDir(), externalDir: path.join(tmp, 'gone'), searchSubfolders: true });
    expect(out.map((m) => m.id)).toEqual(['alpha.gguf']);
  });
});

describe('resolveModelRef: only files inside a searched folder can be loaded', () => {
  const opts = () => ({ rootDir: rootDir(), externalDir: extDir() });

  it('resolves a root ref to a path in the app folder', () => {
    expect(resolveModelRef('alpha.gguf', opts())).toBe(path.join(rootDir(), 'alpha.gguf'));
  });

  it('resolves an external ref to a path in the external folder', () => {
    expect(resolveModelRef('ext:pub/repo/m.gguf', opts()))
      .toBe(path.join(extDir(), 'pub', 'repo', 'm.gguf'));
  });

  // The reason this function exists: the ref crosses the IPC boundary from the renderer.
  it.each([
    ['ext:../../../secrets.gguf', 'traversal out of the external folder'],
    ['ext:pub/../../escape.gguf', 'traversal through a subfolder'],
    [`ext:${path.resolve(os.tmpdir(), 'anywhere.gguf')}`, 'an absolute path'],
    ['ext:', 'an empty external ref'],
    ['ext:notes.txt', 'a non-GGUF file'],
    ['', 'an empty ref'],
  ])('rejects %s (%s)', (ref) => {
    expect(resolveModelRef(ref, opts())).toBeNull();
  });

  // Root refs are flat by construction, so a path-shaped one is reduced to its filename rather than
  // rejected — either way it can only ever land in the app folder.
  it('flattens a path-shaped root ref into the app folder', () => {
    expect(resolveModelRef('../../evil.gguf', opts())).toBe(path.join(rootDir(), 'evil.gguf'));
    expect(resolveModelRef('sub/alpha.gguf', opts())).toBe(path.join(rootDir(), 'alpha.gguf'));
  });

  it('refuses an external ref when no external folder is configured', () => {
    expect(resolveModelRef('ext:m.gguf', { rootDir: rootDir(), externalDir: null })).toBeNull();
  });
});

describe('isRootRef: what delete and download are allowed to touch', () => {
  it('accepts app-folder refs and rejects external ones', () => {
    expect(isRootRef('alpha.gguf')).toBe(true);
    expect(isRootRef('ext:pub/repo/m.gguf')).toBe(false);
  });
});
