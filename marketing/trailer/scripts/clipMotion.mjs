#!/usr/bin/env node
// The per-frame motion of a clip: the share of pixels that change from each frame to the next (ruling Q41).
// capture.mjs runs it on each clip it films and fails a frame whose change spikes far above the clip's median.
// A reveal clip's frames come with `edges.json`, the narration's bottom edge per frame. A spike that is only
// that edge growing by one line, or a paragraph gap and a line, is the app's own layout step and passes (Q52).
//
//   node scripts/clipMotion.mjs <folder of numbered PNG frames>
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A channel must move more than this to count, so encode noise on decoded frames reads as still. */
const TOLERANCE = 8;
/** A step this many times the clip's median moving step is a jump, not motion. */
export const SPIKE = 6;
/** Steps under this share of the frame are too small to see, so they never count as a spike. */
const FLOOR = 0.002;
/** Edge growths, in line heights, that are one line or a paragraph gap and a line. Measured: 1.00, and 1.67 to 1.76. */
const GROWTH_LINES = [[0.9, 1.1], [1.5, 1.9]];

/** Where the narration's bottom edge sits on each frame, and its line height, both in fractions of the frame height. */
export const EDGES_FILE = 'edges.json';

/** The rows a growing edge repaints from `before` to `after`: from the old bottom to one line under the new one. */
const growthBand = (before, after) => {
  if (!(after.line > 0)) throw new Error(`The narration's line height did not read as a number: ${after.line}`);
  const lines = (after.bottom - before.bottom) / after.line;
  if (!GROWTH_LINES.some(([low, high]) => lines >= low && lines <= high)) return null;
  return { top: before.bottom - 0.25 * after.line, bottom: after.bottom + after.line };
};

/**
 * Each step's motion, decoded by Chromium in `page`. Step 0 is frame 0 to 1. `share` is the share of pixels
 * that change; `rest` is the share that changes outside the edge's growth band, on a step where the edge grew.
 */
export async function motionSeries(page, dir) {
  const files = readdirSync(dir).filter((name) => name.endsWith('.png')).sort();
  const edgesFile = path.join(dir, EDGES_FILE);
  const edges = existsSync(edgesFile) ? JSON.parse(readFileSync(edgesFile, 'utf8')) : null;
  await page.evaluate(() => { window.__motion = { previous: null }; });
  const series = [];
  for (const [index, file] of files.entries()) {
    const band = edges && index > 0 && edges[index - 1] && edges[index] ? growthBand(edges[index - 1], edges[index]) : null;
    const step = await page.evaluate(async ([b64, tolerance, band]) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const previous = window.__motion.previous;
      window.__motion.previous = data;
      if (!previous || previous.length !== data.length) return null;
      const [top, bottom] = band ? [band.top * bitmap.height, band.bottom * bitmap.height] : [Infinity, -Infinity];
      let changed = 0;
      let outside = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.abs(data[i] - previous[i]) > tolerance || Math.abs(data[i + 1] - previous[i + 1]) > tolerance || Math.abs(data[i + 2] - previous[i + 2]) > tolerance) {
          changed++;
          const row = Math.floor(i / 4 / bitmap.width);
          if (row < top || row > bottom) outside++;
        }
      }
      const pixels = data.length / 4;
      return { share: changed / pixels, rest: band ? outside / pixels : null };
    }, [readFileSync(path.join(dir, file)).toString('base64'), TOLERANCE, band]);
    if (step !== null) series.push(step);
  }
  return series;
}

/** The median of the steps that move at all: a clip that rests for half its length still has a motion median. */
export const movingMedian = (series) => {
  const moving = series.map((step) => step.share).filter((share) => share > 0).sort((a, b) => a - b);
  return moving.length ? moving[Math.floor(moving.length / 2)] : 0;
};

/**
 * The steps that jump: far above the moving median and big enough to see. Each is the frame the jump lands on.
 * `edge` marks a jump that is only the narration's edge growing: everything outside its band moves as usual.
 */
export const spikes = (series) => {
  const median = movingMedian(series);
  const jumps = (share) => share > FLOOR && share > SPIKE * median;
  return series.flatMap((step, i) => (jumps(step.share) ? [{ frame: i + 1, share: step.share, edge: step.rest !== null && !jumps(step.rest) }] : []));
};

/** The series as percent per frame, ten to a line. `!` marks a spike and `~` an edge growth. */
export const formatSeries = (series) => {
  const marks = new Map(spikes(series).map((spike) => [spike.frame, spike.edge ? '~' : '!']));
  const cells = series.map((step, i) => `${marks.get(i + 1) ?? ' '}${(step.share * 100).toFixed(2).padStart(6)}`);
  const lines = [];
  for (let i = 0; i < cells.length; i += 10) lines.push(`  ${String(i + 1).padStart(3)}: ${cells.slice(i, i + 10).join('')}`);
  return lines.join('\n');
};

/** One line per spike: its frame, its share and whether it is an edge growth. */
export const formatSpikes = (list) => list.map((spike) => `frame ${spike.frame} ${(spike.share * 100).toFixed(2)}%${spike.edge ? ' (edge grows)' : ''}`).join(', ');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) throw new Error('Pass a folder of numbered PNG frames.');
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const series = await motionSeries(await browser.newPage(), dir);
    console.log(`Motion per frame, % of pixels (median moving step ${(movingMedian(series) * 100).toFixed(3)}%, ! = spike, ~ = edge grows):`);
    console.log(formatSeries(series));
    const list = spikes(series);
    console.log(list.length ? `${list.length} spike(s): ${formatSpikes(list)}` : 'No spike.');
  } finally {
    await browser.close();
  }
}
