import type { ChatMessage, DictionaryEntry } from '@/types';
import { tilePieces, type AnatomyPiece, type AnatomyRun } from './requestAnatomy';
import type { MemoryNote } from './memoryOverrides';
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
  importance?: number; // 1-3, the selector's write-time judgment; model-relative, so ranked not read
  timeDelta?: number; // in-world hours this turn consumed (lib/gameClock); absent = the flat hour
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
  /** Digests dropped by relevance ranking instead of oldest-first (0 when semantic memory is off or
   *  the band fit its budget). */
  turnsRelevanceDropped: number;
  /** Turns restored to full text as the remembered-scene exchange (semantic rehydration). */
  turnsRehydrated: number;
}

/** One whole message as a single labeled run. Empty content gets no run, so the tiling invariant holds. */
function wholeRun(content: string, label: Pick<AnatomyRun, 'source' | 'contextLabel'>): AnatomyRun[] {
  return content ? [{ start: 0, end: content.length, ...label }] : [];
}

/** A verbatim turn's pair of runs: the action the player took, then the narration that answered it.
 *  Deliberately not two copies of one label — adjacent twins read as a bug rather than as a turn. */
function pairRuns(userContent: string, gameText: string): AnatomyRun[][] {
  return [wholeRun(userContent, { contextLabel: 'past-action' }), wholeRun(gameText, { contextLabel: 'past-narration' })];
}

export interface BandResult {
  messages: ChatMessage[];
  /** Request Anatomy runs, one list per entry of `messages`. Each list tiles its message exactly. */
  runs: AnatomyRun[][];
  /** The turn ids that survived into the digest band, chronological. Feed back as `stickyIds` next
   *  turn to give incumbents hysteresis. Empty when there is no band. */
  bandTurnIds: string[];
  /** Turn ids sent as full original prose instead of a digest (semantic rehydration). Disjoint from
   *  `bandTurnIds` — a rehydrated turn leaves the band. */
  rehydratedTurnIds: string[];
  /** The summarized-older turns as a labeled recap block (empty when no band), for consumers that want just
   *  that context. It is NOT part of `messages` — there the band rides as the recap exchange; this is a
   *  separate newline-joined string only the precall planner uses. */
  recap: string;
  counts: BandCounts;
}

/** How many of the band's newest digests are immune to ranked (relevance) dropping — the immediate
 *  scene lead-in must survive however low it scores, or a topically-hot old memory can evict the turn
 *  the scene is actually continuing from (probe: semantic-band control case). */
export const RANKED_RECENT_IMMUNE = 2;

/** Hysteresis for ranked dropping: a memory already in last turn's band scores as if multiplied by
 *  this, so a challenger must be meaningfully better to evict it rather than merely luckier. Without
 *  it the band is re-drawn from scratch every turn against a fresh action vector — measured at 57%
 *  of the free slots replaced per turn across a real 50-turn export, which is churn, not memory
 *  (docs-internal/long-session-recall-findings.md item 1a). At the 40-turn relevance half-life this
 *  margin is worth ~13 turns of age advantage. Tunable: the value wants real-session churn numbers,
 *  not a probe. */
export const STICKY_BONUS = 1.25;

/** Spread of the importance multiplier: the least important memory in the band ranks at 1/IMPORTANCE_SPREAD
 *  of the most important, all else equal. Importance is applied as a WITHIN-BAND RANK, never as the raw
 *  1-3 rating, because the rating's scale is model-relative — the same prompt separated must-keeps from
 *  drops by 0.64 on the cloud tier and 0.26 on Cydonia (milestone-select-probe, --prompt weight). Ranking
 *  keeps only the ordering, which was correct on both tiers, and discards the magnitude, which was not.
 *  Chosen above STICKY_BONUS so a genuinely pivotal memory can still displace a merely topical incumbent. */
export const IMPORTANCE_SPREAD = 1.6;

/** Map raw importance ratings to a multiplier in [1/IMPORTANCE_SPREAD, 1] by rank within the band.
 *  Unrated memories (the model omits ~1 in 5) sit at the neutral midpoint rather than the bottom, so an
 *  absent rating never costs a memory its slot. All-equal or all-absent ratings collapse to a flat 1 —
 *  the exact pre-feature ranking. */
