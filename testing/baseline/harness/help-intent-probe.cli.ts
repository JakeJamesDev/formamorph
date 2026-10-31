// Intent probe — does the Intent Classifier give each help question the right Intent? (formaquestion-intents 06)
//
// The corpus is `help-intent-cases.json` (scored by `help-intent-score.ts`). Each case runs in every arm inside the
// same batch, the arms in a shuffled order per case, so the endpoint's drift hits all of them:
//   shipped   `requestIntent` as the app sends it: the Default preset's prompt and pins, the schema where the
//             endpoint takes one
//   prompted  the same request with the schema stripped, so the reply is the two prompted lines the app checks
//   control   a second copy of shipped: the gap between the two is the run-to-run spread
//   variant   with `--variant FILE`: shipped with the classifier prompt read from FILE, to try a revision
//   keyword   word lists alone, no model: a reference floor, never a control
//
// The report, per arm and per set (dev, blind, all): correct Intents; Help, Code and World given Chat; other
// questions given Create; readings that named no Intent; second asks found and second asks marked on one-ask
// messages; median request latency. Then per kind, the per-run spread, and the most-missed cases.
// The latency bar (Q63) reads the help baseline's `--intent` arm, where the request runs alongside both picks.
//
// Usage: npx vite-node testing/baseline/harness/help-intent-probe.cli.ts --
//          [--endpoint URL] [--model default] [--token T] [--runs 5] [--parallel 4] [--sets dev,blind]
//          [--only id,id] [--variant FILE] [--worst 15] [--show]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { requestIntent, type IntentReading } from '@/lib/formaquestion/helpIntent';
import { DEFAULT_HELP_OPTIONS } from '@/lib/formaquestion/helpPresets';
import { renderHelpPrompt } from '@/lib/formaquestion/helpChips';
import { INTENT_PROMPT, noUsage, pct, probeSnapshot, sessionFetch } from './help-probe-shared';
import {
  confusions, INTENT_BARS, INTENT_CASE_KINDS, INTENT_SETS, keywordIntent, loadIntentCases, missedBars, summarizeIntent,
  type IntentCase, type IntentRow, type IntentSummary,
} from './help-intent-score';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const target = {
  endpoint: argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions'),
  model: argVal('--model', 'default'),
  token: argVal('--token', process.env.PROBE_TOKEN ?? ''),
};
const runs = Number(argVal('--runs', '5'));
const parallel = Number(argVal('--parallel', '4'));
const sets = argVal('--sets', INTENT_SETS.join(',')).split(',');
const only = argVal('--only', '').split(',').filter(Boolean);
const variantFile = argVal('--variant', '');
const worst = Number(argVal('--worst', '15'));
const show = args.includes('--show');

const cases = loadIntentCases().filter((c) => sets.includes(c.set) && (!only.length || only.includes(c.id)));
const shippedPrompt = INTENT_PROMPT;
const variantPrompt = variantFile ? renderHelpPrompt(readFileSync(variantFile, 'utf8').replace(/\r\n/g, '\n').trimEnd()) : '';
const AI_ARMS = ['shipped', 'prompted', 'control', ...(variantFile ? ['variant'] : [])] as const;
type Arm = (typeof AI_ARMS)[number] | 'keyword';
const ARMS: Arm[] = [...AI_ARMS, 'keyword'];

const usage = noUsage();
const snapshot = probeSnapshot(target);
const baseFetch = sessionFetch(usage);
/** The prompted arm's fetch: the body without its schema, as an endpoint that takes none would see it. */
const schemaless: typeof fetch = (url, init) => {
  const { response_format: _dropped, ...body } = JSON.parse(String(init?.body)) as Record<string, unknown>;
  return baseFetch(url, { ...init, body: JSON.stringify(body) });
};

