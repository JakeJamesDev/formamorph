// Per-turn scene images. They live in their OWN map keyed by turn id — deliberately not inside the
// assistant message the way every other derived turn field does.
//
// One image is over a megabyte of base64, and the message JSON is parsed by everything that walks the
// history (the context meter recomputes on every sentence boundary of every turn). Measured: json5 takes
// ~110ms on a message carrying one image versus 0.07ms on an ordinary turn, which starved the narration
// reveal for the rest of the session. Nothing that reads history needs the pixels — only the panel showing
// the current turn and the save writer do — so they are kept beside it instead.
//
// The turn's `sceneTags` line stays in the message: it is a few dozen bytes, it makes a scene reproducible
// without its pixels, and riding the message means it rolls back with the turn for free.

import { parseTurnContent, serializeTurnContent, survivingTurnIds } from './turnDigest';
import type { ChatMessage } from '@/types';

/** Scene images by turn id, oldest first within a turn. */
export type SceneImageMap = Record<string, string[]>;

/** Append an image to its turn. Pure — returns a new map. */
export function addSceneImage(map: SceneImageMap, turnId: string, dataUrl: string): SceneImageMap {
  return { ...map, [turnId]: [...(map[turnId] ?? []), dataUrl] };
}

/** Drop one of a turn's images by index. Returns the map unchanged if the turn or index isn't there. */
export function removeSceneImage(map: SceneImageMap, turnId: string, index: number): SceneImageMap {
  const images = map[turnId];
  if (!images || index < 0 || index >= images.length) return map;
  const remaining = images.filter((_, i) => i !== index);
  const next = { ...map };
  if (remaining.length) next[turnId] = remaining;
  else delete next[turnId]; // an empty turn leaves no entry behind
  return next;
}

/**
 * Forget images whose turn is no longer in the history — a rolled-back or re-generated turn. Living in the
 * message used to make this free; keyed beside it, it has to be swept explicitly or the map grows forever
 * holding pixels for scenes that no longer exist.
 */
export function pruneSceneImages(map: SceneImageMap, history: ChatMessage[]): SceneImageMap {
  const live = survivingTurnIds(history);
  const kept = Object.keys(map).filter((id) => live.has(id));
  if (kept.length === Object.keys(map).length) return map; // nothing to drop — keep the identity
  return Object.fromEntries(kept.map((id) => [id, map[id]]));
}

/** How many images are held and roughly what they weigh, for the save dialog's warning. The save stores
 *  the base64 string itself, so the string's length IS the growth (ASCII → one byte per character) —
 *  reporting decoded pixels would under-state the file by a quarter. */
export function sceneImageWeight(map: SceneImageMap): { count: number; bytes: number } {
  let count = 0;
  let bytes = 0;
  for (const images of Object.values(map)) {
    for (const image of images) {
      count += 1;
      bytes += image.length;
    }
  }
  return { count, bytes };
}

/** Store the tag line a turn's image was generated from. This one DOES live in the message (see above). */
export function setSceneTags(history: ChatMessage[], turnId: string, tags: string): ChatMessage[] | null {
  let found = false;
  const next = history.map((message) => {
    if (message.role !== 'assistant') return message;
    const parsed = parseTurnContent(message.content);
    if (!parsed || parsed.turnId !== turnId) return message;
    found = true;
    return { ...message, content: serializeTurnContent({ ...parsed, sceneTags: tags }) };
  });
  return found ? next : null;
}
