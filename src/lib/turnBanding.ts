import type { ChatMessage, DictionaryEntry } from '@/types';
import { parseTurnContent } from './turnDigest';
import { getActivatedDictionary, parseKeywords } from './dictionaryUtils';
import { estimateTokens } from './memoryUtils';
import { containsWord } from './locationMatch';

/**
 * Pure core of Slice 2 memory banding: turns the flat chat history into a budgeted, layered history.
 *
 * Layers (each turn appears in exactly one):
 *   1. Recent **verbatim floor** — the last K turns, always full (guaranteed first).
 *   2. **Digest band** — a single "Earlier events" recap of older turns' summaries, folded into the first
 *      upcoming user turn as context (guaranteed next; oldest lines trimmed if it overflows). It rides a
 *      user message, not a standalone assistant one, so small models don't copy it as their own output.
 *   3. **Rehydration** — older turns the current action lexically touches, restored to full text
 *      (best-effort, from whatever budget is left).
 *   4. Drop — older turns with no digest, or beyond budget.
 *
 * The digest is only a pointer: when an old turn matters again it's rehydrated from its real text, so a
 * hallucinated summary is never load-bearing. Kept React-free so the index/budget math is unit-testable.
 */

/** A parsed user→assistant turn from the flat history. `index` is the assistant message's position
 *  (ascending = chronological). */
export interface BandTurn {
  index: number;
  turnId?: string;
  userMsg: ChatMessage;
  gameText: string;
  summary?: string;
  entities?: string[]; // participants recorded on this turn (drives entity-based rehydration)
}

export interface BandCounts {
  floorTokens: number;
  rehydratedTokens: number;
  bandTokens: number;
  turnsVerbatim: number;
  turnsBanded: number;
  turnsTotal: number;
}

export interface BandResult {
  messages: ChatMessage[];
  /** The recap text alone (empty when no band), for consumers that want just the summarized-older
   *  context; in `messages` it is folded into the first upcoming user turn. */
  recap: string;
  counts: BandCounts;
}

/** Common words that carry no retrieval signal; dropped from lexical keywords (1–2 char words are
 *  already excluded by the length floor). */
const STOPWORDS = new Set([
  'the', 'and', 'you', 'your', 'yours', 'with', 'that', 'this', 'have', 'has', 'had', 'from', 'what',
  'when', 'where', 'were', 'was', 'are', 'for', 'but', 'not', 'into', 'out', 'his', 'her', 'she', 'him',
  'they', 'them', 'then', 'than', 'who', 'how', 'why', 'all', 'any', 'can', 'will', 'would', 'could',
  'should', 'just', 'now', 'get', 'got', 'about', 'after', 'before', 'over', 'under', 'here', 'there',
  'their', 'our', 'its', 'been', 'being', 'does', 'did', 'done', 'onto', 'off', 'around', 'because',
  'player', 'action',
]);

/** The token cost of restoring a turn to full verbatim (user message + assistant narration), measured
 *  the same way the legacy trimmer measured a pair so budgets stay consistent. */
function pairTokenCost(turn: BandTurn): number {
  const assistant: ChatMessage = { role: 'assistant', content: turn.gameText };
  return estimateTokens(JSON.stringify([turn.userMsg, assistant]).length);
}

/** Join turns' summaries into the recap body (chronological, one turn per join). */
function buildBandText(turns: BandTurn[]): string {
  return turns
    .map((t) => (t.summary || '').trim())
    .filter(Boolean)
    .join('\n');
}

/** Walk the flat history in user→assistant pairs and parse each assistant turn's JSON. Unparseable or
 *  mis-roled pairs are skipped (mirrors the legacy trimmer). */
export function parseTurns(history: ChatMessage[]): BandTurn[] {
  const turns: BandTurn[] = [];
  for (let i = 1; i < history.length; i += 2) {
    const userMsg = history[i - 1];
    const assistantMsg = history[i];
    if (!userMsg || userMsg.role !== 'user') continue;
    if (!assistantMsg || assistantMsg.role !== 'assistant') continue;
    const parsed = parseTurnContent(assistantMsg.content);
    if (!parsed) continue;
    turns.push({
      index: i,
      turnId: parsed.turnId,
      userMsg,
      gameText: parsed.narration ?? '',
      summary: parsed.summary,
      entities: parsed.entities,
    });
  }
  return turns;
}

