import { useState, useEffect } from 'react';
import type { WorldOverview } from '@/types';

const STORAGE_KEY = 'FORMAMORPH_worldPromptOptOut';

/**
 * The world's narration system prompt, or null when it has none to apply: no text, blank text, or text the
 * author has switched off. A switched-off prompt is still stored on the world — that is the point of the
 * flag — so this is the only reading that decides whether it counts.
 */
export function worldNarrationPrompt(overview: WorldOverview | null | undefined): string | null {
  const overrides = overview?.promptOverrides;
  if (overrides?.systemPromptEnabled === false) return null;
  const text = overrides?.systemPrompt;
  return typeof text === 'string' && text.trim() ? text : null;
}

/** The authored text regardless of whether it is switched on — what the editor edits and preserves. */
export function storedNarrationPrompt(overview: WorldOverview | null | undefined): string | undefined {
  const text = overview?.promptOverrides?.systemPrompt;
  return typeof text === 'string' ? text : undefined;
}

/** True when this world supplies a narration prompt at all — what the details popup advertises. */
export function hasWorldNarrationPrompt(overview: WorldOverview | null | undefined): boolean {
  return worldNarrationPrompt(overview) !== null;
}

/**
 * The narration system prompt to actually send: the world's, unless it has none or the player declined it
 * for this world, in which case their own preset stands. Every other AI pass ignores this entirely.
 */
export function resolveNarrationPrompt(
  overview: WorldOverview | null | undefined,
  presetPrompt: string,
  optedOut: boolean,
): string {
  if (optedOut) return presetPrompt;
  return worldNarrationPrompt(overview) ?? presetPrompt;
}

/**
 * Per-world "use this world's narration prompt" flag, defaulting to on. Only the declining world ids are
 * persisted (absent ⇒ the world's prompt is used), the same shape `useReadmeVisibility` stores. Local-only:
 * a player's choice is never exported with the world or a save.
 */
export function useWorldPromptOptOut() {
  const [declined, setDeclined] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(declined));
    } catch {
      // A full/blocked localStorage costs only the preference; the session keeps the in-memory choice.
    }
  }, [declined]);

  // Named without a `use` prefix: these are plain getters/setters returned by the hook, and the prefix
  // reads as a nested hook call to the rules-of-hooks lint.
  const applyWorldPrompt = (id: string | null | undefined) => !id || !declined.includes(id);
  const setApplyWorldPrompt = (id: string | null | undefined, apply: boolean) => {
    if (!id) return;
    setDeclined((prev) => (apply ? prev.filter((x) => x !== id) : prev.includes(id) ? prev : [...prev, id]));
  };

  return { applyWorldPrompt, setApplyWorldPrompt };
}
