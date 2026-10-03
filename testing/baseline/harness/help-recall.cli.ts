// Help recall probe — which search approach puts the right guide section in a help request? (ticket 39)
//
// It answers no question and scores no answer: each approach ranks sections for a question, and the score
// is whether a keyed section is among them. Two question sets run:
//   known    the English task, "here" and follow-up questions of help-baseline-cases.json
//   blind    help-recall-blind-cases.json, written from the headings alone; tune no approach on it
//
// Every approach goes through the shipped block builder, `helpSections`, with its own search in place of the
// keyword search. So the open screen's section, the follow-up rule and the size budget are the same for all.
//   keyword   the shipped Docs Index search, with the docs' keyword lines (the word map, ticket 43)
//   semantic  sections ranked by the dot product of MiniLM vectors, the model semantic memory ships
//   hybrid    the keyword and the semantic rankings merged by reciprocal rank fusion
//   ai        with `--ai`: a first request lists every section heading, and the model copies the lines it picks
// The mixes fuse the rankings of the approaches they name the same way: ai+keyword, ai+keyword+semantic.
//   shipped   with `--ai`: the help session's own search (`helpSearch`) with the switches as they ship
//   pick-old  with `--ai`: shipped, with no earlier answer in the pick request, as before ticket 45
//   keep-old  with `--ai`: shipped, where a question that points at the open screen keeps every pick, as before
//             ticket 47
//   howto-old with `--ai`: shipped, where the open page's how-tos join every question, as before ticket 49
// The pick prompt, the pick list and the rank merge are the app's.
//
// `--screen` asks every task and follow-up over one open screen, as the app does; the "here" questions keep
// their own. Without it they are asked with no screen open.
//
// A follow-up's history is its first question with a stand-in answer and the block that arm sent for it. In
// the session arms it is the answer the help session gave in that run, with its sources, and the rule an
// arm turns off is off for its answer as well.
//
// The score, per approach, set and kind:
//   first   a keyed section is the first section of the block
//   at5     a keyed section is among the block's five sections, with no size budget (recall@5)
//   sent    a keyed section is in the block that fits the request's size budget
//
// Usage: npm run probe:help-recall -- [--arms keyword,semantic,hybrid,ai,ai+keyword,ai+keyword+semantic,shipped,pick-old,keep-old,howto-old] [--sets known,blind] [--text head|full|chunks]
//          [--screen library|stats|game]
//          [--ai] [--runs 5] [--parallel 4] [--endpoint URL] [--model default] [--token T] [--show]
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildAiRequestSpec } from '@/lib/aiRequest/aiRequestSpec';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { CHANGELOG_PAGE, FAVORED_PAGE_WEIGHT, type DocSection, type DocsIndex } from '@/lib/docs/docsIndex';
import { guideSections, type GuideSection } from '@/lib/formaquestion/guideSections';
import { HELP_PICK_MAX_TOKENS, HELP_PICK_SYSTEM_PROMPT, pickList, pickMessage, readPicks } from '@/lib/formaquestion/helpPicks';
import { askHelp, HELP_SECTION_LIMIT, helpSearch, helpSections, type EarlierExchange, type HelpQuestion } from '@/lib/formaquestion/helpSession';
import { DEFAULT_HELP_SETTINGS } from '@/lib/formaquestion/helpSettings';
import { mergeRanks, rankByVector } from '@/lib/formaquestion/rankMerge';
import { surfaceHint } from '@/lib/formaquestion/surfaceHint';
import { EMBEDDING_MODEL_ID } from '@/lib/memoryRelevance';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { mean, noUsage, probeSnapshot, sessionFetch, withoutEarlierAnswer, type ProbeTarget, type Usage } from './help-probe-shared';
import { loadBlindCases, loadKnownCases, RECALL_KINDS, RECALL_SETS, type RecallCase, type RecallKind, type RecallSet } from './help-recall-cases';
import { chunksOf, scoreRecall, summarizeRecall, type RecallScore } from './help-recall-score';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const ARMS = ['keyword', 'semantic', 'hybrid', 'ai', 'ai+keyword', 'ai+keyword+semantic', 'shipped', 'pick-old', 'keep-old', 'howto-old'] as const;
type Arm = (typeof ARMS)[number];
/** The values of a comma list flag, each one of `allowed`. */
function listArg<T extends string>(flag: string, allowed: readonly T[]): T[] {
  const values = argVal(flag, allowed.join(',')).split(',');
  const unknown = values.filter((value) => !(allowed as readonly string[]).includes(value));
  if (unknown.length > 0) throw new Error(`${flag} takes ${allowed.join(', ')}, not ${unknown.join(', ')}`);
  return values as T[];
}
/** The arms that run the help session's own search. */
const SESSION_ARMS = ['shipped', 'pick-old', 'keep-old', 'howto-old'] as const satisfies readonly Arm[];
const isSessionArm = (arm: Arm): arm is (typeof SESSION_ARMS)[number] => (SESSION_ARMS as readonly Arm[]).includes(arm);
const isAiArm = (arm: Arm) => arm.startsWith('ai') || isSessionArm(arm);
// The arms that send requests run only with `--ai`.
const arms = listArg('--arms', ARMS).filter((arm) => args.includes('--ai') || !isAiArm(arm));
const sets = listArg('--sets', RECALL_SETS);
const SECTION_TEXTS = ['head', 'full', 'chunks'] as const;
// `full` is the best text on the known set; the blind set has no part in the choice.
const sectionText = args.includes('--text') ? listArg('--text', SECTION_TEXTS)[0] : 'full';
const runs = Number(argVal('--runs', '5'));
const parallel = Number(argVal('--parallel', '4'));
const show = args.includes('--show');

