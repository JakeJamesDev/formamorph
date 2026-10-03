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
import { helpRoutes } from './helpRoutes';
import { semanticRanking, type HelpEmbedder, type SectionRanking } from './helpSemantic';
// Type-only: the session reads every setting from the question, never from this module's defaults.
import type { HelpSettings } from './helpSettings';
import { mergeRanks } from './rankMerge';
import { surfaceHint, type SurfaceHint } from './surfaceHint';
import { HELP_LOOKUP_SYSTEM_PROMPT, HELP_SYSTEM_PROMPT, helpLookupUserMessage, helpSystemPrompt, helpUserMessage } from './helpPrompt';

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
  /** The Formaquestion settings. The window passes its value; tests and probes pass their own. */
  settings: HelpSettings;
  snapshot: AiSettingsSnapshot;
  index: DocsIndex;
  /** What the player has open when they send. Its mapped section leads the docs; an excluded Surface adds nothing. */
  surface?: Surface;
  /** The images the player attached to this question. They go on the question alone, never on history. */
  images?: readonly ImageAttachment[];
  /** Off lets every pick count on a question that points at the open screen: tests and a probe's control arm. */
  screenRule?: boolean;
  /** Off adds the open page's how-tos to every question: tests and a probe's control arm. */
  howToRule?: boolean;
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

/** The snapshot with the help kind sent along `routes`: the first preset id of them that exists, else the active endpoint. */
const routed = (snapshot: AiSettingsSnapshot, routes: readonly string[]): AiSettingsSnapshot => ({
  ...snapshot,
  resolveTarget: (kind) => snapshot.resolveTarget(kind, routes),
});

/** The exchanges that got answer text. */
const answered = (history: readonly EarlierExchange[]): EarlierExchange[] => history.filter((exchange) => exchange.answer.trim());

