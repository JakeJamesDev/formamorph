// World probe: plays a bundled world against an older revision of itself in the real dev build, on the cloud
// endpoint, and reports structural metrics per arm. The app does everything a player's game does (prompt
// assembly, sampler pins, the stat pass, choices, and every world, trait and entity script at its timing); the
// probe only imports each arm's world file, plays the opening and the world's scripted actions, adds
// `reasoning_effort: "none"` to every request, and reads the AI-context dump back.
//
// Arms are interleaved run by run in one batch, alternating which goes first, so each batch carries its own
// control. Transcripts are written under blind labels for rubric scoring; key.json maps labels to arms.
//
// Usage: npx vite-node testing/baseline/harness/world-probe.cli.ts -- [--worlds all|drone,slime]
//          [--arms worktree,2f45261a5] [--runs 5] [--endpoint URL] [--model default] [--out DIR] [--port N]
//   An arm is `worktree` (the file on disk) or any git revision (`HEAD`, `HEAD~2`, a sha).
//   FORMAMORPH_PROBE_TOKEN is sent as the bearer token when the endpoint needs one; it is never written out.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { readTavernJson } from '@/lib/tavernCard';
import { PRE_EXPANSION_SHA } from '@/test/bundledRevisions';
import { enterWorld, startDevServer } from './appDriver.mjs';
import { scoreTurn, summarizeArm, type ArmSummary, type DumpTurn, type TurnScore } from './world-probe-score';
import { commonFlags, WORLD_SCRIPTS } from './world-probe-worlds';

/** The default "before" arm. */
const PRE_EXPANSION = PRE_EXPANSION_SHA.slice(0, 9);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WORLDS_DIR = 'src/defaultworlds';
const TURN_TIMEOUT_MS = 5 * 60_000;
/** How long a world's Opening Narration has to start on its own before the probe sends START GAME. */
const OPENING_GRACE_MS = 20_000;

const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  if (!args.includes(name)) return fallback;
  const value = args[args.indexOf(name) + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value.`);
  return value;
}
const list = (name: string, fallback: string) => option(name, fallback).split(',').map((s) => s.trim()).filter(Boolean);
function count(name: string, fallback: string): number {
  const n = Number(option(name, fallback));
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a whole number.`);
  return n;
}
const endpoint = option('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = option('--model', 'default');
const runs = count('--runs', '5');
const token = process.env.FORMAMORPH_PROBE_TOKEN ?? '';
const arms = list('--arms', `worktree,${PRE_EXPANSION}`);
const bundled = readdirSync(path.join(REPO_ROOT, WORLDS_DIR)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length));
const worldIds = list('--worlds', 'all').flatMap((id) => (id === 'all' ? bundled : [id]));
/** 0 claims a free port. */
const port = count('--port', process.env.WORLD_PROBE_PORT ?? '0');
const outDir = path.resolve(REPO_ROOT, option('--out', path.join('testing/baseline/runs/world-probe', new Date().toISOString().replace(/[:.]/g, '-'))));

for (const id of worldIds) {
  if (!bundled.includes(id)) throw new Error(`No bundled world "${id}". Bundled: ${bundled.join(', ')}.`);
  if (!WORLD_SCRIPTS[id]) throw new Error(`No probe script for "${id}" in world-probe-worlds.ts.`);
}
if (port === 5180) throw new Error('Port 5180 belongs to the launch config. Pick another with --port.');
if (arms.length < 2) throw new Error('Give at least two arms, e.g. --arms worktree,HEAD.');
if (runs < 1) throw new Error('--runs must be at least 1.');

/** Open Chat's stage is blank until an entity joins, so both arms play it with the bundled test card's lead. */
const OPEN_CHAT_LEAD = (() => {
  const cards = JSON.parse(readFileSync(path.join(REPO_ROOT, 'testing/baseline/open-chat-cards.json'), 'utf8')) as unknown[];
  const lead = readTavernJson(JSON.stringify(cards[0]))?.entity;
  if (!lead) throw new Error('open-chat-cards.json lost its lead card.');
  return lead;
})();

