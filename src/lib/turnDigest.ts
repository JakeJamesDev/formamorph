import json5 from 'json5';
import type { AITurnResult, ChatMessage } from '@/types';

/**
 * Pure helpers for the per-turn memory digest (the "summary step").
 *
 * A digest is a cheap, persisted set of typed fact lines stored *inside* the assistant turn it
 * summarizes (`AITurnResult.summary`), addressed by a stable `turnId`. Generation is lazy and async
 * (a turn is digested once it ages past the verbatim window); these functions are the deterministic,
 * unit-testable core — selection of which turns are due, and the apply-guard that patches a digest
 * back onto the right turn (or no-ops if that turn was rolled back / regenerated away).
 *
 * This slice only *generates and stores* digests. Nothing consumes them yet (see Slice 2: banding).
 */

/** Parse an assistant turn's JSON content, or `null` if it doesn't parse. */
export function parseTurnContent(content: string): AITurnResult | null {
  try {
    return json5.parse(content) as AITurnResult;
  } catch {
    return null;
  }
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
