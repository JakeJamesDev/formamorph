/**
 * The production record of what the player has open: the screen, the top dialog and its active tabs.
 * Screens, dialogs and tabs report here while they show. It holds surface ids and nothing else.
 */
import type { SurfaceReporter } from '@/components/ui/surface';
import { SURFACE_IDS, type SurfaceId } from '@/lib/docs/surfaceMap';

/** What the player has open. */
export interface Surface {
  screen: SurfaceId | null;
  /** The dialog on top, null when the screen itself is on top. */
  dialog: SurfaceId | null;
  /**
   * The active tabs of the dialog, or of the screen when no dialog is open, outermost first. Of two
   * tabs side by side, the one that showed last is the deeper one.
   */
  tabs: readonly SurfaceId[];
}

/** A reporter that drops text that is not a surface id: such a report clears its entry. */
export interface SurfaceRegistry extends SurfaceReporter {
  get(): Surface;
  subscribe(listener: () => void): () => void;
}

interface Entry {
  id: SurfaceId;
  /** The place of the screen or dialog a tab is in; null for a screen or dialog. */
  layer: number | null;
}

const KNOWN_IDS: ReadonlySet<string> = new Set(SURFACE_IDS);
/** The surfaces that are screens. Every other place without a layer is a dialog. */
export const SCREEN_IDS: ReadonlySet<SurfaceId> = new Set<SurfaceId>(['mainMenu', 'gameViewer']);

function isSurfaceId(id: string | null): id is SurfaceId {
  return id !== null && KNOWN_IDS.has(id);
}

export function createSurfaceRegistry(): SurfaceRegistry {
  const entries = new Map<number, Entry>();
  const listeners = new Set<() => void>();
  let surface: Surface = { screen: null, dialog: null, tabs: [] };

  /** Reads the Surface again from the entries and tells the subscribers. */
  const update = () => {
    const places = [...entries.keys()].sort((a, b) => a - b);
    const layers = places.filter((place) => entries.get(place)!.layer === null);
    // A screen is under every dialog, also a dialog that was open before the screen showed.
    const screen = layers.filter((place) => SCREEN_IDS.has(entries.get(place)!.id)).at(-1);
    const dialog = layers.filter((place) => !SCREEN_IDS.has(entries.get(place)!.id)).at(-1);
    const top = dialog ?? screen;
    surface = {
      screen: screen === undefined ? null : entries.get(screen)!.id,
      dialog: dialog === undefined ? null : entries.get(dialog)!.id,
      tabs: places.filter((place) => top !== undefined && entries.get(place)!.layer === top).map((place) => entries.get(place)!.id),
    };
    for (const listener of listeners) listener();
  };

  const clear = (place: number) => {
    if (entries.delete(place)) update();
  };

  return {
    report(place, id, layer) {
      if (!isSurfaceId(id)) {
        clear(place);
        return;
      }
      const current = entries.get(place);
      if (current?.id === id && current.layer === layer) return;
      entries.set(place, { id, layer });
      update();
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
