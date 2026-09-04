// Regenerates the Android launcher icons and splash screens from public/icon.png.
//
// One-off tool: run it only when the source icon changes, then commit the result. It borrows `sharp`
// from the @huggingface/transformers dependency rather than adding a 30MB native dep of its own; if
// that ever goes away, the import throws and nothing in the four gates depends on this script.
//
// Usage: node scripts/genAndroidIcons.mjs

import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const SOURCE = 'public/icon.png';
const RES = 'android/app/src/main/res';

/** The app's dark background, matching the web manifest's background_color. */
const BRAND = '#16181D';

/** Legacy launcher densities, in pixels, keyed by resource directory suffix. */
const MIPMAP = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

/** The splash icon at 96dp, one file per density. drawable/splash.xml centers it on the brand plate. */
const SPLASH_ICON_DP = 96;
const DENSITY_SCALE = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** An adaptive icon's art must sit inside the middle 72dp of its 108dp canvas to survive every mask. */
const SAFE_ZONE = 72 / 108;

/**
 * Compose one image: the brand plate, the art centered on it, then an optional shape cut out of both.
 *
 * @param width - Output width in pixels
 * @param height - Output height in pixels
 * @param art - The already-resized source art
 * @param mask - SVG markup whose alpha keeps the parts of the plate that survive, or null for a full square
 * @param background - Plate color, or transparent for an adaptive foreground
 * @returns The composed PNG bytes
 */
async function compose(width, height, art, mask, background) {
  const layers = [{ input: art, gravity: 'centre' }];
  if (mask) layers.push({ input: Buffer.from(mask), blend: 'dest-in' });
  return sharp({ create: { width, height, channels: 4, background } })
    .composite(layers)
    .png()
    .toBuffer();
}

/**
 * The source art resized to a fraction of a square canvas, keeping its aspect and its transparency.
 *
 * @param size - The canvas edge in pixels
 * @param fraction - How much of that edge the art spans
 * @returns The resized PNG bytes
 */
async function art(size, fraction) {
  const box = Math.round(size * fraction);
  return sharp(SOURCE).resize(box, box, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

const opaque = { r: 0x16, g: 0x18, b: 0x1d, alpha: 1 };
const clear = { r: 0, g: 0, b: 0, alpha: 0 };

for (const [density, size] of Object.entries(MIPMAP)) {
  const dir = path.join(RES, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });

  const radius = Math.round(size * 0.22);
  const square = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`;
  const circle = `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`;

  await writeFile(path.join(dir, 'ic_launcher.png'), await compose(size, size, await art(size, 0.92), square, opaque));
  await writeFile(path.join(dir, 'ic_launcher_round.png'), await compose(size, size, await art(size, 0.78), circle, opaque));

  // The adaptive foreground rides on its own 108dp canvas, 2.25x the legacy icon at the same density.
  const canvas = Math.round(size * 108 / 48);
  await writeFile(
    path.join(dir, 'ic_launcher_foreground.png'),
    await compose(canvas, canvas, await art(canvas, SAFE_ZONE), null, clear),
  );
}

for (const [density, scale] of Object.entries(DENSITY_SCALE)) {
  const dir = path.join(RES, `drawable-${density}`);
  await mkdir(dir, { recursive: true });
  const box = Math.round(SPLASH_ICON_DP * scale);
  await writeFile(
    path.join(dir, 'splash_icon.png'),
    await sharp(SOURCE).resize(box, box, { fit: 'contain', background: clear }).png().toBuffer(),
  );
}

console.log(`Wrote launcher icons and the splash icon from ${SOURCE}.`);