/** The fewest sections of each ranking a fused arm merges; a search that asks for more gets more. */
const FUSION_DEPTH = 50;
/** The most characters of one body chunk a section vector covers; about 200 tokens, inside the model's window. */
const CHUNK_CHARS = 900;

/** The open screens `--screen` asks from: a Main Menu tab, a World Editor tab and a play tab. */
const SCREEN_NAMES = ['library', 'stats', 'game'] as const;
const SCREENS: Record<(typeof SCREEN_NAMES)[number], Surface> = {
  library: { screen: 'mainMenu', dialog: null, tabs: ['mainMenu.worlds'] },
  stats: { screen: 'worldEditor', dialog: null, tabs: ['worldEditor.stats'] },
  game: { screen: 'gameViewer', dialog: null, tabs: ['gameViewer.memory'] },
};
const screens = args.includes('--screen') ? listArg('--screen', SCREEN_NAMES) : [];
if (screens.length > 1) throw new Error(`--screen takes one screen, not ${screens.join(', ')}`);
const screen = screens.at(0);

const index = bundledDocsIndex();
const cases = [...loadKnownCases(), ...loadBlindCases()]
  .filter((c) => sets.includes(c.set))
  .map((c): RecallCase => (screen && !c.surface ? { ...c, surface: SCREENS[screen] } : c));
const caseById = new Map(cases.map((c) => [c.id, c]));

/** Every guide section with its heading line, as the app lists them; the changelog is left out. */
const guide = guideSections(index);
const sectionById = new Map(guide.map(({ section }) => [section.id, section]));

// ── The block ────────────────────────────────────────────────────────────────

interface Blocks { ranked: DocSection[]; sent: DocSection[] }

/** The docs block the app builds for a question when `search` finds the sections, with and without the size budget. */
function blocksOf(search: DocsIndex, c: RecallCase, history: EarlierExchange[], howToRule: boolean): Blocks {
  const lead = surfaceHint(c.surface, index)?.section;
  return {
    ranked: helpSections(search, c.question, { history, lead, budget: Infinity, howToRule }),
    sent: helpSections(search, c.question, { history, lead, howToRule }),
  };
}

