import { useState, useEffect } from 'react';
import type { WorldOverview, WorldPromptOverrides } from '@/types';

const STORAGE_KEY = 'FORMAMORPH_worldPromptOptOut';

/** The AI passes a world may supply its own system prompt for. */
export type WorldPromptKind = 'narration' | 'choices' | 'statUpdates';

/** In the order the editor tabs and the player-facing notice list them. */
export const WORLD_PROMPT_KINDS: WorldPromptKind[] = ['narration', 'choices', 'statUpdates'];

/** What each kind is called wherever an author or a player reads it. */
export const WORLD_PROMPT_KIND_LABELS: Record<WorldPromptKind, string> = {
  narration: 'Narration',
  choices: 'Choices',
  statUpdates: 'Stats',
};

type TextKey = 'systemPrompt' | 'choicesPrompt' | 'statUpdatesPrompt';
type FlagKey = 'systemPromptEnabled' | 'choicesPromptEnabled' | 'statUpdatesPromptEnabled';

/** Which pair of override keys a kind reads. Narration keeps the pre-existing names. */
const OVERRIDE_KEYS: Record<WorldPromptKind, { text: TextKey; flag: FlagKey }> = {
  narration: { text: 'systemPrompt', flag: 'systemPromptEnabled' },
  choices: { text: 'choicesPrompt', flag: 'choicesPromptEnabled' },
  statUpdates: { text: 'statUpdatesPrompt', flag: 'statUpdatesPromptEnabled' },
};

/** The authored text regardless of whether it is switched on — what the editor edits and preserves. */
export function storedWorldPrompt(
  overview: WorldOverview | null | undefined,
  kind: WorldPromptKind,
): string | undefined {
  const text = overview?.promptOverrides?.[OVERRIDE_KEYS[kind].text];
  return typeof text === 'string' ? text : undefined;
}

/**
 * Whether the author has this kind switched on. An explicit flag decides; with none, stored text counts as
 * on, so a world authored before the flag existed still uses its prompt.
 */
export function worldPromptEnabled(overview: WorldOverview | null | undefined, kind: WorldPromptKind): boolean {
  const flag = overview?.promptOverrides?.[OVERRIDE_KEYS[kind].flag];
  if (typeof flag === 'boolean') return flag;
  return storedWorldPrompt(overview, kind) !== undefined;
}

/**
 * The world's system prompt for this pass, or null when it has none to apply: no text, blank text, or text
 * the author has switched off. A switched-off prompt is still stored on the world — that is the point of the
 * flag — so this is the only reading that decides whether it counts.
 */
export function worldPrompt(overview: WorldOverview | null | undefined, kind: WorldPromptKind): string | null {
  if (!worldPromptEnabled(overview, kind)) return null;
  const text = storedWorldPrompt(overview, kind);
  return text && text.trim() ? text : null;
}

/** True when this world supplies a prompt for this pass at all. */
export function hasWorldPrompt(overview: WorldOverview | null | undefined, kind: WorldPromptKind): boolean {
  return worldPrompt(overview, kind) !== null;
}

/** Every kind this world actually customizes — what the details popup names and the viewer tabs. */
export function customizedPromptKinds(overview: WorldOverview | null | undefined): WorldPromptKind[] {
  return WORLD_PROMPT_KINDS.filter((kind) => hasWorldPrompt(overview, kind));
}

/**
 * The system prompt to actually send for this pass: the world's, unless it has none or the player declined
 * this world's prompts, in which case their own preset stands. Passes with no kind of their own ignore this.
 */
export function resolveWorldPrompt(
  overview: WorldOverview | null | undefined,
  kind: WorldPromptKind,
  presetPrompt: string,
  optedOut: boolean,
): string {
  if (optedOut) return presetPrompt;
  return worldPrompt(overview, kind) ?? presetPrompt;
}

/**
 * The kinds as a sentence fragment naming what a world customizes: "a custom narration prompt", "custom
 * narration and choices prompts". Empty only for a world that customizes nothing, which advertises nothing.
 */
export function promptKindsPhrase(kinds: WorldPromptKind[]): string {
  const names = kinds.map((kind) => WORLD_PROMPT_KIND_LABELS[kind].toLowerCase());
  if (names.length === 0) return '';
  if (names.length === 1) return `a custom ${names[0]} prompt`;
  const list = names.length === 2
    ? names.join(' and ')
    : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  return `custom ${list} prompts`;
}

/** The find bar's target key for this kind's stored text — how a search hit navigates to its tab. */
export function worldPromptFieldKey(kind: WorldPromptKind): string {
  return `promptOverrides.${OVERRIDE_KEYS[kind].text}`;
}

/** The overrides object with this kind's text and flag set — how the editor writes one tab. */
export function setWorldPromptOverride(
  overrides: WorldPromptOverrides | undefined,
  kind: WorldPromptKind,
  update: { text?: string; enabled?: boolean },
): WorldPromptOverrides {
  const { text, flag } = OVERRIDE_KEYS[kind];
  const next: WorldPromptOverrides = { ...overrides };
  if (update.text !== undefined) next[text] = update.text;
  if (update.enabled !== undefined) next[flag] = update.enabled;
  return next;
}

/** The overrides object with this kind's stored text dropped, returning the tab to live tracking. */
export function clearWorldPromptOverride(
  overrides: WorldPromptOverrides | undefined,
  kind: WorldPromptKind,
): WorldPromptOverrides {
  const next: WorldPromptOverrides = { ...overrides };
  delete next[OVERRIDE_KEYS[kind].text];
  return next;
}

/**
 * Per-world "use this world's prompts" flag, defaulting to on. Only the declining world ids are persisted
 * (absent ⇒ the world's prompts are used), the same shape `useReadmeVisibility` stores. Local-only: a
 * player's choice is never exported with the world or a save.
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
