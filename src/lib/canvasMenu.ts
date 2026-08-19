import { CONNECTION_STYLES, type ConnectionStyle } from "./canvasEdgePath";

/**
 * What the canvas's right-click menu offers, as groups rather than one undifferentiated run of rows. Walking
 * an edit back, doing something to what was clicked, changing how the map is drawn and choosing the shape of
 * its arrows are four different kinds of thing, and a menu that reads as one list makes the author find that
 * out by trying. The grouping is decided here so the menu component only has to draw it — and so what the
 * menu says can be checked without mounting a canvas.
 */

/** One row. `checked` is what makes a row a setting rather than an action; `exclusive` marks the settings
 *  that are one choice between each other rather than a switch of their own. */
export interface CanvasMenuItem {
  label: string;
  checked?: boolean;
  exclusive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

/** One group of rows, drawn between separators. */
export type CanvasMenuSection = CanvasMenuItem[];

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
 * The menu's groups, in the order they are drawn. History leads every menu the canvas opens — the pane has no
 * toolbar to reach it from, so this is the only place undo is offered there. An empty stack grays its row out
 * rather than dropping it: a menu that changes height tells the author nothing about what is missing, and a
 * grayed Undo is where they learn the map has one at all.
 */
export function canvasMenuSections(
  state: CanvasMenuState,
  actions: CanvasMenuActions,
  targetActions: CanvasMenuItem[],
): CanvasMenuSection[] {
  const history: CanvasMenuSection = [
    { label: "Undo", disabled: !state.canUndo, onSelect: actions.undo },
    { label: "Redo", disabled: !state.canRedo, onSelect: actions.redo },
  ];
  const view: CanvasMenuSection = [
    { label: "Snap To Grid", checked: state.snap, onSelect: () => actions.setSnap(!state.snap) },
    { label: "Show Grid", checked: state.gridVisible, onSelect: () => actions.setGridVisible(!state.gridVisible) },
  ];
  const style: CanvasMenuSection = CONNECTION_STYLES.map(({ value, label }) => ({
    label,
    checked: state.connectionStyle === value,
    exclusive: true,
    onSelect: () => actions.setConnectionStyle(value),
  }));
  // A target with nothing to offer contributes no group, rather than a separator with nothing between it.
  return [history, ...(targetActions.length ? [targetActions] : []), view, style];
}
