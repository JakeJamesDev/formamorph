/**
 * World Editor Simple/Advanced mode — an editor-chrome preference, never part of a world.
 *
 * Simple thins the editor for new authors: it hides the Placeholders and Dictionary tabs, the
 * placeholder palette bar, the group-creating `+` popover, the library import pickers, and the
 * advanced fields listed in `docs-internal/world-editor-simple-mode.md`. Simple means simple: a hidden
 * field stays hidden whether or not it holds a value, and the header icon says when this world has
 * something out of sight.
 *
 * Outside the provider (the library's entity editor, tests) the default is Advanced: those surfaces
 * aren't the World Editor and shouldn't lose fields.
 */
import { createContext, useContext } from 'react';

export type EditorMode = 'simple' | 'advanced';

const STORAGE_KEY = 'formamorph.worldEditorMode';

/** The stored preference, defaulting to Simple on first run. */
export function readEditorMode(): EditorMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'advanced' ? 'advanced' : 'simple';
  } catch {
    return 'simple';
  }
}

export function writeEditorMode(mode: EditorMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private-mode storage denial: the mode still works for this session.
  }
}

export interface EditorModeValue {
  mode: EditorMode;
  advanced: boolean;
  setMode: (mode: EditorMode) => void;
}

export const EditorModeContext = createContext<EditorModeValue>({
  mode: 'advanced',
  advanced: true,
  setMode: () => {},
});

export function useEditorMode(): EditorModeValue {
  return useContext(EditorModeContext);
}

/** A field holds a value the header icon should report on. */
export function hasValue(v: unknown): boolean {
  if (v === undefined || v === null || v === false || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}
