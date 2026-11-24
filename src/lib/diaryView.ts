/**
 * Every character's diary as the player reads it in Memories: one diary per name, in order of first
 * appearance, each entry with the player's changes from the text edit layer applied.
 */
import type { ChatMessage } from '@/types';
import { diaryHoldsMemory, parseTurnContent } from '@/lib/turnDigest';
import type { TextSource, TurnTextEdits } from '@/lib/turnTextEdits';

export interface DiaryEntry {
  /** Unique across every diary: the turn id and the name as stored on the turn. */
  key: string;
  turnId: string;
  /** The turn's place among the history's turns, from 1. */
  turnNumber: number;
  /** The name as stored on the turn, which keys the layer. */
  name: string;
  /** The AI's entry with the layer applied; empty when the turn holds only script lines. */
  text: string;
  /** The AI's first text, when a change replaced it. */
  original?: string;
  edited?: TextSource;
  deleted: boolean;
  /** The AI wrote "nothing notable", or nothing. */
  quiet: boolean;
  /** Lines a script wrote for this name on this turn. Read-only; the layer never changes them. */
  scriptLines: string[];
}

export interface Diary {
  /** The first spelling seen; names match without case. */
  name: string;
  entries: DiaryEntry[];
}

/** The key two spellings of one diary name share. */
export const diaryKey = (name: string) => name.trim().toLowerCase();
const fold = diaryKey;

/** Whether the AI reads the entry: not deleted, and it carries something beyond "nothing notable". */
export const isReadEntry = (entry: DiaryEntry): boolean => !entry.deleted && (!entry.quiet || entry.scriptLines.length > 0);

/** Entries the AI skips as "nothing notable", which Show Hidden Entries reveals. */
const isQuietEntry = (entry: DiaryEntry): boolean => !entry.deleted && !isReadEntry(entry);

/** How many entries the AI reads, and how many quiet ones stay hidden. */
export function diaryCounts(diary: Diary): { read: number; hidden: number } {
  return { read: diary.entries.filter(isReadEntry).length, hidden: diary.entries.filter(isQuietEntry).length };
}

/** The entries a diary view lists: what the AI reads, plus quiet ones with `showHidden`, matching `query` in the
 *  entry or its script lines. */
export function visibleDiaryEntries(diary: Diary, { query, showHidden }: { query: string; showHidden: boolean }): DiaryEntry[] {
  const q = query.trim().toLowerCase();
  return diary.entries.filter((entry) => {
    if (!isReadEntry(entry) && !(showHidden && isQuietEntry(entry))) return false;
    return !q || entry.text.toLowerCase().includes(q) || entry.scriptLines.some((line) => line.toLowerCase().includes(q));
  });
}

/** Every diary in the history, in order of first appearance, entries oldest first. */
export function buildDiaries(history: readonly ChatMessage[], layer: TurnTextEdits | undefined): Diary[] {
  const diaries = new Map<string, Diary>();
  let turnNumber = 0;
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const parsed = parseTurnContent(message.content);
    if (!parsed?.turnId) continue;
    turnNumber++;
    const { turnId } = parsed;
    const written = parsed.diaries ?? {};
    const scripted = parsed.codeDiaries ?? {};
    // The AI's spelling keys the entry; a script-only name keys it by the script's spelling.
    const names = [...Object.keys(written)];
    for (const name of Object.keys(scripted)) {
      if (!names.some((known) => fold(known) === fold(name))) names.push(name);
    }
    for (const name of names) {
      const ai = written[name]?.trim() ?? '';
      const edit = layer?.[turnId]?.diaries?.[name];
      const rewrite = edit?.text === undefined ? undefined : { text: edit.text.trim(), source: edit.source };
      const text = rewrite?.text ?? ai;
      const scriptLines = Object.entries(scripted)
        .filter(([key]) => fold(key) === fold(name))
        .flatMap(([, lines]) => lines);
      const entry: DiaryEntry = {
        key: `${turnId}|${name}`,
        turnId,
        turnNumber,
        name,
        text,
        ...(rewrite ? { original: ai, edited: rewrite.source } : {}),
        deleted: edit?.deleted === true,
        quiet: !text || !diaryHoldsMemory(text),
        scriptLines,
      };
      const diary = diaries.get(fold(name));
      if (diary) diary.entries.push(entry);
      else diaries.set(fold(name), { name: name.trim(), entries: [entry] });
    }
  }
  return [...diaries.values()];
}
