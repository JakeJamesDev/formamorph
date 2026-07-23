import type { ChatMessage, DictionaryEntry } from '@/types';
import { parseTurnContent } from './turnDigest';
import { getActivatedDictionary, parseKeywords } from './dictionaryUtils';
import { estimateTokens } from './memoryUtils';
import { containsWord } from './locationMatch';

/**
 * Pure core of Slice 2 memory banding: turns the flat chat history into a budgeted, layered history.
 *
 * The result is full where it matters and condensed where it doesn't:
 *   1. Recent **verbatim floor** — the last K turns, always full (guaranteed), each its own
 *      user/assistant pair.
 *   2. **Rehydration** — older turns the current action lexically touches, restored to full text
 *      (best-effort, from whatever budget is left).
 *   3. **Digest band** — remaining older turns' summaries merged into ONE leading exchange: a recap
 *      question as the user line, the digests joined as the assistant reply (oldest dropped if the
 *      band overflows). Digests must NOT ride as per-turn pairs: a history of many short "own replies"
 *      drags small models into matching that length — measured on a real collapsed turn, paired
 *      digests averaged 40 words/turn vs ~125 for the merged recap exchange (digest-framing-probe.mjs).
 *      Framed as a recap answer, the short style reads as a different task, not a narration exemplar.
 *   4. Drop — older turns with no summary, or beyond budget.
 *
 * A digest is still only a pointer: when an old turn matters again it's rehydrated from its real text,
 * so a hallucinated summary is never load-bearing. Kept React-free so the index/budget math is
 * unit-testable.
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

/** Per-layer token spend and turn tallies for one banding run, for the debug/telemetry view.
 *  `turnsVerbatim` counts rehydrated + recent-floor turns; the three layers plus dropped turns sum to
 *  `turnsTotal`. */
export interface BandCounts {
  floorTokens: number;
  rehydratedTokens: number;
  bandTokens: number;
  turnsVerbatim: number;
  turnsBanded: number;
  turnsTotal: number;
  /** Old-band digests removed by milestone selection (0 when selection is off or kept everything). */
  turnsSelectedOut: number;
}

