import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import profileMerge from './profileMerge.cjs';

const { MARKER_FILE, mergeSource, readMarker, writeMarker } = profileMerge;

let root;
let source;
let target;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-merge-'));
  source = path.join(root, 'AppData', 'Formamorph');
  target = path.join(root, 'Games', 'Formamorph', 'userdata');
  fs.mkdirSync(target, { recursive: true });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const withStores = () => {
  fs.mkdirSync(path.join(source, 'IndexedDB', 'app_local_0.indexeddb.leveldb'), { recursive: true });
};

const offer = (over = {}) => mergeSource({
  platform: 'win32',
  env: { FORMAMORPH_ROOT: path.join(root, 'Games', 'Formamorph') },
  sourceDir: source,
  targetDir: target,
  fsApi: fs,
  ...over,
});

describe('merge offer detection', () => {
  it('offers the AppData profile on a launcher start when it holds stores', () => {
    withStores();
    expect(offer()).toEqual({ dir: source, merged: [] });
  });

  it('does not offer on a non-launcher start', () => {
    withStores();
    expect(offer({ env: {} })).toBeNull();
    expect(offer({ platform: 'linux' })).toBeNull();
  });

  it('does not offer when the AppData profile is missing', () => {
    expect(offer()).toBeNull();
  });

  it('offers a profile that holds only settings, local models or a model-folder choice', () => {
    fs.mkdirSync(path.join(source, 'Local Storage', 'leveldb'), { recursive: true });
    expect(offer()).toEqual({ dir: source, merged: [] });
    fs.rmSync(path.join(source, 'Local Storage'), { recursive: true });
    fs.mkdirSync(path.join(source, 'models'), { recursive: true });
    fs.writeFileSync(path.join(source, 'models', 'a.gguf'), 'x');
    expect(offer()).toEqual({ dir: source, merged: [] });
    fs.rmSync(path.join(source, 'models'), { recursive: true });
    expect(offer()).toBeNull();
    fs.writeFileSync(path.join(source, 'model-locations.json'), JSON.stringify({ searchSubfolders: true }));
    expect(offer()).toEqual({ dir: source, merged: [] });
  });

  it('does not offer when the AppData profile holds no store', () => {
    fs.mkdirSync(path.join(source, 'IndexedDB'), { recursive: true });
    fs.mkdirSync(path.join(source, 'GPUCache'), { recursive: true });
    expect(offer()).toBeNull();
  });

  it('does not offer the folder its own profile', () => {
    withStores();
    expect(offer({ targetDir: source.toUpperCase() })).toBeNull();
  });

  it('does not offer once the declined marker exists', () => {
    withStores();
    writeMarker(source, 'declined', fs);
    expect(offer()).toBeNull();
  });

  it('does not offer over an unreadable marker', () => {
    withStores();
    fs.writeFileSync(path.join(source, MARKER_FILE), '{not json');
    expect(offer()).toBeNull();
  });

  it('reports the merged categories once the done marker exists', () => {
    withStores();
    writeMarker(source, 'done', fs, ['worlds', 'saves']);
    expect(offer()).toEqual({ dir: source, merged: ['worlds', 'saves'] });
  });

  it('adds to the merged categories on each done marker', () => {
    withStores();
    writeMarker(source, 'done', fs, ['worlds']);
    writeMarker(source, 'done', fs, ['worlds', 'settings']);
    expect(readMarker(source, fs)).toEqual({ state: 'done', categories: ['worlds', 'settings'] });
  });

  it('refuses an unknown marker state', () => {
    withStores();
    expect(() => writeMarker(source, 'later', fs)).toThrow();
    expect(offer()).toEqual({ dir: source, merged: [] });
  });
});
