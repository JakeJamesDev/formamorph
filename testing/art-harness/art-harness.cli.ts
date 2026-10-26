// Art Harness: gives a bundled world its art through the app's InvokeAI provider, the app's WebP encoder, and
// an id-keyed write into the world file, then draws a labeled contact sheet. A dry run unless --live.
//
// Usage: npx vite-node testing/art-harness/art-harness.cli.ts -- --world <id|path.json> --style "<line>" [flags]
// README.md beside this file lists the flags.

import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { buildImageRequest, generateImage } from '@/lib/imageGen';
import type { ImageGenParams, ImageProviderId } from '@/lib/imageGen/types';
import { entityImages } from '@/lib/entityImages';
import { locationImages } from '@/lib/locationImages';
import { mapImages } from '@/lib/mapBackground';
import { runRules } from '@/lib/testBench/rules';
import { migrateWorld } from '@/lib/version';
import type { World } from '@/types';
import { startDevServer } from '../baseline/harness/appDriver.mjs';
import {
  ART_PRESET, displayName, imageLabel, imageRequest, isStoredForm, negativePrompt, placeholderNames, planImages, withFaceFix, writeImage, type PlannedImage, type SheetImage,
} from './artHarness';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORLDS_DIR = 'src/defaultworlds';
/** Every Test Bench rule about stored images, minus the size budget the bundled worlds have no limit on. */
const IMAGE_RULES = new Set([
  'image-not-webp', 'image-mislabeled', 'image-rule-missing-target', 'entity-images-all-hideable', 'image-rule-percent-zero-span',
]);

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const hasFlag = (name: string) => args.includes(name);
function flagValue(name: string): string | undefined {
  if (!hasFlag(name)) return undefined;
  const value = args[args.indexOf(name) + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value.`);
  return value;
}
/** Every value of a flag given more than once. */
const flagValues = (name: string) => args.flatMap((arg, i) => (arg === name && args[i + 1] !== undefined ? [args[i + 1]] : []));
const commaList = (value: string | undefined) => (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** One image to make: where it lands, and the exact provider call that makes it. */
interface Job extends Pick<PlannedImage, 'kind' | 'id' | 'name' | 'slot'> {
  mode: PlannedImage['mode'] | 'replay';
  seed: number;
  provider: ImageProviderId;
  params: ImageGenParams;
}

/** A run log: everything needed to make each image again. */
interface RunLog {
  world: string;
  out: string;
  style: string;
  started: string;
  images: (Job & { bytes: number })[];
}

const relative = (file: string) => path.relative(REPO_ROOT, file);
const megabytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(2)} MB (${bytes.toLocaleString('en-US')} bytes)`;

function jobsFor(world: World, style: string, negative: string, faceFix: boolean, replayLog: string | undefined): Job[] {
  if (replayLog) {
    const log = JSON.parse(readFileSync(path.resolve(REPO_ROOT, replayLog), 'utf8')) as RunLog;
    return log.images.map(({ bytes: _bytes, ...logged }) => {
      const job = { ...logged, mode: 'replay' as const };
      return faceFix ? withFaceFix(job) : job;
    });
  }
  if (!style.trim()) throw new Error('Give the world\'s art-direction line with --style.');
  const plan = planImages(world, {
    missing: hasFlag('--missing') || undefined,
    redo: commaList(flagValue('--redo')),
    variants: flagValues('--variant').map((value) => {
      const split = value.indexOf('=');
      if (split < 0) throw new Error(`--variant "${value}" needs the form "Name=extra tags".`);
      return { ref: value.slice(0, split).trim(), extra: value.slice(split + 1) };
    }),
    mapTags: flagValue('--map'),
  });
  for (const { ref, reason } of plan.skipped) console.log(`  skipped ${ref}: ${reason}`);
  const names = placeholderNames(world);
  return plan.images.map((image) => {
    const seed = randomInt(0, 2 ** 31);
    return {
      kind: image.kind, id: image.id, name: displayName(names, image.name), slot: image.slot, mode: image.mode, seed,
      ...imageRequest(world, image, style, seed, negative, faceFix),
    };
  });
}

/** Every image the world holds, labeled for the sheet. */
function worldImages(world: World): SheetImage[] {
  const names = placeholderNames(world);
  return [
    ...(world.locations ?? []).flatMap((l) => locationImages(l).map((img, slot) => ({ label: imageLabel(displayName(names, l.name), slot), data: img.data }))),
    ...(world.entities ?? []).flatMap((e) => entityImages(e).map((img, slot) => ({ label: imageLabel(displayName(names, e.name), slot), data: img.data }))),
    ...mapImages(world.worldOverview).map((img, slot) => ({ label: imageLabel('Map', slot), data: img.data })),
  ];
}

/** The Test Bench image findings on the stored file, read the way the seeder loads it. */
function imageFindings(worldText: string): string[] {
  const world = migrateWorld(JSON.parse(worldText) as World);
  return runRules(world).filter((f) => IMAGE_RULES.has(f.ruleId)).map((f) => `${f.ruleId}: ${f.message}`);
}

/** A dev build in Chromium with the harness's browser half loaded. */
async function openPage(port: number): Promise<{ page: Page; close: () => Promise<void> }> {
  const dev = await startDevServer(REPO_ROOT, port);
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(dev.baseUrl);
    await page.addScriptTag({ type: 'module', content: "import '/testing/art-harness/browser.ts';" });
    await page.waitForFunction(() => Boolean(window.__artHarness), null, { timeout: 60_000 });
    return { page, close: async () => { await browser.close(); dev.stop(); } };
  } catch (err) {
    dev.stop();
    throw err;
  }
}

async function writeSheet(page: Page, sheetPath: string, images: SheetImage[]) {
  const dataUrl = await page.evaluate((list) => window.__artHarness!.sheet(list), images);
  mkdirSync(path.dirname(sheetPath), { recursive: true });
  writeFileSync(sheetPath, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
  console.log(`Contact sheet: ${relative(sheetPath)}`);
}

async function main() {
  const worldArg = flagValue('--world');
  if (!worldArg) throw new Error('Give --world <id> or --world <path.json>.');
  const worldPath = path.resolve(REPO_ROOT, worldArg.endsWith('.json') ? worldArg : `${WORLDS_DIR}/${worldArg}.json`);
  const outPath = path.resolve(REPO_ROOT, flagValue('--out') ?? worldPath);
  const port = Number(flagValue('--port') ?? '0');
  if (!Number.isInteger(port) || port < 0) throw new Error('--port must be a whole number.');
  if (port === 5180) throw new Error('Port 5180 belongs to the launch config. Pick another with --port.');
  const style = flagValue('--style') ?? '';
  const negative = flagValue('--negative') ?? '';
  const replayLog = flagValue('--replay');
  const faceFix = hasFlag('--face-fix');
  const sheetPath = path.join(REPO_ROOT, '.scratch/frames', `${path.basename(outPath, '.json')}-sheet.png`);

  // An output that exists already is where an earlier run left off, so the run continues it.
  const sourcePath = existsSync(outPath) ? outPath : worldPath;
  let worldText = readFileSync(sourcePath, 'utf8');
  if (!isStoredForm(worldText)) throw new Error(`${relative(sourcePath)} is not two-space JSON with one trailing newline, so a write would reformat it.`);
  const world = JSON.parse(worldText) as World;

  if (hasFlag('--sheet')) {
    const images = worldImages(world);
    if (!images.length) throw new Error(`${relative(sourcePath)} holds no images.`);
    const { page, close } = await openPage(port);
    try {
      await writeSheet(page, sheetPath, images);
    } finally {
      await close();
    }
    return;
  }

  const jobs = jobsFor(world, style, negative, faceFix, replayLog);
  console.log(`Art Harness · ${relative(sourcePath)} → ${relative(outPath)} · ${ART_PRESET.imageModel} · ${ART_PRESET.imageSampler}, ${ART_PRESET.imageSteps} steps, cfg ${ART_PRESET.imageCfg}`);
  if (!replayLog) console.log(`Negative: ${negativePrompt(negative)}`);
  if (faceFix) console.log('Face Fix: on');
  for (const job of jobs) {
    console.log(`  ${imageLabel(job.name, job.slot)} · ${job.kind} · ${job.mode} · ${job.params.width}×${job.params.height} · seed ${job.seed}`);
    console.log(`    ${job.params.prompt}`);
    if (replayLog) console.log(`    negative: ${job.params.negativePrompt}`);
  }
  // Every write is tried on placeholder data first, so a bad slot stops the run before the GPU starts.
  jobs.reduce((text, job) => writeImage(text, { kind: job.kind, id: job.id, slot: job.slot, data: 'data:,' }), worldText);
  if (!hasFlag('--live')) {
    console.log(`Dry run: ${jobs.length} images planned, none made.`);
    return;
  }
  if (!jobs.length) return;

  const { opts } = buildImageRequest({ ...ART_PRESET, imageEndpoint: flagValue('--endpoint') ?? '' }, { prompt: '', width: 0, height: 0 });
  const before = statSync(sourcePath).size;
  const started = new Date().toISOString();
  const logPath = path.join(REPO_ROOT, '.scratch/art-harness', `${path.basename(outPath, '.json')}-${started.replace(/[:.]/g, '-')}.json`);
  mkdirSync(path.dirname(logPath), { recursive: true });
  const log: RunLog = { world: relative(sourcePath), out: relative(outPath), style, started, images: [] };

  const { page, close } = await openPage(port);
  try {
    for (const [index, job] of jobs.entries()) {
      const startedAt = Date.now();
      const png = await generateImage(job.provider, job.params, opts);
      const webp = await page.evaluate((url) => window.__artHarness!.encode(url), png);
      // Each image is written as it lands, so a stopped run keeps every image it finished.
      worldText = writeImage(worldText, { kind: job.kind, id: job.id, slot: job.slot, data: webp });
      writeFileSync(outPath, worldText);
      const bytes = Buffer.byteLength(webp);
      log.images.push({ ...job, bytes });
      writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`);
      console.log(`  [${index + 1}/${jobs.length}] ${imageLabel(job.name, job.slot)} · seed ${job.seed} · ${((Date.now() - startedAt) / 1000).toFixed(1)} s · ${(bytes / 1024).toFixed(0)} KB`);
    }
    await writeSheet(page, sheetPath, worldImages(JSON.parse(worldText) as World));
  } finally {
    await close();
  }
  console.log(`Run log: ${relative(logPath)}`);
  console.log(`World file: ${megabytes(before)} → ${megabytes(statSync(outPath).size)}`);
  const findings = imageFindings(worldText);
  console.log(findings.length ? `Test Bench image findings:\n${findings.map((f) => `  ${f}`).join('\n')}` : 'Test Bench image rules: no findings.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