async function ask(arm: Arm, c: IntentCase): Promise<Omit<IntentRow, 'run'>> {
  if (arm === 'keyword') return { id: c.id, reading: keywordIntent(c), ms: 0 };
  const started = performance.now();
  try {
    const reading: IntentReading | null = await requestIntent(
      { question: c.message, prompt: arm === 'variant' ? variantPrompt : shippedPrompt, earlier: c.earlier, earlierAnswer: c.earlierAnswer, where: c.where },
      snapshot,
      DEFAULT_HELP_OPTIONS.intent,
      { fetchImpl: arm === 'prompted' ? schemaless : baseFetch },
    );
    return { id: c.id, reading, ms: performance.now() - started };
  } catch (error: unknown) {
    return { id: c.id, reading: null, ms: performance.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
}

const shuffled = <T,>(items: readonly T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const rows: Record<Arm, IntentRow[]> = Object.fromEntries(ARMS.map((arm) => [arm, []])) as Record<Arm, IntentRow[]>;
const jobs = Array.from({ length: runs }, (_, run) => cases.map((c) => ({ run, c }))).flat();
let next = 0;
let done = 0;
async function worker() {
  while (next < jobs.length) {
    const { run, c } = jobs[next++];
    for (const arm of shuffled(ARMS)) {
      const row = { ...(await ask(arm, c)), run };
      rows[arm].push(row);
      if (row.error) console.log(`  ! ${arm} ${c.id} run ${run + 1}: ${row.error}`);
      else if (show && arm !== 'keyword') console.log(`  ${arm.padEnd(8)} ${c.id.padEnd(22)} ${row.reading?.intent ?? 'none'}${row.reading?.secondAsk ? '+2' : ''}  ${Math.round(row.ms)} ms`);
    }
    if (++done % 25 === 0) console.log(`  ${done}/${jobs.length} cases`);
  }
}

const startedAt = Date.now();
console.log(`Intent probe: ${cases.length} cases × ${runs} runs × ${ARMS.length} arms on ${target.model} @ ${target.endpoint}`);
await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));

const ms = (n: number) => `${Math.round(n).toString().padStart(5)} ms`;
const line = (label: string, s: IntentSummary, arm: Arm) =>
  `  ${label.padEnd(16)} n=${String(s.readings).padStart(4)}  correct ${pct(s.correct * 1000, 1000)}  →Chat ${pct(s.toChat * 1000, 1000)}  false Create ${pct(s.falseCreate * 1000, 1000)}  unread ${pct(s.unread * 1000, 1000)}  2nd found ${pct(s.secondAskRecall * 1000, 1000)}  2nd false ${pct(s.secondAskFalse * 1000, 1000)}${arm === 'keyword' ? '' : `  ${ms(s.latencyMs)}`}`;
const exact = (s: IntentSummary) => `correct ${(100 * s.correct).toFixed(1)}%  →Chat ${(100 * s.toChat).toFixed(2)}%  false Create ${(100 * s.falseCreate).toFixed(2)}%`;

console.log(`\nBars: correct ≥ ${INTENT_BARS.correct * 100}%, →Chat ≤ ${INTENT_BARS.toChat * 100}%, false Create ≤ ${INTENT_BARS.falseCreate * 100}%, latency ≤ ${INTENT_BARS.latencyMs} ms at the median (help baseline --intent arm)`);
const report: Record<string, unknown> = {};
for (const arm of ARMS) {
  console.log(`\n${arm}`);
  const armReport: Record<string, unknown> = {};
  for (const set of [...INTENT_SETS, 'all'] as const) {
    const own = cases.filter((c) => set === 'all' || c.set === set);
    if (!own.length) continue;
    const s = summarizeIntent(own, rows[arm]);
    armReport[set] = s;
    console.log(`${line(set, s, arm)}${arm === 'keyword' ? '' : `   ${exact(s)}${missedBars(s, false).length ? `  MISSES ${missedBars(s, false).join(', ')}` : ''}`}`);
  }
  if (arm === 'keyword') { report[arm] = armReport; continue; }
  for (const kind of INTENT_CASE_KINDS) {
    const own = cases.filter((c) => c.kind === kind);
    if (own.length) console.log(line(`  ${kind}`, summarizeIntent(own, rows[arm]), arm));
  }
  const perRun = Array.from({ length: runs }, (_, run) => summarizeIntent(cases, rows[arm].filter((row) => row.run === run)));
  const spread = (key: 'correct' | 'toChat' | 'falseCreate') => {
    const values = perRun.map((s) => 100 * s[key]);
    return `${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)}`;
  };
  console.log(`  per run          correct ${spread('correct')}%  →Chat ${spread('toChat')}%  false Create ${spread('falseCreate')}%`);
  armReport.perRun = perRun;
  report[arm] = armReport;
}

for (const arm of ['shipped', ...(variantFile ? ['variant' as const] : [])] as const) {
  console.log(`\nMost missed, ${arm}:`);
  for (const { c, wrong, of, got } of confusions(cases, rows[arm]).slice(0, worst)) {
    console.log(`  ${c.id.padEnd(22)} ${c.set.padEnd(5)} want ${[c.intent, ...(c.alt ?? [])].join('/').padEnd(11)} missed ${wrong}/${of}  got ${Object.entries(got).map(([k, n]) => `${k} ${n}`).join(', ')}  "${c.message.slice(0, 70)}"`);
  }
}

const seconds = Math.round((Date.now() - startedAt) / 1000);
console.log(`\n${usage.requests} requests, ${usage.promptTokens} prompt tokens, ${usage.answerTokens} reply tokens, ${seconds} s`);
const dir = path.resolve('testing/baseline/runs');
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `help-intent-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify({ target: { endpoint: target.endpoint, model: target.model }, runs, prompt: shippedPrompt, variantPrompt: variantPrompt || undefined, report, rows }, null, 2));
console.log(`Saved ${path.relative(process.cwd(), file)}`);
