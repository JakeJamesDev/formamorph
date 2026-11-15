// Seed play: plays bundled worlds in the real dev build on the cloud endpoint and writes each turn's stored
// narration as one passage, with its source world, run, turn and action, to the training-data repo
// (coref/seed/play/<batch>.jsonl). seed_label.py pre-labels the file.
//
// Usage: npx vite-node testing/coref/seed-play.cli.ts -- [--worlds all|emberwatch,slime] [--runs N]
//          [--endpoint URL] [--model default] [--out FILE] [--port N]
//   --runs overrides every world's own run count (seed-worlds.ts).
//   FORMAMORPH_PROBE_TOKEN is sent as the bearer token when the endpoint needs one; it is never written out.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { act, enterWorld, playOpening, startDevServer } from '../baseline/harness/appDriver.mjs';
import { SEED_SCRIPTS } from './seed-worlds';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TURN_TIMEOUT_MS = 5 * 60_000;
/** How long a world's Opening Narration has to start on its own before the play sends START GAME. */
const OPENING_GRACE_MS = 20_000;

const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  if (!args.includes(name)) return fallback;
  const value = args[args.indexOf(name) + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value.`);
  return value;
}
const whole = (name: string, value: string) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a whole number.`);
  return n;
};

/** The main checkout, also from a ticket worktree: the training-data repo sits beside it (Q23). */
const MAIN = path.dirname(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim());
const DATA = path.resolve(process.env.FORMAMORPH_TRAINING_DATA ?? path.join(MAIN, '..', 'formamorph-training-data'));
const batch = new Date().toISOString().replace(/\D/g, '').slice(2, 12);
const endpoint = option('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = option('--model', 'default');
const token = process.env.FORMAMORPH_PROBE_TOKEN ?? '';
const runsOverride = args.includes('--runs') ? whole('--runs', option('--runs', '')) : null;
const worldIds = option('--worlds', 'all').split(',').map((s) => s.trim()).filter(Boolean)
  .flatMap((id) => (id === 'all' ? Object.keys(SEED_SCRIPTS) : [id]));
const port = whole('--port', option('--port', '0'));
const outFile = path.resolve(option('--out', path.join(DATA, 'coref/seed/play', `${batch}.jsonl`)));

for (const id of worldIds) if (!SEED_SCRIPTS[id]) throw new Error(`No seed script for "${id}". Scripts: ${Object.keys(SEED_SCRIPTS).join(', ')}.`);
if (!args.includes('--out') && !existsSync(DATA)) throw new Error(`No training-data repo at ${DATA}. Clone it there, set FORMAMORPH_TRAINING_DATA, or pass --out.`);
if (port === 5180) throw new Error('Port 5180 belongs to the launch config. Pick another with --port.');

/** The app's settings for every run: this endpoint as the active preset, the stat pass on, choices off. */
const SETTINGS: Record<string, string> = {
  FORMAMORPH_textEndpointPresets: JSON.stringify({
    activeId: 'harness',
    presets: [{ id: 'harness', name: 'Harness', values: { endpoint, apiToken: token, model } }],
  }),
  FORMAMORPH_engineIsPresetMigrated: '1',
  // The first-run step and the intro would cover the enter dialog.
  FORMAMORPH_firstRunStepSeen: '1',
  FORMAMORPH_introSeen: 'true',
  FORMAMORPH_thinkingMode: JSON.stringify('off'),
  FORMAMORPH_choicesEnabled: JSON.stringify(false),
  FORMAMORPH_statUpdatesEnabled: JSON.stringify(true),
};

interface DebugTurn { action: string; turnId?: string; regenerated?: boolean; pruned?: boolean; requests: { type: string }[] }
interface BaselineWindow {
  __baseline: {
    getDebugTurns: () => DebugTurn[];
    getNarrations: () => { turnId: string; narration: string }[];
  };
}

/** One passage in the annotation format, before labels. */
export interface PlayedPassage {
  id: string;
  text: string;
  source: { world: string; run: number; turn: number; action: string; model: string; batch: string };
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Model-written passages of one run. An authored page one sends no narration request and is left out. */
async function playRun(browser: Browser, baseUrl: string, id: string, run: number): Promise<{ passages: PlayedPassage[]; error?: string }> {
  const context = await browser.newContext();
  try {
    await context.addInitScript((seed) => {
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }, SETTINGS);
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    await page.route(endpoint, async (route) => {
      let body: Record<string, unknown> | null = null;
      try { body = JSON.parse(route.request().postData() ?? '') as Record<string, unknown>; } catch { /* not a chat body */ }
      if (!body) return route.continue();
      await route.continue({ postData: JSON.stringify({ ...body, reasoning_effort: 'none' }) });
    });
    await page.goto(baseUrl);
    await enterWorld(page, path.join(REPO_ROOT, 'src/defaultworlds', `${id}.json`), id);
    let error: string | undefined;
    try {
      await playOpening(page, { graceMs: OPENING_GRACE_MS, timeoutMs: TURN_TIMEOUT_MS });
      for (const action of SEED_SCRIPTS[id].actions) await act(page, action, TURN_TIMEOUT_MS);
    } catch (err) {
      error = messageOf(err);
    }
    const { turns, narrations } = await page.evaluate(() => {
      const b = (window as unknown as BaselineWindow).__baseline;
      return { turns: b.getDebugTurns(), narrations: b.getNarrations() };
    });
    const byTurn = new Map(narrations.map((n) => [n.turnId, n.narration]));
    // Turn numbers count every page the player sees, the authored page one included.
    const passages = turns
      .filter((t) => !t.regenerated && !t.pruned)
      .flatMap((t, i) => {
        const text = t.turnId && t.requests.some((r) => r.type === 'narration') ? byTurn.get(t.turnId)?.trim() : undefined;
        return text ? [{ id: `seed-${id}-${batch}-${run + 1}-${i + 1}`, text, source: { world: id, run: run + 1, turn: i + 1, action: t.action, model, batch } }] : [];
      });
    return { passages, error };
  } catch (err) {
    return { passages: [], error: messageOf(err) };
  } finally {
    await context.close();
  }
}

async function main() {
  mkdirSync(path.dirname(outFile), { recursive: true });
  console.log(`Seed play · ${endpoint} · model "${model}" · worlds ${worldIds.join(', ')} · out ${outFile}`);
  const dev = await startDevServer(REPO_ROOT, port);
  const browser = await chromium.launch();
  let total = 0;
  try {
    for (const id of worldIds) {
      const runs = runsOverride ?? SEED_SCRIPTS[id].runs;
      for (let run = 0; run < runs; run++) {
        const started = Date.now();
        const { passages, error } = await playRun(browser, dev.baseUrl, id, run);
        // Appended per run, so a stopped batch keeps what it played.
        for (const p of passages) appendFileSync(outFile, JSON.stringify(p) + '\n');
        total += passages.length;
        console.log(`  ${id} #${run + 1}: ${passages.length} passages${error ? ` ⚠ ${error}` : ''} (${Math.round((Date.now() - started) / 1000)}s)`);
      }
    }
  } finally {
    await browser.close();
    dev.stop();
  }
  console.log(`\n${total} passages in ${outFile}`);
}

await main();
