import json5 from 'json5';
import type { AITurnResult, ChatMessage } from '@/types';

/**
 * Pure helpers for the per-turn memory digest (the "summary step").
 *
 * A digest is a cheap, persisted condensed retelling stored *inside* the assistant turn it
 * summarizes (`AITurnResult.summary`), addressed by a stable `turnId`. Generation is lazy and async
 * (a turn is digested once it ages past the verbatim window); these functions are the deterministic,
 * unit-testable core — selection of which turns are due, and the apply-guard that patches a digest
 * back onto the right turn (or no-ops if that turn was rolled back / regenerated away).
 *
 * This slice only *generates and stores* digests. Nothing consumes them yet (see Slice 2: banding).
 */

// The history is walked repeatedly — the context meter alone re-derives on every sentence boundary of
// every turn — and each walk parses every assistant message again. Cache by the exact content string, so
// only a turn that actually changed is re-parsed. Bounded: an entry is dropped once the map outgrows a
// long session's history, and a parse is cheap enough that a miss costs nothing.
const PARSE_CACHE_LIMIT = 400;
const parseCache = new Map<string, AITurnResult | null>();

/** Parse an assistant turn's JSON content, or `null` if it doesn't parse. Legacy v1.2 / pre-release 2.0
 *  saves stored the narration under `game_text`; normalize that to `narration` on read (non-destructive
 *  — the field just moves), so every consumer can rely on `narration`.
 *
 *  Native `JSON.parse` runs first: everything the app writes is strict JSON, and json5 is ~200x slower on
 *  the same string. json5 stays as the fallback for legacy and model-authored content, which is the only
 *  place its tolerance was ever needed. */
export function parseTurnContent(content: string): AITurnResult | null {
  const hit = parseCache.get(content);
  if (hit !== undefined) return hit;

  let parsed: (AITurnResult & { game_text?: string }) | null = null;
  try {
    parsed = JSON.parse(content) as AITurnResult & { game_text?: string };
  } catch {
    try {
      parsed = json5.parse(content) as AITurnResult & { game_text?: string };
    } catch {
      parsed = null;
    }
  }
  if (parsed && parsed.narration === undefined && typeof parsed.game_text === 'string') {
    parsed.narration = parsed.game_text;
    delete parsed.game_text;
  }

  // Only successful parses are cached: a streaming turn hands every partial content string through here,
  // and caching those misses would fill the map mid-turn until the cap wiped the whole history's parses.
  // A failed parse exits fast, so re-failing on the next walk costs nothing.
  if (parsed) {
    // Every consumer shares this one object, so an in-place write would corrupt the cache and every
    // other reader at once. Frozen (shallowly — the hot path can't afford a deep walk) to make that
    // mistake throw here rather than surface as a wrong turn somewhere else. Callers spread to modify.
    Object.freeze(parsed);
    if (parseCache.size >= PARSE_CACHE_LIMIT) parseCache.clear();
    parseCache.set(content, parsed);
  }
  return parsed;
}

/** Serialize an assistant turn back to the stored JSON shape. */
export function serializeTurnContent(content: AITurnResult): string {
  return JSON.stringify(content);
}

/**
 * Pick the `turnId`s of assistant turns that are due for a digest: those with a stable id and no
 * summary yet. `skipRecent` optionally excludes the N most recent assistant turns (default 0 — every
 * completed turn is digested, including the newest, since the drainer only runs once a turn is fully
 * committed). Pre-digest turns lacking a `turnId` are skipped (they can't be addressed by the
 * apply-guard). Returns ids most-recent-first; the drainer decides which end to process.
 */
export function selectDueDigests(history: ChatMessage[], skipRecent = 0): string[] {
  const due: string[] = [];
  let assistantSeen = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'assistant') continue;
    assistantSeen += 1;
    if (assistantSeen <= skipRecent) continue;
    const parsed = parseTurnContent(history[i].content);
    if (parsed?.turnId && !parsed.summary) due.push(parsed.turnId);
  }
  return due;
}

/**
 * Patch `summary` onto the assistant turn whose `turnId` matches, returning the new history.
 * Returns `null` if no turn matches — the turn was rolled back or regenerated while the digest was
 * in flight, so its result is discarded (the apply-guard). Other turns are returned untouched.
 */
export function applyDigest(history: ChatMessage[], turnId: string, summary: string): ChatMessage[] | null {
  let found = false;
  const next = history.map((message) => {
    if (message.role !== 'assistant') return message;
    const parsed = parseTurnContent(message.content);
    if (!parsed || parsed.turnId !== turnId) return message;
    found = true;
    return { ...message, content: serializeTurnContent({ ...parsed, summary }) };
  });
  return found ? next : null;
}

/**
 * Who took part across the last `turns` participation-carrying turns, deduped, most-recent turn first.
 * The dedup is load-bearing for the recap's now-line, which renders this list verbatim — a character
 * present for three turns running otherwise reads as "Sarah, Sarah, Sarah present". Turns with no
 * recorded participants are skipped without consuming the window.
 */
