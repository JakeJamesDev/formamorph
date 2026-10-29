// World-question probe — does Formaquestion answer from the open world, and keep what the player has not met?
//
// Each question runs in every arm inside the same batch, so the endpoint's drift hits them all:
//   shipped  the app's help session at its defaults, Read the World on
//   off      the same session with Read the World off: the docs-only control for grounded-correct
//   full     game cases only: the full world (AI descriptions, hidden stats, the unmet cast, switched-off lore) in
//            the Player View's place, the control that shows the leak score catch a real leak
//
// Editor cases ask how a part of a bundled world works, with the World Editor open on it. Game cases ask about the
// lore so far on a hand-written save (world-question-cases.ts); "what would you try" cases score opinion phrasing (Q19).
//
// Scores, editor and game apart (world-question-score.ts): grounded-correct (every keyed fact named), fact share,
// leak (a game answer names what its save keeps hidden), opinion. Sizes per case: the guide, world and story
// blocks, the user message and the body, in characters, with `cut` where a budget dropped a section or a story band.
//
// Usage: npx vite-node testing/baseline/harness/world-question-probe.cli.ts --
//          [--endpoint URL] [--model default] [--token T] [--runs 5] [--parallel 4] [--only id,id] [--arms a,b] [--show]
//          [--rescore testing/baseline/runs/world-question-probe-<stamp>.json]  scores an earlier batch's answers again, asking nothing
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { sectionWithId } from '@/lib/docs/docsReader';
import { firedLore, gameWorldIndex, type GameWorldInput } from '@/lib/formaquestion/gameWorld';
import { HELP_PICK_SYSTEM_PROMPT } from '@/lib/formaquestion/helpPrompt';
import { askHelp, HELP_DOCS_CHAR_BUDGET, HELP_SECTION_LIMIT, HELP_WORLD_CHAR_BUDGET, HELP_WORLD_SECTION_LIMIT } from '@/lib/formaquestion/helpSession';
import { DEFAULT_HELP_SETTINGS, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import type { HelpTrace, HelpTraceSource } from '@/lib/formaquestion/helpTrace';
import type { OpenWorld } from '@/lib/formaquestion/helpWorld';
import { isWorldSource } from '@/lib/formaquestion/helpWorldSource';
import { worldIndexOf, type WorldIndex } from '@/lib/formaquestion/worldIndex';
import { HELP_STORY_CHAR_BUDGET } from '@/lib/formaquestion/storySoFar';
import { emptyToolSnapshot } from '@/lib/tools/toolSnapshot';
import { noUsage, pct, probeSnapshot, sessionFetch } from './help-probe-shared';
import { bundledWorld, fullInputOf, GAME_SAVES, gameInputOf, uncutStory, WORLD_QUESTION_CASES, type WorldQuestionCase } from './world-question-cases';
import { scoreWorldAnswer, summarizeWorldScores, type WorldAnswerScore } from './world-question-score';

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
const only = argVal('--only', '').split(',').filter(Boolean);
const armList = argVal('--arms', '').split(',').filter(Boolean);
const show = args.includes('--show');
const rescore = argVal('--rescore', '');

type Arm = 'shipped' | 'off' | 'full';
const ARMS = (['shipped', 'off', 'full'] as const).filter((arm) => !armList.length || armList.includes(arm));
const cases = only.length ? WORLD_QUESTION_CASES.filter((c) => only.includes(c.id)) : WORLD_QUESTION_CASES;
/** The full arm has nothing to add in the editor, which reads the full world already. */
const armsOf = (c: WorldQuestionCase): Arm[] => ARMS.filter((arm) => arm !== 'full' || c.lean === 'game');

const SETTINGS: Record<Arm, HelpSettings> = {
  shipped: DEFAULT_HELP_SETTINGS,
  off: { ...DEFAULT_HELP_SETTINGS, readWorld: false },
  full: DEFAULT_HELP_SETTINGS,
};
const index = bundledDocsIndex();
const snapshot = probeSnapshot({ endpoint, model, token });

/** The world one arm of a case opens, with the index its world block ranks from. */
function openWorldOf(c: WorldQuestionCase, arm: Arm): { world: OpenWorld; index: () => WorldIndex; game?: GameWorldInput } {
  const authored = bundledWorld(c.world);
  // The probe endpoint takes no function calls, so no Tool or code test reads `snapshot` or `authored`.
  const base ={ snapshot: () => emptyToolSnapshot, authored: () => authored };
  if (c.lean === 'editor') return { world: { ...base, lean: 'editor', world: () => authored }, index: () => worldIndexOf(authored) };
  const save = GAME_SAVES[c.world]!.save;
  const game = arm === 'full' ? fullInputOf(authored, save) : gameInputOf(authored, save);
  return { world: { ...base, lean: 'game', game: () => game }, index: () => gameWorldIndex(game, firedLore(game, c.question, null)), game };
}

/** The characters of one block of the user message; 0 when the message has none. */
const blockSize = (message: string, tag: string) => new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`).exec(message)?.[0].length ?? 0;

/** What one request held, in characters, and where a budget cut it. */
interface Sizes {
  guide: number; world: number; story: number; message: number; body: number;
  /** Each budget that dropped a section or a story band. */
  cut: ('guide' | 'world' | 'story')[];
}

/**
 * True when the block took fewer sections than its limit, and the next ranked section past the last one sent
 * would have overflowed the character budget: helpSections stops at that section.
 */
function budgetCut(merged: readonly HelpTraceSource[], sent: readonly HelpTraceSource[], held: number, limit: number, budget: number, sizeOf: (source: HelpTraceSource) => number): boolean {
  if (sent.length >= limit) return false;
  const sentIds = new Set(sent.map((source) => source.id));
  const lastSent = Math.max(...merged.map((source, at) => (sentIds.has(source.id) ? at : -1)));
  const next = merged.slice(lastSent + 1).find((source) => !sentIds.has(source.id));
  return next !== undefined && held + sizeOf(next) > budget;
}

function sizesOf(message: string, body: string, trace: HelpTrace | null, worldIndex: WorldIndex | null, storyCut: boolean): Sizes {
  const sent = trace?.sent ?? [];
  const guideSent = sent.filter((source) => !isWorldSource(source));
  const worldSent = sent.filter(isWorldSource);
  const guideMerged = trace?.search?.queries[0]?.merged ?? [];
  const worldMerged = trace?.worldSearch?.queries[0]?.merged ?? [];
  const guide = blockSize(message, 'guide');
  const world = blockSize(message, 'world');
  const cut: Sizes['cut'] = [
    ...(budgetCut(guideMerged, guideSent, guide, HELP_SECTION_LIMIT, HELP_DOCS_CHAR_BUDGET, (s) => sectionWithId(index, s.id)?.markdown.length ?? 0) ? ['guide'] : []),
    ...(worldIndex && budgetCut(worldMerged, worldSent, world, HELP_WORLD_SECTION_LIMIT, HELP_WORLD_CHAR_BUDGET,
      (s) => (isWorldSource(s) ? worldIndex.sectionsOf(s).reduce((sum, section) => sum + section.markdown.length, 0) : 0)) ? ['world'] : []),
    ...(storyCut ? ['story'] : []),
  ];
  return { guide, world, story: blockSize(message, 'story'), message: message.length, body: body.length, cut };
}

interface Sample { answer: string; finish: string | null; sizes: Sizes }

/** One answer against its case's keys. Only a game answer can leak: the editor reads the whole world by design. */
const scoreOf = (c: WorldQuestionCase, answer: string): WorldAnswerScore =>
  scoreWorldAnswer(answer, { facts: c.facts, leaks: c.lean === 'game' ? GAME_SAVES[c.world]?.leaks : [], opinion: c.opinion });

async function ask(c: WorldQuestionCase, arm: Arm): Promise<Sample> {
  const usage = noUsage();
  let finish: string | null = null;
  let message = '';
  let body = '';
  const fetchImpl = sessionFetch(usage, (sent, completion) => {
    if (String(sent.messages[0]?.content).startsWith(HELP_PICK_SYSTEM_PROMPT)) return;
    finish = completion.choices?.[0]?.finish_reason ?? null;
    message = String(sent.messages.at(-1)?.content ?? '');
    body = JSON.stringify(sent);
  });
  const open = openWorldOf(c, arm);
  let trace: HelpTrace | null = null;
  let answer = '';
  for await (const event of askHelp({ question: c.question, settings: SETTINGS[arm], snapshot, index, fetchImpl, world: open.world })) {
    if (event.type === 'trace') trace = event.trace;
    if (event.type === 'done') answer = event.text;
  }
  const save = GAME_SAVES[c.world]?.save;
  const storyCut = open.game !== undefined && save !== undefined && open.game.story.text !== uncutStory(bundledWorld(c.world), save).text;
  const read = SETTINGS[arm].readWorld;
  return { answer, finish, sizes: sizesOf(message, body, trace, read ? open.index() : null, read && storyCut) };
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

interface Row {
  caseId: string; lean: WorldQuestionCase['lean']; arm: Arm; run: number;
  sample: Sample | null; score: WorldAnswerScore | null; error?: string;
}

// One job per run, case and arm, with the arms of a question next to each other in time.
const jobs: (() => Promise<Row>)[] = [];
for (let run = 1; run <= runs; run++) {
  for (const c of cases) {
    for (const arm of armsOf(c)) {
      jobs.push(async () => {
        const row = { caseId: c.id, lean: c.lean, arm, run };
        let out: Row;
        try {
          const sample = await ask(c, arm);
          out = { ...row, sample, score: scoreOf(c, sample.answer) };
        } catch (error) {
          out = { ...row, sample: null, score: null, error: error instanceof Error ? error.message : String(error) };
        }
        // One line per answer as it lands, so a run in progress can be read and stopped.
        const s = out.score;
        console.log(out.error
          ? `  ${run} ${c.id.padEnd(20)} ${arm.padEnd(7)} FAILED ${out.error.slice(0, 80)}`
          : `  ${run} ${c.id.padEnd(20)} ${arm.padEnd(7)} ${c.facts.length ? (s!.correct ? 'CORRECT' : `MISS ${s!.missing.join(', ')}`) : ''}`
            + `${s!.leaks.length ? ` · LEAK ${s!.leaks.join(', ')}` : ''}${s!.opinion ? ` · opinion ${s!.opinion.ok ? 'ok' : s!.opinion.marked ? `flat ${s!.opinion.flatSolutions.join(', ')}` : 'unmarked'}` : ''}`
            + ` · world ${out.sample!.sizes.world} story ${out.sample!.sizes.story}${out.sample!.sizes.cut.length ? ` · CUT ${out.sample!.sizes.cut.join(',')}` : ''}`);
        return out;
      });
    }
  }
}

let rows: Row[];
let modelRoot: string;
if (rescore) {
  // The answers of an earlier batch, scored again with the keys as they are now.
  const earlier = JSON.parse(readFileSync(rescore, 'utf8')) as { modelRoot: string; rows: Row[] };
  modelRoot = earlier.modelRoot;
  rows = earlier.rows.filter((r) => cases.some((c) => c.id === r.caseId))
    .map((r) => ({ ...r, score: r.sample ? scoreOf(cases.find((c) => c.id === r.caseId)!, r.sample.answer) : null }));
  console.log(`world-question-probe · rescored ${rescore} · model root ${modelRoot} · ${rows.length} answers`);
} else {
  modelRoot = await fetch(new URL('/v1/models', endpoint))
    .then(async (res) => ((await res.json()) as { data?: { id: string; root?: string }[] }).data?.find((m) => m.id === model)?.root ?? '?')
    .catch(() => '?');
  console.log(`world-question-probe · ${endpoint} · model ${model} (root ${modelRoot}) · ${cases.length} cases · arms ${ARMS.join(',')} · ${runs} runs · ${jobs.length} questions`);
  const started = Date.now();
  rows = await pool(jobs, parallel);
  console.log(`${rows.length} questions in ${((Date.now() - started) / 1000).toFixed(0)}s, ${rows.filter((r) => r.error).length} failed`);
}

const percent = (value: number | null) => (value === null ? '  –' : pct(Math.round(value * 1000), 1000));
/** Every score of a set of rows, as printable cells. Grounded-correct counts only cases that key facts. */
function cells(set: Row[]) {
  const scored = set.filter((r): r is Row & { score: WorldAnswerScore } => r.score !== null);
  const keyed = set.filter((r) => cases.find((c) => c.id === r.caseId)!.facts.length > 0);
  const keyedScored = keyed.filter((r): r is Row & { score: WorldAnswerScore } => r.score !== null);
  const facts = summarizeWorldScores(keyedScored.map((r) => r.score), keyed.length - keyedScored.length);
  const all = summarizeWorldScores(scored.map((r) => r.score), set.length - scored.length);
  return [`n=${set.length}`.padEnd(6), `correct ${percent(keyed.length ? facts.correct : null)}`, `facts ${percent(keyed.length ? facts.factShare : null)}`,
    `leak ${percent(all.leak)}`, `opinion ${percent(all.opinion)}`].join('  ');
}
const of = (keep: (r: Row) => boolean) => rows.filter(keep);

console.log(`\n${'case'.padEnd(20)} arm`);
for (const c of cases) for (const arm of armsOf(c)) console.log(`${c.id.padEnd(20)} ${arm.padEnd(7)} ${cells(of((r) => r.caseId === c.id && r.arm === arm))}`);

console.log('\nTOTALS');
for (const lean of ['editor', 'game'] as const) {
  for (const arm of ARMS) {
    const set = of((r) => r.lean === lean && r.arm === arm);
    if (set.length) console.log(`${lean.padEnd(7)} ${arm.padEnd(7)} ${cells(set)}`);
  }
}

console.log(`\nSIZES (shipped arm, characters; budgets: guide ${HELP_DOCS_CHAR_BUDGET}, world ${HELP_WORLD_CHAR_BUDGET}, story ${HELP_STORY_CHAR_BUDGET})`);
console.log(`${'case'.padEnd(20)} ${'guide'.padStart(6)} ${'world'.padStart(6)} ${'story'.padStart(6)} ${'message'.padStart(8)} ${'body'.padStart(7)}  cut`);
for (const c of cases) {
  const set = of((r) => r.caseId === c.id && r.arm === 'shipped' && r.sample !== null).map((r) => r.sample!.sizes);
  if (!set.length) continue;
  const mean = (pick: (s: Sizes) => number) => String(Math.round(set.reduce((sum, s) => sum + pick(s), 0) / set.length));
  const cuts = [...new Set(set.flatMap((s) => s.cut))];
  console.log(`${c.id.padEnd(20)} ${mean((s) => s.guide).padStart(6)} ${mean((s) => s.world).padStart(6)} ${mean((s) => s.story).padStart(6)} ${mean((s) => s.message).padStart(8)} ${mean((s) => s.body).padStart(7)}  ${cuts.join(',') || '-'}`);
}

if (show) for (const r of rows.filter((x) => x.run === 1)) console.log(`\n--- ${r.caseId} · ${r.arm} ---\n${r.error ?? r.sample?.answer}`);

if (rescore) process.exit(0);
const outDir = path.resolve('testing/baseline/runs');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `world-question-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(outFile, JSON.stringify({ endpoint, model, modelRoot, runs, rows }, null, 2));
console.log(`\nraw answers: ${path.relative(process.cwd(), outFile)}`);
