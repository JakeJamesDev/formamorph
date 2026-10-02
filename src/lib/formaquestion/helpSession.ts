/**
 * The help session: one question in, one streamed answer and its sources out. It has no React and reads no
 * world or save. It sends through the AI Request Spec and the tool loop, the same path as every other call.
 */
import { buildAiRequestSpec, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { ABORTED_FINISH_REASON } from '@/lib/aiRequest/aiStream';
import { streamAiToolLoop } from '@/lib/aiRequest/toolLoop';
import { stripReasoningLive } from '@/lib/aiResponse';
import { CHANGELOG_PAGE, type DocSection, type DocsIndex } from '@/lib/docs/docsIndex';
import { toolsSupported } from '@/lib/reasoningEffort';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { withImageParts } from '@/lib/aiRequest/imageParts';
import type { ImageAttachment, RequestMessage } from '@/types';
import { createDocsLookup, DOCS_LOOKUP } from './docsLookup';
import { GENERAL_KNOWLEDGE_MARKER, isGeneralKnowledge, readMarker } from './generalKnowledge';
import { requestPicks } from './helpPicks';
import { semanticRanking, type HelpEmbedder, type SectionRanking } from './helpSemantic';
import { mergeRanks } from './rankMerge';
import { surfaceHint } from './surfaceHint';
import { HELP_LOOKUP_SYSTEM_PROMPT, HELP_SYSTEM_PROMPT, helpLookupUserMessage, helpSystemPrompt, helpUserMessage } from './helpPrompt';

/**
 * Switches lookup mode on for every help question. Off ships (ADR-0009). Not a player setting, and in no
 * preset or export.
 */
export const HELP_LOOKUP_MODE = false;

/** The keyword search source: the Docs Index search, with the docs' keyword lines. */
export const HELP_KEYWORD_SOURCE = true;

/** The AI picks search source: one request before the answer, in which the model picks sections from the guide's headings. */
export const HELP_AI_PICKS_SOURCE = true;

/** The semantic search source: sections ranked by meaning. It runs only when the embedding model is on the device. */
export const HELP_SEMANTIC_SOURCE = false;

/** The search sources of a help question. The rankings of the ones that are on merge into one. Not player settings, and in no preset or export. */
export interface HelpSources {
  keyword: boolean;
  aiPicks: boolean;
  semantic: boolean;
}

/** The fewest sections of each source's ranking the merge reads; a search that asks for more gets more. */
const HELP_MERGE_DEPTH = 50;

/** The most docs sections the search puts in one help request, or returns for one lookup call. */
export const HELP_SECTION_LIMIT = 5;

/**
 * The most characters of docs section text the prompt of one help question holds, so the request fits a
 * small model's context.
 */
export const HELP_DOCS_CHAR_BUDGET = 12_000;

/** The least share of a search's top hit score another of its hits needs to join the docs block of a help question. */
export const HELP_SCORE_FLOOR = 0.2;

/** The most characters of docs section text the lookup calls of one question return together, in addition to the prompt's. */
export const HELP_LOOKUP_CHAR_BUDGET = 12_000;

/** The answer cap in tokens: room for a long list of steps. */
export const HELP_MAX_TOKENS = 800;

/** The most earlier exchanges one help request carries, newest kept. */
export const HELP_HISTORY_EXCHANGES = 4;

/** An earlier question of the conversation and the answer text it got. */
export interface EarlierExchange {
  question: string;
  answer: string;
  /** The answer did not come from the guide. */
  flagged?: boolean;
  /** The docs sections that reached the model for this answer. */
  sources?: readonly DocSection[];
  /** The open screen's section that led those sources. */
  lead?: DocSection;
}

export interface HelpQuestion {
  question: string;
  /** The earlier exchanges of the conversation, oldest first. The request keeps the newest that have an answer. */
  history?: readonly EarlierExchange[];
  /** The AI Language setting. */
  language?: string;
  snapshot: AiSettingsSnapshot;
  index: DocsIndex;
  /** What the player has open when they send. Its mapped section leads the docs; an excluded Surface adds nothing. */
  surface?: Surface;
  /** The images the player attached to this question. They go on the question alone, never on history. */
  images?: readonly ImageAttachment[];
  /** Overrides `HELP_LOOKUP_MODE` for this question: tests and the probe's lookup arm. */
  lookup?: boolean;
  /** Overrides the search source switches for this question: tests and a probe's arm. */
  searchSources?: Partial<HelpSources>;
  /** The embedder of the semantic source, in place of the device's: tests. */
  embedder?: HelpEmbedder;
  /** Stop: the stream ends and the answer so far is kept. */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export type HelpEvent =
  /** The answer so far. `flagged` once the general-knowledge marker came in. */
  | { type: 'answer'; text: string; flagged: boolean }
  /**
   * The end of the answer, with the docs sections that reached the model. A flagged answer did not come
   * from the guide, and `nearest` holds the search's sections for the question. `lead` is the open screen's
   * section among the sources.
   */
  | { type: 'done'; text: string; sources: DocSection[]; lead?: DocSection; stopped: boolean; flagged: boolean; nearest: DocSection[] };

/** The earlier exchanges a request carries: the newest that got answer text, at most the cap. */
function keptHistory(history: readonly EarlierExchange[]): EarlierExchange[] {
  return history.filter((exchange) => exchange.answer.trim()).slice(-HELP_HISTORY_EXCHANGES);
}

/**
 * The section whose page a follow-up favors: the answer's first source other than the open screen's lead,
 * else the lead. None for an answer that did not come from the guide.
 */
function topicOf({ sources = [], lead, flagged }: EarlierExchange): DocSection | undefined {
  if (flagged) return undefined;
  return sources.find((section) => section.id !== lead?.id) ?? sources[0];
}

/** The query a follow-up searches with after its own: the previous question and this one together. */
const followUpQuery = (previous: EarlierExchange, question: string) => `${previous.question} ${question}`;

/** Every query the docs block of a question searches for. */
function helpQueries(question: string, history: readonly EarlierExchange[]): string[] {
  const previous = keptHistory(history).at(-1);
  return previous ? [question, followUpQuery(previous, question)] : [question];
}

/**
 * One search over the rankings of several sources, merged by reciprocal rank fusion. A merged ranking has no
 * score the floor fits, so the floor does not apply. The release sections of a what's-new question stay first,
 * with any mix of sources. Other changelog sections come from the keyword search alone and stay under every
 * guide section.
 */
function mergedSearch(index: DocsIndex, rankings: readonly SectionRanking[]): DocsIndex {
  return {
    ...index,
    search: (query, limit = HELP_SECTION_LIMIT, favor, options) => {
      const hits = rankings.map((ranking) => ranking(query, Math.max(limit, HELP_MERGE_DEPTH), favor, options?.onSurface));
      const sectionOf = new Map(hits.flat().map((section) => [section.id, section]));
      const isGuide = (section: DocSection) => section.page !== CHANGELOG_PAGE;
      const guide = mergeRanks(hits.map((list) => list.filter(isGuide).map((section) => section.id))).flatMap((id) => sectionOf.get(id) ?? []);
      const lead = index.whatsNew(query);
      const others = hits.flat().filter((section) => !isGuide(section) && !lead.some((release) => release.id === section.id));
      return [...lead, ...guide, ...others].slice(0, limit);
    },
  };
}

/** The most how-to sections of the open page that join the block, after the question's own top hit. */
const HELP_PAGE_HITS = 2;

/** A docs heading that starts a task: "How to Add a Location". */
const HOW_TO_HEADING = /^how to\b/i;

/**
 * The docs block for a question, best first, while the text stays inside the budget and the section limit.
 * The lead section, when given, goes first and counts once toward both. The top hit is always kept. A
 * follow-up such as "and then?" has few keywords of its own, so its own top hit favors the page of the
 * previous answer's topic, and after it come the hits of the previous question and the follow-up
 * searched together. The lead's page adds its best how-to sections for the question next, so a "here"
 * question reaches them. Any other hit under the score floor of its own search stays out.
 */
export function helpSections(index: DocsIndex, question: string, { history = [], budget = HELP_DOCS_CHAR_BUDGET, lead }: {
  history?: readonly EarlierExchange[];
  budget?: number;
  lead?: DocSection;
} = {}): DocSection[] {
  const previous = keptHistory(history).at(-1);
  const options = { onSurface: lead !== undefined, floor: HELP_SCORE_FLOOR };
  const hits = previous
    ? [...index.search(question, 1, topicOf(previous), options), ...index.search(followUpQuery(previous, question), HELP_SECTION_LIMIT, undefined, options)]
    : index.search(question, HELP_SECTION_LIMIT, undefined, options);
  // The open page's how-tos skip the floor: a "here" question's key often scores far below its top hit.
  const onPage = lead ? index.search(question, Infinity, undefined, { onSurface: true }).filter((hit) => hit.page === lead.page && hit.id !== lead.id && HOW_TO_HEADING.test(hit.heading)).slice(0, HELP_PAGE_HITS) : [];
  const ordered = [...hits.slice(0, 1), ...onPage, ...hits.slice(1)];
  const kept: DocSection[] = lead ? [lead] : [];
  let size = lead?.markdown.length ?? 0;
  for (const hit of ordered) {
    if (kept.length === HELP_SECTION_LIMIT) break;
    if (kept.some((section) => section.id === hit.id)) continue;
    if (kept.length > 0 && size + hit.markdown.length > budget) break;
    kept.push(hit);
    size += hit.markdown.length;
  }
  return kept;
}

/** The earlier exchanges as chat messages: the question, and the answer as the model wrote it, marker included. */
function historyMessages(history: readonly EarlierExchange[]): RequestMessage[] {
  return keptHistory(history).flatMap((exchange): RequestMessage[] => [
    { role: 'user', content: exchange.question },
    { role: 'assistant', content: exchange.flagged ? `${GENERAL_KNOWLEDGE_MARKER}\n${exchange.answer}` : exchange.answer },
  ]);
}

export interface HelpSearchQuestion extends Pick<HelpQuestion, 'question' | 'history' | 'snapshot' | 'index' | 'searchSources' | 'embedder' | 'signal' | 'fetchImpl'> {
  /** The open screen, as the answer request names it. */
  where?: string;
}

/**
 * The search of one question: the rankings of the sources that are on, merged into one. AI picks sends its
 * one request here. A source that gives no ranking is left out: a failed or unusable pick, or a semantic
 * source with no model on the device. The keyword search alone is the index's own search, with its score floor.
 */
export async function helpSearch({ question, history = [], snapshot, index, where, searchSources, embedder, signal, fetchImpl }: HelpSearchQuestion): Promise<DocsIndex> {
  const on: HelpSources = { keyword: HELP_KEYWORD_SOURCE, aiPicks: HELP_AI_PICKS_SOURCE, semantic: HELP_SEMANTIC_SOURCE, ...searchSources };
  // The embedder takes no stop signal, so Stop ends the wait for it here.
  const stopped = new Promise<null>((resolve) => signal?.addEventListener('abort', () => resolve(null), { once: true }));
  const previous = keptHistory(history).at(-1);
  const [picks, semantic] = await Promise.all([
    on.aiPicks
      ? requestPicks(index, { question, earlier: previous?.question, earlierAnswer: previous?.answer, where }, snapshot, { signal, fetchImpl }).catch(() => [])
      : [],
    on.semantic ? Promise.race([semanticRanking(index, helpQueries(question, history), embedder), stopped]) : null,
  ]);
  const keyword: SectionRanking = (query, limit, favor, onSurface) => index.search(query, limit, favor, { onSurface });
  const picked: SectionRanking = (_query, limit) => picks.slice(0, limit);
  const rankings = [...(on.keyword ? [keyword] : []), ...(picks.length > 0 ? [picked] : []), ...(semantic ? [semantic] : [])];
  return on.keyword && rankings.length === 1 ? index : mergedSearch(index, rankings);
}

/**
 * Asks one help question, after the earlier exchanges. The mode is picked before anything is sent, and a
 * failed request is never sent again in the other mode (ADR-0008).
 *
 * In both modes the sections that match the question go in the prompt. The search sources that are on find
 * them. AI picks sends one request of its own first; when that fails, the other sources find the sections,
 * and the answer request is still sent once.
 *
 * - Lookup mode, only while `HELP_LOOKUP_MODE` is on and the endpoint is known to take function calls: the
 *   model reads more sections through the docs lookup.
 * - Retrieval mode, everywhere else: one request. The capability check does not run.
 *
 * Throws the request pipeline's errors, and an error for an empty answer.
 */
export async function* askHelp({
  question, history = [], language = '', snapshot, index, surface, images = [], lookup: lookupOn = HELP_LOOKUP_MODE, searchSources, embedder, signal, fetchImpl,
}: HelpQuestion): AsyncGenerator<HelpEvent, void, void> {
  const hint = surfaceHint(surface, index);
  const search = await helpSearch({ question, history, snapshot, index, where: hint?.where, searchSources, embedder, signal, fetchImpl });
  if (signal?.aborted) {
    yield { type: 'done', text: '', sources: [], lead: hint?.section, stopped: true, flagged: false, nearest: [] };
    return;
  }
  const inPrompt = helpSections(search, question, { history, lead: hint?.section });
  const lookupMode = lookupOn && toolsSupported(snapshot.resolveTarget('help').reasoning);
  const lookup = lookupMode
    ? createDocsLookup(index, { budget: HELP_LOOKUP_CHAR_BUDGET, searchLimit: HELP_SECTION_LIMIT, held: inPrompt })
    : null;
  const spec = buildAiRequestSpec(snapshot, {
    systemPrompt: helpSystemPrompt(language, lookup ? HELP_LOOKUP_SYSTEM_PROMPT : HELP_SYSTEM_PROMPT),
    messages: withImageParts([...historyMessages(history), {
      role: 'user',
      content: lookup ? helpLookupUserMessage(question, inPrompt, hint?.where) : helpUserMessage(question, inPrompt, hint?.where),
    }], images),
    requestType: 'help',
    maxTokensOverride: HELP_MAX_TOKENS,
    ...(lookup && { tools: [DOCS_LOOKUP] }),
  });
  let text = '';
  let marked = false;
  for await (const event of streamAiToolLoop(spec, { signal, fetchImpl, ...(lookup && { execute: lookup.execute }) })) {
    if (event.type === 'toolCalls') {
      // What the model wrote before a call is not the answer.
      if (text || marked) yield { type: 'answer', text: '', flagged: false };
      text = '';
      marked = false;
    } else if (event.type === 'delta') {
      const next = readMarker(stripReasoningLive(event.content));
      if (next.text === text && next.marked === marked) continue;
      ({ text, marked } = next);
      yield { type: 'answer', text, flagged: marked };
    } else if (event.type === 'done') {
      const sources = [...(lookup?.fetched() ?? []), ...inPrompt];
      const stopped = event.result.finishReason === ABORTED_FINISH_REASON;
      // A Stop can land while a start of the marker is held back; that start stays hidden.
      const answer = readMarker(stripReasoningLive(event.result.content), { final: !stopped });
      if (!answer.text && !stopped) {
        throw new Error(`The model sent an empty answer (finish reason: ${event.result.finishReason ?? 'none'})`);
      }
      const flagged = isGeneralKnowledge(answer.marked, sources.length);
      const nearest = flagged ? helpSections(search, question, { history }) : [];
      yield { type: 'done', text: answer.text, sources, lead: hint?.section, stopped, flagged, nearest };
    }
  }
}
