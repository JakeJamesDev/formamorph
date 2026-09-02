import type { BandTurn } from './turnBanding';

/**
 * Pure helpers for milestone memory: the AI selects (never rewrites) which old-band digests survive as
 * long-term history. The selector's reply is a keep-index list over the numbered digests; code maps the
 * indices back to turn ids and assembles the survivors verbatim. A malformed reply resolves to null,
 * which callers treat as keep-everything (fail-safe, never fail-drop). Player pins override the
 * selection in both directions. Design: docs-internal/designs/milestone-memory/design.md.
 */

/** How many summarized turns past the verbatim floor ride unfiltered before the milestone band begins.
 *  Zero: selection judges every digest as soon as it leaves the verbatim floor — useless history is
 *  never kept, which is the feature's whole point. */
export const MILESTONE_RECENT_BAND = 0;

/** Player memory overrides, keyed by turn id: 'keep' force-holds a dropped digest in memory, 'drop'
 *  force-removes a kept one. Persisted in the save envelope. */
export type MemoryPinMap = Record<string, 'keep' | 'drop'>;

/** The user message for the milestoneSelect request: the numbered digest list, oldest first. */
export function buildMilestoneUserMessage(digests: string[]): string {
  const list = digests.map((d, i) => `${i + 1}. ${d}`).join('\n');
  return `The story's remembered moments, oldest first:\n${list}\n\nReply with only the numbers to keep, comma-separated.`;
}

/**
 * Incremental selection (T4): verdicts are decided once, when a digest ages in, and never re-voted.
 * The selector sees the already-kept memories as numbered context and judges only the new arrivals;
 * an old memory can change state only by explicit supersession ("Forget"). This kills the
 * whole-list flip-flop by construction and shrinks the recurring request to the new entries.
 */

/** The incremental user message: kept memories as context (1..K), then the new arrivals to judge
 *  (K+1..K+N), numbered continuously so a reply index is unambiguous. With no kept context (first
 *  run, or everything so far dropped) only the new list and the Keep line are asked for. */
export function buildIncrementalMilestoneUserMessage(keptOld: string[], fresh: string[]): string {
  const oldList = keptOld.map((d, i) => `${i + 1}. ${d}`).join('\n');
  const freshList = fresh.map((d, i) => `${keptOld.length + i + 1}. ${d}`).join('\n');
  if (keptOld.length === 0) {
    return `New moments to judge, oldest first:\n${freshList}\n\nReply with one line:\nKeep: the numbers worth remembering, comma-separated, or "none".`;
  }
  return `Moments already in memory, oldest first:\n${oldList}\n\nNew moments to judge:\n${freshList}\n\nReply with three lines:\nKeep: the numbers of the NEW moments worth remembering, comma-separated, or "none".\nForget: the numbers of already-kept moments whose outcome a new moment now carries, or "none".\nWeight: each kept number with its weight, like "<number>=<weight>", comma-separated, or "none".`;
}

/** One incremental verdict: zero-based indices into the fresh list to keep, and zero-based indices
 *  into the shown kept-old list to forget (supersession only). */
export interface IncrementalVerdict {
  keepFresh: Set<number>;
  forgetOld: Set<number>;
  /** Importance per kept fresh entry (zero-based index into the fresh list) on the prompt's 1-3
   *  scale. Sparse: a rating the model omitted is simply absent and reads as neutral downstream.
   *  The absolute value is NOT comparable across models — the probe measured the same prompt
   *  separating must-keeps from drops by 0.64 on the cloud tier and 0.26 on Cydonia — so consumers
   *  must rank-normalize rather than use it directly (see turnBanding's importanceFactor). */
  weights: Map<number, number>;
}

/** Parse an incremental reply. Labeled segments win even inside prose — models append reasoning on
 *  the same line — and the Keep capture stops where a same-line "Forget" begins. A bare number list
 *  is accepted as keeps (the shape small models fall back to; the prose guard applies only there).
 *  Forgets are honored ONLY as "OLD replaced by NEW" citations whose NEW entry is actually kept:
 *  prompt wording alone let the model forget an old entry nearly every batch, and this structural
 *  filter is what restored must-recall (see the probe's paired arm). Returns null when nothing is
 *  parseable — callers keep every fresh entry and touch nothing old (fail-safe). */
export function parseIncrementalMilestoneReply(
  reply: string,
  oldCount: number,
  freshCount: number,
): IncrementalVerdict | null {
  const total = oldCount + freshCount;
  const nums = (line: string) =>
    (line.match(/\d+/g) || []).map(Number).filter((n) => n >= 1 && n <= total);
  // The colon is required: prose that merely uses the word "keep" must fall through to the
  // bare-number path and its guard, not parse as an empty (keep-nothing) label.
  const keepLine = reply.match(/keep\s*:((?:(?!forget)[^\n])*)/i);
  const forgetLine = reply.match(/forget\s*:([^\n]*)/i);
  let keepNums: number[];
  if (keepLine) {
    keepNums = nums(keepLine[1]);
  } else if (forgetLine) {
    keepNums = []; // an explicit Forget with no Keep line: nothing new kept.
  } else {
    if (reply.replace(/none|[\d,.\s\-:and]+/gi, '').length > 40) return null;
    keepNums = nums(reply); // bare number list = keeps.
    if (!keepNums.length && !/none/i.test(reply)) return null;
  }
  const keepFresh = new Set(keepNums.filter((n) => n > oldCount).map((n) => n - oldCount - 1));
  const forgetOld = new Set<number>();
  for (const m of (forgetLine?.[1] ?? '').matchAll(/(\d+)\s*(?:replaced by|->|→)\s*(\d+)/gi)) {
    const oldN = Number(m[1]);
    if (oldN >= 1 && oldN <= oldCount && keepFresh.has(Number(m[2]) - oldCount - 1)) forgetOld.add(oldN - 1);
  }
  // Weight line: only ratings for entries actually kept are meaningful, so unkept and out-of-range
  // citations are discarded rather than stored. Measured coverage is ~0.80 — an absent rating is
  // normal, not an error, and stays absent so consumers can treat it as neutral.
  const weights = new Map<number, number>();
  const weightLine = reply.match(/weight\s*:([^\n]*)/i);
  for (const m of (weightLine?.[1] ?? '').matchAll(/(\d+)\s*=\s*([123])\b/g)) {
    const idx = Number(m[1]) - oldCount - 1;
    if (keepFresh.has(idx)) weights.set(idx, Number(m[2]));
  }
  return { keepFresh, forgetOld, weights };
}

