// Help baseline — how well does Formaquestion answer the fixed question set?
//
// The set is `help-baseline-cases.json`: task questions in a player's words for every guide page, "here"
// questions that need the open Surface, follow-up pairs, changelog questions, questions the guide does not
// cover, and questions with the AI Language set. Each question has keyed facts, apart from the changelog
// ones; `help-baseline-score.ts` scores by text match.
//
// Each question runs in every arm inside the same batch, so the endpoint's drift hits all of them:
//   retrieval  the app's help session as it ships: the search sources that are on find the sections (one pick
//              request), then one answer request
//   keyword-only with `--keyword-only`: retrieval with the AI picks source off, as before ticket 44
//   pick-old   with `--pick-old`: retrieval with no earlier answer in the pick request, as before ticket 45
//   keep-old   with `--keep-old`: retrieval where a question that points at the open screen keeps every pick, as
//              before ticket 47
//   howto-old  with `--howto-old`: retrieval where the open page's how-tos join every question, as before ticket 49
//   lookup     with `--lookup`: the help session in lookup mode, on an endpoint that takes function calls
//   mascot-off with `--mascot-off`: retrieval with the Mascot off, so a Voice is measured against no Voice in one batch
//   old        with `--old`: retrieval with the surface section outside the block: its length comes off the
//              budget before the search, and the 5-section limit covers the search hits only
//   rank-old   with `--rank-old`: retrieval with the changelog ranked like a guide page, as before ticket 34
//   follow-old with `--follow-old`: retrieval with no sources on the history, so a follow-up favors no page, as
//              before ticket 35
//   unfiltered with `--unfiltered`: retrieval over an index that does not ignore filler words, as before ticket 36
//   hub-old    with `--hub-old`: retrieval over an index that ranks hub sections like any other, as before ticket 38
//   floor-old  with `--floor-old`: retrieval with no score floor, as before ticket 41
//   floor-alt  with `--floor-alt N`: retrieval with the score floor at N, to compare two floors
//   v-goal, v-close, v-labels, v-order  with `--variants a,b`: retrieval with the answer request rewritten as
//              `help-answer-variants.ts` says, as measured in ticket 51
//   frame-a, frame-b  with `--frames a,b`: retrieval with the Voice framed as `help-voice-frames.ts`
//              says, as measured in ticket 16
//   no-docs    the control: the same model, samplers, screen line and language, with no guide text and no Voice
//
// A follow-up runs after its first question in the same arm and run, with that answer as the history.
// The request body comes from the app's AI Request Spec, so the sampler pins are the app's. The probe adds
// `reasoning_effort: "none"` and turns streaming off to read the token counts.
//
// The report, per arm and question kind:
//   grounded   every keyed fact, no forbidden name, a keyed section among the sources, and no
//              general-knowledge flag
//   other source  every keyed fact, no forbidden name and no flag, from sections the key does not list
//   keys met   every keyed fact and no forbidden name, whatever the sources and the flag. On the control it
//              is the share of questions a model answers right with no guide, so it shows how far the keys
//              can be guessed
//   wrong step the answer holds a forbidden name
//   invented   the answer holds a bold name that is nowhere in the docs
//   false flag a covered question, flagged as not from the guide
//   wrong, no flag  a covered question with an answer that misses its keys and has no flag to warn the player
//   sources    a keyed section is among the answer's sources
//   missed flag a question the guide does not cover, with no flag
// Then the worst questions of each docs arm with a first cause. Read the answers before you name a cause.
//
// Usage: npm run probe:help -- [--endpoint URL] [--model default] [--token T] [--runs 5] [--parallel 4]
//          [--lookup] [--keyword-only] [--pick-old] [--keep-old] [--howto-old] [--old] [--rank-old] [--follow-old] [--unfiltered] [--hub-old] [--screen-old] [--floor-old] [--floor-alt 0.35] [--variants v-goal,v-close,v-labels,v-order] [--only id,id] [--kinds task,here,followUp,language,changelog,uncovered] [--worst 10] [--show]
//          [--mascot on|off] [--voice TEXT] [--mascot-off]  (the Mascot switch, on as shipped, and the rig's Voice, the default rig's when absent)
//          [--frames frame-a,frame-b]  (needs the Mascot on and a Voice)
//          [--rescore FILE]  (scores a saved batch again with the keys as they are now; sends nothing)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildAiRequestSpec } from '@/lib/aiRequest/aiRequestSpec';
import sidebar from '../../../docs/_Sidebar.md?raw';
import { BUNDLED_DOCS, bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { createDocsIndex, type DocsIndex } from '@/lib/docs/docsIndex';
import { GENERAL_KNOWLEDGE_MARKER, isGeneralKnowledge, readMarker } from '@/lib/formaquestion/generalKnowledge';
import { pickList } from '@/lib/formaquestion/helpPicks';
import { DEFAULT_HELP_PROMPTS, helpSystemPrompt, helpUserMessage } from '@/lib/formaquestion/helpPrompt';
import { renderHelpPrompt } from '@/lib/formaquestion/helpChips';
import { askHelp, HELP_DOCS_CHAR_BUDGET, helpSections, type EarlierExchange } from '@/lib/formaquestion/helpSession';
import { DEFAULT_HELP_OPTIONS } from '@/lib/formaquestion/helpPresets';
import { helpSettingsOf } from '@/lib/formaquestion/helpSettings';
import { DEFAULT_MASCOT_RIG } from '@/lib/formaquestion/mascot';
import { surfaceHint } from '@/lib/formaquestion/surfaceHint';
import type { RequestMessage } from '@/types';
import { mean, noUsage, probeSnapshot, send, sessionFetch, withoutEarlierAnswer, type ProbeTarget, type Usage } from './help-probe-shared';
import { ANSWER_VARIANTS, answerVariant, type AnswerVariant } from './help-answer-variants';
import { VOICE_FRAMES, voiceFrame, type VoiceFrame } from './help-voice-frames';
import { BASELINE_KINDS, loadBaselineCases, type BaselineCase, type BaselineKind } from './help-baseline-cases';
import { inLanguage, scoreAnswer, summarize, worstQuestions, type ScoredRow, type Summary } from './help-baseline-score';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const rescoreFile = argVal('--rescore', '');
const only = argVal('--only', '');
const kinds = argVal('--kinds', BASELINE_KINDS.join(',')).split(',');
const worstCount = Number(argVal('--worst', '10'));
const parallel = Number(argVal('--parallel', '4'));
const show = args.includes('--show');
const isVariant = (arm: string): arm is AnswerVariant => (ANSWER_VARIANTS as readonly string[]).includes(arm);
const variantArgs = argVal('--variants', '').split(',').filter(Boolean);
const unknownVariant = variantArgs.find((variant) => !isVariant(variant));
if (unknownVariant) throw new Error(`--variants takes ${ANSWER_VARIANTS.join(', ')}, not ${unknownVariant}`);
const variants = variantArgs.filter(isVariant);
const isFrame = (arm: string): arm is VoiceFrame => (VOICE_FRAMES as readonly string[]).includes(arm);
const frameArgs = argVal('--frames', '').split(',').filter(Boolean);
const unknownFrame = frameArgs.find((frame) => !isFrame(frame));
if (unknownFrame) throw new Error(`--frames takes ${VOICE_FRAMES.join(', ')}, not ${unknownFrame}`);
const frames = frameArgs.filter(isFrame);
const mascotArg = argVal('--mascot', 'on');
if (mascotArg !== 'on' && mascotArg !== 'off') throw new Error(`--mascot takes on or off, not ${mascotArg}`);
/** The Mascot settings every session arm carries. */
const mascotVoice = argVal('--voice', DEFAULT_MASCOT_RIG.voice);
const mascotSettings = {
  mascot: mascotArg === 'on',
  mascotPresets: { activeId: 'probe', mascots: [{ id: 'probe', name: 'Probe', rig: { ...DEFAULT_MASCOT_RIG, voice: mascotVoice } }] },
};
if (frames.length > 0 && !(mascotSettings.mascot && mascotVoice.trim())) throw new Error('--frames needs the Mascot on and a Voice');

type Arm = AnswerVariant | VoiceFrame | 'retrieval' | 'keyword-only' | 'pick-old' | 'keep-old' | 'howto-old' | 'old' | 'rank-old' | 'follow-old' | 'unfiltered' | 'hub-old' | 'screen-old' | 'floor-old' | 'floor-alt' | 'lookup' | 'mascot-off' | 'no-docs';

interface Sample extends Usage {
  /** The time from the question to the end of the answer, in milliseconds. A saved batch can have none. */
  ms?: number;
  /** The answer text, with the general-knowledge marker removed. */
  answer: string;
  flagged: boolean;
  /** The ids of the docs sections that reached the model. */
  sources: string[];
  /** The id of the open screen's section among the sources. */
  lead?: string;
}
interface Row { caseId: string; arm: Arm; run: number; sample: Sample | null; error?: string }
interface Batch {
  endpoint: string;
  model: string;
  runs: number;
  arms: Arm[];
  /** The ids of the questions the batch was run for. A first question that only gives a follow-up its history is not one. */
  picked?: string[];
  /** The Mascot switch and the Voice the session arms carried. A batch from before the Mascot has none. */
  mascot?: { on: boolean; voice: string };
  rows: Row[];
}

const index = bundledDocsIndex();
/** The changelog's page name in the rank-old index, which the changelog tier does not know. */
const UNTIERED_CHANGELOG = 'Release-Notes-Untiered';
// The same pages and scores with no changelog tier: the ranking before ticket 34.
const untieredIndex = createDocsIndex({
  pages: Object.fromEntries(Object.entries(BUNDLED_DOCS).map(([page, markdown]) => [page === 'Changelog' ? UNTIERED_CHANGELOG : page, markdown])),
  sidebar,
});
// The same pages with filler words in the search: the ranking before ticket 36.
const unfilteredIndex = createDocsIndex({ pages: BUNDLED_DOCS, sidebar, fillerWords: false });
const hubOldIndex = createDocsIndex({ pages: BUNDLED_DOCS, sidebar, hubDemotion: false });
/** The index that keeps screen words in a question over an open screen: the search never gets the option. */
const screenOldIndex: DocsIndex = { ...index, search: (query, limit, favor, options) => index.search(query, limit, favor, options && { ...options, onSurface: false }) };
/** The index with the help session's score floor set to `floor`; searches that ask for no floor keep none. */
const floorIndex = (floor: number): DocsIndex => ({ ...index, search: (query, limit, favor, options) => index.search(query, limit, favor, options?.floor === undefined ? options : { ...options, floor }) });
const floorOldIndex = floorIndex(0);
const floorAlt = argVal('--floor-alt', '');
if (floorAlt && !(Number(floorAlt) >= 0 && Number(floorAlt) <= 1)) throw new Error(`--floor-alt takes a share from 0 to 1, not ${floorAlt}`);
const floorAltIndex = floorIndex(Number(floorAlt));
/** The heading lines of the pick request, for the pick-old arm. */
const PICK_LINES = pickList(index).lines;
const allCases = loadBaselineCases();
const caseById = new Map(allCases.map((c) => [c.id, c]));
const asked = allCases.filter((c) => kinds.includes(c.kind) && (!only || only.split(',').includes(c.id)));
// A follow-up needs its first question in the batch.
const cases = allCases.filter((c) => asked.includes(c) || asked.some((p) => p.after === c.id));
const allDocs = index.contents()
  .flatMap((page) => index.get(page.sections.map((section) => section.id)))
  .map((section) => section.markdown)
  .join('\n');

/** The control's prompt: the help prompt's role and answer rules, without the lines that need a guide. */
const NO_DOCS_SYSTEM_PROMPT = [
  'You are the help writer for Formamorph, a text adventure app. A player asks how to use the app.',
  '',
  '- When the player asks how to do a task, answer with every step of that task as a numbered list.',
  '- Write each control name in bold.',
  '- After the steps, add one or two sentences of detail when the player needs them.',
].join('\n');

/** One question through the app's help session. */
async function askSession(target: ProbeTarget, arm: Arm, c: BaselineCase, history: EarlierExchange[]): Promise<Sample> {
  const usage = noUsage();
  const lookup = arm === 'lookup';
  const untiered = arm === 'rank-old';
  const started = performance.now();
  const previous = history.at(-1);
  const fetchImpl = arm === 'pick-old'
    ? withoutEarlierAnswer(sessionFetch(usage), PICK_LINES, { question: c.question, earlier: previous?.question, earlierAnswer: previous?.answer, where: surfaceHint(c.surface, index)?.where })
    : isVariant(arm) ? answerVariant(sessionFetch(usage), arm)
    : isFrame(arm) ? voiceFrame(sessionFetch(usage), arm, mascotVoice.trim()) : sessionFetch(usage);
  const session = askHelp({
    question: c.question, history: arm === 'follow-old' ? history.map(({ sources: _, ...exchange }) => exchange) : history, language: c.language, surface: c.surface, index: untiered ? untieredIndex : arm === 'unfiltered' ? unfilteredIndex : arm === 'hub-old' ? hubOldIndex : arm === 'screen-old' ? screenOldIndex : arm === 'floor-old' ? floorOldIndex : arm === 'floor-alt' ? floorAltIndex : index,
    settings: helpSettingsOf({ lookup, ...mascotSettings, ...(arm === 'mascot-off' && { mascot: false }), ...(arm === 'keyword-only' && { sources: { aiPicks: false } }) }),
    snapshot: probeSnapshot(target, lookup), fetchImpl,
    ...(arm === 'keep-old' && { screenRule: false }),
    ...(arm === 'howto-old' && { howToRule: false }),
  });
  const idOf = (id: string) => (untiered && id.startsWith(`${UNTIERED_CHANGELOG}#`) ? `Changelog${id.slice(UNTIERED_CHANGELOG.length)}` : id);
  for await (const event of session) {
    if (event.type === 'done') return { answer: event.text, flagged: event.flagged, sources: event.sources.map((section) => idOf(section.id)), lead: event.lead?.id, ms: performance.now() - started, ...usage };
  }
  throw new Error('the help session ended with no answer');
}

/** The block with the surface section outside it: the budget loses its length twice, and the cap skips it. */
async function askOld(target: ProbeTarget, c: BaselineCase, history: EarlierExchange[]): Promise<Sample> {
  const usage = noUsage();
  const hint = surfaceHint(c.surface, index);
  const found = helpSections(index, c.question, { history, budget: HELP_DOCS_CHAR_BUDGET - (hint?.section.markdown.length ?? 0) })
    .filter((section) => section.id !== hint?.section.id);
  const sections = [...(hint ? [hint.section] : []), ...found];
  const messages: RequestMessage[] = [
    ...history.flatMap((exchange): RequestMessage[] => [
      { role: 'user', content: exchange.question },
      { role: 'assistant', content: exchange.flagged ? `${GENERAL_KNOWLEDGE_MARKER}
${exchange.answer}` : exchange.answer },
    ]),
    { role: 'user', content: helpUserMessage(c.question, sections, hint?.where) },
  ];
  const spec = buildAiRequestSpec(probeSnapshot(target, false), {
    systemPrompt: helpSystemPrompt(c.language ?? '', renderHelpPrompt(DEFAULT_HELP_PROMPTS.answer, { voice: mascotSettings.mascot ? mascotVoice.trim() : '' })), messages, requestType: 'help', maxTokensOverride: DEFAULT_HELP_OPTIONS.answer.maxTokens,
  });
  const result = await send(spec.url, { method: 'POST', headers: spec.headers, body: JSON.stringify(spec.body) }, usage);
  if (result instanceof Response) throw new Error(`HTTP ${result.status}: ${(await result.text()).slice(0, 200)}`);
  const answer = readMarker(result.choices?.[0]?.message?.content ?? '', { final: true });
  if (!answer.text) throw new Error('the model sent an empty answer');
  return { answer: answer.text, flagged: isGeneralKnowledge(answer.marked, sections.length), sources: sections.map((section) => section.id), ...usage };
}

/** The control: the question with its history, its screen and its language, and no guide text. */
async function askNoDocs(target: ProbeTarget, c: BaselineCase, history: EarlierExchange[]): Promise<Sample> {
  const usage = noUsage();
  const where = surfaceHint(c.surface, index)?.where;
  const messages: RequestMessage[] = [
    ...history.flatMap((exchange): RequestMessage[] => [{ role: 'user', content: exchange.question }, { role: 'assistant', content: exchange.answer }]),
    { role: 'user', content: [...(where ? [`The player asks from this screen: ${where}.`] : []), `Question: ${c.question}`].join('\n\n') },
  ];
  const spec = buildAiRequestSpec(probeSnapshot(target, false), {
    systemPrompt: helpSystemPrompt(c.language ?? '', NO_DOCS_SYSTEM_PROMPT), messages, requestType: 'help', maxTokensOverride: DEFAULT_HELP_OPTIONS.answer.maxTokens,
  });
  const result = await send(spec.url, { method: 'POST', headers: spec.headers, body: JSON.stringify(spec.body) }, usage);
  if (result instanceof Response) throw new Error(`HTTP ${result.status}: ${(await result.text()).slice(0, 200)}`);
  const answer = readMarker(result.choices?.[0]?.message?.content ?? '', { final: true }).text;
  if (!answer) throw new Error('the model sent an empty answer');
  // No section reached the model, so the app would flag every answer of this arm.
  return { answer, flagged: true, sources: [], ...usage };
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

async function runBatch(): Promise<Batch> {
  const target: ProbeTarget = {
    endpoint: argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions'),
    model: argVal('--model', 'default'),
    token: argVal('--token', process.env.PROBE_TOKEN ?? ''),
  };
  const runs = Number(argVal('--runs', '5'));
  const arms: Arm[] = ['retrieval', ...variants, ...frames, ...(args.includes('--keyword-only') ? ['keyword-only' as const] : []), ...(args.includes('--pick-old') ? ['pick-old' as const] : []), ...(args.includes('--keep-old') ? ['keep-old' as const] : []), ...(args.includes('--howto-old') ? ['howto-old' as const] : []), ...(args.includes('--old') ? ['old' as const] : []), ...(args.includes('--rank-old') ? ['rank-old' as const] : []), ...(args.includes('--follow-old') ? ['follow-old' as const] : []), ...(args.includes('--unfiltered') ? ['unfiltered' as const] : []), ...(args.includes('--hub-old') ? ['hub-old' as const] : []), ...(args.includes('--screen-old') ? ['screen-old' as const] : []), ...(args.includes('--floor-old') ? ['floor-old' as const] : []), ...(floorAlt ? ['floor-alt' as const] : []), ...(args.includes('--lookup') ? ['lookup' as const] : []), ...(args.includes('--mascot-off') ? ['mascot-off' as const] : []), 'no-docs'];
  const ask = (arm: Arm, c: BaselineCase, history: EarlierExchange[]) =>
    (arm === 'no-docs' ? askNoDocs(target, c, history) : arm === 'old' ? askOld(target, c, history) : askSession(target, arm, c, history));

  /** One question, sent once more after a failed request. */
  async function row(arm: Arm, c: BaselineCase, run: number, history: EarlierExchange[]): Promise<Row> {
    for (let attempt = 1; ; attempt++) {
      try {
        return { caseId: c.id, arm, run, sample: await ask(arm, c, history) };
      } catch (error) {
        if (attempt === 2) return { caseId: c.id, arm, run, sample: null, error: error instanceof Error ? error.message : String(error) };
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  // One job per run, question and arm, with the arms of a question next to each other in time.
  const jobs: (() => Promise<Row[]>)[] = [];
  for (let run = 1; run <= runs; run++) {
    for (const c of cases.filter((first) => first.kind !== 'followUp')) {
      for (const arm of arms) {
        jobs.push(async () => {
          const first = await row(arm, c, run, []);
          const followUps = cases.filter((next) => next.after === c.id);
          if (followUps.length === 0) return [first];
          if (!first.sample) return [first, ...followUps.map((next): Row => ({ caseId: next.id, arm, run, sample: null, error: `the first question failed: ${first.error}` }))];
          // The control keeps the marker off its history, as its answers never carry one.
          const history = [{ question: c.question, answer: first.sample.answer, flagged: arm !== 'no-docs' && first.sample.flagged, sources: index.get(first.sample.sources), lead: index.get(first.sample.lead ? [first.sample.lead] : [])[0] }];
          const rest: Row[] = [];
          for (const next of followUps) rest.push(await row(arm, next, run, history));
          return [first, ...rest];
        });
      }
    }
  }

  console.log(`help-baseline · ${target.endpoint} · model ${target.model} · mascot ${mascotArg} · ${cases.length} questions × ${arms.length} arms × ${runs} runs`);
  const started = Date.now();
  const rows = (await pool(jobs, parallel)).flat();
  console.log(`${rows.length} answers in ${((Date.now() - started) / 1000).toFixed(0)}s, ${rows.filter((r) => r.error).length} failed`);
  return { endpoint: target.endpoint, model: target.model, runs, arms, picked: asked.map((c) => c.id), mascot: { on: mascotSettings.mascot, voice: mascotVoice }, rows };
}

const batch = rescoreFile ? JSON.parse(readFileSync(rescoreFile, 'utf8')) as Batch : await runBatch();
// A saved batch is scored for the questions it was run for, and for no more than the flags of this run ask.
const picked = new Set(asked.map((c) => c.id).filter((id) => !batch.picked || batch.picked.includes(id)));

/** A row of the report: a kind of question, with the language questions split by how the player asked. */
type ReportKind = Exclude<BaselineKind, 'language'> | 'languageSetting' | 'languageAsked';
const reportKind = (c: BaselineCase): ReportKind => (c.kind !== 'language' ? c.kind : c.asked ? 'languageAsked' : 'languageSetting');
const KIND_LABELS: Record<ReportKind, string> = {
  task: 'Task', here: 'Here', followUp: 'Follow-up', languageSetting: 'Language, setting only',
  languageAsked: 'Language, asked in it', changelog: 'Changelog', uncovered: 'Not covered',
};

const scored: ScoredRow[] = batch.rows.flatMap((r) => {
  const c = caseById.get(r.caseId);
  if (!c || !r.sample || !picked.has(c.id)) return [];
  return [{
    caseId: c.id,
    kind: reportKind(c),
    arm: r.arm,
    run: r.run,
    score: scoreAnswer(c, { text: r.sample.answer, flagged: r.sample.flagged, sources: r.sample.sources }, allDocs),
    promptTokens: r.sample.promptTokens,
    answerTokens: r.sample.answerTokens,
    ...(c.language && { inLanguage: inLanguage(c.language, r.sample.answer) }),
  }];
});

const pct = (value: number | null) => (value === null ? '–' : `${Math.round(value * 100)}%`);
const table = (head: string[], lines: string[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...lines.map((cells) => `| ${cells.join(' | ')} |`)].join('\n');
// The control gets no section, so its flag and its sources are fixed; those cells stay empty.
const summaryCells = (s: Summary, arm: Arm) => {
  const session = (value: number | null) => (arm === 'no-docs' ? '–' : pct(value));
  return [
    String(s.covered + s.uncovered), session(s.groundedCorrect), session(s.otherSource), pct(s.keysMet), pct(s.wrongStep), pct(s.invented), session(s.falseFlag),
    session(s.wrongNoFlag), session(s.sourceAccuracy), session(s.missedFlag), pct(s.inLanguage), s.promptTokens === null ? '–' : `${s.promptTokens} / ${s.answerTokens}`,
  ];
};

const report: string[] = [];
const failed = batch.rows.filter((r) => r.error);
const mascotLine = batch.mascot ? ` · mascot ${batch.mascot.on ? 'on' : 'off'}` : '';
report.push(`# Help baseline\n\n${batch.endpoint} · model \`${batch.model}\`${mascotLine} · ${batch.runs} runs per arm · ${scored.length} answers scored, ${failed.length} failed`);
for (const arm of batch.arms) {
  const ofArm = scored.filter((r) => r.arm === arm);
  const kindRows = (Object.keys(KIND_LABELS) as ReportKind[]).filter((kind) => ofArm.some((r) => r.kind === kind));
  report.push(`## Arm: ${arm}\n\n${table(
    ['Questions', 'Answers', 'Grounded-correct', 'Correct, other source', 'Keys met', 'Wrong step', 'Invented name', 'False flag', 'Wrong, no flag', 'Right source', 'Missed flag', 'In language', 'Tokens in / out'],
    [
      ...kindRows.map((kind) => [KIND_LABELS[kind], ...summaryCells(summarize(ofArm.filter((r) => r.kind === kind)), arm)]),
      ['**All**', ...summaryCells(summarize(ofArm), arm)],
    ],
  )}`);
}
// What one question costs in each arm: the requests it sends, their tokens, its time and its sections.
report.push(`## Cost per question\n\n${table(
  ['Arm', 'Requests', 'Tokens in', 'Tokens out', 'Time', 'Sections sent'],
  batch.arms.map((arm) => {
    const samples = batch.rows.flatMap((r) => (r.arm === arm && r.sample && picked.has(r.caseId) ? [r.sample] : []));
    const timed = samples.flatMap((s) => (s.ms === undefined ? [] : [s.ms]));
    return [
      arm, mean(samples.map((s) => s.requests)).toFixed(2), mean(samples.map((s) => s.promptTokens)).toFixed(0), mean(samples.map((s) => s.answerTokens)).toFixed(0),
      timed.length ? `${(mean(timed) / 1000).toFixed(2)} s` : '–', mean(samples.map((s) => s.sources.length)).toFixed(2),
    ];
  }),
)}`);
for (const arm of batch.arms.filter((a) => a !== 'no-docs')) {
  const failing = worstQuestions(scored.filter((r) => r.arm === arm), Infinity);
  const worst = failing.slice(0, worstCount);
  const causes = (['search miss', 'docs gap', 'model error'] as const).map((cause) => `${cause} ${failing.filter((q) => q.likelyCause === cause).length}`);
  if (worst.length > 0) report.push(`## Worst questions: ${arm}\n\n${failing.length} questions have a failed run. First cause: ${causes.join(', ')}.\n\n${table(
    ['Question', 'Correct', 'Facts', 'Right source', 'Flagged', 'Wrong step', 'First cause', 'Asked'],
    worst.map((q) => [q.caseId, pct(q.correct), pct(q.factShare), pct(q.sourced), pct(q.flagged), pct(q.wrongStep), q.likelyCause, caseById.get(q.caseId)?.question ?? '']),
  )}`);
}
const text = report.join('\n\n');
console.log(`\n${text}`);

if (failed.length > 0) {
  console.log('\nfailed:');
  for (const r of failed.slice(0, 20)) console.log(`  ${r.caseId} · ${r.arm} · run ${r.run}: ${r.error}`);
}
if (show) {
  for (const r of batch.rows.filter((row) => row.run === 1 && picked.has(row.caseId))) {
    console.log(`\n--- ${r.caseId} · ${r.arm} ---\n${r.error ?? `${r.sample?.flagged ? `${GENERAL_KNOWLEDGE_MARKER}\n` : ''}${r.sample?.answer}`}`);
  }
}

if (!rescoreFile) {
  const outDir = path.resolve('testing/baseline/runs');
  mkdirSync(outDir, { recursive: true });
  const stem = path.join(outDir, `help-baseline-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  writeFileSync(`${stem}.json`, JSON.stringify(batch, null, 2));
  writeFileSync(`${stem}.md`, `${text}\n`);
  console.log(`\nraw answers: ${path.relative(process.cwd(), `${stem}.json`)}\nreport: ${path.relative(process.cwd(), `${stem}.md`)}`);
}
