// Help recall probe — which search approach puts the right guide section in a help request? (ticket 39)
//
// It answers no question and scores no answer: each approach ranks sections for a question, and the score
// is whether a keyed section is among them. Two question sets run:
//   known    the English task, "here" and follow-up questions of help-baseline-cases.json
//   blind    help-recall-blind-cases.json, written from the headings alone; tune no approach on it
//
// Every approach goes through the shipped block builder, `helpSections`, with its own search in place of the
// keyword search. So the open screen's section, the follow-up rule and the size budget are the same for all.
//   keyword   the shipped Docs Index search: the control
//   wordmap   the same search over the docs with the keyword lines of help-word-map.json added
//   semantic  sections ranked by the dot product of MiniLM vectors, the model semantic memory ships
//   hybrid    the keyword and the semantic rankings merged by reciprocal rank fusion
//   ai        with `--ai`: a first request lists every section heading, and the model copies the lines it picks
// The mixes fuse the rankings of the approaches they name the same way: wordmap+semantic, ai+wordmap,
// ai+wordmap+semantic.
//
// The score, per approach, set and kind:
//   first   a keyed section is the first section of the block
//   at5     a keyed section is among the block's five sections, with no size budget (recall@5)
//   sent    a keyed section is in the block that fits the request's size budget
//
// Usage: npm run probe:help-recall -- [--arms keyword,wordmap,semantic,hybrid,wordmap+semantic,ai,ai+wordmap,ai+wordmap+semantic] [--sets known,blind] [--text head|full|chunks]
//          [--ai] [--runs 5] [--parallel 4] [--endpoint URL] [--model default] [--token T] [--show]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildAiRequestSpec } from '@/lib/aiRequest/aiRequestSpec';
import sidebar from '../../../docs/_Sidebar.md?raw';
import { BUNDLED_DOCS, bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { createDocsIndex, type DocSection, type DocsIndex } from '@/lib/docs/docsIndex';
import { HELP_SECTION_LIMIT, helpSections, type EarlierExchange } from '@/lib/formaquestion/helpSession';
import { surfaceHint } from '@/lib/formaquestion/surfaceHint';
import { EMBEDDING_MODEL_ID } from '@/lib/memoryRelevance';
import { mean, probeSnapshot, type ProbeTarget } from './help-probe-shared';
import { loadBlindCases, loadKnownCases, RECALL_KINDS, RECALL_SETS, type RecallCase, type RecallKind, type RecallSet } from './help-recall-cases';
import { baseSectionId, chunksOf, mergeRanks, rankByVector, readPicks, scoreRecall, summarizeRecall, withKeywords, type RecallScore } from './help-recall-score';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const ARMS = ['keyword', 'wordmap', 'semantic', 'hybrid', 'wordmap+semantic', 'ai', 'ai+wordmap', 'ai+wordmap+semantic'] as const;
type Arm = (typeof ARMS)[number];
/** The values of a comma list flag, each one of `allowed`. */
function listArg<T extends string>(flag: string, allowed: readonly T[]): T[] {
  const values = argVal(flag, allowed.join(',')).split(',');
  const unknown = values.filter((value) => !(allowed as readonly string[]).includes(value));
  if (unknown.length > 0) throw new Error(`${flag} takes ${allowed.join(', ')}, not ${unknown.join(', ')}`);
  return values as T[];
}
const isAiArm = (arm: Arm) => arm.startsWith('ai');
// The arms that send requests run only with `--ai`.
const arms = listArg('--arms', ARMS).filter((arm) => args.includes('--ai') || !isAiArm(arm));
const sets = listArg('--sets', RECALL_SETS);
const SECTION_TEXTS = ['head', 'full', 'chunks'] as const;
// `full` is the best text on the known set; the blind set has no part in the choice.
const sectionText = args.includes('--text') ? listArg('--text', SECTION_TEXTS)[0] : 'full';
const runs = Number(argVal('--runs', '5'));
const parallel = Number(argVal('--parallel', '4'));
const show = args.includes('--show');

const WORD_MAP_FILE = path.resolve('testing/baseline/help-word-map.json');
const CHANGELOG_PAGE = 'Changelog';
/** The fewest sections of each ranking a fused arm merges; a search that asks for more gets more. */
const FUSION_DEPTH = 50;
/** How much a section of the favored page outweighs another, as in the keyword search. */
const FAVORED_PAGE_WEIGHT = 2;
/** The most characters of one body chunk a section vector covers; about 200 tokens, inside the model's window. */
const CHUNK_CHARS = 900;

const index = bundledDocsIndex();
const cases = [...loadKnownCases(), ...loadBlindCases()].filter((c) => sets.includes(c.set));
const caseById = new Map(cases.map((c) => [c.id, c]));

/** Every guide section, changelog left out: the keyword search ranks the changelog under every guide hit. */
const guide = index.contents().filter((page) => page.page !== CHANGELOG_PAGE);
const guideSections: DocSection[] = guide.flatMap((page) => page.sections.flatMap((s) => index.get([s.id]).filter((part) => part.id === s.id)));
const sectionById = new Map(guideSections.map((section) => [section.id, section]));
const titleOf = new Map(guide.map((page) => [page.page, page.title]));
/** A section as one line: its page, the headings above it, then its own. */
const headingLine = (section: DocSection) =>
  [...new Set([titleOf.get(section.page) ?? section.page, ...section.trail, section.heading].map((name) => name.replace(/^[^\p{L}\p{N}]+/u, '')))].join(' › ');

// ── The block ────────────────────────────────────────────────────────────────

interface Blocks { ranked: DocSection[]; sent: DocSection[] }

/** The docs block the app builds for a question when `search` finds the sections, with and without the size budget. */
function blocksOf(search: DocsIndex, c: RecallCase, history: EarlierExchange[]): Blocks {
  const lead = surfaceHint(c.surface, index)?.section;
  return {
    ranked: helpSections(search, c.question, { history, lead, budget: Infinity }),
    sent: helpSections(search, c.question, { history, lead }),
  };
}

/** The history a follow-up gets: its first question, with the block that question's request held. */
function historyOf(first: RecallCase, sent: DocSection[]): EarlierExchange[] {
  return [{ question: first.question, answer: '(the answer to the first question)', sources: sent, lead: surfaceHint(first.surface, index)?.section }];
}

interface Row { arm: Arm; run: number; caseId: string; score: RecallScore; ranked: string[]; ms: number; promptTokens: number; answerTokens: number }

/** Scores every question with one search; a follow-up runs after its first question. `searchFor` may differ by question. */
function scoreAll(arm: Arm, run: number, searchFor: (c: RecallCase) => DocsIndex, costOf: (c: RecallCase) => Pick<Row, 'ms' | 'promptTokens' | 'answerTokens'> | null): Row[] {
  const rows: Row[] = [];
  const sentOf = new Map<string, DocSection[]>();
  const one = (c: RecallCase, history: EarlierExchange[]) => {
    const started = performance.now();
    const { ranked, sent } = blocksOf(searchFor(c), c, history);
    // `blocksOf` builds the block twice; a request builds it once.
    const ms = (performance.now() - started) / 2;
    sentOf.set(c.id, sent);
    rows.push({ arm, run, caseId: c.id, score: scoreRecall(c.right, ranked.map((s) => s.id), sent.map((s) => s.id)), ranked: ranked.map((s) => s.id), ...(costOf(c) ?? { ms, promptTokens: 0, answerTokens: 0 }) });
  };
  for (const c of cases.filter((first) => first.kind !== 'followUp')) one(c, []);
  for (const c of cases.filter((next) => next.kind === 'followUp')) {
    const first = caseById.get(c.after ?? '');
    if (!first) throw new Error(`follow-up ${c.id} names no question of the run: ${c.after}`);
    one(c, historyOf(first, sentOf.get(first.id) ?? []));
  }
  return rows;
}

// ── Semantic ─────────────────────────────────────────────────────────────────

type Extractor = (texts: string[], options: { pooling: 'mean'; normalize: true }) => Promise<{ dims: number[]; data: Float32Array; dispose(): void }>;
interface SemanticCost { loadMs: number; loadRssMb: number; vectors: number; vectorBytes: number; queryMs: number }

/**
 * The texts one section is embedded as. The model reads the first 512 tokens of a text, so `full` covers the
 * start of a long section. `chunks` scores a section by its best chunk, so a long section is read whole.
 */
function textsOf(section: DocSection): string[] {
  const head = headingLine(section);
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

  const texts = guideSections.flatMap((section) => textsOf(section).map((text) => ({ id: section.id, text })));
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
    blocksOf(recorder, c, first ? historyOf(first, []) : []);
  }
  return [...queries];
}

