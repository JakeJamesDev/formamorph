import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import modelFolder from './profileMergeModelFolder.cjs';

const { LOCATIONS_FILE, readFields, fillField } = modelFolder;

let root;
let sourceDir;
let targetDir;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-merge-models-'));
  sourceDir = path.join(root, 'AppData');
  targetDir = path.join(root, 'userdata');
  fs.mkdirSync(sourceDir);
  fs.mkdirSync(targetDir);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const write = (dir, value) => fs.writeFileSync(path.join(dir, LOCATIONS_FILE), JSON.stringify(value));
const fill = (field) => fillField({ sourceDir, targetDir, field, fsApi: fs });

describe('model-folder choice', () => {
  it('reads only the fields a file sets', () => {
    write(sourceDir, { downloadDir: 'D:\\Models', externalDir: null, searchSubfolders: false });
    expect(readFields(sourceDir, fs)).toEqual({ downloadDir: 'D:\\Models', searchSubfolders: false });
    expect(readFields(targetDir, fs)).toEqual({});
  });

  it('takes the AppData value for a field the folder lacks', () => {
    write(sourceDir, { downloadDir: 'D:\\Models', externalDir: 'E:\\Lm' });
    expect(fill('downloadDir')).toEqual({ downloadDir: 'D:\\Models' });
    expect(readFields(targetDir, fs)).toEqual({ downloadDir: 'D:\\Models' });
  });

  it("keeps the folder's choice over the AppData value", () => {
    write(sourceDir, { downloadDir: 'D:\\Models', searchSubfolders: true });
    write(targetDir, { downloadDir: 'F:\\Mine', searchSubfolders: false });
    fill('downloadDir');
    fill('searchSubfolders');
    expect(readFields(targetDir, fs)).toEqual({ downloadDir: 'F:\\Mine', searchSubfolders: false });
  });

  it("fills a missing field beside the folder's other fields", () => {
    write(sourceDir, { downloadDir: 'D:\\Models', externalDir: 'E:\\Lm' });
    write(targetDir, { downloadDir: 'F:\\Mine' });
    fill('externalDir');
    expect(readFields(targetDir, fs)).toEqual({ downloadDir: 'F:\\Mine', externalDir: 'E:\\Lm' });
  });

  it('writes nothing when the AppData file does not set the field', () => {
    write(sourceDir, { downloadDir: 'D:\\Models' });
    fill('externalDir');
    expect(fs.existsSync(path.join(targetDir, LOCATIONS_FILE))).toBe(false);
  });

  it('rejects an unknown field', () => {
    expect(() => fill('rootDir')).toThrow(/Unknown/);
  });
});