/** Fold one incremental verdict into the stored selection. `shownOldIds` are the kept-old turn ids
 *  in the order they were numbered; `freshIds` the judged arrivals in order. A null verdict
 *  (malformed reply) keeps every fresh entry and leaves old verdicts untouched. A legacy
 *  `selected: null` (old malformed full-vote) materializes to keep-everything-seen first. */
export function applyIncrementalVerdict(
  prev: { seen: string[]; selected: string[] | null } | null,
  shownOldIds: string[],
  freshIds: string[],
  verdict: IncrementalVerdict | null,
): { seen: string[]; selected: string[] } {
  const prevSeen = prev?.seen ?? [];
  const prevSelected = new Set(prev ? (prev.selected ?? prev.seen) : []);
  if (verdict) {
    verdict.forgetOld.forEach((i) => {
      const id = shownOldIds[i];
      if (id) prevSelected.delete(id);
    });
    freshIds.forEach((id, i) => {
      if (verdict.keepFresh.has(i)) prevSelected.add(id);
    });
  } else {
    freshIds.forEach((id) => prevSelected.add(id));
  }
  const seen = [...prevSeen, ...freshIds.filter((id) => !prevSeen.includes(id))];
  return { seen, selected: seen.filter((id) => prevSelected.has(id)) };
}

/** Parse the selector's reply into kept zero-based indices, or null when malformed (callers keep
 *  everything). A reply that is mostly prose rather than a number list is treated as malformed. */
export function parseMilestoneReply(reply: string, count: number): Set<number> | null {
  const nums = (reply.match(/\d+/g) || []).map(Number).filter((n) => n >= 1 && n <= count);
  if (!nums.length) return null;
  if (reply.replace(/[\d,.\s\-and]+/gi, '').length > 40) return null;
  return new Set(nums.map((n) => n - 1));
}

/** Every turn with a memory: all digest-carrying turns, chronological. This is the selector's input and
 *  the Memory panel's ledger — a memory forms (and gets its keep/drop verdict) the turn it is
 *  summarized, not once it ages out of the verbatim window. */
export function milestoneCandidates(turns: BandTurn[]): BandTurn[] {
  return turns.filter((t) => t.summary && t.summary.trim());
}

/** The candidates whose verdicts actually FILTER context: digest-carrying turns older than the verbatim
 *  floor, minus the newest `recentBand` of them (counted in digest-carrying turns). Verdicts on fresher
 *  turns are display-only until the turn ages in — the floor rides verbatim in narration regardless, and
 *  the planner's narrower floor must not see fresh turns filtered early. */
export function agedMilestoneCandidates(turns: BandTurn[], verbatimFloor: number, recentBand = MILESTONE_RECENT_BAND): BandTurn[] {
  const withDigest = turns.slice(0, Math.max(0, turns.length - verbatimFloor)).filter((t) => t.summary && t.summary.trim());
  return withDigest.slice(0, Math.max(0, withDigest.length - recentBand));
}

/** The stored verdict of one selector run: which candidate turn ids it saw and which it kept
 *  (`selected` null = malformed reply → treat everything seen as kept). */
export interface MilestoneSelection {
  seen: Set<string>;
  selected: Set<string> | null;
}

/** Resolve the surviving turn ids for the current candidates: pins win outright; a turn the selector
 *  never saw (it aged into the band after the last run) always survives; otherwise the selector's
 *  verdict applies. No selection at all (`null`) keeps everything unpinned. */
/** The inverse view for history assembly: the candidate turn ids that do NOT survive. This is what
 *  buildBandedHistory consumes — passing drops (not keeps) means turns outside the candidate window can
 *  never be filtered, whatever floor width the consuming stage uses. */
export function resolveMilestoneDrop(
  candidates: BandTurn[],
  selection: MilestoneSelection | null,
  pins: MemoryPinMap = {},
): Set<string> {
  const keep = resolveMilestoneKeep(candidates, selection, pins);
  const drop = new Set<string>();
  for (const t of candidates) {
    if (t.turnId && !keep.has(t.turnId)) drop.add(t.turnId);
  }
  return drop;
}

export function resolveMilestoneKeep(
  candidates: BandTurn[],
  selection: MilestoneSelection | null,
  pins: MemoryPinMap = {},
): Set<string> {
  const keep = new Set<string>();
  candidates.forEach((t, i) => {
    if (!t.turnId) return;
    const pin = pins[t.turnId];
    // The oldest remembered moment (the story's opening, in practice) is kept regardless of the
    // selector: with it gone the recap starts mid-scene and models write a fresh establishing scene
    // over the live one (observed as a full scene reset in a real session). A player 'drop' pin still wins.
    const kept =
      pin === 'keep' ? true :
      pin === 'drop' ? false :
      i === 0 ? true :
      selection === null || !selection.seen.has(t.turnId) || selection.selected === null || selection.selected.has(t.turnId);
    if (kept) keep.add(t.turnId);
  });
  return keep;
}