/** The arm's world file as text: the working tree's, or the file at a git revision. */
function armWorldText(id: string, arm: string): string {
  const file = `${WORLDS_DIR}/${id}.json`;
  if (arm === 'worktree') return readFileSync(path.join(REPO_ROOT, file), 'utf8');
  return execFileSync('git', ['show', `${arm}:${file}`], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** Write the arm's world where the import picks it up. Open Chat gains its lead at the starting location. */
function writeArmWorld(id: string, arm: string): string {
  const world = JSON.parse(armWorldText(id, arm)) as { locations: { id: string; isStarting?: boolean }[]; entities: unknown[] };
  if (id === 'open-chat') {
    const start = world.locations.find((l) => l.isStarting) ?? world.locations[0];
    world.entities = [...world.entities, { ...OPEN_CHAT_LEAD, locations: [start.id] }];
  }
  const file = path.resolve(outDir, 'worlds', `${id}--${slug(arm)}.json`);
  writeFileSync(file, JSON.stringify(world));
  return file;
}

const slug = (arm: string) => arm.replace(/[^A-Za-z0-9._-]/g, '_');
const serialize = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

/** The app's settings for every run: this endpoint as the active preset, choices and the stat pass on. */
const SEED: Record<string, string> = {
  FORMAMORPH_textEndpointPresets: JSON.stringify({
    activeId: 'harness',
    presets: [{ id: 'harness', name: 'Harness', values: { endpoint, apiToken: token, model } }],
  }),
  FORMAMORPH_engineIsPresetMigrated: '1',
  FORMAMORPH_thinkingMode: serialize('off'),
  FORMAMORPH_choicesEnabled: serialize(true),
  FORMAMORPH_statUpdatesEnabled: serialize(true),
};

interface BaselineWindow {
  __baseline: {
    getDebugTurns: () => (DumpTurn & { regenerated?: boolean; pruned?: boolean })[];
    runScript: (actions: string[]) => Promise<void>;
    isTurnRunning: () => boolean;
    isGameStarted: () => boolean;
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const withTimeout = <T>(promise: Promise<T>, what: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} timed out`)), TURN_TIMEOUT_MS); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/** Play the opening: an Opening Narration starts the game on its own, an Opening Action waits to be sent. */
async function playOpening(page: Page): Promise<void> {
  const status = () => page.evaluate(() => {
    const b = (window as unknown as BaselineWindow).__baseline;
    // An Opening Action waits in the input box for the player.
    const prefilled = [...document.querySelectorAll('textarea')].some((t) => t.value.trim().length > 0);
    return { running: b.isTurnRunning(), started: b.isGameStarted(), prefilled };
  });
  for (let waited = 0; waited < OPENING_GRACE_MS; waited += 500) {
    const { running, started, prefilled } = await status();
    if (prefilled && !running && !started) break;
    if (running || started) {
      const deadline = Date.now() + TURN_TIMEOUT_MS;
      while ((await status()).running) {
        if (Date.now() > deadline) throw new Error('the opening narration timed out');
        await sleep(500);
      }
      return;
    }
    await sleep(500);
  }
  await act(page, 'START GAME');
}

const act = (page: Page, action: string) => withTimeout(
  page.evaluate((a) => (window as unknown as BaselineWindow).__baseline.runScript([a]), action),
  `"${action.slice(0, 40)}"`,
);

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

interface RunResult { arm: string; label: string; turns: DumpTurn[]; scores: TurnScore[]; error?: string }

async function playRun(browser: Browser, baseUrl: string, id: string, arm: string, worldFile: string): Promise<Omit<RunResult, 'label'>> {
  const context = await browser.newContext();
  try {
    await context.addInitScript((seed) => {
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }, SEED);
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    let rewritten = 0;
    await page.route(endpoint, async (route) => {
      let body: Record<string, unknown> | null = null;
      try { body = JSON.parse(route.request().postData() ?? '') as Record<string, unknown>; } catch { /* not a chat body */ }
      if (!body) return route.continue();
      rewritten++;
      await route.continue({ postData: JSON.stringify({ ...body, reasoning_effort: 'none' }) });
    });
    await page.goto(baseUrl);
    await enterWorld(page, worldFile, `${id} ${arm}`);
    let error: string | undefined;
    try {
      await playOpening(page);
      for (const action of WORLD_SCRIPTS[id].actions) await act(page, action);
    } catch (err) {
      error = messageOf(err);
    }
    if (!rewritten) error ??= `no request reached ${endpoint}`;
    const turns = (await page.evaluate(() => (window as unknown as BaselineWindow).__baseline.getDebugTurns()))
      .filter((t) => !t.regenerated && !t.pruned)
      .map(({ action, requests }) => ({ action, requests }));
    const flags = (text: string) => [...commonFlags(text), ...WORLD_SCRIPTS[id].flags(text)];
    return { arm, turns, scores: turns.map((t) => scoreTurn(t, flags)), error };
  } catch (err) {
    return { arm, turns: [], scores: [], error: messageOf(err) };
  } finally {
    await context.close();
  }
}

/** One run as a rubric reader sees it: each turn's action, narration, choices and stat reply, arm hidden. */
function transcript(id: string, run: number, result: RunResult): string {
  const reply = (turn: DumpTurn, type: string) => turn.requests.find((r) => r.type === type)?.response;
  const turns = result.turns.map((turn, i) => {
    const s = result.scores[i];
    const narration = reply(turn, 'narration') ?? '*(authored page one; no narration request)*';
    return [
      `## Turn ${i + 1}`,
      `**Action:** ${turn.action}`,
      narration,
      `**Choices:**\n${reply(turn, 'choices') ?? '—'}`,
      `**Stat reply:** \`${(reply(turn, 'statUpdates') ?? '—').replace(/\s+/g, ' ')}\``,
      `**Metrics:** narration ${s.narration} · choices ${s.choices} (${s.choiceCount}) · stat ${s.stat}` +
        ([['tokens', s.tokenLeaks], ['reasoning', s.reasoningLeaks], ['placeholders', s.placeholders], ['stat problems', s.statProblems], ['flags', s.flags]] as const)
          .flatMap(([label, items]) => (items.length ? [` · ${label}: ${items.join(', ')}`] : []))
          .join(''),
    ].join('\n\n');
  });
  return [`# ${id} · run ${run + 1} · arm ${result.label}`, ...(result.error ? [`> ⚠ ${result.error}`] : []), ...turns].join('\n\n') + '\n';
}

