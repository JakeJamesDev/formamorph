import { usePersistentState, boolCodec, type Codec } from './usePersistentState';
import { isConnectionStyle, type ConnectionStyle } from './canvasEdgePath';
import {
  DEFAULT_CANVAS_CONNECTION_STYLE, DEFAULT_CANVAS_GRID_VISIBLE, DEFAULT_CANVAS_SNAP,
} from '@/contexts/settingsDefaults';

/**
 * How one author likes the Locations Canvas to draw and behave. These are the author's own working
 * preferences rather than anything about the world, so they live beside the app's other per-user settings and
 * never reach a world export — two authors opening the same world see their own grid, not each other's.
 *
 * Deliberately its own home rather than the Settings modal's context: the canvas is where they are chosen,
 * and the canvas is the only thing that reads them.
 */

const PREFIX = 'FORMAMORPH_canvas';

/** Snap dragged nodes to the grid. */
export const useCanvasSnap = () =>
  usePersistentState<boolean>(`${PREFIX}Snap`, DEFAULT_CANVAS_SNAP, boolCodec);

/** Draw the grid the nodes snap to. Independent of snapping: either can be had without the other. */
export const useCanvasGridVisible = () =>
  usePersistentState<boolean>(`${PREFIX}GridVisible`, DEFAULT_CANVAS_GRID_VISIBLE, boolCodec);

/** A shape retired from the picker leaves stored choices naming it, and a name nobody draws would be a canvas
 *  with no arrows at all — so an unrecognized one is refused and the default stands. */
const connectionStyleCodec: Codec<ConnectionStyle> = {
  parse: (raw) => {
    if (!isConnectionStyle(raw)) throw new Error('not a connection style');
    return raw;
  },
  serialize: (value) => value,
};

/** How arrows are drawn between boxes. Presentation only: the world reads the same in all three. */
export const useCanvasConnectionStyle = () =>
  usePersistentState<ConnectionStyle>(
    `${PREFIX}ConnectionStyle`, DEFAULT_CANVAS_CONNECTION_STYLE, connectionStyleCodec,
  );
