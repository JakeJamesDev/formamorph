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
 *   2. **Digest band** — a single "Story so far" recap of older turns' summaries (guaranteed next,
 *      oldest lines trimmed if it overflows).
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

/** The token cost of restoring a turn to full verbatim (user message + assistant game_text), measured
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
      gameText: parsed.game_text ?? '',
      summary: parsed.summary,
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

/** Choose which candidate turns to rehydrate: those whose digest overlaps the keywords, best score
 *  first then most recent, accumulating full-turn cost up to `tokenCap` and at most `maxCount` turns.
 *  Rehydration is a small, targeted augmentation — the count cap keeps a noisy keyword set from pulling
 *  the whole history back verbatim. Returns their turnIds. */
export function selectRehydrations(
  candidates: BandTurn[],
  keywords: string[],
  tokenCap: number,
  maxCount = Infinity,
): Set<string> {
  const scored = candidates
    .map((t) => ({ t, score: scoreTurnDigest(t, keywords) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.t.index - a.t.index);
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
  rehydrateCap: number;
  maxRehydrations?: number;
}): BandResult {
  const { turns, contextWindow, promptTokens, maxTokens, verbatimFloor, keywords, rehydrateCap, maxRehydrations = Infinity } = args;
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
  const chosen = selectRehydrations(bandTurns, keywords, rehydrateBudget, maxRehydrations);
  const rehydratedTurns = bandTurns.filter((t) => t.turnId && chosen.has(t.turnId));
  let rehydratedTokens = 0;
  for (const t of rehydratedTurns) rehydratedTokens += pairTokenCost(t);
  // Rehydrated turns leave the band so they aren't duplicated.
  bandTurns = bandTurns.filter((t) => !(t.turnId && chosen.has(t.turnId)));
  const bandText = buildBandText(bandTurns);
  bandTokens = estimateTokens(bandText.length);

  // Assemble: recap block, then verbatim turns (rehydrated-older + floor-recent) in chronological order.
  const verbatim = [...rehydratedTurns, ...floorTaken].sort((a, b) => a.index - b.index);
  const messages: ChatMessage[] = [];
  // The recap is the narrator's own prior summary, so it reads as an assistant message, not player input.
  if (bandText) messages.push({ role: 'assistant', content: `Story so far (earlier events):\n${bandText}` });
  for (const t of verbatim) {
    messages.push(t.userMsg, { role: 'assistant', content: t.gameText });
  }

  return {
    messages,
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
