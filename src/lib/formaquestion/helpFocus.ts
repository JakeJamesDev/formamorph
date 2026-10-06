/**
 * The item the player has selected, for Formaquestion. A panel that shows one item registers it while it
 * shows; the help window reads the newest one when a question is sent. The surface registry holds the
 * structure and stays ids only; the focus adds the item's words.
 */
import { useEffect } from 'react';

export type HelpFocusKind = 'stat' | 'trait' | 'entity' | 'location' | 'entry';

/** One selected item. */
export interface HelpFocus {
  kind: HelpFocusKind;
  id: string;
  name: string;
}

export interface HelpFocusRegistry {
  /** Registers a focus; the newest registered one is the focus. Returns the step that removes it. */
  register(focus: HelpFocus): () => void;
  get(): HelpFocus | undefined;
}

export function createHelpFocusRegistry(): HelpFocusRegistry {
  const focuses: HelpFocus[] = [];
  return {
    register(focus) {
      focuses.push(focus);
      return () => {
        const at = focuses.lastIndexOf(focus);
        if (at !== -1) focuses.splice(at, 1);
      };
    },
    get: () => focuses.at(-1),
  };
}

/** The app's one registry. */
export const helpFocus = createHelpFocusRegistry();

/** Registers `focus` while the caller is mounted and passes one with a name. A rename registers the new name. */
export function useHelpFocus(focus: HelpFocus | undefined): void {
  const { kind, id, name } = focus ?? {};
  useEffect(() => (kind && id !== undefined && name?.trim() ? helpFocus.register({ kind, id, name }) : undefined), [kind, id, name]);
}
