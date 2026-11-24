/**
 * The player's changes to AI-written turn text: memory rewrites, kept regenerates and deletions, and the
 * same for each diary entry. One record per turn id, or per written memory's id.
 *
 * The AI's original stays on the turn; readers resolve this layer when they read, so clearing a change
 * restores the original. Every writer hands back the same object when it changes nothing.
 */

/** One change to one piece of AI text. `text` absent: the AI's text stands, as with a delete-only change.
 *  `source` separates a player rewrite (intent) from a kept regenerate (fresher AI text). */
export interface TextEdit {
  text?: string;
  source: TextSource;
  deleted?: true;
}

export type TextSource = 'player' | 'ai';

/** A rewrite with its text, as a reader applies it and as released saves stored it. */
export interface TextRewrite {
  text: string;
  source: TextSource;
}

export interface TurnTextRecord {
  memory?: TextEdit;
  /** Keyed by the diary name as stored on the turn. */
  diaries?: Record<string, TextEdit>;
}

export type TurnTextEdits = Record<string, TurnTextRecord>;

/** A memory's rewrite, when it has one. A delete-only record has none. */
export function memoryRewrite(layer: TurnTextEdits | undefined, id: string): TextRewrite | undefined {
  const edit = layer?.[id]?.memory;
  return edit?.text === undefined ? undefined : { text: edit.text, source: edit.source };
}

export const isMemoryDeleted = (layer: TurnTextEdits | undefined, id: string): boolean =>
  layer?.[id]?.memory?.deleted === true;

/** Every id whose memory the player deleted. */
export function deletedMemoryIds(layer: TurnTextEdits | undefined): string[] {
  return layer ? Object.keys(layer).filter((id) => layer[id].memory?.deleted) : [];
}

/** Whether any memory carries a change. Diary changes don't count. */
export const hasMemoryChanges = (layer: TurnTextEdits): boolean =>
  Object.values(layer).some((record) => record.memory !== undefined);

/** `layer` with `id`'s record replaced by `next`, removing a record left empty. */
function withRecord(layer: TurnTextEdits, id: string, next: TurnTextRecord): TurnTextEdits {
  if (Object.keys(next).length) return { ...layer, [id]: next };
  if (!layer[id]) return layer;
  const { [id]: _gone, ...others } = layer;
  return others;
}

/** `layer` with `id`'s memory set to `memory`, pruning a record left empty. */
function withMemory(layer: TurnTextEdits, id: string, memory: TextEdit | undefined): TurnTextEdits {
  const record = layer[id];
  if (record?.memory === memory) return layer;
  const { memory: _drop, ...rest } = record ?? {};
  return withRecord(layer, id, memory ? { ...rest, memory } : rest);
}

/** `was` rewritten to `text`; undefined when that changes nothing. A delete stays. */
function rewritten(was: TextEdit | undefined, text: string, source: TextSource): TextEdit | undefined {
  if (was?.text === text && was.source === source) return undefined;
  return { text, source, ...(was?.deleted ? { deleted: true } : {}) };
}

/** What stays of `was` once its rewrite goes: the delete, or nothing. */
const deleteOnly = (was: TextEdit): TextEdit | undefined => (was.deleted ? { source: 'player', deleted: true } : undefined);

/** `was` deleted or restored. A rewrite stays under the delete. */
function deletedAs(was: TextEdit | undefined, deleted: boolean): TextEdit | undefined {
  if (deleted) return { ...(was ?? { source: 'player' }), deleted: true };
  return was?.text === undefined ? undefined : { text: was.text, source: was.source };
}

/** A rewrite of `id`'s memory. A delete stays. */
export function withMemoryText(layer: TurnTextEdits, id: string, text: string, source: TextSource): TurnTextEdits {
  const next = rewritten(layer[id]?.memory, text, source);
  return next ? withMemory(layer, id, next) : layer;
}

/** `id`'s memory back to the AI's first text. A delete stays. */
export function withoutMemoryText(layer: TurnTextEdits, id: string): TurnTextEdits {
  const was = layer[id]?.memory;
  if (was?.text === undefined) return layer;
  return withMemory(layer, id, deleteOnly(was));
}

/** `id`'s memory deleted, or restored. A rewrite stays under the delete. */
export function withMemoryDeleted(layer: TurnTextEdits, id: string, deleted: boolean): TurnTextEdits {
  const was = layer[id]?.memory;
  if ((was?.deleted === true) === deleted) return layer;
  return withMemory(layer, id, deletedAs(was, deleted));
}

/** Every memory change gone. Diary changes stay. */
export function withoutMemoryChanges(layer: TurnTextEdits): TurnTextEdits {
  return Object.keys(layer).reduce((at, id) => withMemory(at, id, undefined), layer);
}

