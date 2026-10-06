// Help-code probe — does the Code rider bring a code question back as fenced stat code that runs?
//
// Each question runs in every arm inside the same batch, so the endpoint's drift hits them all:
//   rider    the app's help session with the Default preset, whose Code rider rides every code turn
//   names    the Default rider with `entities` and `persona` named beside `traits` (the Q10 arm; only through `--arms`)
//   nofocus  the rider arm with no selected stat, so the surface line names none (the Q39 control; only through `--arms`)
//   noqr     the Default preset over docs with no Quick Reference section, so no code turn pins it
//   control  the same session with a custom preset whose rider is empty, so no turn carries one
//   test     with `--tools`: the rider arm with the code test on, against the case's fixture world (the Q19 arm)
//   <name>   with `--alt FILE,FILE`: per file, the session with a custom preset whose rider is the file's text,
//            as an arm named after the file
//   <name>   with `--docs-alt PAGE=FILE,PAGE=FILE`: per file, the Default preset over docs whose page PAGE is
//            the file's text, as an arm named after the file
//
// A code case asks with code words, or with a stat's Code tab open. A prose case is a how-to control: no turn
// of it is a code turn, so it wants no fence on any arm. A known case carries its real names: it passes when
// every fence runs, the fences hold those names, and they hold no invented one (an unknown clock field, a whole
// stat compared, or a name the case rules out).
//
// With `--tools`, the endpoint takes function calls and the arms default to rider and test. Each answer also
// counts its code test calls, and whether the last one came back clean: no error and no dropped write.
//
// Checks, per answer (help-code-score.ts): fence, closed, tagged (per fence), runs (every fence runs in the
// stat-code sandbox against the fixture stat), truncated (an open fence, of the fenced answers), `cap` (the
// answer request stopped on the token cap), and on known cases `pass`. Bars: Q7 on the rider arm's code cases
// (fence ≥ 90%, runs ≥ 80%); Q9 on the rider arm's known cases (pass ≥ 80%, 5+ runs, the other code cases' runs
// not below noqr's); Q10 compares names with rider on the known cases.
//
// Usage: npx vite-node testing/baseline/harness/help-code-probe.cli.ts --
//          [--endpoint URL] [--model default] [--token T] [--runs 8] [--parallel 4] [--only id,id] [--arms a,b] [--alt FILE,FILE] [--docs-alt PAGE=FILE] [--tools] [--show]
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sidebar from '../../../docs/_Sidebar.md?raw';
import { BUNDLED_DOCS, bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { createDocsIndex, type DocsIndex } from '@/lib/docs/docsIndex';
import { sectionWithId } from '@/lib/docs/docsReader';
import { DEFAULT_CODE_RIDER, QUICK_REFERENCE_SECTION } from '@/lib/formaquestion/helpCodeRider';
import { DEFAULT_HELP_PROMPTS, HELP_PICK_SYSTEM_PROMPT } from '@/lib/formaquestion/helpPrompt';
import { DEFAULT_HELP_OPTIONS, type HelpPresetStore } from '@/lib/formaquestion/helpPresets';
import { askHelp } from '@/lib/formaquestion/helpSession';
import { HELP_CODE_TEST } from '@/lib/formaquestion/helpCodeTest';
import type { CodeTestResult } from '@/lib/formaquestion/helpCodeTestRun';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import { emptyToolSnapshot } from '@/lib/tools/toolSnapshot';
import { FIXTURE_WORLD, HELP_CODE_CASES, fixtureRunner, testsClean, type HelpCodeCase, type HelpCodeKind } from './help-code-cases';
import { passesCase, scoreCodeAnswer, scoreNames, summarizeCodeScores, type CodeScore, type NameScore } from './help-code-score';
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
const tools = args.includes('--tools');
const altFiles = argVal('--alt', '').split(',').filter(Boolean);
const armList = argVal('--arms', '').split(',').filter(Boolean);
const docsAlts = argVal('--docs-alt', '').split(',').filter(Boolean).map((spec) => {
  const at = spec.indexOf('=');
  if (at <= 0) {
    console.error(`help-code-probe: --docs-alt takes PAGE=FILE, not ${spec}`);
    process.exit(1);
  }
  return { page: spec.slice(0, at), file: spec.slice(at + 1) };
});

/** `rider`, `names`, `nofocus`, `noqr`, `control`, `test`, or an alt arm's file name. */
type Arm = string;
const altName = (file: string) => path.basename(file, path.extname(file));
const ALL_ARMS: Arm[] = ['rider', 'names', 'nofocus', 'noqr', ...altFiles.map(altName), ...docsAlts.map((alt) => altName(alt.file)), 'control', ...(tools ? ['test'] : [])];
// `names` asks a settled question (Q10) and `nofocus` one control (Q39), so each runs only when `--arms` names it.
const ARMS = armList.length
  ? ALL_ARMS.filter((arm) => armList.includes(arm))
  : ALL_ARMS.filter((arm) => (tools ? arm === 'rider' || arm === 'test' : arm !== 'names' && arm !== 'nofocus'));
if (armList.includes('test') && !tools) {
  console.error('help-code-probe: the test arm calls a function, so it needs --tools and an endpoint that takes function calls');
  process.exit(1);
}
const cases = only ? HELP_CODE_CASES.filter((c) => only.split(',').includes(c.id)) : HELP_CODE_CASES;

const NAMES_AFTER = 'traits through `traits`';
const NAMES_CLAUSE = ', entities through `entities`, the played persona through `persona`';
if (ARMS.includes('names') && (!DEFAULT_CODE_RIDER.includes(NAMES_AFTER) || DEFAULT_CODE_RIDER.includes(NAMES_CLAUSE))) {
  console.error('help-code-probe: the names arm needs a Default rider that names traits and not entities or persona');
  process.exit(1);
}

/** Settings whose active preset is the Default one with `code` as its rider. */
const withRider = (code: string): HelpSettings => {
  const presets: HelpPresetStore = {
    activeId: 'probe',
    presets: [{ id: 'probe', name: 'Probe', prompts: { ...DEFAULT_HELP_PROMPTS, code }, options: DEFAULT_HELP_OPTIONS }],
  };
  return helpSettingsOf({ presets });
};
// Every arm but test turns the code test off, whatever its default.
const SETTINGS: Record<Arm, HelpSettings> = Object.fromEntries(Object.entries({
  rider: DEFAULT_HELP_SETTINGS,
  names: withRider(DEFAULT_CODE_RIDER.replace(NAMES_AFTER, NAMES_AFTER + NAMES_CLAUSE)),
  nofocus: DEFAULT_HELP_SETTINGS,
  noqr: DEFAULT_HELP_SETTINGS,
  control: withRider(''),
  ...Object.fromEntries(altFiles.map((file) => [altName(file), withRider(readFileSync(file, 'utf8').trim())])),
  ...Object.fromEntries(docsAlts.map((alt) => [altName(alt.file), DEFAULT_HELP_SETTINGS])),
}).map(([arm, settings]): [Arm, HelpSettings] => [arm, { ...settings, codeTest: false }]));
SETTINGS.test = { ...DEFAULT_HELP_SETTINGS, codeTest: true };

const index = bundledDocsIndex();
// The same pages with no Quick Reference section in the guide.
const noQuickReference = createDocsIndex({
  pages: Object.fromEntries(Object.entries(BUNDLED_DOCS).map(([page, markdown]) =>
    [page, markdown.replace(/^## Quick Reference\n[\s\S]*?(?=^## )/m, '')])),
  sidebar,
});
if (!sectionWithId(index, QUICK_REFERENCE_SECTION) || sectionWithId(noQuickReference, QUICK_REFERENCE_SECTION)) {
  console.error('help-code-probe: the noqr arm needs the Quick Reference in the bundled docs and out of its own index');
  process.exit(1);
}
const INDEX: Record<Arm, DocsIndex> = {
  ...Object.fromEntries(ALL_ARMS.map((arm) => [arm, arm === 'noqr' ? noQuickReference : index])),
  ...Object.fromEntries(docsAlts.map(({ page, file }) => {
    if (!(page in BUNDLED_DOCS)) {
      console.error(`help-code-probe: --docs-alt names ${page}, which is no bundled docs page`);
      process.exit(1);
    }
    return [altName(file), createDocsIndex({ pages: { ...BUNDLED_DOCS, [page]: readFileSync(file, 'utf8') }, sidebar })];
  })),
};
const snapshot = probeSnapshot({ endpoint, model, token }, tools);

interface Sample {
  answer: string; finish: string | null; usage: Usage;
  /** The prompt tokens of the question's largest single request. */
  largestPrompt: number;
  /** The code test calls the answer made. */
  tests: number;
  /** Whether the last code test came back with no error and no dropped write; null with no call. */
  lastClean: boolean | null;
}

interface SentMessage { role: string; content: unknown; tool_call_id?: string; tool_calls?: { id: string; function: { name: string } }[] }

/** The last code test result an answer request carries in its tool rounds. */
function lastTestResult(messages: readonly SentMessage[]): CodeTestResult | null {
  const ids = new Set(messages.flatMap((m) => m.tool_calls ?? []).filter((call) => call.function.name === HELP_CODE_TEST.name).map((call) => call.id));
  const result = messages.filter((m) => m.role === 'tool' && m.tool_call_id !== undefined && ids.has(m.tool_call_id)).at(-1);
  if (!result) return null;
  try {
    return JSON.parse(String(result.content)) as CodeTestResult;
  } catch {
    return null;
  }
}

/** One question through the app's help session. Each request goes out with streaming off, to read its finish and tokens. */
async function ask(arm: Arm, c: HelpCodeCase): Promise<Sample> {
  const usage = noUsage();
  let finish: string | null = null;
  let tests = 0;
  let largestPrompt = 0;
  let last: CodeTestResult | null = null;
  // The pick request comes first; the answer's finish is the one the cap shows on.
  const fetchImpl = sessionFetch(usage, (body, completion) => {
    largestPrompt = Math.max(largestPrompt, completion.usage?.prompt_tokens ?? 0);
    if (String(body.messages[0]?.content).startsWith(HELP_PICK_SYSTEM_PROMPT)) return;
    finish = completion.choices?.[0]?.finish_reason ?? null;
    tests += (completion.choices?.[0]?.message?.tool_calls ?? []).filter((call) => call.function.name === HELP_CODE_TEST.name).length;
    last = lastTestResult(body.messages as SentMessage[]) ?? last;
  });
  const world = { snapshot: emptyToolSnapshot, authored: () => c.world ?? FIXTURE_WORLD };
  let answer = '';
  for await (const event of askHelp({ question: c.question, settings: SETTINGS[arm], snapshot, index: INDEX[arm], fetchImpl, surface: c.surface, focus: arm === 'nofocus' ? undefined : c.focus, world })) {
    if (event.type === 'done') answer = event.text;
  }
  // A call whose result never came back counts as not clean.
  return { answer, finish, usage, largestPrompt, tests, lastClean: tests ? last !== null && testsClean(last) : null };
}

/** The loaded model's slot count and context, from `lms ps --json`; null off LM Studio or when the CLI is absent. */
function lmsLoad(): { parallel: number; contextLength: number } | null {
  if (!/localhost:1234|127\.0\.0\.1:1234/.test(endpoint)) return null;
  try {
    const list = JSON.parse(execSync('lms ps --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) as { identifier: string; parallel?: number; contextLength?: number }[];
    const loaded = list.find((m) => m.identifier === model) ?? list[0];
    return loaded?.parallel && loaded.contextLength ? { parallel: loaded.parallel, contextLength: loaded.contextLength } : null;
  } catch {
    return null;
  }
}

/** The most requests that fit the loaded context at once: LM Studio shares it across its slots, so two in flight each get half. */
const safeParallel = (load: { parallel: number; contextLength: number }, largestPrompt: number, maxTokens: number) =>
  Math.max(1, Math.min(load.parallel, Math.floor(load.contextLength / (largestPrompt + maxTokens))));

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

interface Row {
  caseId: string; kind: HelpCodeKind; arm: Arm; run: number; sample: Sample | null; score: CodeScore | null;
  /** On a known case: its names, and whether it passed. */
  names?: NameScore; pass?: boolean; error?: string;
}

// One job per run, case and arm, with the arms of a question next to each other in time.
const jobs: (() => Promise<Row>)[] = [];
for (let run = 1; run <= runs; run++) {
  for (const c of cases) {
    for (const arm of ARMS) {
      jobs.push(async () => {
        const row = { caseId: c.id, kind: c.kind, arm, run };
        let out: Row;
        try {
          const sample = await ask(arm, c);
          const score = await scoreCodeAnswer(sample.answer, fixtureRunner);
          const names = c.names ? scoreNames(sample.answer, c.names) : undefined;
          out = { ...row, sample, score, ...(names && { names, pass: passesCase(score, names) }) };
        } catch (error) {
          out = { ...row, sample: null, score: null, error: error instanceof Error ? error.message : String(error) };
        }
        // One line per answer as it lands, so a run in progress can be read and stopped.
        console.log(out.error
          ? `  ${run} ${c.id.padEnd(25)} ${arm.padEnd(8)} FAILED ${out.error.slice(0, 80)}`
          : `  ${run} ${c.id.padEnd(25)} ${arm.padEnd(8)} calls ${out.sample!.tests} · fence ${out.score!.fence ? 'ok' : 'no'} · ${out.pass === undefined ? `runs ${out.score!.runs ? 'ok' : 'no'}` : out.pass ? 'PASS' : 'MISS'} · ${out.sample!.largestPrompt} tok`);
        return out;
      });
    }
  }
}

const modelRoot = await fetch(new URL('/v1/models', endpoint))
  .then(async (res) => ((await res.json()) as { data?: { id: string; root?: string }[] }).data?.find((m) => m.id === model)?.root ?? '?')
  .catch(() => '?');
console.log(`help-code-probe · ${endpoint} · model ${model} (root ${modelRoot}) · ${cases.length} cases × ${ARMS.length} arms × ${runs} runs`);
const started = Date.now();
// The first question runs alone: it is the smoke line, and its largest request sizes the slots the rest may use.
const first = await jobs[0]();
const load = lmsLoad();
let limit = parallel;
if (load && first.sample) {
  limit = Math.min(parallel, safeParallel(load, first.sample.largestPrompt, DEFAULT_HELP_OPTIONS.answer.maxTokens));
  console.log(`lms ps: parallel ${load.parallel}, context ${load.contextLength} · largest request ${first.sample.largestPrompt} + ${DEFAULT_HELP_OPTIONS.answer.maxTokens} tokens · running ${limit} at a time${limit < parallel ? ` (asked ${parallel})` : ''}`);
}
const rows = [first, ...(await pool(jobs.slice(1), limit))];
console.log(`${rows.length} questions in ${((Date.now() - started) / 1000).toFixed(0)}s, ${rows.filter((r) => r.error).length} failed`);

const known = new Set(cases.filter((c) => c.names).map((c) => c.id));

/** The code test cells: answers that called it, calls per answer, and of the callers, those whose last call came back clean. */
function testCells(scored: readonly Row[]) {
  const called = scored.filter((r) => (r.sample?.tests ?? 0) > 0);
  return [
    `tested ${pct(called.length, scored.length)}`,
    `calls ${(scored.reduce((sum, r) => sum + (r.sample?.tests ?? 0), 0) / Math.max(1, scored.length)).toFixed(1)}`,
    `clean ${pct(called.filter((r) => r.sample?.lastClean).length, called.length)}`,
  ];
}

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
      // A failed request on a known case counts as a miss.
      ...(set.some((r) => known.has(r.caseId)) ? [`pass ${pct(set.filter((r) => r.pass).length, set.length)}`] : []),
      ...(tools ? testCells(scored) : []),
    ].join('  '),
  };
}
const of = (arm: Arm, keep: (r: Row) => boolean) => rows.filter((r) => r.arm === arm && keep(r));
const isKnown = (r: Row) => known.has(r.caseId);
const share = (set: Row[], pick: (r: Row) => boolean) => (set.length ? set.filter(pick).length / set.length : 0);
const percent = (value: number) => `${Math.round(value * 100)}%`;

console.log(`\n${'case'.padEnd(25)} arm`);
for (const c of cases) {
  for (const arm of ARMS) console.log(`${c.id.padEnd(25)} ${arm.padEnd(8)} ${cells(of(arm, (r) => r.caseId === c.id)).line}`);
}

console.log('\nTOTALS');
for (const kind of ['code', 'prose'] as const) {
  for (const arm of ARMS) console.log(`${kind.padEnd(6)} ${arm.padEnd(8)} ${cells(of(arm, (r) => r.kind === kind)).line}`);
}
for (const arm of ARMS) console.log(`code, Code tab open  ${arm.padEnd(8)} ${cells(of(arm, (r) => r.kind === 'code' && cases.find((c) => c.id === r.caseId)?.surface !== undefined)).line}`);
for (const arm of ARMS) console.log(`known cases          ${arm.padEnd(8)} ${cells(of(arm, isKnown)).line}`);
for (const arm of ARMS) console.log(`other code cases     ${arm.padEnd(8)} ${cells(of(arm, (r) => r.kind === 'code' && !isKnown(r))).line}`);

const bar = cells(of('rider', (r) => r.kind === 'code')).m;
const prose = ARMS.filter((arm) => arm === 'rider' || arm === 'control').map((arm) => `${arm} ${percent(cells(of(arm, (r) => r.kind === 'prose')).m.fence)}`);
console.log(`\nQ7 bar, rider arm: fence ${percent(bar.fence)} (≥90%) ${bar.fence >= 0.9 ? 'MET' : 'MISSED'}`
  + ` · runs ${percent(bar.runs)} (≥80%) ${bar.runs >= 0.8 ? 'MET' : 'MISSED'}`
  + ` · prose controls fenced: ${prose.join(', ')}`);

if (known.size && ARMS.includes('rider')) {
  const knownPass = (arm: Arm) => share(of(arm, isKnown), (r) => r.pass === true);
  const pass = knownPass('rider');
  const otherRuns = (arm: Arm) => cells(of(arm, (r) => r.kind === 'code' && !isKnown(r))).m.runs;
  const held = ARMS.includes('noqr') ? ` · other code cases runs ${percent(otherRuns('rider'))} vs noqr ${percent(otherRuns('noqr'))} ${otherRuns('rider') >= otherRuns('noqr') ? 'HELD' : 'DROPPED'}` : '';
  console.log(`Q9 bar, rider arm: known cases pass ${percent(pass)} (≥80%) ${pass >= 0.8 ? 'MET' : 'MISSED'}${runs < 5 ? ' (under 5 runs)' : ''}${held}`);
  if (ARMS.includes('names')) console.log(`Q10 rider names: known cases pass names ${percent(knownPass('names'))} vs rider ${percent(pass)}`);
  if (ARMS.includes('test')) {
    const persona = (arm: Arm) => share(of(arm, (r) => r.caseId === 'seasoned-on-persona'), (r) => r.pass === true);
    const testPass = knownPass('test');
    console.log(`Q9 bar, test arm: known cases pass ${percent(testPass)} (≥80%) ${testPass >= 0.8 ? 'MET' : 'MISSED'}`
      + `${ARMS.includes('noqr') ? ` · other code cases runs ${percent(otherRuns('test'))} vs noqr ${percent(otherRuns('noqr'))}` : ''}`);
    console.log(`Q19 code test: known cases pass test ${percent(testPass)} vs rider ${percent(pass)}`
      + ` · other code cases runs test ${percent(otherRuns('test'))} vs rider ${percent(otherRuns('rider'))}`
      + ` · persona case (Q29) test ${percent(persona('test'))} vs rider ${percent(persona('rider'))}`);
  }
}

const nameMisses = rows.flatMap((r) => [...(r.names?.missing ?? []).map((name) => `missing ${name}`), ...(r.names?.invented ?? [])]
  .map((name) => `${r.caseId} · ${r.arm}: ${name}`));
if (nameMisses.length) {
  const counts = new Map<string, number>();
  for (const line of nameMisses) counts.set(line, (counts.get(line) ?? 0) + 1);
  console.log(`\nknown-case names:\n${[...counts].map(([line, count]) => `${count}× ${line}`).join('\n')}`);
}

const errors = rows.flatMap((r) => (r.score?.errors ?? []).map((error) => `${r.caseId} · ${r.arm}: ${error.split('\n')[0]}`));
if (errors.length) console.log(`\nsandbox errors:\n${[...new Set(errors)].join('\n')}`);

if (show) for (const r of rows.filter((x) => x.run === 1)) console.log(`\n--- ${r.caseId} · ${r.arm} ---\n${r.error ?? r.sample?.answer}`);

const outDir = path.resolve('testing/baseline/runs');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `help-code-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(outFile, JSON.stringify({ endpoint, model, modelRoot, runs, rows }, null, 2));
console.log(`\nraw answers: ${path.relative(process.cwd(), outFile)}`);