const pct = (n: number, of: number) => (of ? `${n}/${of}` : '—');
function tableRows(id: string, results: RunResult[]): string[] {
  return arms.map((arm) => {
    const mine = results.filter((r) => r.arm === arm);
    const s: ArmSummary = summarizeArm(mine.flatMap((r) => r.scores));
    const errors = mine.filter((r) => r.error).length;
    return `| ${id} | ${arm} | ${mine.length} | ${s.turns} | ${s.emptyNarration} | ${s.tokenLeakTurns} | ${s.reasoningLeakTurns} | ` +
      `${s.placeholderTurns} | ${pct(s.choicesOk, s.choicesSent)} | ${pct(s.statOk, s.statSent)} | ${s.flaggedTurns} | ${errors} |`;
  });
}
const TABLE_HEAD = [
  '| World | Arm | Runs | Turns | Empty | Token leaks | Reasoning leaks | Placeholders | Choices ok | Stat ok | Flagged | Errors |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
];

async function main() {
  mkdirSync(path.join(outDir, 'worlds'), { recursive: true });
  mkdirSync(path.join(outDir, 'transcripts'), { recursive: true });
  console.log(`World probe · ${endpoint} · model "${model}" · arms ${arms.join(' vs ')} · ${runs} run(s) per arm`);
  console.log(`Worlds: ${worldIds.join(', ')} · out: ${outDir}`);
  const dev = await startDevServer(REPO_ROOT, port);
  const browser = await chromium.launch();
  const rows: string[] = [];
  const key: Record<string, Record<string, string>> = {};
  try {
    for (const id of worldIds) {
      let files: Record<string, string>;
      try {
        files = Object.fromEntries(arms.map((arm) => [arm, writeArmWorld(id, arm)]));
      } catch (err) {
        console.log(`  ${id}: skipped, an arm has no world file (${messageOf(err).split('\n')[0]})`);
        rows.push(`| ${id} | — | skipped: an arm has no world file | | | | | | | | | |`);
        continue;
      }
      // Blind labels, assigned per world so a label never names the same arm twice in a row of worlds.
      const labels = Object.fromEntries(arms.map((arm, i) => [arm, String.fromCharCode(65 + ((i + worldIds.indexOf(id)) % arms.length))]));
      key[id] = Object.fromEntries(Object.entries(labels).map(([arm, label]) => [label, arm]));
      const results: RunResult[] = [];
      for (let run = 0; run < runs; run++) {
        const order = run % 2 ? [...arms].reverse() : arms;
        for (const arm of order) {
          const started = Date.now();
          const result = { ...(await playRun(browser, dev.baseUrl, id, arm, files[arm])), label: labels[arm] };
          results.push(result);
          writeFileSync(path.join(outDir, 'transcripts', `${id}-run${run + 1}-${result.label}.md`), transcript(id, run, result));
          const s = summarizeArm(result.scores);
          console.log(`  ${id} #${run + 1} ${arm}: ${s.turns} turns, choices ${pct(s.choicesOk, s.choicesSent)}, stat ${pct(s.statOk, s.statSent)}` +
            `${result.error ? ` ⚠ ${result.error.split('\n')[0]}` : ''} (${Math.round((Date.now() - started) / 1000)}s)`);
        }
      }
      writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(results, null, 2));
      rows.push(...tableRows(id, results));
    }
  } finally {
    await browser.close();
    dev.stop();
  }
  writeFileSync(path.join(outDir, 'key.json'), JSON.stringify(key, null, 2));
  const table = [...TABLE_HEAD, ...rows].join('\n');
  writeFileSync(path.join(outDir, 'summary.md'), `# World probe\n\n${endpoint} · model "${model}" · ${runs} run(s) per arm\n\n${table}\n`);
  console.log(`\n${table}\n\nTranscripts: ${path.join(outDir, 'transcripts')} (arm key: key.json)`);
}

await main();
