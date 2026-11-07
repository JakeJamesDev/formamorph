import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import paths from './samePath.cjs';

const { samePath } = paths;

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-samepath-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('samePath', () => {
  it('sees a link to a folder as that folder', () => {
    const real = path.join(tmp, 'real');
    fs.mkdirSync(real);
    const link = path.join(tmp, 'link');
    fs.symlinkSync(real, link, 'junction');
    expect(samePath(real, link)).toBe(true);
    expect(samePath(real, path.join(tmp, 'other'))).toBe(false);
  });

  it('ignores case on Windows only', () => {
    const dir = path.join(tmp, 'Folder');
    expect(samePath(dir, dir.toUpperCase(), 'win32')).toBe(true);
    expect(samePath(path.join(tmp, 'missing-a'), path.join(tmp, 'MISSING-A'), 'linux')).toBe(false);
  });
});
