// Help flag-in-history probe (ticket 30): does a flagged answer's marker in the follow-up history help the
// model flag the next answer right, through the app's own `askHelp`.
//
// Per run and case in `help-flag-history-cases.json`, the first question (not in the guide) is asked once.
// Only a flagged first answer goes on. Then each follow-up goes out in two arms in the same batch:
//   marked     the earlier answer carries the marker in history, as shipped
//   unmarked   the control: the same answer without the marker
// Follow-ups:
//   uncovered  the guide does not cover it either. Wanted: flagged
//   covered    the guide covers it. Wanted: not flagged, with the keyed control names
// `marked when sent` counts only follow-ups that got sections: with none, the app flags without the model.
//
// The probe adds `reasoning_effort: "none"` to the app's request body, as every probe here does.
//
// Usage: npx vite-node testing/baseline/harness/help-flag-history-probe.cli.ts --
//          [--endpoint URL] [--model default] [--token T] [--runs 5] [--parallel 4] [--show]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { GENERAL_KNOWLEDGE_MARKER } from '@/lib/formaquestion/generalKnowledge';
import { askHelp, type EarlierExchange } from '@/lib/formaquestion/helpSession';
import { DEFAULT_HELP_SETTINGS } from '@/lib/formaquestion/helpSettings';
import { factShare, mean, pct, probeSnapshot } from './help-probe-shared';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const token = argVal('--token', process.env.PROBE_TOKEN ?? '');
const runs = Number(argVal('--runs', '5'));
const parallel = Number(argVal('--parallel', '4'));
const show = args.includes('--show');

interface Covered { question: string; section: string; facts: string[] }
interface FlagCase { id: string; first: string; uncovered: string; covered: Covered }

const BASELINE = path.resolve('testing/baseline');
const cases = (JSON.parse(readFileSync(path.join(BASELINE, 'help-flag-history-cases.json'), 'utf8')) as { cases: FlagCase[] }).cases;
const index = bundledDocsIndex();

const snapshot = probeSnapshot({ endpoint, model, token });

interface Sample { answer: string; flagged: boolean; sources: string[]; history: string[] }

/** One question through the app's `askHelp`. The fetch adds the probe's reasoning-off field and keeps the sent history. */
async function ask(question: string, history: EarlierExchange[]): Promise<Sample> {
  let sent: string[] = [];
  const fetchImpl: typeof fetch = (url, init) => {
    const body = JSON.parse(String(init?.body)) as { messages: { role: string; content: string }[] };
    sent = body.messages.filter((message) => message.role === 'assistant').map((message) => message.content);
    return fetch(url, { ...init, body: JSON.stringify({ ...body, reasoning_effort: 'none' }) });
  };
  for await (const event of askHelp({ question, history, language: 'English', settings: DEFAULT_HELP_SETTINGS, snapshot, index, fetchImpl })) {
    if (event.type === 'done') return { answer: event.text, flagged: event.flagged, sources: event.sources.map((s) => s.id), history: sent };
  }
  throw new Error('no answer');
}

/** Runs the jobs with at most `limit` in flight. */
async function pool<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (next < jobs.length) {
      const at = next++;
      results[at] = await jobs[at]();
    }
  }));
  return results;
}

const ARMS = ['marked', 'unmarked'] as const;
const KINDS = ['uncovered', 'covered'] as const;
type Arm = (typeof ARMS)[number];
type Kind = (typeof KINDS)[number];
interface Row { id: string; run: number; arm: Arm; kind: Kind; sample?: Sample; error?: string }
interface First { id: string; run: number; flagged: boolean; error?: string }

