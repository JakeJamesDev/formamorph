// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { bundledWorldImportCheck, wholeWorldModules } from './bundledWorldImportCheck.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A real Vite build of a page whose entry runs `entry`, beside a `defaultworlds/forest.json`. */
async function buildWith(entry) {
  const root = mkdtempSync(path.join(tmpdir(), 'world-import-check-'));
  roots.push(root);
  mkdirSync(path.join(root, 'defaultworlds'));
  writeFileSync(path.join(root, 'defaultworlds', 'forest.json'), JSON.stringify({ worldOverview: { name: 'Forest' } }));
  writeFileSync(path.join(root, 'main.js'), entry);
  writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>t</title><script type="module" src="./main.js"></script>');
  // Vitest sets NODE_ENV=test, which builds with import.meta.env.DEV true; a release build runs as production.
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await build({ root, configFile: false, logLevel: 'silent', plugins: [bundledWorldImportCheck()] });
  } finally {
    process.env.NODE_ENV = nodeEnv;
  }
}

describe('the bundled world import check', () => {
  it('fails a build that lazy-loads a whole bundled world', async () => {
    await expect(buildWith("window.load = () => import('./defaultworlds/forest.json');"))
      .rejects.toThrow(/forest\.json in assets\/forest-/);
  });

  it('fails a build that imports a whole bundled world statically', async () => {
    await expect(buildWith("import world from './defaultworlds/forest.json'; console.log(world);"))
      .rejects.toThrow(/forest\.json/);
  });

  it('passes a build that imports the world as ?raw text', async () => {
    // Spelled through JSON.stringify: the test-selection scan reads a quoted `?raw` import as this file's own.
    await expect(buildWith(`window.load = () => import(${JSON.stringify('./defaultworlds/forest.json?raw')});`)).resolves.toBeUndefined();
  });

  it('passes a build whose world import sits behind import.meta.env.DEV', async () => {
    await expect(buildWith("if (import.meta.env.DEV) window.load = () => import('./defaultworlds/forest.json');")).resolves.toBeUndefined();
  });

  it('names whole world modules and skips queried ones and other JSON', () => {
    expect(wholeWorldModules(['/a/src/defaultworlds/veilwood.json', '/a/src/defaultworlds/veilwood.json?raw', '/a/src/data/tags.json', 'C:\\a\\src\\defaultworlds\\slime.json']))
      .toEqual(['veilwood.json', 'slime.json']);
  });
});
