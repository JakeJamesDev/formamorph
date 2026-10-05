// Help-code probe — does the Code rider bring a code question back as fenced stat code that runs?
//
// Each question runs in two arms inside the same batch, so the endpoint's drift hits both:
//   rider    the app's help session with the Default preset, whose Code rider rides every code turn
//   control  the same session with a custom preset whose rider is empty, so no turn carries one
//   <name>   with `--alt FILE,FILE`: per file, the session with a custom preset whose rider is the file's text,
//            as an arm named after the file
//
// A code case asks with code words, or with a stat's Code tab open. A prose case is a how-to control: no turn
// of it is a code turn, so it wants no fence on any arm.
//
// Checks, per answer (help-code-score.ts): fence, closed, tagged (per fence), runs (every fence runs in the
// stat-code sandbox against the fixture stat), truncated (an open fence, of the fenced answers), and `cap`
// (the answer request stopped on the token cap). The bar is Q7 on the rider arm's code cases: fence ≥ 90%,
// runs ≥ 80%.
//
// Usage: npx vite-node testing/baseline/harness/help-code-probe.cli.ts --
//          [--endpoint URL] [--model default] [--token T] [--runs 8] [--parallel 4] [--only id,id] [--alt FILE,FILE] [--show]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { DEFAULT_HELP_PROMPTS, HELP_PICK_SYSTEM_PROMPT } from '@/lib/formaquestion/helpPrompt';
import { DEFAULT_HELP_OPTIONS, type HelpPresetStore } from '@/lib/formaquestion/helpPresets';
import { askHelp } from '@/lib/formaquestion/helpSession';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import { HELP_CODE_CASES, fixtureRunner, type HelpCodeCase, type HelpCodeKind } from './help-code-cases';
import { scoreCodeAnswer, summarizeCodeScores, type CodeScore } from './help-code-score';
import { noUsage, pct, probeSnapshot, sessionFetch, type Usage } from './help-probe-shared';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const token = argVal('--token', process.env.PROBE_TOKEN ?? '');
const runs = Number(argVal('--runs', '8'));
const parallel = Number(argVal('--parallel', '4'));
const only = argVal('--only', '');
const show = args.includes('--show');
const altFiles = argVal('--alt', '').split(',').filter(Boolean);

/** `rider`, `control`, or an alt arm's file name. */
type Arm = string;
const altName = (file: string) => path.basename(file, path.extname(file));
const ARMS: Arm[] = ['rider', ...altFiles.map(altName), 'control'];
const cases = only ? HELP_CODE_CASES.filter((c) => only.split(',').includes(c.id)) : HELP_CODE_CASES;

/** Settings whose active preset is the Default one with `code` as its rider. */
const withRider = (code: string): HelpSettings => {
  const presets: HelpPresetStore = {
    activeId: 'probe',
    presets: [{ id: 'probe', name: 'Probe', prompts: { ...DEFAULT_HELP_PROMPTS, code }, options: DEFAULT_HELP_OPTIONS }],
  };
  return helpSettingsOf({ presets });
};
const SETTINGS: Record<Arm, HelpSettings> = {
  rider: DEFAULT_HELP_SETTINGS,
  control: withRider(''),
  ...Object.fromEntries(altFiles.map((file) => [altName(file), withRider(readFileSync(file, 'utf8').trim())])),
};

const index = bundledDocsIndex();
const snapshot = probeSnapshot({ endpoint, model, token });

interface Sample { answer: string; finish: string | null; usage: Usage }

/** One question through the app's help session. Each request goes out with streaming off, to read its finish and tokens. */
async function ask(arm: Arm, c: HelpCodeCase): Promise<Sample> {
  const usage = noUsage();
  let finish: string | null = null;
  // The pick request comes first; the answer's finish is the one the cap shows on.
  const fetchImpl = sessionFetch(usage, (body, completion) => {
    if (!String(body.messages[0]?.content).startsWith(HELP_PICK_SYSTEM_PROMPT)) finish = completion.choices?.[0]?.finish_reason ?? null;
  });
  let answer = '';
  for await (const event of askHelp({ question: c.question, settings: SETTINGS[arm], snapshot, index, fetchImpl, surface: c.surface })) {
    if (event.type === 'done') answer = event.text;
  }
  return { answer, finish, usage };
}

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

interface Row { caseId: string; kind: HelpCodeKind; arm: Arm; run: number; sample: Sample | null; score: CodeScore | null; error?: string }