/** The history a follow-up gets: its first question, with the block that question's request held. */
function historyOf(first: RecallCase, sent: DocSection[]): EarlierExchange[] {
  return [{ question: first.question, answer: '(the answer to the first question)', sources: sent, lead: surfaceHint(first.surface, index)?.section }];
}

interface Row { arm: Arm; run: number; caseId: string; score: RecallScore; ranked: string[]; ms: number; promptTokens: number; answerTokens: number }

/**
 * Scores every question with one search; a follow-up runs after its first question. `searchFor` may differ by
 * question. `exchanges` holds the real answers of first questions, by id, in place of the stand-in history.
 */
function scoreAll(arm: Arm, run: number, searchFor: (c: RecallCase) => DocsIndex, costOf: (c: RecallCase) => Pick<Row, 'ms' | 'promptTokens' | 'answerTokens'> | null, exchanges?: Map<string, EarlierExchange>): Row[] {
  const rows: Row[] = [];
  const sentOf = new Map<string, DocSection[]>();
  const one = (c: RecallCase, history: EarlierExchange[]) => {
    const started = performance.now();
    const { ranked, sent } = blocksOf(searchFor(c), c, history, arm !== 'howto-old');
    // `blocksOf` builds the block twice; a request builds it once.
    const ms = (performance.now() - started) / 2;
    sentOf.set(c.id, sent);
    rows.push({ arm, run, caseId: c.id, score: scoreRecall(c.right, ranked.map((s) => s.id), sent.map((s) => s.id)), ranked: ranked.map((s) => s.id), ...(costOf(c) ?? { ms, promptTokens: 0, answerTokens: 0 }) });
  };
  for (const c of cases.filter((first) => first.kind !== 'followUp')) one(c, []);
  for (const c of cases.filter((next) => next.kind === 'followUp')) {
    const first = caseById.get(c.after ?? '');
    if (!first) throw new Error(`follow-up ${c.id} names no question of the run: ${c.after}`);
    const exchange = exchanges?.get(first.id);
    one(c, exchange ? [exchange] : historyOf(first, sentOf.get(first.id) ?? []));
  }
  return rows;
}

