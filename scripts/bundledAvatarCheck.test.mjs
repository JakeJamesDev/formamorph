// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { bundledAvatarCheck } from './bundledAvatarCheck.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A real Vite build of an empty page whose public folder holds `files`, returning the output folder. */
async function buildWith(avatarSet, files) {
  const root = mkdtempSync(path.join(tmpdir(), 'avatar-check-'));
  roots.push(root);
  mkdirSync(path.join(root, 'public'));
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, 'public', file)), { recursive: true });
    writeFileSync(path.join(root, 'public', file), 'vrm');
  }
  writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>t</title>');
  await build({ root, configFile: false, logLevel: 'silent', plugins: [bundledAvatarCheck(avatarSet)] });
  return path.join(root, 'dist');
}

describe('the bundled Avatar build check', () => {
  it('passes an SFW build holding only the default', async () => {
    const dist = await buildWith('', ['default-avatar.vrm']);
    expect(existsSync(path.join(dist, 'default-avatar.vrm'))).toBe(true);
    expect(existsSync(path.join(dist, 'praline-avatar.vrm'))).toBe(false);
  });

  it('passes an NSFW build holding both models', async () => {
    const dist = await buildWith('nsfw', ['default-avatar.vrm', 'praline-avatar.vrm']);
    expect(existsSync(path.join(dist, 'default-avatar.vrm'))).toBe(true);
    expect(existsSync(path.join(dist, 'praline-avatar.vrm'))).toBe(true);
  });

  it('refuses an SFW build that holds Praline', async () => {
    await expect(buildWith('', ['default-avatar.vrm', 'praline-avatar.vrm'])).rejects.toThrow(/praline-avatar\.vrm is in the output/);
  });

  it('refuses an NSFW build that lacks Praline', async () => {
    await expect(buildWith('nsfw', ['default-avatar.vrm'])).rejects.toThrow(/praline-avatar\.vrm is missing/);
  });

  it('refuses an unknown avatar set', async () => {
    await expect(buildWith('sfw', ['default-avatar.vrm'])).rejects.toThrow(/FORMAMORPH_AVATARS must be/);
  });

  it('leaves the tracked default out of a Steam build', async () => {
    const dist = await buildWith('none', ['default-avatar.vrm', 'icon.png']);
    expect(existsSync(path.join(dist, 'default-avatar.vrm'))).toBe(false);
    expect(existsSync(path.join(dist, 'icon.png'))).toBe(true);
  });

  it('refuses a Steam build that holds Praline', async () => {
    await expect(buildWith('none', ['default-avatar.vrm', 'praline-avatar.vrm'])).rejects.toThrow(/praline-avatar\.vrm is in the output/);
  });

  it('refuses a Steam build with a .vrm of any other name', async () => {
    await expect(buildWith('none', ['someone.VRM'])).rejects.toThrow(/someone\.VRM is in the output/);
  });

  it('refuses a Steam build with a .vrm in a nested output folder', async () => {
    await expect(buildWith('none', ['models/deep/default-avatar.vrm'])).rejects.toThrow(/models\/deep\/default-avatar\.vrm is in the output/);
  });

  it('runs on the app build', () => {
    expect(readFileSync('vite.config.js', 'utf8')).toMatch(/plugins: \[[^\]]*bundledAvatarCheck\(\)/);
  });
});

describe('the workflows that build the app', () => {
  const release = readFileSync('.github/workflows/release.yml', 'utf8');
  const stepsAfterSwap = release.split('- name: Swap in the release avatars').slice(1);

  it('copy both models and set the flag on each of the three release builds', () => {
    expect(stepsAfterSwap).toHaveLength(3);
    for (const steps of stepsAfterSwap) {
      expect(steps).toContain('cp build-assets/alternate-avatar.vrm public/default-avatar.vrm');
      expect(steps).toContain('cp build-assets/praline-avatar.vrm public/praline-avatar.vrm');
      expect(steps).toContain('FORMAMORPH_AVATARS: nsfw');
    }
    expect(release.match(/FORMAMORPH_AVATARS: nsfw/g)).toHaveLength(3);
  });

  it('leave the Pages dev build without Praline or the flag', () => {
    const pages = readFileSync('.github/workflows/pages.yml', 'utf8');
    expect(pages).not.toContain('FORMAMORPH_AVATARS');
    expect(pages).not.toContain('praline');
  });
});
