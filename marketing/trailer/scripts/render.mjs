#!/usr/bin/env node
// Renders each trailer composition (default: both) to out/<id>.mp4, then checks every file against its composition.
import { bundle } from '@remotion/bundler';
import { parseMedia } from '@remotion/media-parser';
import { nodeReader } from '@remotion/media-parser/node';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['TrailerWide', 'TrailerTall'];
const outDir = path.join(root, 'out');
mkdirSync(outDir, { recursive: true });

console.log('Bundling…');
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public') });

const rendered = [];
for (const id of ids) {
  const composition = await selectComposition({ serveUrl, id });
  const outputLocation = path.join(outDir, `${id}.mp4`);
  let lastStep = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation,
    onProgress: ({ progress }) => {
      const step = Math.floor(progress * 10);
      if (step !== lastStep) {
        lastStep = step;
        console.log(`${id}: ${step * 10}%`);
      }
    },
  });
  rendered.push({ composition, outputLocation });
}

let failed = false;
for (const { composition, outputLocation } of rendered) {
  const media = await parseMedia({
    src: outputLocation,
    reader: nodeReader,
    fields: { dimensions: true, fps: true, slowNumberOfFrames: true, videoCodec: true, audioCodec: true },
  });
  const expected = {
    size: `${composition.width}x${composition.height}`,
    fps: composition.fps,
    frames: composition.durationInFrames,
    videoCodec: 'h264',
    audioCodec: null,
  };
  const actual = {
    size: `${media.dimensions?.width}x${media.dimensions?.height}`,
    fps: media.fps === null ? null : Math.round(media.fps * 100) / 100,
    frames: media.slowNumberOfFrames,
    videoCodec: media.videoCodec,
    audioCodec: media.audioCodec,
  };
  const mismatches = Object.keys(expected).filter((key) => expected[key] !== actual[key]);
  const seconds = actual.frames === null ? '?' : (actual.frames / composition.fps).toFixed(2);
  const summary = `${path.relative(root, outputLocation)}  ${actual.size}  ${actual.fps} fps  ${seconds} s  ${actual.videoCodec}  audio: ${actual.audioCodec ?? 'none'}`;
  if (mismatches.length === 0) {
    console.log(`OK    ${summary}`);
  } else {
    failed = true;
    console.log(`FAIL  ${summary}`);
    for (const key of mismatches) console.log(`      ${key}: expected ${expected[key]}, got ${actual[key]}`);
  }
}
process.exit(failed ? 1 : 0);
