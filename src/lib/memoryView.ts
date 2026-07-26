import type { ChatMessage } from '@/types';
import { parseTurns } from './turnBanding';
import { milestoneCandidates, agedMilestoneCandidates, resolveMilestoneKeep, type MemoryPinMap, type MilestoneSelection } from './milestoneMemory';
import { applyMemoryOverrides, type MemoryOverrides } from './memoryOverrides';

/**
 * The memory ledger as the player sees it, shared by the Memory side panel and the Memory Manager so the
 * two surfaces can never disagree about what is remembered. Pure: history in, rows out.
 */

/** One row of the ledger. Turn-derived rows carry a `turnId`; player-written notes carry their note id. */
export interface MemoryRow {
  id: string;
  text: string;
  /** True for a player-written memory (never judged, never trimmed, keeps until deleted). */
  isNote: boolean;
  /** The AI's original summary, when the row's text is an override of it. */
  original?: string;
  /** How the row's text came to differ from the AI's first summary. */
  edited?: 'player' | 'ai';
  /** Whether this memory currently rides in the story's context. */
  kept: boolean;
  /** The player's pin on this row, when set. */
  pin?: 'keep' | 'drop';
  /** Tombstoned: hidden from the default view, out of context, restorable. */
  deleted: boolean;
  /** 1-based turn number for display; 0 for a note (it belongs to no turn). */
  turnNumber: number;
  /** Chronological sort position, in the message-history index domain. */
  pos: number;
}

export interface MemoryLedger {
  rows: MemoryRow[];
  /** Index into `rows` (deleted excluded) where the "Recent" divider goes: from here on, a verdict is
   *  display-only because the turn still rides verbatim in the narration floor. */
  recentFrom: number;
  keptCount: number;
  /** Rows excluding tombstoned ones — the denominator the player counts against. */
  totalCount: number;
}

/** Build the ledger. Deleted rows are included (flagged) so the manager can offer restore; callers that
 *  don't show them filter on `deleted`. */
export function buildMemoryLedger(args: {
  history: ChatMessage[];
  overrides: MemoryOverrides;
  pins: MemoryPinMap;
  selection: { seen: string[]; selected: string[] | null } | null;
  verbatimFloor: number;
}): MemoryLedger {
  const { history, overrides, pins, selection, verbatimFloor } = args;
  const rawTurns = parseTurns(history);
  const turns = applyMemoryOverrides(rawTurns, overrides);
  const candidates = milestoneCandidates(turns);
  // Entries past the aged window are "Recent": their memory and verdict show the turn they form, but they
  // still ride in context verbatim regardless — the verdict takes effect only once aged.
  const agedCount = agedMilestoneCandidates(turns, verbatimFloor).length;
  const sel: MilestoneSelection | null = selection
    ? {
        seen: new Set(selection.seen),
        selected: selection.selected === null ? null : new Set(selection.selected),
      }
    : null;
  const keep = resolveMilestoneKeep(candidates, sel, pins);
  const originalById = new Map(rawTurns.flatMap((t) => (t.turnId && t.summary ? [[t.turnId, t.summary] as const] : [])));
  const deletedSet = new Set(overrides.deleted ?? []);

  const rows: MemoryRow[] = [];
  candidates.forEach((t, i) => {
    if (!t.turnId) return;
    const edit = overrides.edits?.[t.turnId];
    rows.push({
      id: t.turnId,
      text: t.summary ?? '',
      isNote: false,
      original: edit ? originalById.get(t.turnId) : undefined,
      edited: edit?.source,
      kept: keep.has(t.turnId),
      pin: pins[t.turnId],
      deleted: false,
      // The candidate's ordinal is the number the player counts by — turns without a memory don't appear.
      turnNumber: i + 1,
      pos: t.index,
    });
  });
  // Tombstoned turns lost their summary in applyMemoryOverrides, so they aren't candidates — rebuild them
  // from the raw parse to keep restore possible.
  for (const t of rawTurns) {
    if (!t.turnId || !deletedSet.has(t.turnId) || !t.summary?.trim()) continue;
    const edit = overrides.edits?.[t.turnId];
    rows.push({
      id: t.turnId,
      text: edit?.text ?? t.summary,
      isNote: false,
      original: edit ? t.summary : undefined,
      edited: edit?.source,
      kept: false,
      pin: pins[t.turnId],
      deleted: true,
      turnNumber: 0,
      pos: t.index,
    });
  }
  for (const n of overrides.notes ?? []) {
    rows.push({
      id: n.id,
      text: n.text,
      isNote: true,
      kept: !deletedSet.has(n.id),
      deleted: deletedSet.has(n.id),
      turnNumber: 0,
      pos: n.anchorTurn,
    });
  }
  // Notes tie-break after the turn they were written at, matching how they ride in the recap.
  rows.sort((a, b) => a.pos - b.pos || Number(a.isNote) - Number(b.isNote));

  const visible = rows.filter((r) => !r.deleted);
  // The divider sits after the aged candidates. Notes never gate on aging, so they don't shift it: count
  // the aged turn-derived rows and place the divider at that row's position in the visible list.
  const agedIds = new Set(agedMilestoneCandidates(turns, verbatimFloor).map((t) => t.turnId));
  let recentFrom = visible.length;
  for (let i = 0; i < visible.length; i++) {
    if (!visible[i].isNote && !agedIds.has(visible[i].id)) { recentFrom = i; break; }
  }
  if (agedCount === 0) recentFrom = 0;

  return {
    rows,
    recentFrom,
    keptCount: visible.filter((r) => r.kept).length,
    totalCount: visible.length,
  };
}
