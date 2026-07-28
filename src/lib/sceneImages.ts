// Per-turn scene images: the pure history helpers that add, remove and strip them, plus the size readout
// the save dialog uses. Images live inside the assistant turn they illustrate (`AITurnResult.sceneImages`),
// addressed by `turnId` like every other derived turn field — so an image rolls back with its turn and a
// result arriving after a rollback is discarded rather than landing on the wrong scene.
//
// They are deliberately NOT part of what a save carries by default: one image is around a megabyte of
// base64 and a long session holds dozens (see stripSceneImages / the save dialog's opt-in).

import { parseTurnContent, serializeTurnContent } from './turnDigest';
import type { ChatMessage } from '@/types';

/** Patch a generated image onto the turn it illustrates, newest last. Returns `null` when no turn matches
 *  — the turn was rolled back or regenerated while the image was rendering (the apply-guard). */
export function addSceneImage(history: ChatMessage[], turnId: string, dataUrl: string, tags?: string): ChatMessage[] | null {
  let found = false;
  const next = history.map((message) => {
    if (message.role !== 'assistant') return message;
    const parsed = parseTurnContent(message.content);
    if (!parsed || parsed.turnId !== turnId) return message;
    found = true;
    return {
      ...message,
      content: serializeTurnContent({
        ...parsed,
        sceneImages: [...(parsed.sceneImages ?? []), dataUrl],
        ...(tags !== undefined ? { sceneTags: tags } : {}),
      }),
    };
  });
  return found ? next : null;
}

/** Drop one of a turn's images by index. Returns `null` if the turn or the index isn't there. */
export function removeSceneImage(history: ChatMessage[], turnId: string, index: number): ChatMessage[] | null {
  let found = false;
  const next = history.map((message) => {
    if (message.role !== 'assistant') return message;
    const parsed = parseTurnContent(message.content);
    if (!parsed || parsed.turnId !== turnId) return message;
    const images = parsed.sceneImages ?? [];
    if (index < 0 || index >= images.length) return message;
    found = true;
    const remaining = images.filter((_, i) => i !== index);
    const { sceneImages: _dropped, ...rest } = parsed;
    return {
      ...message,
      content: serializeTurnContent(remaining.length ? { ...rest, sceneImages: remaining } : rest),
    };
  });
  return found ? next : null;
}

/** Store the tag line a turn's image was generated from, so the editable field survives a reload. */
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

/** A turn's images, or `[]`. Reads by index in the flat history (the paged view addresses turns that way). */
export function sceneImagesAt(history: ChatMessage[], index: number): string[] {
  const message = history[index];
  if (!message || message.role !== 'assistant') return [];
  return parseTurnContent(message.content)?.sceneImages ?? [];
}

/** The history with every scene image removed — what a save writes unless the player opts in. The tag lines
 *  stay: they're a few dozen bytes and are what makes a saved scene reproducible. */
export function stripSceneImages(history: ChatMessage[]): ChatMessage[] {
  return history.map((message) => {
    if (message.role !== 'assistant') return message;
    const parsed = parseTurnContent(message.content);
    if (!parsed?.sceneImages) return message;
    const { sceneImages: _dropped, ...rest } = parsed;
    return { ...message, content: serializeTurnContent(rest) };
  });
}

/** How many images the history holds and roughly what they weigh, for the save dialog's warning. Base64
 *  carries 3 bytes per 4 characters, which is close enough for a number the player only reads as a size. */
export function sceneImageWeight(history: ChatMessage[]): { count: number; bytes: number } {
  let count = 0;
  let bytes = 0;
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    for (const image of parseTurnContent(message.content)?.sceneImages ?? []) {
      count += 1;
      bytes += Math.round((image.length - (image.indexOf(',') + 1)) * 0.75);
    }
  }
  return { count, bytes };
}
