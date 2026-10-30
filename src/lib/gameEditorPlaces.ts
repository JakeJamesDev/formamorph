/** Where the player is in the Game Editor: the rail tab, the entity on its panel, and the panel's tab. */
export interface GameEditorPlace {
  tab: string;
  selectedId: string | null;
  entityTab: string;
}

/** The places visited since the editor opened, for the back and forward buttons. */
export interface GameEditorPlaces {
  list: readonly GameEditorPlace[];
  at: number;
}

export const NO_PLACES: GameEditorPlaces = { list: [], at: -1 };

const samePlace = (a: GameEditorPlace, b: GameEditorPlace) =>
  a.tab === b.tab && a.selectedId === b.selectedId && a.entityTab === b.entityTab;

/** The history after visiting `place`: what lay ahead goes, as in a browser. The place it is at adds nothing. */
export function withPlace(places: GameEditorPlaces, place: GameEditorPlace): GameEditorPlaces {
  const current = places.list[places.at];
  if (current && samePlace(current, place)) return places;
  return { list: [...places.list.slice(0, places.at + 1), place], at: places.at + 1 };
}

/** The history one step back or forward, or null at that end. */
export function stepPlace(places: GameEditorPlaces, delta: -1 | 1): GameEditorPlaces | null {
  const at = places.at + delta;
  return at >= 0 && at < places.list.length ? { ...places, at } : null;
}
