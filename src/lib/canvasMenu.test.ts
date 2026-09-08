import { beforeEach, describe, it, expect, vi } from "vitest";
import { canvasMenuSections, type CanvasMenuItem, type CanvasMenuSection, type CanvasMenuState } from "./canvasMenu";

const noop = () => {};
const state: CanvasMenuState = {
  canUndo: true, canRedo: true, snap: false, gridVisible: true, connectionStyle: "bezier",
};
const actions = {
  undo: vi.fn(), redo: vi.fn(), setSnap: vi.fn(), setGridVisible: vi.fn(), setConnectionStyle: vi.fn(),
};
const titles = (sections: CanvasMenuSection[]) => sections.map((section) => section.title);
const labels = (sections: CanvasMenuSection[]) => sections.map((section) => section.items.map((i) => i.label));
const rowsOf = (sections: CanvasMenuSection[], label: string) =>
  sections.flatMap((section) => section.items).find((item) => item.label === label);

describe("canvasMenuSections", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const nodeActions: CanvasMenuItem[] = [
    { label: "Edit Location", onSelect: noop },
    { label: "Auto Arrange", onSelect: noop },
  ];

  it("leads with the titled sets, then history, then what was clicked", () => {
    const sections = canvasMenuSections(state, actions, nodeActions);
    expect(titles(sections)).toEqual(["Grid", "Connection Style", undefined, undefined]);
    expect(labels(sections)).toEqual([
      ["Snap To Grid", "Show Grid"],
      ["Straight", "Curved", "Elbow"],
      ["Undo", "Redo"],
      ["Edit Location", "Auto Arrange"],
    ]);
  });

  it("carries no title on the history or target sections", () => {
    const sections = canvasMenuSections(state, actions, nodeActions);
    expect(sections[2].title).toBeUndefined();
    expect(sections[3].title).toBeUndefined();
  });

  it("offers undo and redo whatever the menu was opened on, the bare pane included", () => {
    for (const target of [nodeActions, [{ label: "Clear Selection", onSelect: noop }], []]) {
      const sections = canvasMenuSections(state, actions, target);
      expect(labels(sections)[2]).toEqual(["Undo", "Redo"]);
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
    const styles = sections[1].items;
    expect(styles.filter((item) => item.checked).map((item) => item.label)).toEqual(["Curved"]);
    expect(styles.every((item) => item.exclusive)).toBe(true);
  });

  it("reads the arrow shapes by their short presentation label, since the title carries the shared word", () => {
    const styles = canvasMenuSections(state, actions, nodeActions)[1];
    expect(styles.title).toBe("Connection Style");
    expect(styles.items.map((item) => item.label)).toEqual(["Straight", "Curved", "Elbow"]);
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
    sections[1].items[2].onSelect();
    expect(actions.setConnectionStyle).toHaveBeenCalledWith("elbow");
  });
});