// One job per run, case and arm, with the arms of a question next to each other in time.
const jobs: (() => Promise<Row>)[] = [];
for (let run = 1; run <= runs; run++) {
  for (const c of cases) {
    for (const arm of ARMS) {
      jobs.push(async () => {
        const row = { caseId: c.id, kind: c.kind, arm, run };
        try {
          const sample = await ask(arm, c);
          return { ...row, sample, score: await scoreCodeAnswer(sample.answer, fixtureRunner) };
        } catch (error) {
          return { ...row, sample: null, score: null, error: error instanceof Error ? error.message : String(error) };
        }
      });
    }
  }
}

const modelRoot = await fetch(new URL('/v1/models', endpoint))
  .then(async (res) => ((await res.json()) as { data?: { id: string; root?: string }[] }).data?.find((m) => m.id === model)?.root ?? '?')
  .catch(() => '?');
console.log(`help-code-probe · ${endpoint} · model ${model} (root ${modelRoot}) · ${cases.length} cases × ${ARMS.length} arms × ${runs} runs`);
const started = Date.now();
const rows = await pool(jobs, parallel);
console.log(`${rows.length} questions in ${((Date.now() - started) / 1000).toFixed(0)}s, ${rows.filter((r) => r.error).length} failed`);

/** Every metric of one arm over a set of rows, as printable cells. */
function cells(set: Row[]) {
  const scored = set.filter((r): r is Row & { score: CodeScore } => r.score !== null);
  const m = summarizeCodeScores(scored.map((r) => r.score), set.length - scored.length);
  const p = (share: number, whole: number) => pct(Math.round(share * whole), whole);
  return {
    m,
    line: [
      `n=${m.n}`.padEnd(5), `fence ${p(m.fence, m.n)}`, `closed ${p(m.closed, m.n)}`, `tagged ${p(m.tagged, m.fences)}`,
      `runs ${p(m.runs, m.n)}`, `fence-runs ${p(m.fenceRuns, m.fences)}`, `truncated ${p(m.truncated, m.fenced)}`,
      `cap ${pct(scored.filter((r) => r.sample?.finish === 'length').length, m.n)}`,
      `tok ${Math.round(scored.reduce((sum, r) => sum + (r.sample?.usage.answerTokens ?? 0), 0) / Math.max(1, scored.length))}`,
    ].join('  '),
  };
}
const of = (arm: Arm, keep: (r: Row) => boolean) => rows.filter((r) => r.arm === arm && keep(r));

console.log('\ncase                arm');
for (const c of cases) {
  for (const arm of ARMS) console.log(`${c.id.padEnd(19)} ${arm.padEnd(8)} ${cells(of(arm, (r) => r.caseId === c.id)).line}`);
}

console.log('\nTOTALS');
for (const kind of ['code', 'prose'] as const) {
  for (const arm of ARMS) console.log(`${kind.padEnd(6)} ${arm.padEnd(8)} ${cells(of(arm, (r) => r.kind === kind)).line}`);
}
for (const arm of ARMS) console.log(`code, Code tab open  ${arm.padEnd(8)} ${cells(of(arm, (r) => r.kind === 'code' && cases.find((c) => c.id === r.caseId)?.surface !== undefined)).line}`);

const bar = cells(of('rider', (r) => r.kind === 'code')).m;
const prose = (['rider', 'control'] as const).map((arm) => cells(of(arm, (r) => r.kind === 'prose')).m.fence);
console.log(`\nQ7 bar, rider arm: fence ${Math.round(bar.fence * 100)}% (≥90%) ${bar.fence >= 0.9 ? 'MET' : 'MISSED'}`
  + ` · runs ${Math.round(bar.runs * 100)}% (≥80%) ${bar.runs >= 0.8 ? 'MET' : 'MISSED'}`
  + ` · prose controls fenced: rider ${Math.round(prose[0] * 100)}%, control ${Math.round(prose[1] * 100)}%`);

const errors = rows.flatMap((r) => (r.score?.errors ?? []).map((error) => `${r.caseId} · ${r.arm}: ${error.split('\n')[0]}`));
if (errors.length) console.log(`\nsandbox errors:\n${[...new Set(errors)].join('\n')}`);

if (show) for (const r of rows.filter((x) => x.run === 1)) console.log(`\n--- ${r.caseId} · ${r.arm} ---\n${r.error ?? r.sample?.answer}`);

const outDir = path.resolve('testing/baseline/runs');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `help-code-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(outFile, JSON.stringify({ endpoint, model, modelRoot, runs, rows }, null, 2));
console.log(`\nraw answers: ${path.relative(process.cwd(), outFile)}`);