export function importanceFactors(ids: string[], importance: Map<string, number> | null | undefined): Map<string, number> {
  const flat = new Map(ids.map((id) => [id, 1]));
  if (!importance) return flat;
  const rated = ids.map((id) => importance.get(id)).filter((v): v is number => v !== undefined);
  const distinct = [...new Set(rated)].sort((a, b) => a - b);
  if (distinct.length < 2) return flat; // nothing to order by
  const lo = 1 / IMPORTANCE_SPREAD;
  const span = 1 - lo;
  const out = new Map<string, number>();
  for (const id of ids) {
    const v = importance.get(id);
    // Rank position in [0,1]; unrated sits at the midpoint.
    const pos = v === undefined ? 0.5 : distinct.indexOf(v) / (distinct.length - 1);
    out.set(id, lo + span * pos);
  }
  return out;
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

/** The band body's pieces in chronological order: each surviving digest at its turn's position, each
 *  player-written note at its anchor. A note anchored past the last banded turn lands at the end — the
 *  standing block immediately before the verbatim floor, which is where a note written this scene
 *  belongs. Notes are never trimmed: they aren't band turns, so the budget trimmer can't see them. */
/** A stamp resolver over the same position domain the pieces sort by (see lib/gameClock). */
export type BandStamp = (pos: number) => string;

/** A band body piece and which feature wrote it — the two read alike to the model, and apart in the
 *  Request Anatomy. */
interface BandPiece {
  text: string;
  kind: 'digest' | 'note';
}

function bandPieces(turns: BandTurn[], notes: MemoryNote[] = [], stamp?: BandStamp): BandPiece[] {
  const pieces: Array<{ pos: number; order: number; text: string; kind: BandPiece['kind'] }> = [];
  for (const t of turns) pieces.push({ pos: t.index, order: 0, text: (t.summary || '').trim(), kind: 'digest' });
  // order 1 breaks a tie toward the note: it was written after that turn committed.
  for (const n of notes) pieces.push({ pos: n.anchorTurn, order: 1, text: (n.text || '').trim(), kind: 'note' });
  return pieces
    .sort((a, b) => a.pos - b.pos || a.order - b.order)
    .filter((p) => p.text)
    // The in-world time label leads each memory so the model reads when before what. A note is stamped
    // like a digest — it sits at an anchor in the same chronology and reads as one.
    .map((p) => {
      const label = stamp?.(p.pos)?.trim();
      return { text: label ? `${label} ${p.text}` : p.text, kind: p.kind };
    });
}

/** The recap exchange's assistant reply, and the runs over it: each body piece under the feature that
 *  wrote it, the now-line under the editor that owns it. The joins ride with the text they join, so the
 *  now-line's run starts on its own first character. */
function recapReplyTiled(pieces: BandPiece[], nowLine?: string): { content: string; runs: AnatomyRun[] } {
  const parts: AnatomyPiece[] = [];
  pieces.forEach((piece, i) => {
    if (i > 0) parts.push({ text: ' ', glue: true });
    parts.push({ text: piece.text, contextLabel: piece.kind === 'note' ? 'notes' : 'condensed' });
  });
  if (nowLine) {
    parts.push({ text: '\n\n', glue: true }, { text: nowLine, source: 'now' });
  }
  return tilePieces(parts);
}

/** The digests joined into the recap exchange's assistant reply. Space-joined — the exact merged form
 *  the digest-framing probe validated (newline-join is untested). */
function mergedBandText(turns: BandTurn[], notes: MemoryNote[] = [], stamp?: BandStamp): string {
  return bandPieces(turns, notes, stamp).map((p) => p.text).join(' ');
}

/** The token cost of the whole digest band as it actually rides: one recap-question user line plus the
 *  merged digests (and the now-line closer, when set) as the assistant reply. 0 when there is nothing to
 *  say — no surviving digest and no note (no exchange is emitted). */
function bandExchangeCost(turns: BandTurn[], recapPrompt: string, nowLine?: string, notes: MemoryNote[] = [], stamp?: BandStamp): number {
  const body = mergedBandText(turns, notes, stamp);
  if (!body) return 0;
  const pair: ChatMessage[] = [
    { role: 'user', content: recapPrompt },
    { role: 'assistant', content: nowLine ? `${body}\n\n${nowLine}` : body },
  ];
  return estimateTokens(JSON.stringify(pair).length);
}

/** Join the band body into the planner's recap block (chronological, one piece per line). */
function buildBandText(turns: BandTurn[], notes: MemoryNote[] = [], stamp?: BandStamp): string {
  return bandPieces(turns, notes, stamp).map((p) => p.text).join('\n');
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
      importance: parsed.importance,
      timeDelta: parsed.timeDelta,
    });
  }
  return turns;
}