/** Two spellings of one diary name match without case. */
const sameDiary = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** `layer` with `turnId`'s diary entry for `name` set to `edit`, pruning what is left empty. */
function withDiary(layer: TurnTextEdits, turnId: string, name: string, edit: TextEdit | undefined): TurnTextEdits {
  const record = layer[turnId];
  if (record?.diaries?.[name] === edit) return layer;
  const { [name]: _drop, ...others } = record?.diaries ?? {};
  const diaries = edit ? { ...others, [name]: edit } : others;
  const { diaries: _was, ...rest } = record ?? {};
  return withRecord(layer, turnId, Object.keys(diaries).length ? { ...rest, diaries } : rest);
}

/** The change to `turnId`'s diary entry for `name`, by the name as stored on the turn. */
export const diaryEdit = (layer: TurnTextEdits | undefined, turnId: string, name: string): TextEdit | undefined =>
  layer?.[turnId]?.diaries?.[name];

/** A rewrite of `turnId`'s diary entry for `name`. A delete stays. */
export function withDiaryText(layer: TurnTextEdits, turnId: string, name: string, text: string, source: TextSource): TurnTextEdits {
  const next = rewritten(diaryEdit(layer, turnId, name), text, source);
  return next ? withDiary(layer, turnId, name, next) : layer;
}

/** `turnId`'s diary entry for `name` back to the AI's first text. A delete stays. */
export function withoutDiaryText(layer: TurnTextEdits, turnId: string, name: string): TurnTextEdits {
  const was = diaryEdit(layer, turnId, name);
  if (was?.text === undefined) return layer;
  return withDiary(layer, turnId, name, deleteOnly(was));
}

/** `turnId`'s diary entry for `name` deleted, or restored. A rewrite stays under the delete. */
export function withDiaryDeleted(layer: TurnTextEdits, turnId: string, name: string, deleted: boolean): TurnTextEdits {
  const was = diaryEdit(layer, turnId, name);
  if ((was?.deleted === true) === deleted) return layer;
  return withDiary(layer, turnId, name, deletedAs(was, deleted));
}

/** Whether `turnId`'s diary entry for `name` is deleted. Names match without case. */
export function isDiaryDeleted(layer: TurnTextEdits | undefined, turnId: string, name: string): boolean {
  return Object.entries(layer?.[turnId]?.diaries ?? {}).some(([key, edit]) => edit.deleted && sameDiary(key, name));
}

/** Whether the diary `name` carries a change on any turn. Names match without case. */
export const hasDiaryChanges = (layer: TurnTextEdits, name: string): boolean =>
  Object.values(layer).some((record) => Object.keys(record.diaries ?? {}).some((key) => sameDiary(key, name)));

/** Every change to the diary `name` gone, on every turn and spelling. Memory and other diaries' changes stay. */
export function withoutDiaryChanges(layer: TurnTextEdits, name: string): TurnTextEdits {
  let out = layer;
  for (const [turnId, record] of Object.entries(layer)) {
    for (const key of Object.keys(record.diaries ?? {})) {
      if (sameDiary(key, name)) out = withDiary(out, turnId, key, undefined);
    }
  }
  return out;
}

/** `turnId`'s text changes gone after its narration changed: memory and diary rewrites go, deletes stay. */
export function withoutTurnText(layer: TurnTextEdits, turnId: string): TurnTextEdits {
  const record = layer[turnId];
  if (!record) return layer;
  const memory = record.memory && deleteOnly(record.memory);
  const diaries = Object.fromEntries(
    Object.entries(record.diaries ?? {}).flatMap(([name, edit]) => {
      const kept = deleteOnly(edit);
      return kept ? [[name, kept]] : [];
    }),
  );
  const next: TurnTextRecord = {
    ...(memory ? { memory } : {}),
    ...(Object.keys(diaries).length ? { diaries } : {}),
  };
  if (!Object.keys(next).length) {
    const { [turnId]: _gone, ...others } = layer;
    return others;
  }
  return { ...layer, [turnId]: next };
}

/** The layer folded from a released save's `memoryEdits` and `memoryDeleted`, onto `layer` if it has one. */
export function foldMemoryChanges(
  layer: TurnTextEdits | undefined,
  edits: Record<string, TextRewrite> | undefined,
  deleted: readonly string[] | undefined,
): TurnTextEdits {
  let out = layer ?? {};
  for (const [id, edit] of Object.entries(edits ?? {})) out = withMemoryText(out, id, edit.text, edit.source);
  for (const id of deleted ?? []) out = withMemoryDeleted(out, id, true);
  return out;
}