/** Legacy assembly: pack recent turns verbatim newest-first until the budget runs out, dropping the
 *  rest. Returned chronological. Used when banding is off — kept here so the off path is testable too. */
export function buildVerbatimHistory(
  turns: BandTurn[],
  contextWindow: number,
  promptTokens: number,
  maxTokens: number,
): ChatMessage[] {
  const margin = Math.max(256, Math.round(contextWindow * 0.05));
  const budget = Math.max(0, contextWindow - promptTokens - maxTokens - margin);
  const out: ChatMessage[] = [];
  let used = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const cost = pairTokenCost(turns[i]);
    if (used + cost > budget) break;
    out.unshift(turns[i].userMsg, { role: 'assistant', content: turns[i].gameText });
    used += cost;
  }
  return out;
}

/** Significant keywords from `text` (lowercased, length ≥ 3, minus stopwords) unioned with the
 *  keywords of any Lore-Dictionary entry the text activates — so retrieval keys on both plain words
 *  and the world's named entities. Deduped. */
export function extractKeywords(text: string, dictionary: DictionaryEntry[] = []): string[] {
  const keywords = new Set<string>();
  for (const raw of (text || '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) keywords.add(raw);
  }
  for (const entry of getActivatedDictionary(dictionary, [text])) {
    for (const kw of parseKeywords(entry)) keywords.add(kw.toLowerCase());
  }
  return [...keywords];
}

/** How many keywords appear (word-bounded) in a turn's digest. 0 = no lexical overlap. */
export function scoreTurnDigest(turn: BandTurn, keywords: string[]): number {
  if (!turn.summary) return 0;
  const hay = turn.summary.toLowerCase();
  return keywords.reduce((n, kw) => (containsWord(hay, kw) ? n + 1 : n), 0);
}

/** How many of the action's entities took part in this turn (intersection of `actionEntities` with the
 *  turn's stored participants). 0 = the turn doesn't involve any character the action references. */
export function scoreTurnEntities(turn: BandTurn, actionEntities: string[]): number {
  if (!turn.entities || turn.entities.length === 0 || actionEntities.length === 0) return 0;
  const have = new Set(turn.entities.map((e) => e.toLowerCase()));
  return actionEntities.reduce((n, e) => (have.has(e.toLowerCase()) ? n + 1 : n), 0);
}

/** Choose which candidate turns to rehydrate. A turn qualifies if it shares an entity with the action
 *  (participation) OR its digest overlaps the keywords; ordered entity-hit first, then keyword score, then
 *  recency. Accumulates full-turn cost up to `tokenCap` and at most `maxCount` turns. Returns their
 *  turnIds. */
export function selectRehydrations(
  candidates: BandTurn[],
  keywords: string[],
  actionEntities: string[],
  tokenCap: number,
  maxCount = Infinity,
): Set<string> {
  const scored = candidates
    .map((t) => ({ t, score: scoreTurnDigest(t, keywords), eScore: scoreTurnEntities(t, actionEntities) }))
    .filter((s) => s.score > 0 || s.eScore > 0)
    .sort((a, b) => b.eScore - a.eScore || b.score - a.score || b.t.index - a.t.index);
  const chosen = new Set<string>();
  let used = 0;
  for (const { t } of scored) {
    if (chosen.size >= maxCount) break;
    if (!t.turnId) continue;
    const cost = pairTokenCost(t);
    if (used + cost > tokenCap) continue; // try smaller turns rather than stopping outright
    chosen.add(t.turnId);
    used += cost;
  }
  return chosen;
}

/** Assemble the banded history: verbatim floor (guaranteed) → digest band (guaranteed) → rehydrated
 *  relevant turns (best-effort) → drop. Output is `[band?, ...verbatim turns chronological]`; the
 *  caller appends the current action. */
export function buildBandedHistory(args: {
  turns: BandTurn[];
  contextWindow: number;
  promptTokens: number;
  maxTokens: number;
  verbatimFloor: number;
  keywords: string[];
  actionEntities: string[];
  rehydrateCap: number;
  maxRehydrations?: number;
}): BandResult {
  const { turns, contextWindow, promptTokens, maxTokens, verbatimFloor, keywords, actionEntities, rehydrateCap, maxRehydrations = Infinity } = args;
  const margin = Math.max(256, Math.round(contextWindow * 0.05));
  const budget = Math.max(0, contextWindow - promptTokens - maxTokens - margin);

  // 1. Recent verbatim floor — newest-first, capped by K and budget.
  const floorTaken: BandTurn[] = [];
  let floorTokens = 0;
  for (let i = turns.length - 1; i >= 0 && floorTaken.length < verbatimFloor; i--) {
    const cost = pairTokenCost(turns[i]);
    if (floorTokens + cost > budget) break;
    floorTaken.unshift(turns[i]);
    floorTokens += cost;
  }
  // Everything not taken verbatim (older than the floor, or a floor turn that didn't fit).
  const candidates = turns.slice(0, turns.length - floorTaken.length);
  const remaining = budget - floorTokens;

  // 2. Digest band (guaranteed) — older turns carrying a summary, oldest lines trimmed to fit.
  let bandTurns = candidates.filter((t) => t.summary && t.summary.trim());
  let bandTokens = estimateTokens(buildBandText(bandTurns).length);
  while (bandTokens > remaining && bandTurns.length > 0) {
    bandTurns = bandTurns.slice(1); // drop the oldest
    bandTokens = estimateTokens(buildBandText(bandTurns).length);
  }

  // 3. Rehydration (best-effort) — pull relevant band turns back to full text within leftover budget.
  const rehydrateBudget = Math.min(rehydrateCap, Math.max(0, remaining - bandTokens));
  const chosen = selectRehydrations(bandTurns, keywords, actionEntities, rehydrateBudget, maxRehydrations);
  const rehydratedTurns = bandTurns.filter((t) => t.turnId && chosen.has(t.turnId));
  let rehydratedTokens = 0;
  for (const t of rehydratedTurns) rehydratedTokens += pairTokenCost(t);
  // Rehydrated turns leave the band so they aren't duplicated.
  bandTurns = bandTurns.filter((t) => !(t.turnId && chosen.has(t.turnId)));
  const bandText = buildBandText(bandTurns);
  bandTokens = estimateTokens(bandText.length);

  // Assemble: verbatim turns (rehydrated-older + floor-recent) in chronological order, with the recap of
  // older turns folded into the first upcoming user turn as context. It is NOT a standalone assistant
  // message: small models copy the last assistant turn's shape and echo the recap's headings instead of
  // narrating. Folding it into a user turn keeps strict user/assistant alternation (valid on any
  // OpenAI-compatible endpoint) and reads as provided context, not the model's own prior output.
  const verbatim = [...rehydratedTurns, ...floorTaken].sort((a, b) => a.index - b.index);
  const messages: ChatMessage[] = [];
  const recap = bandText ? `Earlier events (context):\n${bandText}` : '';
  if (verbatim.length > 0) {
    verbatim.forEach((t, i) => {
      const content = i === 0 && recap ? `${recap}\n\n${t.userMsg.content}` : t.userMsg.content;
      messages.push({ ...t.userMsg, content }, { role: 'assistant', content: t.gameText });
    });
  } else if (recap) {
    // No verbatim turns to attach to — emit the recap as a lone user context message.
    messages.push({ role: 'user', content: recap });
  }

  return {
    messages,
    // The recap text on its own (empty when there is no band), for consumers (the precall planner) that
    // want just the summarized-older context without digging it back out of the folded user message.
    recap,
    counts: {
      floorTokens,
      rehydratedTokens,
      bandTokens,
      turnsVerbatim: verbatim.length,
      turnsBanded: bandTurns.length,
      turnsTotal: turns.length,
    },
  };
}