/** Legacy assembly: pack recent turns verbatim newest-first until the budget runs out, dropping the
 *  rest. Returned chronological. Used when banding is off — kept here so the off path is testable too.
 *
 *  Player-written notes still ride with banding off: with no band to anchor into, chronology has nothing
 *  to mean, so they lead as one standing block ahead of the verbatim history. Their cost comes off the
 *  budget first — a note is player intent and outranks an extra old turn. */
export function buildVerbatimHistory(
  turns: BandTurn[],
  contextWindow: number,
  promptTokens: number,
  maxTokens: number,
  notes: MemoryNote[] = [],
  recapPrompt = '',
): { messages: ChatMessage[]; runs: AnatomyRun[][] } {
  const margin = Math.max(256, Math.round(contextWindow * 0.05));
  let budget = Math.max(0, contextWindow - promptTokens - maxTokens - margin);
  const noteBody = notes.map((n) => (n.text || '').trim()).filter(Boolean).join(' ');
  const lead: ChatMessage[] = [];
  const leadRuns: AnatomyRun[][] = [];
  if (noteBody && recapPrompt) {
    lead.push({ role: 'user', content: recapPrompt }, { role: 'assistant', content: noteBody });
    leadRuns.push(wholeRun(recapPrompt, { source: 'recap' }), wholeRun(noteBody, { contextLabel: 'notes' }));
    budget = Math.max(0, budget - estimateTokens(JSON.stringify(lead).length));
  }
  const out: ChatMessage[] = [];
  const outRuns: AnatomyRun[][] = [];
  let used = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const cost = pairTokenCost(turns[i]);
    if (used + cost > budget) break;
    out.unshift(turns[i].userMsg, { role: 'assistant', content: turns[i].gameText });
    outRuns.unshift(...pairRuns(turns[i].userMsg.content, turns[i].gameText));
    used += cost;
  }
  return { messages: [...lead, ...out], runs: [...leadRuns, ...outRuns] };
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
  /** Relevance score per turnId (semantic memory: cosine-to-current-action × recency decay, built by
   *  lib/memoryRelevance). When present AND covering every band turn, budget trimming drops the
   *  lowest-scored memory instead of the oldest. Null/absent/incomplete = oldest-first, the exact
   *  pre-feature path — cold caches and disabled settings fail open, never fail-drop. */
  relevanceScores?: Map<string, number> | null;
  /** Always-on top-K band (roadmap step 3): cap the digest band at this many memories every turn,
   *  keeping the most relevant, even when the band fits the budget — smaller prompts, denser signal.
   *  Only acts in scored mode (a cap without relevance scores would blind-trim by age, which the
   *  feature never promises); protected ends (opening + newest RANKED_RECENT_IMMUNE) can't drop, so
   *  an effective floor of 1 + RANKED_RECENT_IMMUNE applies. 0/null/absent = no cap. */
  bandCap?: number | null;
  /** Last turn's band membership (`BandResult.bandTurnIds`). Members rank as if scored STICKY_BONUS×
   *  higher, so the band drifts instead of being re-drawn every turn. Only acts in scored mode, and
   *  never overrides the protected ends. Null/absent/empty = no hysteresis, the pre-feature path. */
  stickyIds?: Set<string> | null;
  /** Semantic rehydration (roadmap step 2): the turnIds worth restoring to full text for this action,
   *  best-first, already threshold-gated and near-duplicate-filtered by lib/semanticRehydration. The
   *  band takes as many as fit `rehydrateCap` tokens (up to `maxRehydrations`), removes them from the
   *  digest band, and rides them as ONE framed remembered-scene exchange after the recap — never as
   *  live-looking history (the dead-Jim guard). Null/absent/empty = no rehydration. */
  semanticRehydrate?: string[] | null;
  /** The framed exchange's user line ("Recall the earlier scene…"); required when semanticRehydrate
   *  is non-empty. */
  rehydratePrompt?: string;
  /** Player-written memories (lib/memoryOverrides), tombstones already removed. They ride in the recap
   *  body at their anchor, read to the model exactly like a digest, and are never judged or trimmed —
   *  they leave only when the player deletes them. Absent/empty = the pre-feature body. */
  notes?: MemoryNote[];
  /** In-world time labels for the digest band: maps a memory's position to a stamp like
   *  `[Day 3, evening — two days ago]`, prefixed to each piece so the model reads when before what
   *  (lib/gameClock). Costed with the band, so a stamped band is trimmed against its real size. The
   *  verbatim floor is never stamped — that is the live scene, not a memory. Absent = unstamped, the
   *  exact pre-feature body. */
  stamp?: BandStamp;
}): BandResult {
  // `keywords` and `actionEntities` are intentionally not destructured: lexical rehydration stays
  // disabled (see step 3). Kept in the arg type so callers compile unchanged.
  const { turns, contextWindow, promptTokens, maxTokens, verbatimFloor, milestoneDrop = null, recapPrompt, nowLine, relevanceScores = null, bandCap = null, stickyIds = null, semanticRehydrate = null, rehydratePrompt = '', rehydrateCap, maxRehydrations = Infinity, notes = [], stamp } = args;
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
  let bandTokens = bandExchangeCost(bandTurns, recapPrompt, nowLine, notes, stamp);
  // Scored trimming engages only when every band turn is covered — a partial map (embedding cache still
  // warming) must not rank some turns and default others, or stages could disagree on what dropped.
  const scored = relevanceScores !== null && bandTurns.every((t) => t.turnId && relevanceScores.has(t.turnId));
  let turnsRelevanceDropped = 0;
  // Ranked drop protects both ends of the band: index 0 (the story's opening — losing it makes the
  // recap start mid-scene and models write a fresh establishing scene over the live one, same guard
  // as resolveMilestoneKeep) and the newest RANKED_RECENT_IMMUNE digests (the immediate scene
  // lead-in — the probe's control case showed a topical old memory can outscore it, same failure
  // class). Only the middle competes on relevance; an all-protected band has nothing to rank-drop.
  // Effective rank score: raw relevance, lifted for last turn's incumbents so eviction needs a real
  // margin rather than a fresh action vector's noise (see STICKY_BONUS).
  // Importance ranks are computed once over the band as it stands before trimming, so a memory's
  // factor doesn't shift as its neighbors are evicted around it.
  const impFactor = importanceFactors(
    bandTurns.map((t) => t.turnId).filter((id): id is string => !!id),
    new Map(bandTurns.flatMap((t) => (t.turnId && t.importance !== undefined ? [[t.turnId, t.importance] as const] : []))),
  );
  const rankScore = (t: BandTurn): number => {
    const raw = relevanceScores!.get(t.turnId!)! * (impFactor.get(t.turnId!) ?? 1);
    return stickyIds && t.turnId && stickyIds.has(t.turnId) ? raw * STICKY_BONUS : raw;
  };
  const dropLowestEligible = (): boolean => {
    if (!scored) return false;
    const lastEligible = bandTurns.length - 1 - RANKED_RECENT_IMMUNE;
    if (lastEligible < 1) return false;
    let lowest = 1;
    for (let i = 2; i <= lastEligible; i++) {
      if (rankScore(bandTurns[i]) < rankScore(bandTurns[lowest])) lowest = i;
    }
    bandTurns = bandTurns.slice(0, lowest).concat(bandTurns.slice(lowest + 1));
    turnsRelevanceDropped++;
    return true;
  };
  while (bandTokens > remaining && bandTurns.length > 0) {
    if (!dropLowestEligible()) bandTurns = bandTurns.slice(1); // fall back: drop the oldest
    bandTokens = bandExchangeCost(bandTurns, recapPrompt, nowLine, notes, stamp);
  }
  // Always-on top-K cap (step 3): even a band that fits gets trimmed to the K most relevant memories.
  // Scored mode only, and the protected ends set the effective floor.
  if (bandCap && bandCap > 0) {
    const floor = Math.max(bandCap, 1 + RANKED_RECENT_IMMUNE);
    while (bandTurns.length > floor && dropLowestEligible()) { /* trimmed in dropLowestEligible */ }
    bandTokens = bandExchangeCost(bandTurns, recapPrompt, nowLine, notes, stamp);
  }

  // 3. Rehydration. Lexical selection stays DISABLED — keyed on the charged action it pulled ~6
  //    near-identical "poised / about-to" tableaux back verbatim, the confirmed charged-scene-freeze
  //    driver (real-app A/B on Cydonia-24B). `selectRehydrations` and the scorers are kept for reference.
  //    SEMANTIC rehydration replaces it: the caller hands in an already-deduped best-first turnId list
  //    (lib/semanticRehydration — near-duplicate guard against chosen set AND floor); here we only apply
  //    the token budget, pull the turns out of the digest band, and (below) frame them as memory.
  const rehydratedTurns: BandTurn[] = [];
  let rehydratedTokens = 0;
  if (semanticRehydrate && semanticRehydrate.length > 0) {
    const rehydrateBudget = Math.min(rehydrateCap, Math.max(0, remaining - bandTokens));
    const byId = new Map(bandTurns.filter((t) => t.turnId).map((t) => [t.turnId!, t]));
    for (const id of semanticRehydrate) {
      if (rehydratedTurns.length >= maxRehydrations) break;
      const t = byId.get(id);
      if (!t) continue; // not in the band (already floor, milestone-dropped since scoring, or trimmed)
      const cost = estimateTokens(JSON.stringify([{ role: 'user', content: rehydratePrompt }, { role: 'assistant', content: t.gameText }]).length);
      if (rehydratedTokens + cost > rehydrateBudget) continue; // try a smaller scene rather than stopping
      rehydratedTurns.push(t);
      rehydratedTokens += cost;
    }
    if (rehydratedTurns.length > 0) {
      // Rehydrated turns leave the band so the same event isn't in context twice (once compressed,
      // once full). Band cost shrinks; no re-trim needed — removal only frees tokens.
      const chosen = new Set(rehydratedTurns.map((t) => t.turnId));
      bandTurns = bandTurns.filter((t) => !chosen.has(t.turnId));
      bandTokens = bandExchangeCost(bandTurns, recapPrompt, nowLine, notes, stamp);
    }
  }

  // Assemble: the recap exchange first (older events condensed), then the remembered-scene exchange
  // (rehydrated turns, chronological, as ONE framed question/answer — explicitly the past, never
  // live-looking pairs: position reads as time and a vivid old scene would otherwise overrule the
  // recap's later facts, e.g. a character who has since died walks again), then the recent floor as
  // real user/assistant pairs. Strict alternation stays valid on any endpoint. The digests deliberately
  // do NOT ride as per-turn pairs: many short "own replies" in a row measurably collapse small-model
  // narration length (see module header); answered to a recap question, the short style belongs to a
  // different task.
  const messages: ChatMessage[] = [];
  const runs: AnatomyRun[][] = [];
  const pieces = bandPieces(bandTurns, notes, stamp);
  if (pieces.length > 0) {
    const reply = recapReplyTiled(pieces, nowLine);
    messages.push({ role: 'user', content: recapPrompt }, { role: 'assistant', content: reply.content });
    runs.push(wholeRun(recapPrompt, { source: 'recap' }), reply.runs);
  }
  if (rehydratedTurns.length > 0) {
    const scenes = [...rehydratedTurns].sort((a, b) => a.index - b.index).map((t) => t.gameText).join('\n\n');
    messages.push({ role: 'user', content: rehydratePrompt }, { role: 'assistant', content: scenes });
    runs.push(wholeRun(rehydratePrompt, { source: 'recall' }), wholeRun(scenes, { contextLabel: 'recalled' }));
  }
  const ordered = [...floorTaken].sort((a, b) => a.index - b.index);
  for (const t of ordered) {
    messages.push({ ...t.userMsg }, { role: 'assistant', content: t.gameText });
    runs.push(...pairRuns(t.userMsg.content, t.gameText));
  }

  const bandText = buildBandText(bandTurns, notes, stamp);
  return {
    messages,
    runs,
    bandTurnIds: bandTurns.map((t) => t.turnId).filter((id): id is string => !!id),
    rehydratedTurnIds: rehydratedTurns.map((t) => t.turnId).filter((id): id is string => !!id),
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
      turnsRelevanceDropped,
      turnsRehydrated: rehydratedTurns.length,
    },
  };
}
