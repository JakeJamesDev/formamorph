/** Where the Help tab sits on the screen edge, how a drag or an arrow key moves it, and where the device keeps it. */
import type { Viewport } from './windowBox';

export type Edge = 'left' | 'right' | 'top' | 'bottom';

/** An edge, and how far along it (0 to 1, from the top or the left) the tab's center is. */
export interface TabPlace {
  edge: Edge;
  at: number;
}

export const DEFAULT_TAB_PLACE: TabPlace = { edge: 'right', at: 0.5 };

const EDGES: readonly Edge[] = ['left', 'right', 'top', 'bottom'];
const STORAGE_KEY = 'formamorph.formaquestion.tab';
/** Space the tab keeps from a screen corner. */
const CORNER_GAP = 8;
/** How far one arrow key press moves the tab along its edge. */
const KEY_STEP = 0.05;

export const isEdge = (value: unknown): value is Edge => EDGES.includes(value as Edge);

export const isSideEdge = (edge: Edge): boolean => edge === 'left' || edge === 'right';

const edgeLength = (edge: Edge, viewport: Viewport) => (isSideEdge(edge) ? viewport.height : viewport.width);

/** The place moved along its edge until a tab `length` long is whole on the screen, clear of both corners. */
export function wholeOnScreen(place: TabPlace, length: number, viewport: Viewport): TabPlace {
  const min = Math.min((length / 2 + CORNER_GAP) / edgeLength(place.edge, viewport), 0.5);
  return { edge: place.edge, at: Math.min(Math.max(place.at, min), 1 - min) };
}

/** The edge nearest to a point, and the point's place along that edge. */
export function placeAt(x: number, y: number, viewport: Viewport): TabPlace {
  const distance: Record<Edge, number> = { left: x, right: viewport.width - x, top: y, bottom: viewport.height - y };
  const edge = EDGES.reduce((best, next) => (distance[next] < distance[best] ? next : best));
  return { edge, at: isSideEdge(edge) ? y / viewport.height : x / viewport.width };
}

type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

const ARROWS: Record<ArrowKey, { axis: 'x' | 'y'; toward: Edge; sign: -1 | 1 }> = {
  ArrowUp: { axis: 'y', toward: 'top', sign: -1 },
  ArrowDown: { axis: 'y', toward: 'bottom', sign: 1 },
  ArrowLeft: { axis: 'x', toward: 'left', sign: -1 },
  ArrowRight: { axis: 'x', toward: 'right', sign: 1 },
};

export const isArrowKey = (key: string): key is ArrowKey => key in ARROWS;

/**
 * The place after one arrow key press. An arrow along the edge moves the tab a step, and at the end of
 * the edge it turns the corner. An arrow away from the edge sends the tab to the opposite edge. An arrow
 * into the edge returns the same place.
 */
export function moveByKey(place: TabPlace, key: ArrowKey, length: number, viewport: Viewport): TabPlace {
  const arrow = ARROWS[key];
  const along = isSideEdge(place.edge) ? arrow.axis === 'y' : arrow.axis === 'x';
  if (!along) {
    if (arrow.toward === place.edge) return place;
    return wholeOnScreen({ edge: arrow.toward, at: place.at }, length, viewport);
  }
  const next = wholeOnScreen({ edge: place.edge, at: place.at + arrow.sign * KEY_STEP }, length, viewport);
  if (Math.abs(next.at - place.at) > 1e-6) return next;
  // The corner: the tab goes onto the edge the arrow points at, at the end nearest to where it was.
  const cornerAt = place.edge === 'left' || place.edge === 'top' ? 0 : 1;
  return wholeOnScreen({ edge: arrow.toward, at: cornerAt }, length, viewport);
}

/** The place this device stored, or the default when none is stored or storage is blocked. */
export function readTabPlace(): TabPlace {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<TabPlace> | null;
    if (stored && isEdge(stored.edge) && typeof stored.at === 'number' && Number.isFinite(stored.at)) {
      return { edge: stored.edge, at: Math.min(Math.max(stored.at, 0), 1) };
    }
  } catch { /* blocked storage or a damaged value */ }
  return DEFAULT_TAB_PLACE;
}

/** Stores the place on this device. With storage blocked, the place lasts for this visit only. */
export function writeTabPlace(place: TabPlace): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(place));
  } catch { /* blocked storage */ }
}