/** The first questions of the follow-ups, each answered once by the help session as it ships, with its sources. */
async function firstAnswers(target: ProbeTarget, rules: Pick<HelpQuestion, 'screenRule' | 'howToRule'> = {}): Promise<{ exchanges: Map<string, EarlierExchange>; failed: number }> {
  const firsts = cases.filter((c) => cases.some((next) => next.after === c.id));
  const exchanges = new Map<string, EarlierExchange>();
  let failed = 0;
  await pool(firsts.map((c) => async () => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        for await (const event of askHelp({ question: c.question, settings: DEFAULT_HELP_SETTINGS, snapshot: probeSnapshot(target), index, surface: c.surface, ...rules, fetchImpl: sessionFetch(noUsage()) })) {
          if (event.type === 'done') exchanges.set(c.id, { question: c.question, answer: event.text, flagged: event.flagged, sources: event.sources, lead: event.lead });
        }
        return;
      } catch (error) {
        if (attempt === 2) {
          failed++;
          console.log(`  first answer failed · ${c.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }), parallel);
  return { exchanges, failed };
}

// ── Semantic ─────────────────────────────────────────────────────────────────

type Extractor = (texts: string[], options: { pooling: 'mean'; normalize: true }) => Promise<{ dims: number[]; data: Float32Array; dispose(): void }>;
interface SemanticCost { loadMs: number; loadRssMb: number; vectors: number; vectorBytes: number; queryMs: number }

/**
 * The texts one section is embedded as. The model reads the first 512 tokens of a text, so `full` covers the
 * start of a long section. `chunks` scores a section by its best chunk, so a long section is read whole.
 */
function textsOf({ section, line: head }: GuideSection): string[] {
  if (sectionText === 'head') return [head];
  if (sectionText === 'full') return [`${head}\n\n${section.markdown}`];
  return [head, ...chunksOf(section.markdown, CHUNK_CHARS).map((chunk) => `${head}\n\n${chunk}`)];
}

async function loadSemantic(queries: string[]): Promise<{ search: DocsIndex; cost: SemanticCost; queryMs: Map<string, number> }> {
  const rssBefore = process.memoryUsage().rss;
  const loadStarted = performance.now();
  // The app's worker loads the same model and weights (`embeddingWorker.ts`); it runs them on WASM, this on the Node runtime.
  const { pipeline } = await import('@huggingface/transformers');
  // The pipeline's own type is a union too large for tsc to resolve; `Extractor` is the one call this probe makes.
  const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL_ID, { dtype: 'q8' }) as unknown as Extractor;
  const embed = async (texts: string[]): Promise<Float32Array[]> => {
    const vectors: Float32Array[] = [];
    for (let at = 0; at < texts.length; at += 16) {
      const output = await extractor(texts.slice(at, at + 16), { pooling: 'mean', normalize: true });
      const [rows, dims] = output.dims;
      for (let r = 0; r < rows; r++) vectors.push(output.data.slice(r * dims, (r + 1) * dims));
      output.dispose();
    }
    return vectors;
  };
  await embed(['warm up']);
  const loadMs = performance.now() - loadStarted;
  const loadRssMb = (process.memoryUsage().rss - rssBefore) / 2 ** 20;

  const texts = guide.flatMap((entry) => textsOf(entry).map((text) => ({ id: entry.section.id, text })));
  const vectors = await embed(texts.map((t) => t.text));
  const entries = texts.map((t, at) => ({ id: t.id, vector: vectors[at] }));

  // One question at a time, as the app embeds it.
  const queryVectors = new Map<string, Float32Array>();
  const queryMs = new Map<string, number>();
  for (const query of queries) {
    const started = performance.now();
    queryVectors.set(query, (await embed([query]))[0]);
    queryMs.set(query, performance.now() - started);
  }

  const search: DocsIndex = {
    ...index,
    search: (query, limit = HELP_SECTION_LIMIT, favor) => {
      const vector = queryVectors.get(query);
      if (!vector) throw new Error(`no vector for the query: ${query}`);
      return rankByVector(vector, entries)
        .map((hit) => ({ ...hit, score: hit.score * (hit.score > 0 && sectionById.get(hit.id)?.page === favor?.page ? FAVORED_PAGE_WEIGHT : 1) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .flatMap((hit) => sectionById.get(hit.id) ?? []);
    },
  };
  const cost: SemanticCost = { loadMs, loadRssMb, vectors: entries.length, vectorBytes: entries.length * (entries[0]?.vector.length ?? 0) * 4, queryMs: mean([...queryMs.values()]) };
  return { search, cost, queryMs };
}

/** Every query string the block builder searches for, over all questions. */
function queriesOf(): string[] {
  const queries = new Set<string>();
  const recorder: DocsIndex = { ...index, search: (query) => (queries.add(query), []) };
  for (const c of cases) {
    const first = caseById.get(c.after ?? '');
    // The how-to rule off, so the page how-to search of every question is recorded too.
    blocksOf(recorder, c, first ? historyOf(first, []) : [], false);
  }
  return [...queries];
}

// ── AI picks ─────────────────────────────────────────────────────────────────

/** The sections the model picks from, as the app lists them: one line per whole section. */
const PICKS = pickList(index);

interface PickReply { sections: DocSection[]; ms: number; promptTokens: number; answerTokens: number; reply: string }

async function askPicks(target: ProbeTarget, c: RecallCase): Promise<PickReply> {
  const spec = buildAiRequestSpec(probeSnapshot(target), {
    systemPrompt: HELP_PICK_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: pickMessage(PICKS.lines, { question: c.question, earlier: caseById.get(c.after ?? '')?.question, where: surfaceHint(c.surface, index)?.where }) }],
    // The pins of a help request: temperature 0.2 and no repetition penalty, so a copied line stays exact.
    requestType: 'help',
    maxTokensOverride: HELP_PICK_MAX_TOKENS,
  });
  for (let attempt = 1; ; attempt++) {
    const started = performance.now();
    try {
      const response = await fetch(spec.url, { method: 'POST', headers: spec.headers, body: JSON.stringify({ ...spec.body, stream: false, reasoning_effort: 'none' }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
      const json = await response.json() as { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      const reply = json.choices?.[0]?.message?.content ?? '';
      const sections = readPicks(reply, PICKS.lines).flatMap((at) => PICKS.sections[at]);
      return { sections, ms: performance.now() - started, promptTokens: json.usage?.prompt_tokens ?? 0, answerTokens: json.usage?.completion_tokens ?? 0, reply };
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
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

// ── Run ──────────────────────────────────────────────────────────────────────

const rows: Row[] = [];
const notes: string[] = [];
const wants = (arm: Arm) => arms.includes(arm);
const noCost = () => null;

/** One search that merges the rankings of several by reciprocal rank fusion. The score floor does not apply to it. */
const fused = (...searches: DocsIndex[]): DocsIndex => ({
  ...index,
  search: (query, limit = HELP_SECTION_LIMIT, favor, options) =>
    mergeRanks(searches.map((search) => search.search(query, Math.max(limit, FUSION_DEPTH), favor, { onSurface: options?.onSurface }).filter((hit) => hit.page !== CHANGELOG_PAGE).map((hit) => hit.id)))
      .slice(0, limit)
      .flatMap((id) => sectionById.get(id) ?? []),
});

if (wants('keyword')) rows.push(...scoreAll('keyword', 1, () => index, noCost));

let semantic: DocsIndex | null = null;
if (arms.some((arm) => arm.includes('semantic') || arm === 'hybrid')) {
  const loaded = await loadSemantic(queriesOf());
  semantic = loaded.search;
  const { cost, queryMs } = loaded;
  notes.push(`Semantic: model \`${EMBEDDING_MODEL_ID}\` (q8), section text \`${sectionText}\`, ${cost.vectors} vectors = ${(cost.vectorBytes / 1024).toFixed(0)} KB as float32. In Node: load ${cost.loadMs.toFixed(0)} ms, +${cost.loadRssMb.toFixed(0)} MB resident, ${cost.queryMs.toFixed(1)} ms to embed one query.`);
  /** The embed time of a question's own queries, which the search calls look up for free. */
  const embedCost = (c: RecallCase) => {
    const first = caseById.get(c.after ?? '');
    const ms = (queryMs.get(c.question) ?? 0) + (first ? queryMs.get(`${first.question} ${c.question}`) ?? 0 : 0);
    return { ms, promptTokens: 0, answerTokens: 0 };
  };
  if (wants('semantic')) rows.push(...scoreAll('semantic', 1, () => semantic!, embedCost));
  if (wants('hybrid')) rows.push(...scoreAll('hybrid', 1, () => fused(index, semantic!), embedCost));
}

let failed = 0;
if (arms.some(isAiArm)) {
  const target: ProbeTarget = {
    endpoint: argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions'),
    model: argVal('--model', 'default'),
    token: argVal('--token', process.env.PROBE_TOKEN ?? ''),
  };
  console.log(`ai picks · ${target.endpoint} · model ${target.model} · ${cases.length} questions × ${runs} runs · ${PICKS.lines.length} headings`);
  const started = Date.now();
  let empty = 0;
  let shippedFailed = 0;
  let firstFailed = 0;
  const probeArms = arms.some((arm) => arm.startsWith('ai'));
  const sessionArms = SESSION_ARMS.filter(wants);
  for (let run = 1; run <= runs; run++) {
    if (sessionArms.length > 0) {
      const ruled = sessionArms.some((arm) => arm !== 'keep-old' && arm !== 'howto-old') ? await firstAnswers(target) : null;
      const unruled = sessionArms.includes('keep-old') ? await firstAnswers(target, { screenRule: false }) : null;
      const howToUnruled = sessionArms.includes('howto-old') ? await firstAnswers(target, { howToRule: false }) : null;
      firstFailed += (ruled?.failed ?? 0) + (unruled?.failed ?? 0) + (howToUnruled?.failed ?? 0);
      const exchangesOf = (arm: (typeof SESSION_ARMS)[number]) => (arm === 'keep-old' ? unruled : arm === 'howto-old' ? howToUnruled : ruled)!.exchanges;
      // The app's own search for each question, the arms of a question next to each other in time: its pick
      // request goes out once, and a failed one is not sent again.
      const found = new Map<string, { search: DocsIndex; ms: number; usage: Usage }>();
      await pool(cases.flatMap((c) => sessionArms.map((arm) => async () => {
        const exchange = exchangesOf(arm).get(c.after ?? '');
        const first = caseById.get(c.after ?? '');
        const history = exchange ? [exchange] : first ? historyOf(first, []) : [];
        const hint = surfaceHint(c.surface, index);
        const usage = noUsage();
        const fetchImpl = arm === 'pick-old'
          ? withoutEarlierAnswer(sessionFetch(usage), PICKS.lines, { question: c.question, earlier: history.at(-1)?.question, earlierAnswer: history.at(-1)?.answer, where: hint?.where })
          : sessionFetch(usage);
        const asked = performance.now();
        const search = await helpSearch({ question: c.question, history, settings: DEFAULT_HELP_SETTINGS, snapshot: probeSnapshot(target), index, hint, screenRule: arm !== 'keep-old', fetchImpl });
        found.set(`${arm}|${c.id}`, { search, ms: performance.now() - asked, usage });
      })), parallel);
      shippedFailed += [...found.values()].filter(({ usage }) => usage.requests === 0).length;
      for (const arm of sessionArms) {
        rows.push(...scoreAll(arm, run, (c) => found.get(`${arm}|${c.id}`)!.search, (c) => {
          const { ms, usage } = found.get(`${arm}|${c.id}`)!;
          return { ms, promptTokens: usage.promptTokens, answerTokens: usage.answerTokens };
        }, exchangesOf(arm)));
      }
    }
    if (!probeArms) continue;
    const picks = new Map<string, PickReply>();
    await pool(cases.map((c) => async () => {
      try {
        picks.set(c.id, await askPicks(target, c));
      } catch (error) {
        failed++;
        console.log(`  failed · ${c.id} · run ${run}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }), parallel);
    empty += [...picks.values()].filter((pick) => pick.sections.length === 0).length;
    // A failed request picks nothing, so it scores as a miss.
    const picked = (c: RecallCase): DocsIndex => ({ ...index, search: (_query, limit = HELP_SECTION_LIMIT) => (picks.get(c.id)?.sections ?? []).slice(0, limit) });
    const pickCost = (c: RecallCase) => {
      const pick = picks.get(c.id);
      return { ms: pick?.ms ?? 0, promptTokens: pick?.promptTokens ?? 0, answerTokens: pick?.answerTokens ?? 0 };
    };
    if (wants('ai')) rows.push(...scoreAll('ai', run, picked, pickCost));
    if (wants('ai+keyword')) rows.push(...scoreAll('ai+keyword', run, (c) => fused(picked(c), index), pickCost));
    if (wants('ai+keyword+semantic')) rows.push(...scoreAll('ai+keyword+semantic', run, (c) => fused(picked(c), index, semantic!), pickCost));
    if (show && run === 1) for (const c of cases) console.log(`  ${c.id}: ${picks.get(c.id)?.reply.replace(/\s+/g, ' ').slice(0, 80)}`);
  }
  notes.push(`AI picks: ${target.endpoint}, model \`${target.model}\`, ${runs} runs, ${PICKS.lines.length} headings in each request, ${failed} failed requests and ${empty} replies with no line of the list, in ${((Date.now() - started) / 1000).toFixed(0)} s.`);
  if (sessionArms.length > 0) notes.push(`${sessionArms.join(', ')}: ${shippedFailed} pick requests failed; ${firstFailed} first answers failed, and their follow-ups ran on the stand-in history.`);
}

// ── Report ───────────────────────────────────────────────────────────────────

const pct = (share: number) => `${(share * 100).toFixed(1)}%`;
const table = (head: string[], lines: string[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...lines.map((cells) => `| ${cells.join(' | ')} |`)].join('\n');
const ARM_LABELS: Record<Arm, string> = {
  keyword: 'Keyword', semantic: 'Semantic', hybrid: 'Hybrid', ai: 'AI picks', 'ai+keyword': 'AI picks + keyword', 'ai+keyword+semantic': 'AI picks + keyword + semantic',
  shipped: 'Shipped switches', 'pick-old': 'Pick with no earlier answer', 'keep-old': 'Every pick over the screen', 'howto-old': 'Page how-tos on every question',
};
const KIND_LABELS: Record<RecallKind, string> = { task: 'Task', here: 'Here', followUp: 'Follow-up' };
const ranArms = ARMS.filter((arm) => rows.some((r) => r.arm === arm));
const inScope = (r: Row, set: RecallSet, kind?: RecallKind) => caseById.get(r.caseId)?.set === set && (!kind || caseById.get(r.caseId)?.kind === kind);

const report: string[] = [`# Help recall\n\n${cases.length} questions${screen ? `, asked over the ${screen} screen` : ''}. ${notes.join(' ')}`];
for (const set of RECALL_SETS.filter((s) => sets.includes(s))) {
  const lines = ranArms.flatMap((arm) => {
    const ofArm = rows.filter((r) => r.arm === arm && inScope(r, set));
    const runIds = [...new Set(ofArm.map((r) => r.run))];
    const perRun = runIds.map((run) => summarizeRecall(ofArm.filter((r) => r.run === run).map((r) => r.score)).at5);
    const all = summarizeRecall(ofArm.map((r) => r.score));
    const spread = runIds.length > 1 ? ` (${pct(Math.min(...perRun))}–${pct(Math.max(...perRun))})` : '';
    const kindCells = RECALL_KINDS.filter((kind) => cases.some((c) => c.set === set && c.kind === kind))
      .map((kind) => pct(summarizeRecall(ofArm.filter((r) => inScope(r, set, kind)).map((r) => r.score)).at5));
    const tokens = mean(ofArm.map((r) => r.promptTokens + r.answerTokens));
    return [[ARM_LABELS[arm], String(all.questions / runIds.length), `${pct(all.at5)}${spread}`, pct(all.first), pct(all.sent), ...kindCells, `${mean(ofArm.map((r) => r.ms)).toFixed(1)} ms`, tokens.toFixed(0)]];
  });
  const kindHead = RECALL_KINDS.filter((kind) => cases.some((c) => c.set === set && c.kind === kind)).map((kind) => `${KIND_LABELS[kind]} @5`);
  report.push(`## Set: ${set}\n\n${table(['Approach', 'Questions', 'Recall@5', 'First', 'Sent', ...kindHead, 'Added time', 'Added tokens'], lines)}`);
}
const text = report.join('\n\n');
console.log(`\n${text}`);

if (show) {
  for (const arm of ranArms.filter((a) => !isAiArm(a))) {
    console.log(`\nmisses · ${arm}`);
    for (const r of rows.filter((row) => row.arm === arm && !row.score.at5)) {
      const c = caseById.get(r.caseId)!;
      console.log(`  [${c.set}] ${c.id}: ${c.question}\n      want ${c.right[0]} · got ${r.ranked.slice(0, 3).join(', ') || '(none)'}`);
    }
  }
}

const outDir = path.resolve('testing/baseline/runs');
mkdirSync(outDir, { recursive: true });
const stem = path.join(outDir, `help-recall-${new Date().toISOString().replace(/[:.]/g, '-')}`);
writeFileSync(`${stem}.json`, JSON.stringify({ sectionText, notes, rows }, null, 2));
writeFileSync(`${stem}.md`, `${text}\n`);
console.log(`\nrows: ${path.relative(process.cwd(), `${stem}.json`)}\nreport: ${path.relative(process.cwd(), `${stem}.md`)}`);
