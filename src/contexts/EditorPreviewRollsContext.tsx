import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  buildPlaceholderPreview, decodePlaceholderToken, drawOpenPlaceholderValues, parsePlaceholderText,
  placeholderIsChoice, reachablePlaceholderIds,
  type ChosenTexts, type OpenPlaceholderValue, type PlaceholderMode, type PlaceholderToken,
} from '@/lib/placeholders';
import type { PinRow } from '@/lib/placeholderPins';
import { isPinStop, placeholderStops } from '@/lib/placeholderStops';
import type { Placeholder, PlaceholderRolls } from '@/types';

/**
 * The editor's preview rolls: one drawn value per World-mode placeholder and one per Unique placement
 * chain, as a playthrough's session holds them — but editor UI state only, kept by value id. A field's Preview reads
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
   *  next reader — this field's next render, or another field — sees the same value. `pinRows` are the
   *  world's pins, which a stop an author stepped to may name. */
  preview(text: string, placeholders: Placeholder[], pinRows?: readonly PinRow[]): Record<string, string>;
  /** Token → the value each chip in `text` opens on, from the same rolls `preview` reads. */
  open(text: string, placeholders: Placeholder[], pinRows?: readonly PinRow[]): Record<string, OpenPlaceholderValue>;
  /** Redraw `ids` and every placeholder reachable through their values; every other roll stays. */
  reroll(ids: Iterable<string>, placeholders: Placeholder[]): void;
  /** Roll `valueId` for one placement: a World placement moves every chip of its placeholder, a Unique
   *  placement moves only itself. Nothing else is redrawn. */
  setRoll(placement: Pick<PlaceholderToken, 'id' | 'mode' | 'placementId'>, valueId: string): void;
  /** Step one placement to a stop — a value or a pin (see `placeholderStops`). A step outranks any pin the
   *  draw lays itself, and a World step moves every chip of its placeholder. A reroll clears it. */
  choose(placement: Pick<PlaceholderToken, 'id' | 'mode' | 'placementId'>, stopKey: string): void;
  /** The stop a placement was stepped to, if any. */
  chosenStop(placement: Pick<PlaceholderToken, 'id' | 'mode' | 'placementId'>): string | undefined;
}

const EditorPreviewRollsContext = createContext<EditorPreviewRolls | null>(null);

/** A store bound to this component: the rolls in a ref, so a first read can draw without a re-render, and
 *  a version in state, so a reroll re-renders whoever reads the store. */
function usePreviewRollStore(): EditorPreviewRolls {
  // Rolls hold value ids, so a value the author re-spells stays rolled under its new text.
  const valueIds = useRef<Partial<Record<PlaceholderMode, Record<string, string>>>>({});
  // Which placeholder each bare Unique placement id belongs to — a nested Unique key carries its own
  // placeholder's id as its last step, but a chain root is keyed by the placement id alone.
  const uniqueOwner = useRef<Record<string, string>>({});
  // Stop keys an author stepped to, keyed as the rolls are.
  const chosenStops = useRef<Partial<Record<PlaceholderMode, Record<string, string>>>>({});
  const [version, setVersion] = useState(0);
  return useMemo((): EditorPreviewRolls => {
    /** The live rolls as texts, less any whose value is gone, the writer a fresh draw reports to, and the
     *  text of every stop an author stepped to. */
    const storeFor = (text: string, placeholders: Placeholder[], pinRows: readonly PinRow[] = []) => {
      for (const seg of parsePlaceholderText(text)) {
        const token = seg.type === 'variable' ? decodePlaceholderToken(seg.token) : null;
        if (token?.mode === 'unique') uniqueOwner.current[token.placementId] = token.id;
      }
      const byId = new Map(placeholders.map((p) => [p.id, p]));
      const ownerOf = (scope: PlaceholderMode, key: string) =>
        byId.get((scope === 'world' ? key : uniqueOwnerOf(key)) ?? '');
      // A roll whose value the author has since removed is dropped before it is read, so a Preview never
      // shows a value the placeholder no longer holds.
      const rolls: PlaceholderRolls = {};
      for (const scope of ['world', 'unique'] as const) {
        const ids = valueIds.current[scope] ?? {};
        const texts: Record<string, string> = (rolls[scope] = {});
        for (const [key, valueId] of Object.entries(ids)) {
          const owner = ownerOf(scope, key);
          if (!owner) continue;
          const value = owner.values?.find((v) => v.id === valueId);
          if (value) texts[key] = value.text;
          else delete ids[key];
        }
      }
      const recordDraw = (scope: PlaceholderMode, key: string, text: string) => {
        const value = ownerOf(scope, key)?.values?.find((v) => v.text === text);
        if (value) (valueIds.current[scope] ??= {})[key] = value.id;
      };
      // A stop this reader cannot see — a pin whose source it was not handed — is skipped, not dropped, so
      // a reader with the whole world still shows it.
      const chosen: ChosenTexts = {};
      for (const scope of ['world', 'unique'] as const) {
        for (const [key, stopKey] of Object.entries(chosenStops.current[scope] ?? {})) {
          const owner = ownerOf(scope, key);
          const stop = owner && placeholderStops(owner, pinRows).find((s) => s.key === stopKey);
          if (!owner || !stop) continue;
          // An Object shows every value at once; a step between them only picks which one a field opens.
          if (!isPinStop(stop) && !placeholderIsChoice(owner) && owner.values.length > 1) continue;
          (chosen[scope] ??= {})[key] = stop.text;
        }
      }
      return { rolls, setRoll: recordDraw, chosen };
    };
    const keyOf = ({ id, mode, placementId }: Pick<PlaceholderToken, 'id' | 'mode' | 'placementId'>) =>
      (mode === 'world' ? id : placementId);
    return {
      version,
      preview: (text, placeholders, pinRows) =>
        buildPlaceholderPreview(text, placeholders, undefined, storeFor(text, placeholders, pinRows)),
      open: (text, placeholders, pinRows) =>
        drawOpenPlaceholderValues(text, placeholders, undefined, storeFor(text, placeholders, pinRows)),
      reroll: (ids, placeholders) => {
        const drop = reachablePlaceholderIds(ids, placeholders);
        // A reroll draws afresh, so it drops a step as it drops a roll.
        for (const store of [valueIds.current, chosenStops.current]) {
          const world = store.world ?? {};
          for (const id of drop) delete world[id];
          const unique = store.unique ?? {};
          for (const key of Object.keys(unique)) {
            const owner = uniqueOwnerOf(key);
            if (owner && drop.has(owner)) delete unique[key];
          }
        }
        setVersion((v) => v + 1);
      },
      setRoll: ({ id, mode, placementId }, valueId) => {
        if (mode === 'unique') uniqueOwner.current[placementId] = id;
        (valueIds.current[mode] ??= {})[mode === 'world' ? id : placementId] = valueId;
        setVersion((v) => v + 1);
      },
      choose: (placement, stopKey) => {
        if (placement.mode === 'unique') uniqueOwner.current[placement.placementId] = placement.id;
        (chosenStops.current[placement.mode] ??= {})[keyOf(placement)] = stopKey;
        setVersion((v) => v + 1);
      },
      chosenStop: (placement) => chosenStops.current[placement.mode]?.[keyOf(placement)],
    };
  }, [version]);
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
