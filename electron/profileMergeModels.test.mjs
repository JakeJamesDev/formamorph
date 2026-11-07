import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import models from './profileMergeModels.cjs';

const { sourceModelsDir, plannedModelsDir, modelSides, samePath } = models;

let tmp;
const appData = () => path.join(tmp, 'appdata');
const folderModels = () => path.join(tmp, 'root', 'models');

function write(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(bytes, 1));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-mergemodels-'));
  fs.mkdirSync(appData(), { recursive: true });
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('sourceModelsDir', () => {
  it('is the models folder in the AppData profile without a saved choice', () => {
    expect(sourceModelsDir(appData(), fs)).toBe(path.join(appData(), 'models'));
  });

  it('is the AppData profile\'s own download folder when it saved one', () => {
    const chosen = path.join(tmp, 'elsewhere');
    fs.writeFileSync(path.join(appData(), 'model-locations.json'), JSON.stringify({ downloadDir: chosen }));
    expect(sourceModelsDir(appData(), fs)).toBe(chosen);
  });
});

describe('modelSides', () => {
  it('lists the model files on both sides', () => {
    write(path.join(appData(), 'models', 'a.gguf'), 10);
    write(path.join(appData(), 'models', 'readme.txt'), 3);
    write(path.join(folderModels(), 'b.gguf'), 20);
    const sides = modelSides({ sourceDir: appData(), targetModelsDir: folderModels(), fsApi: fs });
    expect(sides.source).toEqual([{ name: 'a.gguf', size: 10 }]);
    expect(sides.target).toEqual([{ name: 'b.gguf', size: 20 }]);
  });

  it.runIf(process.platform === 'win32')('offers nothing when the AppData models folder is the folder\'s own, in other letter case', () => {
    write(path.join(folderModels(), 'a.gguf'), 10);
    fs.writeFileSync(path.join(appData(), 'model-locations.json'), JSON.stringify({ downloadDir: folderModels().toUpperCase() }));
    const sides = modelSides({ sourceDir: appData(), targetModelsDir: folderModels(), fsApi: fs });
    expect(sides.source).toEqual([]);
  });

  it('offers nothing when the AppData folder choice becomes the folder\'s own through the fill', () => {
    // The folder saved no choice, so the fill gives it the AppData one: both sides are one folder.
    const chosen = path.join(tmp, 'elsewhere');
    write(path.join(chosen, 'a.gguf'), 10);
    fs.writeFileSync(path.join(appData(), 'model-locations.json'), JSON.stringify({ downloadDir: chosen }));
    const targetModelsDir = plannedModelsDir({ chosen: null, sourceDir: appData(), defaultDir: folderModels(), fsApi: fs });
    expect(targetModelsDir).toBe(chosen);
    expect(modelSides({ sourceDir: appData(), targetModelsDir, fsApi: fs }).source).toEqual([]);
  });
});

describe('plannedModelsDir', () => {
  it('keeps the folder\'s own choice over the AppData one', () => {
    fs.writeFileSync(path.join(appData(), 'model-locations.json'), JSON.stringify({ downloadDir: path.join(tmp, 'theirs') }));
    expect(plannedModelsDir({ chosen: path.join(tmp, 'mine'), sourceDir: appData(), defaultDir: folderModels(), fsApi: fs }))
      .toBe(path.join(tmp, 'mine'));
  });

  it('falls back to the default when neither side chose', () => {
    expect(plannedModelsDir({ chosen: null, sourceDir: appData(), defaultDir: folderModels(), fsApi: fs })).toBe(folderModels());
  });
});

describe('samePath', () => {
  it('sees a link to a folder as that folder', () => {
    const real = path.join(tmp, 'real');
    fs.mkdirSync(real);
    const link = path.join(tmp, 'link');
    fs.symlinkSync(real, link, 'junction');
    expect(samePath(real, link)).toBe(true);
    expect(samePath(real, path.join(tmp, 'other'))).toBe(false);
  });
});
