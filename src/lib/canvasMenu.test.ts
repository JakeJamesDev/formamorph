import { beforeEach, describe, it, expect, vi } from "vitest";
import { canvasMenuSections, type CanvasMenuItem, type CanvasMenuState } from "./canvasMenu";

const noop = () => {};
const state: CanvasMenuState = {
  canUndo: true, canRedo: true, snap: false, gridVisible: true, connectionStyle: "bezier",
};
const actions = {
  undo: vi.fn(), redo: vi.fn(), setSnap: vi.fn(), setGridVisible: vi.fn(), setConnectionStyle: vi.fn(),
};
const labels = (sections: CanvasMenuItem[][]) => sections.map((section) => section.map((i) => i.label));
const rowsOf = (sections: CanvasMenuItem[][], label: string) =>
  sections.flat().find((item) => item.label === label);

describe("canvasMenuSections", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const nodeActions: CanvasMenuItem[] = [
    { label: "Edit Location", onSelect: noop },
    { label: "Auto Arrange", onSelect: noop },
  ];

  it("leads with history, then what was clicked, then the view switches, then the arrow shapes", () => {
    expect(labels(canvasMenuSections(state, actions, nodeActions))).toEqual([
      ["Undo", "Redo"],
      ["Edit Location", "Auto Arrange"],
      ["Snap To Grid", "Show Grid"],
      ["Straight Connections", "Curved Connections", "Elbow Connections"],
    ]);
  });

  it("offers undo and redo whatever the menu was opened on, the bare pane included", () => {
    for (const target of [nodeActions, [{ label: "Clear Selection", onSelect: noop }], []]) {
      expect(labels(canvasMenuSections(state, actions, target))[0]).toEqual(["Undo", "Redo"]);
    }
  });

  it("draws no group for a target with nothing to offer, rather than an empty one", () => {
    expect(canvasMenuSections(state, actions, [])).toHaveLength(3);
  });

  it("grays out each history row exactly when its own stack is empty", () => {
    const sections = canvasMenuSections({ ...state, canUndo: false }, actions, nodeActions);
    expect(rowsOf(sections, "Undo")?.disabled).toBe(true);
    expect(rowsOf(sections, "Redo")?.disabled).toBe(false);
    const back = canvasMenuSections({ ...state, canRedo: false }, actions, nodeActions);
    expect(rowsOf(back, "Undo")?.disabled).toBe(false);
    expect(rowsOf(back, "Redo")?.disabled).toBe(true);
  });

  it("keeps the rows grayed rather than hidden, so the menu's height never moves", () => {
    const none = canvasMenuSections({ ...state, canUndo: false, canRedo: false }, actions, nodeActions);
    expect(labels(none)).toEqual(labels(canvasMenuSections(state, actions, nodeActions)));
  });

  it("carries each setting's own state, and the one arrow shape in force", () => {
    const sections = canvasMenuSections(state, actions, nodeActions);
    expect(rowsOf(sections, "Snap To Grid")?.checked).toBe(false);
    expect(rowsOf(sections, "Show Grid")?.checked).toBe(true);
    const styles = sections[3];
    expect(styles.filter((item) => item.checked).map((item) => item.label)).toEqual(["Curved Connections"]);
    expect(styles.every((item) => item.exclusive)).toBe(true);
  });

  it("hands each row's press straight to what it is a row for", () => {
    const sections = canvasMenuSections(state, actions, nodeActions);
    rowsOf(sections, "Undo")?.onSelect();
    expect(actions.undo).toHaveBeenCalled();
    // A switch is offered its opposite: the row is what turns the setting off again.
    rowsOf(sections, "Show Grid")?.onSelect();
    expect(actions.setGridVisible).toHaveBeenCalledWith(false);
    rowsOf(sections, "Snap To Grid")?.onSelect();
    expect(actions.setSnap).toHaveBeenCalledWith(true);
    // A shape is chosen rather than switched: the row hands over its own value, whatever is in force.
    sections[3][2].onSelect();
    expect(actions.setConnectionStyle).toHaveBeenCalledWith("elbow");
  });
});
