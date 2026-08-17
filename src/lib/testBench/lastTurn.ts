/**
 * The Triggers instrument's "paste last turn": the world's most recent save, read back as the two things
 * the tracer scans — the narration that was on screen, and the messages behind it.
 *
 * A save's assistant messages are stored as the turn envelope, so the narration comes out through
 * `scannableMessageText`, the same reading the activation pass gives a history message during play.
 */
import { getAllSaveRecords } from '@/components/modals/dbUtils';
import { scannableMessageText } from '@/lib/dictionaryScan';
import type { ChatMessage, SaveRecord } from '@/types';

/** How many messages behind the narration are offered as history. Deep enough for any ordinary scan
 *  depth, short enough that the box stays something an author can read. */
export const LAST_TURN_HISTORY = 10;

/** One save's last turn, in the shape the tracer takes it. */
export interface LastTurn {
  /** The narration that was on screen — what goes in the scene box. */
  scene: string;
  /** The messages before it, oldest→newest. */
  history: string[];
}

/** When a save was written, as a sortable number (0 when it carries no stamp). */
const savedAt = (record: SaveRecord): number =>
  record.currentState?.timestamp ? Date.parse(record.currentState.timestamp) || 0 : 0;

/**
 * The newest save belonging to this world. Matching is by `worldId`; a save written before saves carried
 * one falls back to the world name it stored, which is all those saves have.
 */
export function pickLatestSave(
  records: SaveRecord[],
  worldId: string | null | undefined,
  worldName: string | null | undefined,
): SaveRecord | undefined {
  const mine = records.filter((record) => (
    worldId && record.worldId ? record.worldId === worldId
      : !record.worldId && !!worldName && record.currentState?.worldName === worldName
  ));
  return mine.reduce<SaveRecord | undefined>(
    (best, record) => (!best || savedAt(record) > savedAt(best) ? record : best),
    undefined,
  );
}

/** A save's flat chat history, wherever this save's vintage keeps it. */
const messagesOf = (record: SaveRecord): ChatMessage[] =>
  record.messageHistory ?? record.currentState?.fullMessageHistory ?? [];

/**
 * `record`'s last turn: the final assistant narration as the scene, and the messages before it as history.
 * A save whose messages didn't survive falls back to the snapshot's own narration text with no history —
 * still a real turn to trace, just without the lookback. `null` when there is no narration at all.
 */
export function lastTurnFrom(record: SaveRecord, historyDepth = LAST_TURN_HISTORY): LastTurn | null {
  const messages = messagesOf(record);
  const at = messages.map((m) => m.role).lastIndexOf('assistant');
  if (at < 0) {
    const fallback = record.currentState?.gameplayText?.trim();
    return fallback ? { scene: fallback, history: [] } : null;
  }
  const scene = scannableMessageText(messages[at]).trim();
  if (!scene) return null;
  const history = messages
    .slice(Math.max(0, at - historyDepth), at)
    .map(scannableMessageText)
    .map((text) => text.trim())
    .filter(Boolean);
  return { scene, history };
}

/**
 * The last turn of this world's most recent save, or `null` when it has never been played. Returns `null`
 * rather than throwing if the save database can't be read — the offer simply isn't made.
 */
export async function loadLastTurn(
  worldId: string | null | undefined,
  worldName: string | null | undefined,
): Promise<LastTurn | null> {
  try {
    const latest = pickLatestSave(await getAllSaveRecords(), worldId, worldName);
    return latest ? lastTurnFrom(latest) : null;
  } catch {
    return null;
  }
}
