/**
 * The production record of what the player has open: the screen, the top dialog and its active tabs.
 * Screens, dialogs and tabs report here while they show. It holds surface ids and nothing else.
 */
import { SURFACE_IDS, type SurfaceId } from '@/lib/docs/surfaceMap';
import { DEV_VIEWS } from '@/lib/devRoutes';

/** What the player has open. */
export interface Surface {
  screen: SurfaceId | null;
  /** The dialog on top, null when the screen itself is on top. */
  dialog: SurfaceId | null;
  /** The active tabs of the dialog, or of the screen when no dialog is open, outermost first. */
  tabs: readonly SurfaceId[];
}

export interface SurfaceRegistry {
  /** A new place in the stack, above every place taken before it. */
  nextOrder(): number;
  /**
   * Sets what the entry at this place shows. A screen or dialog names no layer. A tab names the place of
   * the screen or dialog it is in. Text that is not a surface id clears the entry.
   */
  report(order: number, id: string | null, layer?: number | null): void;
  clear(order: number): void;
  get(): Surface;
  subscribe(listener: () => void): () => void;
}

interface Entry {
  id: SurfaceId;
  /** The place of the screen or dialog a tab is in; null for a screen or dialog. */
  layer: number | null;
}

const KNOWN_IDS: ReadonlySet<string> = new Set(SURFACE_IDS);
const SCREEN_IDS: ReadonlySet<string> = new Set(DEV_VIEWS);

function isSurfaceId(id: string | null): id is SurfaceId {
  return id !== null && KNOWN_IDS.has(id);
}

export function createSurfaceRegistry(): SurfaceRegistry {
  let lastOrder = 0;
  const entries = new Map<number, Entry>();
  const listeners = new Set<() => void>();
  let surface: Surface = { screen: null, dialog: null, tabs: [] };

  const changed = () => {
    const places = [...entries.keys()].sort((a, b) => a - b);
    const layers = places.filter((order) => entries.get(order)?.layer === null);
    const top = layers.at(-1);
    const screen = layers.find((order) => SCREEN_IDS.has(entries.get(order)!.id));
    surface = {
      screen: screen === undefined ? null : entries.get(screen)!.id,
      dialog: top === undefined || top === screen ? null : entries.get(top)!.id,
      tabs: places.filter((order) => top !== undefined && entries.get(order)?.layer === top).map((order) => entries.get(order)!.id),
    };
    for (const listener of listeners) listener();
  };

  const clear = (order: number) => {
    if (entries.delete(order)) changed();
  };

  return {
    nextOrder: () => ++lastOrder,
    report(order, id, layer = null) {
      if (!isSurfaceId(id)) {
        clear(order);
        return;
      }
      const current = entries.get(order);
      if (current?.id === id && current.layer === layer) return;
      entries.set(order, { id, layer });
      changed();
    },
    clear,
    get: () => surface,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The app's one registry. */
export const surfaceRegistry = createSurfaceRegistry();
