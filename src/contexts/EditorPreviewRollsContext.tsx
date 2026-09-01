import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  buildPlaceholderPreview, decodePlaceholderToken, parsePlaceholderText, reachablePlaceholderIds,
  type PlaceholderMode,
} from '@/lib/placeholders';
import type { Placeholder, PlaceholderRolls } from '@/types';

/**
 * The editor's preview rolls: one drawn value per World-mode placeholder and one per Unique placement
 * chain, the same shape a playthrough's session holds — but editor UI state only. A field's Preview reads
 * from here rather than drawing on open, so a placeholder shows one value in every field until an author
 * rerolls it, and opening a Preview twice shows the same text twice.
 *
 * Nothing here reaches a save or a live session: the session store is a different provider, and the Test
 * Bench's Opening rolls are a third, so a trait pin set there never silently moves what a field shows.
 */
export interface EditorPreviewRolls {
  /** Changes on every reroll, so a preview memoized on the store re-reads it. */
  version: number;
  /** Token → value for every chip in `text`. A chip nothing has drawn yet is drawn now and kept, so the
   *  next reader — this field's next render, or another field — sees the same value. */
  preview(text: string, placeholders: Placeholder[]): Record<string, string>;
  /** Redraw `ids` and every placeholder reachable through their values; every other roll stays. */
  reroll(ids: Iterable<string>, placeholders: Placeholder[]): void;
}

const EditorPreviewRollsContext = createContext<EditorPreviewRolls | null>(null);

/** A store bound to this component: the rolls in a ref, so a first read can draw without a re-render, and
 *  a version in state, so a reroll re-renders whoever reads the store. */
function usePreviewRollStore(): EditorPreviewRolls {
  const rolls = useRef<PlaceholderRolls>({});
  // Which placeholder each bare Unique placement id belongs to — a nested Unique key carries its own
  // placeholder's id as its last step, but a chain root is keyed by the placement id alone.
  const uniqueOwner = useRef<Record<string, string>>({});
  const [version, setVersion] = useState(0);
  return useMemo(() => ({
    version,
    preview: (text, placeholders) => {
      for (const seg of parsePlaceholderText(text)) {
        const token = seg.type === 'variable' ? decodePlaceholderToken(seg.token) : null;
        if (token?.mode === 'unique') uniqueOwner.current[token.placementId] = token.id;
      }
      // A roll the author has since edited out of its pool is dropped before it is read, so a Preview
      // never shows text the placeholder no longer holds.
      const pool = new Map(placeholders.map((p) => [p.id, new Set((p.values ?? []).map((v) => v.text))]));
      const stale = (owner: string | undefined, value: string) => {
        const values = owner ? pool.get(owner) : undefined;
        return !!values && !values.has(value);
      };
      const world = rolls.current.world ?? {};
      for (const [id, value] of Object.entries(world)) if (stale(id, value)) delete world[id];
      const unique = rolls.current.unique ?? {};
      for (const [key, value] of Object.entries(unique)) if (stale(uniqueOwnerOf(key), value)) delete unique[key];
      const setRoll = (scope: PlaceholderMode, key: string, value: string) => {
        (rolls.current[scope] ??= {})[key] = value;
      };
      return buildPlaceholderPreview(text, placeholders, undefined, { rolls: rolls.current, setRoll });
    },
    reroll: (ids, placeholders) => {
      const drop = reachablePlaceholderIds(ids, placeholders);
      const world = rolls.current.world ?? {};
      for (const id of drop) delete world[id];
      const unique = rolls.current.unique ?? {};
      for (const key of Object.keys(unique)) {
        const owner = uniqueOwnerOf(key);
        if (owner && drop.has(owner)) delete unique[key];
      }
      setVersion((v) => v + 1);
    },
  }), [version]);
  // Hoisted so both readers share it; `useMemo` above closes over the refs, not over this.
  function uniqueOwnerOf(key: string): string | undefined {
    const slash = key.lastIndexOf('/');
    return slash === -1 ? uniqueOwner.current[key] : key.slice(slash + 1);
  }
}

/** Wraps an editor so every placeholder field inside it shares one set of preview rolls. */
export function EditorPreviewRollsProvider({ children }: { children: ReactNode }) {
  const store = usePreviewRollStore();
  return <EditorPreviewRollsContext.Provider value={store}>{children}</EditorPreviewRollsContext.Provider>;
}

/** The shared store, or a store of this field's own where no editor provides one. The private store is
 *  built either way — hooks cannot be skipped — and costs a ref and an unused state slot. */
// eslint-disable-next-line react-refresh/only-export-components
export function useEditorPreviewRolls(): EditorPreviewRolls {
  const shared = useContext(EditorPreviewRollsContext);
  const own = usePreviewRollStore();
  return shared ?? own;
}