export interface BandResult {
  messages: ChatMessage[];
  /** The summarized-older turns as a labeled recap block (empty when no band), for consumers that want just
   *  that context. It is NOT part of `messages` — there the band rides as the recap exchange; this is a
   *  separate newline-joined string only the precall planner uses. */
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

/** The digests joined into the recap exchange's assistant reply. Space-joined — the exact merged form
 *  the digest-framing probe validated (newline-join is untested). */
function mergedBandText(turns: BandTurn[]): string {
  return turns.map((t) => (t.summary || '').trim()).filter(Boolean).join(' ');
}

/** The token cost of the whole digest band as it actually rides: one recap-question user line plus the
 *  merged digests (and the now-line closer, when set) as the assistant reply. 0 when the band is empty
 *  (no exchange is emitted). */
function bandExchangeCost(turns: BandTurn[], recapPrompt: string, nowLine?: string): number {
  if (turns.length === 0) return 0;
  const body = mergedBandText(turns);
  const pair: ChatMessage[] = [
    { role: 'user', content: recapPrompt },
    { role: 'assistant', content: nowLine ? `${body}\n\n${nowLine}` : body },
  ];
  return estimateTokens(JSON.stringify(pair).length);
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

/** Assemble the banded history: verbatim floor (guaranteed) → digest band (guaranteed) → drop. Output is
 *  `[recap exchange?, ...verbatim turns chronological]`; the caller appends the current action. Rehydration
 *  (pulling relevant older turns back to full text) is currently DISABLED — see step 3. */
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
  /** The recap exchange's user line (Settings → Prompts → Narration → Recap; default in GamePrompts). */
  recapPrompt: string;
  /** Optional "where things stand" closer appended to the recap reply: a code-built present-state
   *  sentence (location, who is present, standing player notes). The recap alone is a chronicle —
   *  without a stated *now*, models have re-opened a live scene as a fresh arrival and lost standing
   *  frame facts (probed on real failure turns via now-line-probe.mjs). Only rides when a band exists. */
  nowLine?: string;
  /** Turn ids removed by milestone selection (selection + pins already resolved by the caller — see
   *  lib/milestoneMemory). Absent/empty = no filtering, the pre-milestone behavior. The caller owns the
   *  window math so every stage filters the exact same turns regardless of its own floor width. */
  milestoneDrop?: Set<string> | null;
}): BandResult {
  // `keywords`, `actionEntities`, `rehydrateCap`, `maxRehydrations` are intentionally not destructured:
  // rehydration is disabled (see step 3). Kept in the arg type so callers compile unchanged.
  const { turns, contextWindow, promptTokens, maxTokens, verbatimFloor, milestoneDrop = null, recapPrompt, nowLine } = args;
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

  // 2. Digest band (guaranteed) — older turns carrying a summary, oldest turns dropped to fit. Sized as
  // it actually rides: one recap exchange (question + merged digests), not per-turn pairs.
  // Milestone selection: the caller hands in the exact turn ids to remove (recent digests past the
  // floor always survive by construction — they are never in the drop set). No selection yet = empty
  // set = keep everything: fail-safe, never fail-drop.
  let bandTurns = candidates.filter((t) => t.summary && t.summary.trim());
  let turnsSelectedOut = 0;
  if (milestoneDrop && milestoneDrop.size > 0) {
    const kept = bandTurns.filter((t) => !t.turnId || !milestoneDrop.has(t.turnId));
    turnsSelectedOut = bandTurns.length - kept.length;
    bandTurns = kept;
  }
  let bandTokens = bandExchangeCost(bandTurns, recapPrompt, nowLine);
  while (bandTokens > remaining && bandTurns.length > 0) {
    bandTurns = bandTurns.slice(1); // drop the oldest
    bandTokens = bandExchangeCost(bandTurns, recapPrompt, nowLine);
  }

  // 3. Rehydration — DISABLED. Keyed on the current (charged) action, lexical rehydration pulled many
  //    near-identical prior charged turns back to full verbatim, packing the narration context with ~6
  //    repeated "poised / about-to" tableaux — the confirmed driver of the charged-scene freeze (real-app
  //    A/B on Cydonia-24B: fewer full charged turns advanced, more froze). Off wholesale until redesigned.
  //    TODO(rehydration): re-enable behind a smarter selector — dedupe near-duplicate charged turns and cap
  //    how many charged turns may be verbatim — then restore the AI-Context "Rehydrated" row + the
  //    Hydrations highlight toggle in GameViewer. `selectRehydrations` and the scorers are kept for that.
  // const rehydrateBudget = Math.min(rehydrateCap, Math.max(0, remaining - bandTokens));
  // const chosen = selectRehydrations(bandTurns, keywords, actionEntities, rehydrateBudget, maxRehydrations);
  const rehydratedTurns: BandTurn[] = [];
  const rehydratedTokens = 0;

  // Assemble: the recap exchange first (older events condensed), then full turns (rehydrated + recent
  // floor) chronological, each as its real user/assistant pair. Strict alternation stays valid on any
  // endpoint — the recap question is a genuine user turn. The digests deliberately do NOT ride as
  // per-turn pairs: many short "own replies" in a row measurably collapse small-model narration length
  // (see module header); answered to a recap question, the short style belongs to a different task.
  const messages: ChatMessage[] = [];
  const bandBody = mergedBandText(bandTurns);
  if (bandBody) {
    const reply = nowLine ? `${bandBody}\n\n${nowLine}` : bandBody;
    messages.push({ role: 'user', content: recapPrompt }, { role: 'assistant', content: reply });
  }
  const ordered = [...rehydratedTurns, ...floorTaken].sort((a, b) => a.index - b.index);
  for (const t of ordered) {
    messages.push({ ...t.userMsg }, { role: 'assistant', content: t.gameText });
  }

  const bandText = buildBandText(bandTurns);
  return {
    messages,
    // The summarized-older turns as a labeled block (empty when there is no band), for consumers (the
    // precall planner) that want just that recap as context without walking the message pairs. This label
    // rides only the planner's own user message — it never appears in the narration history above.
    recap: bandText ? `Earlier events:\n${bandText}` : '',
    counts: {
      floorTokens,
      rehydratedTokens,
      bandTokens,
      turnsVerbatim: rehydratedTurns.length + floorTaken.length,
      turnsBanded: bandTurns.length,
      turnsTotal: turns.length,
      turnsSelectedOut,
    },
  };
}
