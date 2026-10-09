#!/usr/bin/env node
// Renders each trailer composition (default: both) to out/<id>.mp4, then checks every file against its composition,
// every line of copy against the reading bar, every camera move, and proves its 6 s loop. The wide cut is also checked against the
// Steam spec and writes its poster frame.
//
//   npm run render                 both cuts
//   npm run render -- TrailerWide  one cut
import { bundle } from '@remotion/bundler';
import { parseMedia } from '@remotion/media-parser';
import { nodeReader } from '@remotion/media-parser/node';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['TrailerWide', 'TrailerTall'];
const outDir = path.join(root, 'out');
mkdirSync(outDir, { recursive: true });

/**
 * Per-composition checks. The wide cut follows Steam's store trailer spec (partner docs, read 2026-10-08):
 * up to 1920x1080, 30 or 60 fps, 5,000+ Kbps, H.264 in MP4. The spec states no length limit; the storyboard
 * sets the 90 s target. The poster must be a 1920x1080 frame of the video. The first 6 s are Steam's
 * microtrailer, so they must loop.
 */
const CHECKS = {
  TrailerWide: {
    videoBitrate: '12M',
    minKbps: 5000,
    maxSeconds: 90,
    loopFrames: 360,
    poster: { size: '1920x1080', fromEnd: 1 },
    zoomShots: ['W06', 'W13'],
  },
  // The social cut has no store spec. It shares the wide cut's first 6 s, so it loops too. Its stats pane zooms like W06.
  TrailerTall: { loopFrames: 360, zoomShots: ['T06/1'] },
};

/** Ruling Q26: a shot that holds its zoom moves this far on screen, as a percent of its area. */
const DRIFT_PERCENT = { min: 1, max: 5 };

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
    jpegQuality: 95,
    videoBitrate: CHECKS[id]?.videoBitrate,
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

const still = async (composition, frame, output) => {
  await renderStill({ composition, serveUrl, frame, output, imageFormat: 'png' });
  return readFileSync(output);
};

/** PNG width and height, read from the IHDR chunk. */
const pngSize = (buffer) => `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;

let failed = false;
const report = (ok, line, details = []) => {
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${line}`);
  for (const detail of details) console.log(`      ${detail}`);
};

for (const { composition, outputLocation } of rendered) {
  const media = await parseMedia({
    src: outputLocation,
    reader: nodeReader,
    fields: { dimensions: true, fps: true, slowNumberOfFrames: true, videoCodec: true, audioCodec: true },
  });
  const spec = CHECKS[composition.id];
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
  const problems = Object.keys(expected).filter((key) => expected[key] !== actual[key]).map((key) => `${key}: expected ${expected[key]}, got ${actual[key]}`);
  const seconds = actual.frames === null ? null : actual.frames / composition.fps;
  const kbps = seconds ? Math.round((statSync(outputLocation).size * 8) / seconds / 1000) : null;
  if (spec?.maxSeconds && (seconds === null || seconds >= spec.maxSeconds)) problems.push(`length: ${seconds} s is not under ${spec.maxSeconds} s`);
  if (spec?.minKbps && (kbps === null || kbps < spec.minKbps)) problems.push(`bitrate: ${kbps} Kbps is under ${spec.minKbps} Kbps`);
  const summary = `${path.relative(root, outputLocation)}  ${actual.size}  ${actual.fps} fps  ${seconds?.toFixed(2) ?? '?'} s  ${kbps ?? '?'} Kbps  ${actual.videoCodec}  audio: ${actual.audioCodec ?? 'none'}`;
  report(problems.length === 0, summary, problems);

  // Rulings Q17 and Q25: each line's enter, legible and exit seconds and its characters per second, measured by the timeline that played.
  for (const line of composition.props.reading) {
    const cps = line.charsPerSecond === null ? '-' : line.charsPerSecond.toFixed(1);
    const exit = line.exitSeconds === null ? 'holds to end' : `exit ${line.exitSeconds.toFixed(2)} s`;
    report(line.ok, `${line.shot.padEnd(4)} enter ${line.enterSeconds.toFixed(2)} s  hold ${line.seconds.toFixed(2).padStart(5)} s  ${exit.padEnd(12)}  ${cps.padStart(4)} cps  "${line.text}"`);
  }

  // Rulings Q22, Q23 and Q26: every camera moves at a constant rate; only the named shots zoom; every other shot drifts a few percent.
  for (const camera of composition.props.camera) {
    const name = camera.pane === null ? camera.shot : `${camera.shot}/${camera.pane}`;
    const zooms = Math.abs(camera.zoomTo - camera.zoomFrom) > 1e-6;
    const allowed = spec?.zoomShots?.includes(name) ?? false;
    const problems = [];
    if (!camera.linear) problems.push('the move is not linear: the shot edge stops the camera');
    if (zooms && !allowed) problems.push('only a zoom shot may change zoom');
    if (!zooms && allowed) problems.push('a zoom shot must zoom');
    if (!zooms && (camera.travelPercent < DRIFT_PERCENT.min || camera.travelPercent > DRIFT_PERCENT.max)) {
      problems.push(`drift: ${camera.travelPercent.toFixed(1)}% is outside ${DRIFT_PERCENT.min}% to ${DRIFT_PERCENT.max}%`);
    }
    const move = zooms ? `zoom ${camera.zoomFrom.toFixed(2)} -> ${camera.zoomTo.toFixed(2)}` : `zoom ${camera.zoomFrom.toFixed(2)}, drift ${camera.travelPercent.toFixed(1)}%`;
    report(problems.length === 0, `${name.padEnd(6)} camera ${move}`, problems);
  }

  if (!spec) continue;

  // The microtrailer loops when its last frame is its first frame, so the replay has no jump.
  const first = await still(composition, 0, path.join(outDir, `${composition.id}-loop-first.png`));
  const last = await still(composition, spec.loopFrames - 1, path.join(outDir, `${composition.id}-loop-last.png`));
  report(first.equals(last), `first ${spec.loopFrames / composition.fps} s loop: frame 0 and frame ${spec.loopFrames - 1} are identical`);
  if (!spec.poster) continue;

  // The poster is a frame of the encoded video, so it is the frame a viewer sees. Seek by time, to the frame's start.
  const posterFrame = composition.durationInFrames - spec.poster.fromEnd;
  const posterPath = path.join(outDir, `${composition.id}-poster.png`);
  execFileSync('npx', ['remotion', 'ffmpeg', '-y', '-loglevel', 'error', '-ss', String(posterFrame / composition.fps), '-i', outputLocation, '-frames:v', '1', '-update', '1', posterPath], {
    cwd: root,
    shell: true,
  });
  const poster = pngSize(readFileSync(posterPath));
  report(poster === spec.poster.size, `${path.relative(root, posterPath)}  ${poster}  frame ${posterFrame}`, poster === spec.poster.size ? [] : [`size: expected ${spec.poster.size}`]);
}
process.exit(failed ? 1 : 0);
