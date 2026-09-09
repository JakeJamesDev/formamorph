import { Redo2, Undo2, type LucideIcon } from "lucide-react";
import { CONNECTION_STYLES, type ConnectionStyle } from "./canvasEdgePath";

/**
 * What the canvas's right-click menu offers, as groups rather than one undifferentiated run of rows. Walking
 * an edit back, doing something to what was clicked, changing how the map is drawn and choosing the shape of
 * its arrows are four different kinds of thing, and a menu that reads as one list makes the author find that
 * out by trying. The grouping is decided here so the menu component only has to draw it — and so what the
 * menu says can be checked without mounting a canvas.
 */

/** One row. `checked` is what makes a row a setting rather than an action; `exclusive` marks the settings
 *  that are one choice between each other rather than a switch of their own. `icon` is what an action row
 *  carries in place of a set row's checkmark — it never folds, so it stays visually apart instead. */
export interface CanvasMenuItem {
  label: string;
  checked?: boolean;
  exclusive?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  onSelect: () => void;
}

/** One group of rows, drawn between separators. A title is the flyout handle for a set that answers "which
 *  one?"; a flat action set that only does something carries none. */
export interface CanvasMenuSection {
  title?: string;
  items: CanvasMenuItem[];
}

/** The short word an author reads a connection shape by, once the "Connection Style" title above it already
 *  carries the shared word. A consumer with no title to carry it, like the toolbar picker, keeps the long
 *  form straight off `CONNECTION_STYLES`. */
const STYLE_ROW_LABEL: Record<ConnectionStyle, string> = { straight: 'Straight', bezier: 'Curved', elbow: 'Elbow' };

/** What the menu is reporting on: how the map is drawn, and whether there is anything to walk back. */
export interface CanvasMenuState {
  canUndo: boolean;
  canRedo: boolean;
  snap: boolean;
  gridVisible: boolean;
  connectionStyle: ConnectionStyle;
}

/** What its rows do. The rows for whatever the menu was opened on come in whole, since what a location or a
 *  selection offers is a question about the world rather than about the menu. */
export interface CanvasMenuActions {
  undo: () => void;
  redo: () => void;
  setSnap: (next: boolean) => void;
  setGridVisible: (next: boolean) => void;
  setConnectionStyle: (next: ConnectionStyle) => void;
}

/**
 * The menu's groups, in the order they are drawn: the titled sets first, then the flat action sets, matching
 * the Main Menu tile menu's own order. The pane has no toolbar to reach history from, so its row is the only
 * place undo is offered there. An empty stack grays its row out rather than dropping it: a menu that changes
 * height tells the author nothing about what is missing, and a grayed Undo is where they learn the map has
 * one at all.
 */
export function canvasMenuSections(
  state: CanvasMenuState,
  actions: CanvasMenuActions,
  targetActions: CanvasMenuItem[],
): CanvasMenuSection[] {
  const grid: CanvasMenuItem[] = [
    { label: "Snap To Grid", checked: state.snap, onSelect: () => actions.setSnap(!state.snap) },
    { label: "Show Grid", checked: state.gridVisible, onSelect: () => actions.setGridVisible(!state.gridVisible) },
  ];
  const style: CanvasMenuItem[] = CONNECTION_STYLES.map(({ value }) => ({
    label: STYLE_ROW_LABEL[value],
    checked: state.connectionStyle === value,
    exclusive: true,
    onSelect: () => actions.setConnectionStyle(value),
  }));
  const history: CanvasMenuItem[] = [
    { label: "Undo", icon: Undo2, disabled: !state.canUndo, onSelect: actions.undo },
    { label: "Redo", icon: Redo2, disabled: !state.canRedo, onSelect: actions.redo },
  ];
  // A target with nothing to offer contributes no group, rather than a separator with nothing between it.
  return [
    { title: "Grid", items: grid },
    { title: "Connection Style", items: style },
    { items: history },
    ...(targetActions.length ? [{ items: targetActions }] : []),
  ];
}