/** The earlier exchanges a request carries: the newest that got answer text, at most the History Length. */
function keptHistory(history: readonly EarlierExchange[], historyLength: number): EarlierExchange[] {
  return historyLength > 0 ? answered(history).slice(-historyLength) : [];
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
function helpQueries(question: string, previous: EarlierExchange | undefined): string[] {
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

/** The words with which a question points at the open screen. */
const POINTS_AT_SCREEN = /\b(?:here|this|these)\b/i;

/**
 * The docs block for a question, best first, while the text stays inside the budget and the section limit.
 * The lead section, when given, goes first and counts once toward both. The top hit is always kept. A
 * follow-up such as "and then?" has few keywords of its own, so its own top hit favors the page of the
 * previous answer's topic, and after it come the hits of the previous question and the follow-up
 * searched together. A question that points at the open screen gets the lead page's best how-to sections
 * next, so a "here" question reaches them; any other question keeps those slots for its own hits. Any
 * other hit under the score floor of its own search stays out.
 */
export function helpSections(index: DocsIndex, question: string, { history = [], budget = HELP_DOCS_CHAR_BUDGET, lead, howToRule = true }: {
  /** The exchanges the request carries. The newest with answer text is the one a follow-up continues. */
  history?: readonly EarlierExchange[];
  budget?: number;
  lead?: DocSection;
  howToRule?: HelpQuestion['howToRule'];
} = {}): DocSection[] {
  const previous = answered(history).at(-1);
  const options = { onSurface: lead !== undefined, floor: HELP_SCORE_FLOOR };
  const hits = previous
    ? [...index.search(question, 1, topicOf(previous), options), ...index.search(followUpQuery(previous, question), HELP_SECTION_LIMIT, undefined, options)]
    : index.search(question, HELP_SECTION_LIMIT, undefined, options);
  const addsPageHowTos = lead && (!howToRule || POINTS_AT_SCREEN.test(question));
  // The open page's how-tos skip the floor: a "here" question's key often scores far below its top hit.
  const onPage = addsPageHowTos ? index.search(question, Infinity, undefined, { onSurface: true }).filter((hit) => hit.page === lead.page && hit.id !== lead.id && HOW_TO_HEADING.test(hit.heading)).slice(0, HELP_PAGE_HITS) : [];
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

/** The kept exchanges as chat messages: the question, and the answer as the model wrote it, marker included. */
function historyMessages(kept: readonly EarlierExchange[]): RequestMessage[] {
  return kept.flatMap((exchange): RequestMessage[] => [
    { role: 'user', content: exchange.question },
    { role: 'assistant', content: exchange.flagged ? `${GENERAL_KNOWLEDGE_MARKER}\n${exchange.answer}` : exchange.answer },
  ]);
}

export interface HelpSearchQuestion extends Pick<HelpQuestion, 'question' | 'history' | 'settings' | 'snapshot' | 'index' | 'screenRule' | 'embedder' | 'signal' | 'fetchImpl'> {
  /** The open screen and its section. */
  hint?: SurfaceHint | null;
}

/**
 * The picks a question keeps. A question that points at the open screen keeps only the picks on the screen's
 * page: a pick from another page reads as an answer about another screen.
 */
function screenPicks(question: string, picks: DocSection[], lead: DocSection | undefined): DocSection[] {
  return lead && POINTS_AT_SCREEN.test(question) ? picks.filter((section) => section.page === lead.page) : picks;
}

/**
 * The search of one question: the rankings of the sources that are on, merged into one. AI picks sends its
 * one request here. A source that gives no ranking is left out: a failed or unusable pick, a pick list the
 * screen rule empties, or a semantic source with no model on the device. The keyword search alone is the
 * index's own search, with its score floor.
 */
export async function helpSearch({ question, history = [], settings, snapshot, index, hint, screenRule = true, embedder, signal, fetchImpl }: HelpSearchQuestion): Promise<DocsIndex> {
  const on = settings.sources;
  // The embedder takes no stop signal, so Stop ends the wait for it here.
  const stopped = new Promise<null>((resolve) => signal?.addEventListener('abort', () => resolve(null), { once: true }));
  const previous = keptHistory(history, settings.historyLength).at(-1);
  const [allPicks, semantic] = await Promise.all([
    on.aiPicks
      ? requestPicks(index, { question, earlier: previous?.question, earlierAnswer: previous?.answer, where: hint?.where }, routed(snapshot, helpRoutes(settings).pick), { signal, fetchImpl }).catch(() => [])
      : [],
    on.semantic ? Promise.race([semanticRanking(index, helpQueries(question, previous), embedder), stopped]) : null,
  ]);
  const picks = screenRule ? screenPicks(question, allPicks, hint?.section) : allPicks;
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
 * - Lookup mode, only while the lookup setting is on and the endpoint is known to take function calls: the
 *   model reads more sections through the docs lookup.
 * - Retrieval mode, everywhere else: one request. The capability check does not run.
 * - A bare question, when every source is off, lookup mode is off and the open screen adds no section: the
 *   question alone, with no search. A search that runs and misses still sends the empty guide block.
 *
 * Throws the request pipeline's errors, and an error for an empty answer.
 */
export async function* askHelp({
  question, history = [], language = '', settings, snapshot, index, surface, images = [], screenRule, howToRule, embedder, signal, fetchImpl,
}: HelpQuestion): AsyncGenerator<HelpEvent, void, void> {
  const hint = settings.openScreen ? surfaceHint(surface, index) : null;
  const kept = keptHistory(history, settings.historyLength);
  const answerSnapshot = routed(snapshot, helpRoutes(settings).answer);
  const lookupMode = settings.lookup && toolsSupported(answerSnapshot.resolveTarget('help').reasoning);
  // No part of the request can carry a section, so the question goes alone and its answer is never flagged.
  const bare = !hint && !lookupMode && !Object.values(settings.sources).some(Boolean);
  const search = bare ? index : await helpSearch({ question, history, settings, snapshot, index, hint, screenRule, embedder, signal, fetchImpl });
  if (signal?.aborted) {
    yield { type: 'done', text: '', sources: [], lead: hint?.section, stopped: true, flagged: false, nearest: [] };
    return;
  }
  const inPrompt = bare ? [] : helpSections(search, question, { history: kept, lead: hint?.section, howToRule });
  const lookup = lookupMode
    ? createDocsLookup(index, { budget: HELP_LOOKUP_CHAR_BUDGET, searchLimit: HELP_SECTION_LIMIT, held: inPrompt })
    : null;
  const userMessage = bare
    ? question
    : lookup ? helpLookupUserMessage(question, inPrompt, hint?.where) : helpUserMessage(question, inPrompt, hint?.where);
  const spec = buildAiRequestSpec(answerSnapshot, {
    systemPrompt: helpSystemPrompt(language, lookup ? HELP_LOOKUP_SYSTEM_PROMPT : HELP_SYSTEM_PROMPT),
    messages: withImageParts([...historyMessages(kept), { role: 'user', content: userMessage }], images),
    requestType: 'help',
    maxTokensOverride: settings.answerMaxTokens,
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
      yield { type: 'answer', text, flagged: marked && !bare };
    } else if (event.type === 'done') {
      const sources = [...(lookup?.fetched() ?? []), ...inPrompt];
      const stopped = event.result.finishReason === ABORTED_FINISH_REASON;
      // A Stop can land while a start of the marker is held back; that start stays hidden.
      const answer = readMarker(stripReasoningLive(event.result.content), { final: !stopped });
      if (!answer.text && !stopped) {
        throw new Error(`The model sent an empty answer (finish reason: ${event.result.finishReason ?? 'none'})`);
      }
      const flagged = !bare && isGeneralKnowledge(answer.marked, sources.length);
      const nearest = flagged ? helpSections(search, question, { history: kept }) : [];
      yield { type: 'done', text: answer.text, sources, lead: hint?.section, stopped, flagged, nearest };
    }
  }
}
