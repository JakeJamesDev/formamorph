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

/** `layer` with `id`'s memory set to `memory`, pruning a record left empty. */
function withMemory(layer: TurnTextEdits, id: string, memory: TextEdit | undefined): TurnTextEdits {
  const record = layer[id];
  if (record?.memory === memory) return layer;
  const { memory: _drop, ...rest } = record ?? {};
  const next: TurnTextRecord = memory ? { ...rest, memory } : rest;
  if (Object.keys(next).length) return { ...layer, [id]: next };
  if (!record) return layer;
  const { [id]: _gone, ...others } = layer;
  return others;
}

/** A rewrite of `id`'s memory. A delete stays. */
export function withMemoryText(layer: TurnTextEdits, id: string, text: string, source: TextSource): TurnTextEdits {
  const was = layer[id]?.memory;
  if (was?.text === text && was.source === source) return layer;
  return withMemory(layer, id, { text, source, ...(was?.deleted ? { deleted: true } : {}) });
}

/** `id`'s memory back to the AI's first text. A delete stays. */
export function withoutMemoryText(layer: TurnTextEdits, id: string): TurnTextEdits {
  const was = layer[id]?.memory;
  if (was?.text === undefined) return layer;
  return withMemory(layer, id, was.deleted ? { source: 'player', deleted: true } : undefined);
}

/** `id`'s memory deleted, or restored. A rewrite stays under the delete. */
export function withMemoryDeleted(layer: TurnTextEdits, id: string, deleted: boolean): TurnTextEdits {
  const was = layer[id]?.memory;
  if ((was?.deleted === true) === deleted) return layer;
  if (deleted) return withMemory(layer, id, { ...(was ?? { source: 'player' }), deleted: true });
  if (was?.text === undefined) return withMemory(layer, id, undefined);
  return withMemory(layer, id, { text: was.text, source: was.source });
}

/** Every memory change gone. Diary changes stay. */
export function withoutMemoryChanges(layer: TurnTextEdits): TurnTextEdits {
  return Object.keys(layer).reduce((at, id) => withMemory(at, id, undefined), layer);
}

/** A text change without its text: the delete it carried, or nothing. */
const deleteOnly = (edit: TextEdit): TextEdit | undefined => (edit.deleted ? { source: 'player', deleted: true } : undefined);

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
