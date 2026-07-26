import type { ChatMessage } from '@/types';
import { parseTurns } from './turnBanding';
import { milestoneCandidates, agedMilestoneCandidates, resolveMilestoneKeep, type MemoryPinMap, type MilestoneSelection } from './milestoneMemory';
import { applyMemoryOverrides, type MemoryOverrides } from './memoryOverrides';
import { formatStampPlain, hoursByPosition, type WorldCalendar } from './gameClock';

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
  /** When this moment happened, both readings — `Day 3, evening — two days ago`. Only set when the
   *  caller passes a clock, which it does only while the turn duration is actually measured. */
  stamp?: string;
  /** This memory reached the model on the last turn. Kept memories that lost on relevance, the band cap
   *  or the token budget are `false` — kept is a standing verdict, this is per-turn. */
  inContext: boolean;
  /** Sent as its full original prose rather than as a digest (Scene Recall). Implies `inContext`. */
  asScene: boolean;
  /** Still inside the verbatim floor — the turn rides word-for-word, not as this summary. Together with
   *  `asScene` this is "the story has the whole thing", which is what the Full filter means. */
  verbatim: boolean;
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

/** The ledger filters, shared by both surfaces so a chip means the same thing in each.
 *
 *  `verbatim` / `summary` / `held` name the *form* the story holds a memory in, not a ranking, and are
 *  mutually exclusive: it has the real text, or a compressed line, or it is holding the memory back this
 *  turn. Labels that implied a ladder read as a bug once the sets overlapped. */
export type MemoryFilter = 'all' | 'verbatim' | 'summary' | 'held' | 'letGo' | 'edited' | 'custom' | 'deleted';

export const MEMORY_FILTER_LABELS: Record<MemoryFilter, string> = {
  all: 'All',
  verbatim: 'Verbatim',
  summary: 'Summary',
  held: 'Held',
  letGo: 'Let Go',
  edited: 'Edited',
  custom: 'Custom',
  deleted: 'Deleted',
};

/** What the header counts under each filter — the phrase after "N of M". `all` is the exception: it
 *  reads as a bare total, since "5 of 5" says nothing. */
export const MEMORY_FILTER_COUNT_LABELS: Record<MemoryFilter, string> = {
  all: 'Total Memories',
  // No verb: the floor rides in every request whether or not a turn has run yet, so "sent" would claim
  // something that hasn't happened on a freshly loaded save. These name a form, like the chips do.
  verbatim: 'Memories in Full',
  summary: 'Memories in Summary',
  held: 'Memories Held Back',
  letGo: 'Memories Let Go',
  edited: 'Memories Edited',
  custom: 'Memories You Wrote',
  deleted: 'Memories Deleted',
};

/** The story has this memory's real text — riding in the verbatim floor, or pulled back whole by Scene
 *  Recall. Either way the model sees more than the one line the row shows. */
function hasFullText(row: MemoryRow): boolean {
  return row.verbatim || row.asScene;
}

/** Whether a row belongs under `filter`. Deleted rows appear only under `deleted`, whatever else they are. */
export function matchesMemoryFilter(row: MemoryRow, filter: MemoryFilter): boolean {
  if (filter === 'deleted') return row.deleted;
  if (row.deleted) return false;
  switch (filter) {
    case 'all': return true;
    case 'verbatim': return hasFullText(row);
    case 'summary': return row.inContext && !hasFullText(row);
    case 'held': return row.kept && !row.inContext && !hasFullText(row);
    case 'letGo': return !row.kept;
    case 'edited': return !!row.edited;
    case 'custom': return row.isNote;
  }
}

/** Build the ledger. Deleted rows are included (flagged) so the manager can offer restore; callers that
 *  don't show them filter on `deleted`. */
export function buildMemoryLedger(args: {
  history: ChatMessage[];
  overrides: MemoryOverrides;
  pins: MemoryPinMap;
  selection: { seen: string[]; selected: string[] | null } | null;
  verbatimFloor: number;
  /** Omit to leave rows unstamped. Callers pass it only when the clock is measured, since under the flat
   *  hour-per-turn a stamp is a turn count wearing a date. */
  clock?: { nowHours: number; calendar?: WorldCalendar };
  /** What the last real turn sent. Omit (or leave empty) before any turn has run — nothing is marked
   *  rather than a stale band being reported as current. */
  context?: { bandIds?: string[]; rehydratedIds?: string[] };
}): MemoryLedger {
  const { history, overrides, pins, selection, verbatimFloor, clock, context } = args;
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
      inContext: false,
      asScene: false,
      verbatim: false,
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
      inContext: false,
      asScene: false,
      verbatim: false,
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
      inContext: false,
      asScene: false,
      verbatim: false,
    });
  }
  // Notes tie-break after the turn they were written at, matching how they ride in the recap.
  rows.sort((a, b) => a.pos - b.pos || Number(a.isNote) - Number(b.isNote));

  // Floor rows need no exclusion here: a turn riding verbatim never enters the band, so it is never in
  // `bandIds` and simply reads as unmarked — the Recent divider is what says it is present.
  const bandIds = new Set(context?.bandIds ?? []);
  const sceneIds = new Set(context?.rehydratedIds ?? []);
  // A note carries no turn id, so it can never appear in the band's id list — but it rides in the recap
  // whenever there is one, never judged and never trimmed. Mark it from the band's existence instead.
  const hasBand = bandIds.size > 0 || sceneIds.size > 0;
  for (const row of rows) {
    row.asScene = sceneIds.has(row.id);
    row.inContext = row.isNote ? hasBand && !row.deleted : row.asScene || bandIds.has(row.id);
  }

  if (clock) {
    // Same resolver the AI-facing stamp uses, so the two can't disagree. A turn with no measured delta
    // charges the flat hour, which keeps a history that straddles the setting monotonic.
    const hoursAt = hoursByPosition(rawTurns);
    for (const row of rows) row.stamp = formatStampPlain(hoursAt(row.pos), clock.nowHours, clock.calendar);
  }

  const visible = rows.filter((r) => !r.deleted);
  // The divider sits after the aged candidates. Notes never gate on aging, so they don't shift it: count
  // the aged turn-derived rows and place the divider at that row's position in the visible list.
  const agedIds = new Set(agedMilestoneCandidates(turns, verbatimFloor).map((t) => t.turnId));
  // A turn-derived row that hasn't aged out is still riding word-for-word in the narration floor.
  for (const row of rows) row.verbatim = !row.isNote && !row.deleted && !agedIds.has(row.id);
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
