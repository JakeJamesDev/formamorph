import type { BandTurn } from './turnBanding';

/**
 * Pure helpers for milestone memory: the AI selects (never rewrites) which old-band digests survive as
 * long-term history. The selector's reply is a keep-index list over the numbered digests; code maps the
 * indices back to turn ids and assembles the survivors verbatim. A malformed reply resolves to null,
 * which callers treat as keep-everything (fail-safe, never fail-drop). Player pins override the
 * selection in both directions. Design: docs-internal/milestone-memory-design.md.
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
  for (const t of candidates) {
    if (!t.turnId) continue;
    const pin = pins[t.turnId];
    const kept =
      pin === 'keep' ? true :
      pin === 'drop' ? false :
      selection === null || !selection.seen.has(t.turnId) || selection.selected === null || selection.selected.has(t.turnId);
    if (kept) keep.add(t.turnId);
  }
  return keep;
}