// ── AI picks ─────────────────────────────────────────────────────────────────

/** The sections the model picks from: one line per whole section. */
const pickable = guideSections.filter((section) => section.id === baseSectionId(section.id));
const PICK_SYSTEM_PROMPT = [
  'You are the librarian of the Formamorph player guide. Formamorph is a text adventure app. A player asks a question, and you pick the guide sections that answer it.',
  '',
  'The message lists every section of the guide, one on each line: the page, then the headings down to the section.',
  '',
  '- Pick the sections whose text answers the question, the best one first.',
  '- Pick 5 sections at most.',
  '- Reply with the lines of your picks alone, one on each line, each copied as the list writes it.',
].join('\n');
const PICK_MAX_TOKENS = 150;
const PICK_LINES = pickable.map(headingLine);
const SECTION_LIST = PICK_LINES.join('\n');

function pickMessage(c: RecallCase, first: RecallCase | undefined): string {
  const where = surfaceHint(c.surface, index)?.where;
  return [
    `<sections>\n${SECTION_LIST}\n</sections>`,
    ...(where ? [`The player asks from this screen: ${where}.`] : []),
    ...(first ? [`The player's earlier question: ${first.question}`] : []),
    `Question: ${c.question}`,
    'Reply with the lines of the sections that answer the question, the best one first.',
  ].join('\n\n');
}