export function recentParticipants(history: ChatMessage[], turns: number): string[] {
  const names = new Set<string>();
  let seen = 0;
  for (let i = history.length - 1; i >= 0 && seen < turns; i--) {
    if (history[i].role !== 'assistant') continue;
    const parsed = parseTurnContent(history[i].content);
    if (!parsed || parsed.entities === undefined) continue;
    for (const name of parsed.entities) names.add(name);
    seen += 1;
  }
  return [...names];
}

/**
 * Patch importance ratings onto the assistant turns whose ids match, returning the new history.
 * Turns absent from the map, and ratings for ids not in the history, are left alone — a verdict that
 * lands after a rollback simply finds nothing to write. Returns the original array when nothing
 * matched, so callers can skip a state update.
 */
export function applyImportance(history: ChatMessage[], byTurnId: Map<string, number>): ChatMessage[] {
  if (byTurnId.size === 0) return history;
  let found = false;
  const next = history.map((message) => {
    if (message.role !== 'assistant') return message;
    const parsed = parseTurnContent(message.content);
    if (!parsed || !parsed.turnId) return message;
    const importance = byTurnId.get(parsed.turnId);
    if (importance === undefined) return message;
    found = true;
    return { ...message, content: serializeTurnContent({ ...parsed, importance }) };
  });
  return found ? next : history;
}

/**
 * Pick the `turnId`s of assistant turns due for a character diary entry: those with a stable id and at
 * least one participant (`entities`) that has no diary entry yet. Turns with no participants are skipped
 * (no one to write). Returns ids most-recent-first; the drainer decides which end to process.
 */
export function selectDueDiaries(history: ChatMessage[]): string[] {
  const due: string[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'assistant') continue;
    const parsed = parseTurnContent(history[i].content);
    if (!parsed?.turnId || !parsed.entities?.length) continue;
    if (parsed.entities.some((name) => parsed.diaries?.[name] === undefined)) due.push(parsed.turnId);
  }
  return due;
}

/** The participant names on a turn still missing a diary entry (empty if the turn is fully covered). */
export function pendingDiaryNames(history: ChatMessage[], turnId: string): string[] {
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const parsed = parseTurnContent(message.content);
    if (parsed?.turnId === turnId) {
      return (parsed.entities ?? []).filter((name) => parsed.diaries?.[name] === undefined);
    }
  }
  return [];
}

/**
 * A character's own diary entries across the history, chronological (oldest first), capped to the last
 * `max`. Key match is case-insensitive (a director cast name may differ in case from the entity name).
 * `nothing notable` entries carry no memory and are skipped.
 */
export function collectCharacterDiary(history: ChatMessage[], name: string, max: number): string[] {
  const key = name.trim().toLowerCase();
  const entries: string[] = [];
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const parsed = parseTurnContent(message.content);
    if (!parsed?.diaries) continue;
    const match = Object.entries(parsed.diaries).find(([k]) => k.trim().toLowerCase() === key);
    const text = match?.[1]?.trim();
    if (text && text.toLowerCase() !== 'nothing notable') entries.push(text);
  }
  // `slice(-0)` is `slice(0)` — it would return the whole array — so guard max === 0 explicitly.
  return max > 0 ? entries.slice(-max) : max < 0 ? entries : [];
}

/**
 * Patch one character's diary `text` onto the matching turn (merging into its `diaries` map), returning
 * the new history. Returns `null` if no turn matches (rolled back / regenerated while in flight — the
 * apply-guard). Other turns and other characters' entries are left untouched.
 */
export function applyDiary(
  history: ChatMessage[],
  turnId: string,
  name: string,
  text: string,
): ChatMessage[] | null {
  let found = false;
  const next = history.map((message) => {
    if (message.role !== 'assistant') return message;
    const parsed = parseTurnContent(message.content);
    if (!parsed || parsed.turnId !== turnId) return message;
    found = true;
    const diaries = { ...(parsed.diaries ?? {}), [name]: text };
    return { ...message, content: serializeTurnContent({ ...parsed, diaries }) };
  });
  return found ? next : null;
}

/**
 * Drop a turn's derived-from-narration data so the drainers regenerate it. Editing a turn's narration
 * makes its stored digest (`summary`) — and, when `diaries` is set, its character diary entries — disagree
 * with the visible text; nulling those fields makes `selectDueDigests`/`selectDueDiaries` re-select the
 * turn and the drainers rebuild lazily. Returns `null` if no turn matches the id (rolled back / regenerated
 * away), mirroring the apply-guards. Other turns are untouched.
 */
export function clearTurnDerived(
  history: ChatMessage[],
  turnId: string,
  opts?: { diaries?: boolean },
): ChatMessage[] | null {
  let found = false;
  const next = history.map((message) => {
    if (message.role !== 'assistant') return message;
    const parsed = parseTurnContent(message.content);
    if (!parsed || parsed.turnId !== turnId) return message;
    found = true;
    const { summary: _summary, diaries: _diaries, ...rest } = parsed;
    const cleared: AITurnResult = opts?.diaries ? rest : { ...rest, diaries: _diaries };
    return { ...message, content: serializeTurnContent(cleared) };
  });
  return found ? next : null;
}
