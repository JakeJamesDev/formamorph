/**
 * The help session: one question in, one streamed answer and its sources out. It has no React and reads no
 * world or save. It sends through the AI Request Spec and the tool loop, the same path as every other call.
 */
import { buildAiRequestSpec, type AiRequestBody, type AiRequestSpec, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { ABORTED_FINISH_REASON, type AiStreamResult } from '@/lib/aiRequest/aiStream';
import { streamAiToolLoop, type AiToolRound, type ToolExecutor } from '@/lib/aiRequest/toolLoop';
import { extractReasoningLive, stripReasoningLive } from '@/lib/aiResponse';
import { snapshotToolExecutor } from '@/lib/tools/toolOffer';
import { isTool, type OfferedFunction } from '@/lib/tools/toolSchema';
import { emptyToolSnapshot } from '@/lib/tools/toolSnapshot';
import { CHANGELOG_PAGE, type DocSection, type DocsIndex } from '@/lib/docs/docsIndex';
import { toDebugEndpoint } from '@/lib/promptEndpoints';
import { resolvePromptReasoning, resolvePromptReasoningSetting, toolsSupported, type PromptReasoningSetting } from '@/lib/reasoningEffort';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { withImageParts } from '@/lib/aiRequest/imageParts';
import type { ImageAttachment, RequestMessage } from '@/types';
import { createDocsLookup, DOCS_LOOKUP } from './docsLookup';
import { GENERAL_KNOWLEDGE_MARKER, isGeneralKnowledge, readMarker } from './generalKnowledge';
import { helpChipValues, renderHelpPrompt } from './helpChips';
import { isCodeTurn, withCodeRider } from './helpCodeRider';
import { createFaceCall } from './helpFace';
import { requestPicks } from './helpPicks';
import { HELP_ROLL } from './helpRoll';
import { activeHelpOptions, activeHelpPreset, activeHelpPrompts, isHelpPromptEdited } from './helpPresets';
import { helpRoutes } from './helpRoutes';
import { semanticRanking, type HelpEmbedder, type SectionRanking } from './helpSemantic';
// Type-only: the session reads every setting from the question, never from this module's defaults.
import type { HelpSettings } from './helpSettings';
import { activeMascotRig } from './mascotPresets';
import { helpToolsOn } from './helpTools';
import {
  emptySearchRecord, HELP_SAMPLER_FIELDS, recordQuery, searchTraceOf, traceSection,
  type HelpRequestTrace, type HelpSamplers, type HelpSearchRecord, type HelpSource, type HelpTrace,
} from './helpTrace';
import type { ToolSnapshotSource } from './helpWorld';
import { mergeRanks } from './rankMerge';
import { surfaceHint, surfaceWords, type SurfaceHint } from './surfaceHint';
import { helpLookupUserMessage, helpSystemPrompt, helpUserMessage } from './helpPrompt';

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
  /** The open world as a Tool Snapshot, read once at the first Tool call. None: a Tool runs on an empty snapshot (Q36). */
  world?: ToolSnapshotSource;
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

/**
 * What a question waits on before its answer text. `checking` is the reachability check the chat runs
 * before the question; the rest come from the question as stage events, each when it starts.
 */
export type HelpStage = 'checking' | 'searching' | 'picking' | 'waiting' | 'lookingUp';

export type HelpEvent =
  /** A new stage started. The next stage, or the first answer text, ends it. */
  | { type: 'stage'; stage: HelpStage }
  /** The answer so far. `flagged` once the general-knowledge marker came in. `reasoning` is the model's, native or inline. */
  | { type: 'answer'; text: string; flagged: boolean; reasoning: string }
  /**
   * The end of the answer, with the docs sections that reached the model. A flagged answer did not come
   * from the guide, and `nearest` holds the search's sections for the question. `lead` is the open screen's
   * section among the sources.
   */
  | { type: 'done'; text: string; sources: DocSection[]; lead?: DocSection; stopped: boolean; flagged: boolean; nearest: DocSection[]; reasoning: string }
  /** The AI set the Mascot's face: the layer id of an enabled expression of the rig. Each call yields one. */
  | { type: 'face'; face: string }
  /**
   * What the question sent, for AI Context: once the search is done and the answer request is built, again
   * after each tool round, and once more with the reply. Each event carries the whole trace so far.
   */
  | { type: 'trace'; trace: HelpTrace };

/** The pick request never reasons (Q28). */
const PICK_REASONING: PromptReasoningSetting = { enabled: false, level: 'global' };

/**
 * The snapshot of one help request: the help kind sent along `routes` (the first preset id of them that exists,
 * else the active endpoint), with `reasoning` in place of any game setting for the kind.
 */
function helpSnapshot(snapshot: AiSettingsSnapshot, routes: readonly string[], reasoning: PromptReasoningSetting, budgetPct?: number): AiSettingsSnapshot {
  const promptReasoning = { ...snapshot.promptReasoning, help: resolvePromptReasoningSetting(reasoning) };
  const reasons = resolvePromptReasoning('help', promptReasoning, snapshot.reasoningEffort, snapshot.thinkingMode) !== 'none';
  return {
    ...snapshot,
    resolveTarget: (kind) => snapshot.resolveTarget(kind, routes),
    promptReasoning,
    ...(budgetPct !== undefined && { promptReasoningBudget: { ...snapshot.promptReasoningBudget, help: budgetPct } }),
    keptReasoning: { ...snapshot.keptReasoning, prompts: { ...snapshot.keptReasoning?.prompts, help: reasoning } },
    reasoningEngaged: snapshot.reasoningEngaged || reasons,
  };
}

/** The reasoning parts that came in, as one text. */
const joinReasoning = (...parts: string[]): string => parts.filter(Boolean).join('\n\n');

/** The sampler values a request body carried, in the settings' names. The engine spells the penalty `repeat_penalty`. */
function samplersOf(body: AiRequestBody): HelpSamplers {
  const sent: Record<string, unknown> = { ...body, repetition_penalty: body.repetition_penalty ?? body.repeat_penalty };
  return Object.fromEntries(HELP_SAMPLER_FIELDS.flatMap(({ key, wire }) => (typeof sent[wire] === 'number' ? [[key, sent[wire]]] : [])));
}

/** One request as the trace records it: the wire messages and the endpoint, and the reply once it came. */
function requestTrace(type: string, { target, body }: AiRequestSpec, customPrompt: boolean, result?: AiStreamResult, toolRounds?: readonly AiToolRound[]): HelpRequestTrace {
  const endpoint = { presetId: target.presetId ?? null, presetName: target.presetName ?? target.endpointId, model: target.model, url: target.url, apiToken: target.apiToken };
  return {
    record: {
      type,
      messages: body.messages,
      endpoint: toDebugEndpoint(endpoint, body, target.reasoning.dialect),
      ...(toolRounds?.length && { toolRounds: [...toolRounds] }),
      ...(result && { response: result.content, reasoning: result.reasoningText }),
    },
    samplers: samplersOf(body),
    customPrompt,
  };
}

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

/** One search source and its name, for the merge and the trace. */
interface NamedRanking {
  source: HelpSource;
  ranking: SectionRanking;
}

/**
 * One search over the rankings of several sources, merged by reciprocal rank fusion. A merged ranking has no
 * score the floor fits, so the floor does not apply. The release sections of a what's-new question stay first,
 * with any mix of sources. Other changelog sections come from the keyword search alone and stay under every
 * guide section. Each query goes in the record, when one is given.
 */
function mergedSearch(index: DocsIndex, sources: readonly NamedRanking[], record?: HelpSearchRecord): DocsIndex {
  return {
    ...index,
    search: (query, limit = HELP_SECTION_LIMIT, favor, options) => {
      const hits = sources.map(({ ranking }) => ranking(query, Math.max(limit, HELP_MERGE_DEPTH), favor, options?.onSurface));
      const sectionOf = new Map(hits.flat().map((section) => [section.id, section]));
      const isGuide = (section: DocSection) => section.page !== CHANGELOG_PAGE;
      const guide = mergeRanks(hits.map((list) => list.filter(isGuide).map((section) => section.id))).flatMap((id) => sectionOf.get(id) ?? []);
      const lead = index.whatsNew(query);
      const others = hits.flat().filter((section) => !isGuide(section) && !lead.some((release) => release.id === section.id));
      const merged = [...lead, ...guide, ...others];
      // Every source that was on gets a row; one that gave no ranking has no sections.
      if (record) recordQuery(record, { query, sources: record.on.map((source) => ({ source, sections: hits[sources.findIndex((named) => named.source === source)] ?? [] })), merged });
      return merged.slice(0, limit);
    },
  };
}

/**
 * The keyword search alone, with each query put in the record. The index's own search ranks and then cuts,
 * so a deeper call cut to the limit returns what the limit alone would.
 */
function recordedKeyword(index: DocsIndex, record: HelpSearchRecord): DocsIndex {
  return {
    ...index,
    search: (query, limit, favor, options) => {
      const hits = index.search(query, limit === undefined ? undefined : Math.max(limit, HELP_MERGE_DEPTH), favor, options);
      recordQuery(record, { query, sources: record.on.map((source) => ({ source, sections: source === 'keyword' ? hits : [] })), merged: hits });
      return limit === undefined ? hits : hits.slice(0, limit);
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
  /** Gets each source's ranking of each query, and the pick request, for the trace. */
  record?: HelpSearchRecord;
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
export async function helpSearch({ question, history = [], settings, snapshot, index, hint, screenRule = true, embedder, signal, fetchImpl, record }: HelpSearchQuestion): Promise<DocsIndex> {
  const on = settings.sources;
  // The embedder takes no stop signal, so Stop ends the wait for it here.
  const stopped = new Promise<null>((resolve) => signal?.addEventListener('abort', () => resolve(null), { once: true }));
  const previous = keptHistory(history, settings.historyLength).at(-1);
  const prompts = activeHelpPrompts(settings.presets);
  const prompt = renderHelpPrompt(prompts.pick, helpChipValues('pick', settings));
  const observe = record && ((spec: AiRequestSpec, result?: AiStreamResult) => { record.pick = requestTrace('AI Search', spec, isHelpPromptEdited(prompts, 'pick'), result); });
  const pickSnapshot = helpSnapshot(snapshot, helpRoutes(settings).pick, PICK_REASONING);
  const [allPicks, semantic] = await Promise.all([
    on.aiPicks
      ? requestPicks(index, { question, prompt, earlier: previous?.question, earlierAnswer: previous?.answer, where: hint?.where }, pickSnapshot, activeHelpOptions(settings.presets).pick, { signal, fetchImpl, observe }).catch(() => [])
      : [],
    on.semantic ? Promise.race([semanticRanking(index, helpQueries(question, previous), embedder), stopped]) : null,
  ]);
  const picks = screenRule ? screenPicks(question, allPicks, hint?.section) : allPicks;
  const keyword: SectionRanking = (query, limit, favor, onSurface) => index.search(query, limit, favor, { onSurface });
  const picked: SectionRanking = (_query, limit) => picks.slice(0, limit);
  const sources: NamedRanking[] = [
    ...(on.keyword ? [{ source: 'keyword' as const, ranking: keyword }] : []),
    ...(picks.length > 0 ? [{ source: 'aiPicks' as const, ranking: picked }] : []),
    ...(semantic ? [{ source: 'semantic' as const, ranking: semantic }] : []),
  ];
  if (on.keyword && sources.length === 1) return record ? recordedKeyword(index, record) : index;
  return mergedSearch(index, sources, record);
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
 * - The help dice roll joins either mode while its setting is on and the endpoint is known to take function
 *   calls. It is no source, so it never decides the mode.
 * - The face call joins either mode on the same gate while the Mascot is on and the rig has an enabled
 *   expression. It is no source either.
 * - Retrieval mode, everywhere else: one request. The capability check does not run.
 * - A bare question, when every source is off, lookup mode is off and the open screen adds no section: the
 *   question alone, with no search. A search that runs and misses still sends the empty guide block.
 *
 * The player's Formaquestion Tools that are on go with the request on the same gate, in either mode. They
 * are no source (Q51): they change neither the prompt nor the bare rule. A Tool reads the open world.
 *
 * Throws the request pipeline's errors, and an error for an empty answer.
 */
export async function* askHelp({
  question, history = [], language = '', settings, snapshot, index, surface, images = [], world = emptyToolSnapshot, screenRule, howToRule, embedder, signal, fetchImpl,
}: HelpQuestion): AsyncGenerator<HelpEvent, void, void> {
  const hint = settings.openScreen ? surfaceHint(surface, index) : null;
  const kept = keptHistory(history, settings.historyLength);
  const answerSnapshot = helpSnapshot(snapshot, helpRoutes(settings).answer, settings.reasoning, settings.reasoningBudget);
  const takesFunctions = toolsSupported(answerSnapshot.resolveTarget('help').reasoning);
  const lookupMode = settings.lookup && takesFunctions;
  const playerTools = takesFunctions ? helpToolsOn(settings.tools, settings.toolSwitches) : [];
  const face = settings.mascot && takesFunctions ? createFaceCall(activeMascotRig(settings.mascotPresets)) : null;
  // No part of the request can carry a section, so the question goes alone and its answer is never flagged.
  const bare = !hint && !lookupMode && !Object.values(settings.sources).some(Boolean);
  const record = bare ? null : emptySearchRecord((Object.keys(settings.sources) as HelpSource[]).filter((source) => settings.sources[source]));
  // The keyword search is instant. The pick request and the semantic ranking take time, and picks take the name.
  if (record && settings.sources.aiPicks) yield { type: 'stage', stage: 'picking' };
  else if (record && settings.sources.semantic) yield { type: 'stage', stage: 'searching' };
  const search = record ? await helpSearch({ question, history, settings, snapshot, index, hint, screenRule, embedder, signal, fetchImpl, record }) : index;
  if (signal?.aborted) {
    yield { type: 'done', text: '', sources: [], lead: hint?.section, stopped: true, flagged: false, nearest: [], reasoning: '' };
    return;
  }
  const inPrompt = bare ? [] : helpSections(search, question, { history: kept, lead: hint?.section, howToRule });
  const lookup = lookupMode
    ? createDocsLookup(index, { budget: HELP_LOOKUP_CHAR_BUDGET, searchLimit: HELP_SECTION_LIMIT, held: inPrompt })
    : null;
  // The active preset's text, with each chip rendered. A prompt with no chip sends none of that chip's text.
  const prompts = activeHelpPrompts(settings.presets);
  // The Code tab counts only while the open screen does.
  const codeTurn = isCodeTurn(question, settings.openScreen ? surface : null);
  const turnMessage = bare
    ? question
    : lookup ? helpLookupUserMessage(question, inPrompt, hint?.where) : helpUserMessage(question, inPrompt, hint?.where);
  const userMessage = codeTurn ? withCodeRider(turnMessage, prompts.code) : turnMessage;
  const options = activeHelpOptions(settings.presets)[lookup ? 'lookup' : 'answer'];
  // The fixed functions first, then the player's Tools. The lookup and the face call keep their own executors;
  // the roll and the Tools run on the one world snapshot of the question, which the roll does not read.
  const offered: OfferedFunction[] = [
    ...(lookup ? [{ ...DOCS_LOOKUP, callLimit: settings.lookupCallLimit }] : []),
    ...(settings.roll && takesFunctions ? [{ ...HELP_ROLL, callLimit: settings.rollCallLimit }] : []),
    ...(face ? [face.fn] : []),
    ...playerTools,
  ];
  const runTool = snapshotToolExecutor(world);
  // The offered functions without a handler, by id: each is offered only while its executor is here.
  const internal = new Map<string, ToolExecutor<OfferedFunction>>([
    ...(lookup ? [[DOCS_LOOKUP.id, lookup.execute] as const] : []),
    ...(face ? [[face.fn.id, face.execute] as const] : []),
  ]);
  const execute: ToolExecutor<OfferedFunction> = (fn, argumentsText, callSignal) =>
    (isTool(fn) ? runTool(fn, argumentsText, callSignal) : internal.get(fn.id)!(fn, argumentsText, callSignal));
  const spec = buildAiRequestSpec(answerSnapshot, {
    systemPrompt: helpSystemPrompt(language, renderHelpPrompt(lookup ? prompts.lookup : prompts.answer, helpChipValues(lookup ? 'lookup' : 'answer', settings))),
    messages: withImageParts([...historyMessages(kept), { role: 'user', content: userMessage }], images),
    requestType: 'help',
    maxTokensOverride: options.maxTokens,
    samplerOverride: { temperature: options.temperature, repetitionPenalty: options.repetitionPenalty },
    ...(offered.length > 0 && { tools: offered }),
  });
  // The trace so far. Each yield builds it anew, so a viewer that keeps an earlier one sees no later change.
  const rounds: AiToolRound[] = [];
  const customPrompt = isHelpPromptEdited(prompts, lookup ? 'lookup' : 'answer') || (codeTurn && isHelpPromptEdited(prompts, 'code'));
  const traceOf = (result?: AiStreamResult): HelpTrace => ({
    surface: surface ? surfaceWords(surface) : null,
    openScreen: settings.openScreen,
    ...(hint && { lead: traceSection(hint.section) }),
    preset: activeHelpPreset(settings.presets).name,
    search: record && searchTraceOf(record, inPrompt),
    sent: inPrompt.map(traceSection),
    requests: [...(record?.pick ? [record.pick] : []), requestTrace('Answer', spec, customPrompt, result, rounds)],
  });
  yield { type: 'trace', trace: traceOf() };
  yield { type: 'stage', stage: 'waiting' };
  let text = '';
  let marked = false;
  // Native reasoning of every round, inline reasoning of earlier rounds, and this round's content.
  let native = '';
  let earlierInline = '';
  let content = '';
  let reasoning = '';
  const reasoningNow = () => joinReasoning(native, earlierInline, extractReasoningLive(content));
  for await (const event of streamAiToolLoop(spec, { signal, fetchImpl, captureRounds: true, ...(offered.length > 0 && { execute }) })) {
    if (event.type === 'toolRound') {
      for (const id of face?.takeFaces() ?? []) yield { type: 'face', face: id };
      rounds.push(event.round);
      yield { type: 'trace', trace: traceOf() };
      yield { type: 'stage', stage: 'waiting' };
    } else if (event.type === 'toolCalls') {
      // What the model wrote before a call is not the answer, but its inline reasoning still is reasoning.
      earlierInline = joinReasoning(earlierInline, extractReasoningLive(content));
      content = '';
      if (text || marked) yield { type: 'answer', text: '', flagged: false, reasoning };
      text = '';
      marked = false;
      yield { type: 'stage', stage: 'lookingUp' };
    } else if (event.type === 'reasoning' || event.type === 'delta') {
      if (event.type === 'reasoning') native = event.text;
      else content = event.content;
      const next = readMarker(stripReasoningLive(content));
      const nextReasoning = reasoningNow();
      if (next.text === text && next.marked === marked && nextReasoning === reasoning) continue;
      ({ text, marked } = next);
      reasoning = nextReasoning;
      yield { type: 'answer', text, flagged: marked && !bare, reasoning };
    } else if (event.type === 'done') {
      native = event.result.reasoningText;
      content = event.result.content;
      const sources = [...(lookup?.fetched() ?? []), ...inPrompt];
      const stopped = event.result.finishReason === ABORTED_FINISH_REASON;
      // A Stop can land while a start of the marker is held back; that start stays hidden.
      const answer = readMarker(stripReasoningLive(event.result.content), { final: !stopped });
      // The trace goes out first, so an empty reply is in AI Context.
      yield { type: 'trace', trace: traceOf(event.result) };
      if (!answer.text && !stopped) {
        throw new Error(`The model sent an empty answer (finish reason: ${event.result.finishReason ?? 'none'})`);
      }
      const flagged = !bare && isGeneralKnowledge(answer.marked, sources.length);
      const nearest = flagged ? helpSections(search, question, { history: kept }) : [];
      yield { type: 'done', text: answer.text, sources, lead: hint?.section, stopped, flagged, nearest, reasoning: reasoningNow() };
    }
  }
}
