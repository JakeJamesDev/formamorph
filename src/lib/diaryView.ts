/**
 * Every character's diary as the player reads it in Memories: one diary per name, in order of first
 * appearance, each entry with the player's changes from the text edit layer applied.
 */
import type { ChatMessage } from '@/types';
import { diaryHoldsMemory, parseTurnContent } from '@/lib/turnDigest';
import { diaryKey, sameDiary, type TextSource, type TurnTextEdits } from '@/lib/turnTextEdits';

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
  /** The pass wrote an entry for this name, or the player deleted one. False: only a script wrote here. */
  aiEntry: boolean;
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

/** Whether the AI reads the entry: its script lines, or its own text when that is kept and beyond "nothing notable". */
export const isReadEntry = (entry: DiaryEntry): boolean =>
  entry.scriptLines.length > 0 || (!entry.deleted && !entry.quiet);

/** How many entries the AI reads, and how many quiet or deleted ones stay hidden. */
export function diaryCounts(diary: Diary): { read: number; hidden: number } {
  const read = diary.entries.filter(isReadEntry).length;
  return { read, hidden: diary.entries.length - read };
}

/** How many entries the AI reads in the diary kept under `name`; 0 when there is none. */
export function readEntryCount(diaries: readonly Diary[], name: string): number {
  const key = diaryKey(name);
  const diary = diaries.find((d) => diaryKey(d.name) === key);
  return diary ? diaryCounts(diary).read : 0;
}

/** The entries a diary view lists: what the AI reads, plus quiet and deleted ones with `showHidden`, matching
 *  `query` in the entry or its script lines. */
export function visibleDiaryEntries(
  diary: Diary,
  { query, showHidden, pendingKey }: { query: string; showHidden: boolean; pendingKey?: string },
): DiaryEntry[] {
  const q = query.trim().toLowerCase();
  return diary.entries.filter((entry) => {
    if (entry.key === pendingKey) return true; // a pending preview never hides behind the toggle or a search
    if (!showHidden && !isReadEntry(entry)) return false;
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
    const edits = layer?.[turnId]?.diaries ?? {};
    // The AI's spelling keys the entry; a script-only name keys it by the script's spelling. A delete outlives the
    // entry a narration edit cleared, so it still lists for Restore.
    const names = [...Object.keys(written)];
    for (const name of Object.keys(edits)) {
      if (edits[name].deleted && !(name in written)) names.push(name);
    }
    for (const name of Object.keys(scripted)) {
      if (!names.some((known) => sameDiary(known, name))) names.push(name);
    }
    for (const name of names) {
      const ai = written[name]?.trim() ?? '';
      const edit = edits[name];
      const rewrite = edit?.text === undefined ? undefined : { text: edit.text.trim(), source: edit.source };
      const text = rewrite?.text ?? ai;
      const scriptLines = Object.entries(scripted)
        .filter(([key]) => sameDiary(key, name))
        .flatMap(([, lines]) => lines);
      const entry: DiaryEntry = {
        key: `${turnId}|${name}`,
        turnId,
        turnNumber,
        name,
        text,
        ...(rewrite ? { original: ai, edited: rewrite.source } : {}),
        deleted: edit?.deleted === true,
        aiEntry: name in written || edit?.deleted === true,
        quiet: !text || !diaryHoldsMemory(text),
        scriptLines,
      };
      const diary = diaries.get(diaryKey(name));
      if (diary) diary.entries.push(entry);
      else diaries.set(diaryKey(name), { name: name.trim(), entries: [entry] });
    }
  }
  return [...diaries.values()];
}
