// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { versionSiteImages } from './versionSiteImages.mjs';

const roots = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function site() {
  const root = mkdtempSync(join(tmpdir(), 'formamorph-images-'));
  roots.push(root);
  for (const directory of ['site/shots/graphite/dark', 'site/shots/thumbs', 'privacy']) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  // Image encoding is irrelevant to URL versioning; these bytes represent replacement captures.
  writeFileSync(join(root, 'site/shots/graphite/dark/02-game.webp'), 'game capture');
  writeFileSync(join(root, 'site/shots/thumbs/02-game.webp'), 'thumbnail');
  writeFileSync(join(root, 'site/og.jpg'), 'social preview');
  // Scripts build frame paths in JavaScript, as the hero and tour do.
  writeFileSync(join(root, 'site/hero.js'), "const FRAMES = '/site/shots/hero'; img.src = `${FRAMES}/dark/stats.webp`;");
  writeFileSync(join(root, 'site/hero-turn.js'), 'window.FM_HERO_TURN = { action: "look" };');
  mkdirSync(join(root, 'site/shots/hero'), { recursive: true });
  writeFileSync(join(root, 'site/shots/hero/layout.js'), 'window.FM_HERO_LAYOUT = {};');
  writeFileSync(join(root, 'site/tour.js'), 'const src = (id) => `/site/shots/graphite/dark/${id}.webp`;');
  const html = '<script src="/site/hero-turn.js"></script><script src="/site/shots/hero/layout.js"></script><script src="/site/hero.js"></script><script src="/site/tour.js"></script><img src="/site/shots/graphite/dark/02-game.webp"><img src="/site/shots/thumbs/02-game.webp"><meta content="https://formamorph.ai/site/og.jpg">';
  writeFileSync(join(root, 'index.html'), html);
  writeFileSync(join(root, 'privacy/index.html'), html);
  return root;
}

it('rewrites pages to versioned images that contain the original bytes', () => {
  const root = site();
  const { galleryPath, previewPath } = versionSiteImages(root);
  for (const page of ['index.html', 'privacy/index.html']) {
    const html = readFileSync(join(root, page), 'utf8');
    expect(html).not.toContain('/site/shots/');
    expect(html).not.toContain('/site/og.jpg');
    expect(html).toContain(`${galleryPath}thumbs/02-game.webp`);
    expect(html).toContain(`https://formamorph.ai${previewPath}`);
  }
  expect(readFileSync(join(root, galleryPath, 'graphite/dark/02-game.webp'), 'utf8')).toBe('game capture');
  expect(readFileSync(join(root, galleryPath, 'thumbs/02-game.webp'), 'utf8')).toBe('thumbnail');
  expect(readFileSync(join(root, previewPath), 'utf8')).toBe('social preview');
  expect(readFileSync(join(root, 'site/shots/graphite/dark/02-game.webp'), 'utf8')).toBe('game capture');
});

it('versions script-built frame paths and the script URLs that carry them', () => {
  const root = site();
  const { galleryPath, scriptPaths } = versionSiteImages(root);
  const hero = readFileSync(join(root, scriptPaths['/site/hero.js']), 'utf8');
  expect(hero).toContain(`'${galleryPath}hero'`);
  expect(hero).not.toContain('/site/shots/');
  for (const page of ['index.html', 'privacy/index.html']) {
    const html = readFileSync(join(root, page), 'utf8');
    expect(html).toContain(`src="${scriptPaths['/site/hero.js']}"`);
    expect(html).toContain(`src="${scriptPaths['/site/hero-turn.js']}"`);
    expect(html).toContain(`src="${scriptPaths['/site/tour.js']}"`);
    expect(html).toContain(`src="${galleryPath}hero/layout.js"`);
    expect(html).not.toContain('"/site/hero.js"');
    expect(html).not.toContain('"/site/hero-turn.js"');
  }
  // Open pages still load the plain script and the plain frames.
  expect(readFileSync(join(root, 'site/hero.js'), 'utf8')).toContain('/site/shots/hero');
  const tour = readFileSync(join(root, scriptPaths['/site/tour.js']), 'utf8');
  expect(tour).toContain(`${galleryPath}graphite`);
  expect(tour).not.toContain('/site/shots/');
});

it('leaves its own versioned scripts alone when run again on the same root', () => {
  const root = site();
  const first = versionSiteImages(root);
  expect(versionSiteImages(root)).toEqual(first);
  expect(Object.keys(first.scriptPaths).sort()).toEqual(['/site/hero-turn.js', '/site/hero.js', '/site/tour.js']);
});

it('changes the script URLs when a recapture changes the frames', () => {
  const root = site();
  const first = versionSiteImages(root);
  writeFileSync(join(root, 'site/shots/graphite/dark/02-game.webp'), 'replacement game');
  const changed = versionSiteImages(root);
  expect(changed.scriptPaths['/site/hero.js']).not.toBe(first.scriptPaths['/site/hero.js']);
  expect(changed.scriptPaths['/site/hero-turn.js']).toBe(first.scriptPaths['/site/hero-turn.js']);
});

it('keeps URLs stable for unchanged captures and changes them when image bytes change', () => {
  const first = versionSiteImages(site());
  const root = site();
  expect(versionSiteImages(root)).toEqual(first);
  writeFileSync(join(root, 'site/shots/graphite/dark/02-game.webp'), 'replacement game');
  writeFileSync(join(root, 'site/og.jpg'), 'replacement preview');
  const changed = versionSiteImages(root);
  expect(changed.galleryPath).not.toBe(first.galleryPath);
  expect(changed.previewPath).not.toBe(first.previewPath);
});

it('versions thumbnail-only changes without invalidating the social preview', () => {
  const root = site();
  const first = versionSiteImages(root);
  writeFileSync(join(root, 'site/shots/thumbs/02-game.webp'), 'replacement thumbnail');
  const changed = versionSiteImages(root);
  expect(changed.galleryPath).not.toBe(first.galleryPath);
  expect(changed.previewPath).toBe(first.previewPath);
});