const firsts: First[] = [];
const jobs: (() => Promise<Row[]>)[] = [];
for (let run = 1; run <= runs; run++) {
  for (const c of cases) {
    jobs.push(async () => {
      let first: Sample;
      try {
        first = await ask(c.first, []);
      } catch (error) {
        firsts.push({ id: c.id, run, flagged: false, error: String(error) });
        return [];
      }
      firsts.push({ id: c.id, run, flagged: first.flagged });
      if (!first.flagged) return [];
      return Promise.all(ARMS.flatMap((arm) => KINDS.map(async (kind): Promise<Row> => {
        const history = [{ question: c.first, answer: first.answer, flagged: arm === 'marked' }];
        try {
          return { id: c.id, run, arm, kind, sample: await ask(kind === 'covered' ? c.covered.question : c.uncovered, history) };
        } catch (error) {
          return { id: c.id, run, arm, kind, error: String(error) };
        }
      })));
    });
  }
}

console.log(`\nflag in history · ${endpoint} · ${model} · ${cases.length} cases × 2 follow-ups × 2 arms × ${runs} runs`);
const started = Date.now();
const rows = (await pool(jobs, parallel)).flat();
console.log(`${rows.length} follow-ups in ${((Date.now() - started) / 1000).toFixed(0)}s, ${rows.filter((r) => r.error).length} failed`);
console.log(`first answers flagged: ${firsts.filter((f) => f.flagged).length}/${firsts.length}, failed ${firsts.filter((f) => f.error).length}`);

const coveredOf = (id: string) => cases.find((c) => c.id === id)!.covered;
const line = (label: string, keep: (r: Row) => boolean) => {
  const scored = rows.filter((r) => r.sample && keep(r));
  const n = scored.length;
  const covered = scored.filter((r) => r.kind === 'covered');
  // With no section sent the app flags by itself; only answers with sections show the model's marker.
  const withSections = scored.filter((r) => r.sample!.sources.length > 0);
  const parts = [
    label.padEnd(30), `n=${n}`.padEnd(5), `flagged ${pct(scored.filter((r) => r.sample!.flagged).length, n)}`,
    `sections sent ${pct(withSections.length, n)}`,
    `marked when sent ${pct(withSections.filter((r) => r.sample!.flagged).length, withSections.length)}`,
  ];
  if (covered.length) {
    parts.push(
      `section sent ${pct(covered.filter((r) => r.sample!.sources.includes(coveredOf(r.id).section)).length, covered.length)}`,
      `facts ${pct(mean(covered.map((r) => factShare(coveredOf(r.id).facts, r.sample!.answer))) * covered.length, covered.length)}`,
      `complete ${pct(covered.filter((r) => factShare(coveredOf(r.id).facts, r.sample!.answer) === 1).length, covered.length)}`,
    );
  }
  console.log(parts.join('  '));
};
for (const c of cases) for (const kind of KINDS) for (const arm of ARMS) line(`${c.id} · ${kind} · ${arm}`, (r) => r.id === c.id && r.kind === kind && r.arm === arm);
console.log('');
for (const kind of KINDS) for (const arm of ARMS) line(`ALL · ${kind} · ${arm}`, (r) => r.kind === kind && r.arm === arm);
const leaked = rows.filter((r) => r.arm === 'unmarked' && r.sample?.history.some((text) => text.includes(GENERAL_KNOWLEDGE_MARKER))).length;
const held = rows.filter((r) => r.arm === 'marked' && r.sample?.history.some((text) => text.startsWith(`${GENERAL_KNOWLEDGE_MARKER}\n`))).length;
console.log(`arm check: marked requests that held the marker ${held}/${rows.filter((r) => r.arm === 'marked' && r.sample).length}, unmarked that held one ${leaked}`);
if (show) for (const r of rows.filter((row) => row.run === 1)) console.log(`\n--- ${r.id} · ${r.kind} · ${r.arm} · flagged ${r.sample?.flagged} ---\n${r.error ?? r.sample?.answer}`);

const outDir = path.join(BASELINE, 'runs');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `help-flag-history-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(outFile, JSON.stringify({ endpoint, model, runs, firsts, rows }, null, 2));
console.log(`\nraw answers: ${path.relative(process.cwd(), outFile)}`);