interface PickReply { sections: DocSection[]; ms: number; promptTokens: number; answerTokens: number; reply: string }

async function askPicks(target: ProbeTarget, c: RecallCase): Promise<PickReply> {
  const spec = buildAiRequestSpec(probeSnapshot(target), {
    systemPrompt: PICK_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: pickMessage(c, caseById.get(c.after ?? '')) }],
    // The pins of a help request: temperature 0.2 and no repetition penalty, so a copied line stays exact.
    requestType: 'help',
    maxTokensOverride: PICK_MAX_TOKENS,
  });
  for (let attempt = 1; ; attempt++) {
    const started = performance.now();
    try {
      const response = await fetch(spec.url, { method: 'POST', headers: spec.headers, body: JSON.stringify({ ...spec.body, stream: false, reasoning_effort: 'none' }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
      const json = await response.json() as { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      const reply = json.choices?.[0]?.message?.content ?? '';
      const sections = readPicks(reply, PICK_LINES).flatMap((at) => index.get([pickable[at].id]));
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

let wordmap: DocsIndex | null = null;
if (arms.some((arm) => arm.includes('wordmap'))) {
  if (!existsSync(WORD_MAP_FILE)) throw new Error(`the wordmap arms need ${path.relative(process.cwd(), WORD_MAP_FILE)}`);
  const map = (JSON.parse(readFileSync(WORD_MAP_FILE, 'utf8')) as { sections: Record<string, string[]> }).sections;
  const { pages, unknown } = withKeywords(BUNDLED_DOCS, map);
  if (unknown.length > 0) throw new Error(`the word map names sections the guide does not have: ${unknown.join(', ')}`);
  const phrases = Object.values(map).flat();
  notes.push(`Word map: ${phrases.length} phrases on ${Object.keys(map).length} sections, ${phrases.join(', ').length} characters.`);
  wordmap = createDocsIndex({ pages, sidebar });
  if (wants('wordmap')) rows.push(...scoreAll('wordmap', 1, () => wordmap!, noCost));
}

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
  if (wants('wordmap+semantic')) rows.push(...scoreAll('wordmap+semantic', 1, () => fused(wordmap!, semantic!), embedCost));
}

let failed = 0;
if (arms.some(isAiArm)) {
  const target: ProbeTarget = {
    endpoint: argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions'),
    model: argVal('--model', 'default'),
    token: argVal('--token', process.env.PROBE_TOKEN ?? ''),
  };
  console.log(`ai picks · ${target.endpoint} · model ${target.model} · ${cases.length} questions × ${runs} runs · ${pickable.length} headings`);
  const started = Date.now();
  let empty = 0;
  for (let run = 1; run <= runs; run++) {
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
    if (wants('ai+wordmap')) rows.push(...scoreAll('ai+wordmap', run, (c) => fused(picked(c), wordmap!), pickCost));
    if (wants('ai+wordmap+semantic')) rows.push(...scoreAll('ai+wordmap+semantic', run, (c) => fused(picked(c), wordmap!, semantic!), pickCost));
    if (show && run === 1) for (const c of cases) console.log(`  ${c.id}: ${picks.get(c.id)?.reply.replace(/\s+/g, ' ').slice(0, 80)}`);
  }
  notes.push(`AI picks: ${target.endpoint}, model \`${target.model}\`, ${runs} runs, ${pickable.length} headings in each request, ${failed} failed requests and ${empty} replies with no line of the list, in ${((Date.now() - started) / 1000).toFixed(0)} s.`);
}

// ── Report ───────────────────────────────────────────────────────────────────

const pct = (share: number) => `${(share * 100).toFixed(1)}%`;
const table = (head: string[], lines: string[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...lines.map((cells) => `| ${cells.join(' | ')} |`)].join('\n');
const ARM_LABELS: Record<Arm, string> = {
  keyword: 'Keyword (control)', wordmap: 'Bigger word map', semantic: 'Semantic', hybrid: 'Hybrid', 'wordmap+semantic': 'Word map + semantic',
  ai: 'AI picks', 'ai+wordmap': 'AI picks + word map', 'ai+wordmap+semantic': 'AI picks + word map + semantic',
};
const KIND_LABELS: Record<RecallKind, string> = { task: 'Task', here: 'Here', followUp: 'Follow-up' };
const ranArms = ARMS.filter((arm) => rows.some((r) => r.arm === arm));
const inScope = (r: Row, set: RecallSet, kind?: RecallKind) => caseById.get(r.caseId)?.set === set && (!kind || caseById.get(r.caseId)?.kind === kind);

const report: string[] = [`# Help recall\n\n${cases.length} questions. ${notes.join(' ')}`];
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
