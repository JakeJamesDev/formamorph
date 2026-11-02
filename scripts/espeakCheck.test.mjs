// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { espeakCheck } from './espeakCheck.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A real Vite build of a page whose entry script is `script` and whose public folder holds `publicFiles`. */
async function buildWith(script, publicFiles = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'espeak-check-'));
  roots.push(root);
  mkdirSync(path.join(root, 'public'));
  for (const [file, content] of Object.entries(publicFiles)) writeFileSync(path.join(root, 'public', file), content);
  writeFileSync(path.join(root, 'main.js'), script);
  writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>t</title><script type="module" src="/main.js"></script>');
  await build({ root, configFile: false, logLevel: 'silent', plugins: [espeakCheck()] });
}

describe('the eSpeak NG build check', () => {
  it('passes a build with ordinary text, including English words that contain "espeak"', async () => {
    await buildWith('console.log("bespeak doublespeak")', { 'cmudict.dict': 'bespeak B IH0 S P IY1 K\n' });
  });

  it('refuses a bundle that holds the phonemizer package name', async () => {
    await expect(buildWith('console.log("phonemizer")')).rejects.toThrow(/assets\/.*\.js: phonemizer/);
  });

  it('refuses the eSpeak NG glue names in a bundle', async () => {
    await expect(buildWith('globalThis.f = "_espeak_Initialize"')).rejects.toThrow(/espeak_/);
  });

  it.each(['eSpeakNG', 'eSpeak NG', 'espeakEVENT'])('refuses %s in a bundle', async (marker) => {
    await expect(buildWith(`globalThis.f = "${marker}"`)).rejects.toThrow(marker);
  });

  it('refuses a copied data file, whatever its type', async () => {
    await expect(buildWith('1', { 'voice.bin': 'xx espeak-ng-data xx' })).rejects.toThrow(/voice\.bin: espeak-ng-data/);
  });

  it('runs on the app build', () => {
    expect(readFileSync('vite.config.js', 'utf8')).toMatch(/plugins: \[[^\]]*espeakCheck\(\)/);
  });
});
