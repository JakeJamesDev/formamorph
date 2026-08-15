import { describe, it, expect } from "vitest";
import {
  CANVAS_HISTORY_LIMIT, canvasHistoryFor, EMPTY_CANVAS_HISTORY, historyShortcut, recordCanvasEdit,
  redoCanvasEdit, undoCanvasEdit,
  type CanvasEdit, type CanvasHistory, type CanvasRestore, type CanvasWorld,
} from "./canvasHistory";
import {
  applyCanvasDrops, applyCanvasIntent, connectIntent, deleteIntent, directionIntent, hintIntent,
  multiDropIntents,
} from "./locationCanvas";
import { autoArrange, autoArrangeAll } from "./locationArrange";
import type { Connection, GameLocation } from "@/types";

// village > { tavern, house } ; shore stands on its own.
const village: GameLocation = { id: "village", name: "Village", isStarting: true };
const tavern: GameLocation = { id: "tavern", name: "Tavern", parentId: "village", canvasPosition: { x: 20, y: 60 } };
const house: GameLocation = { id: "house", name: "House", parentId: "village", canvasPosition: { x: 24, y: 64 } };
const shore: GameLocation = { id: "shore", name: "Shore", canvasPosition: { x: 400, y: 40 } };
const world: GameLocation[] = [village, tavern, house, shore];

/** The world an edit left behind, which is what the next press is answered against. */
const worldAfter = (edit: CanvasEdit): CanvasWorld => (edit.slice === "locations"
  ? { locations: edit.after, connections: [] }
  : { locations: world, connections: edit.after });

/** Records one edit onto a fresh stack, undoes it, and hands back what the editor would write. */
const roundTrip = (edit: CanvasEdit) => {
  const recorded = recordCanvasEdit(EMPTY_CANVAS_HISTORY, edit);
  const undone = undoCanvasEdit(recorded, worldAfter(edit))!;
  const undoneWorld: CanvasWorld = undone.restore.slice === "locations"
    ? { locations: undone.restore.locations, connections: [] }
    : { locations: world, connections: undone.restore.connections };
  const redone = redoCanvasEdit(undone.history, undoneWorld)!;
  return { undone, redone };
};

describe("undoing a canvas edit", () => {
  it("puts a whole multi-drag back in one step", () => {
    const drops = multiDropIntents(world, [
      { id: "shore", position: { x: 520, y: 180 } },
      { id: "house", position: { x: 90, y: 130 } },
    ]);
    const after = applyCanvasDrops(world, drops);
    expect(after).not.toEqual(world); // the drag really moved something

    const { undone, redone } = roundTrip({ slice: "locations", before: world, after });
    expect(undone.restore).toEqual({ slice: "locations", locations: world });
    expect(undone.history.past).toHaveLength(0); // one step, not one per location moved
    expect(redone.restore).toEqual({ slice: "locations", locations: after });
  });

  it("puts a reparent back, holder and all", () => {
    const drops = multiDropIntents(world, [{ id: "shore", position: { x: 24, y: 8 } }]);
    const after = applyCanvasDrops(world, drops);
    expect(after.find((l) => l.id === "shore")!.parentId).toBe("village");

    const { undone } = roundTrip({ slice: "locations", before: world, after });
    const restored = (undone.restore as { locations: GameLocation[] }).locations;
    expect(restored).toEqual(world);
    expect(restored.find((l) => l.id === "shore")!.parentId).toBeUndefined();
  });

  it("reverts an Auto Arrange as one step however many positions it rewrote", () => {
    const after = autoArrangeAll(world, []);
    const moved = after.filter((l, i) => l.canvasPosition?.x !== world[i].canvasPosition?.x);
    expect(moved.length).toBeGreaterThan(1); // several locations, still one edit

    const { undone } = roundTrip({ slice: "locations", before: world, after });
    expect(undone.restore).toEqual({ slice: "locations", locations: world });
    expect(undone.history.past).toHaveLength(0);
  });

  it("reverts a single group's arrangement", () => {
    const after = autoArrange(world, [], "village");
    expect(after).not.toEqual(world);
    const { undone, redone } = roundTrip({ slice: "locations", before: world, after });
    expect(undone.restore).toEqual({ slice: "locations", locations: world });
    expect(redone.restore).toEqual({ slice: "locations", locations: after });
  });

  it.each([
    ["creating", (c: Connection[]) => connectIntent("tavern", "shore", c)!],
    ["editing the direction", (c: Connection[]) => directionIntent(c[0], "outgoing")],
    ["deleting", (c: Connection[]) => deleteIntent(c[0])],
  ])("puts a Connection back after %s one", (_label, intent) => {
    const existing: Connection[] = [{ id: "conn-1", from: "village", to: "shore", twoWay: true }];
    const after = applyCanvasIntent(existing, intent(existing));
    expect(after).not.toEqual(existing);

    const { undone, redone } = roundTrip({ slice: "connections", before: existing, after });
    expect(undone.restore).toEqual({ slice: "connections", connections: existing });
    expect(redone.restore).toEqual({ slice: "connections", connections: after });
  });
});

describe("undoing against a world that moved on", () => {
  it("leaves an edit made in the list panel since alone", () => {
    // The canvas moves the Shore; the author then renames the Tavern in the list view.
    const dragged = applyCanvasDrops(world, multiDropIntents(world, [{ id: "shore", position: { x: 520, y: 180 } }]));
    const renamed = dragged.map((l) => (l.id === "tavern" ? { ...l, name: "The Bell" } : l));
    const history = recordCanvasEdit(EMPTY_CANVAS_HISTORY, { slice: "locations", before: world, after: dragged });

    const undone = undoCanvasEdit(history, { locations: renamed, connections: [] })!;
    const back = (undone.restore as { locations: GameLocation[] }).locations;
    expect(back.find((l) => l.id === "shore")!.canvasPosition).toEqual(shore.canvasPosition); // the drag, undone
    expect(back.find((l) => l.id === "tavern")!.name).toBe("The Bell"); // the rename, untouched
  });

  it("leaves a Connection authored since alone when a deletion is taken back", () => {
    const deleted: Connection[] = [];
    const removed: Connection = { id: "conn-1", from: "village", to: "shore", twoWay: true };
    const authoredSince: Connection = { id: "conn-2", from: "tavern", to: "house", twoWay: true };
    const history = recordCanvasEdit(EMPTY_CANVAS_HISTORY, {
      slice: "connections", before: [removed], after: deleted,
    });

    const undone = undoCanvasEdit(history, { locations: world, connections: [authoredSince] })!;
    expect((undone.restore as { connections: Connection[] }).connections).toEqual([authoredSince, removed]);
  });
});

describe("the canvas history stack", () => {
  const edit = (n: number): CanvasEdit => ({
    slice: "locations",
    before: [{ id: `l${n}`, name: "before" }],
    after: [{ id: `l${n}`, name: "after" }],
  });

  /** The world every one of those edits left behind. */
  const edited: CanvasWorld = {
    locations: [1, 2, 3].map((n) => ({ id: `l${n}`, name: "after" })),
    connections: [],
  };
  const restored = (step: { restore: CanvasRestore } | null) =>
    (step!.restore as { locations: GameLocation[] }).locations;

  it("undoes and redoes several edits in order", () => {
    let history = EMPTY_CANVAS_HISTORY;
    for (const n of [1, 2, 3]) history = recordCanvasEdit(history, edit(n));

    // Each step names its own record and leaves the other two as the world has them.
    const first = undoCanvasEdit(history, edited)!;
    expect(restored(first)).toEqual([
      { id: "l1", name: "after" }, { id: "l2", name: "after" }, { id: "l3", name: "before" },
    ]);
    const second = undoCanvasEdit(first.history, { ...edited, locations: restored(first) })!;
    expect(restored(second).map((l) => l.name)).toEqual(["after", "before", "before"]);
    const forward = redoCanvasEdit(second.history, { ...edited, locations: restored(second) })!;
    expect(restored(forward).map((l) => l.name)).toEqual(["after", "after", "before"]);
  });

  it("has nothing to undo or redo on an empty stack", () => {
    expect(undoCanvasEdit(EMPTY_CANVAS_HISTORY, edited)).toBeNull();
    expect(redoCanvasEdit(EMPTY_CANVAS_HISTORY, edited)).toBeNull();
  });

  it("drops the forward once a new edit is made", () => {
    const history = recordCanvasEdit(recordCanvasEdit(EMPTY_CANVAS_HISTORY, edit(1)), edit(2));
    const undone = undoCanvasEdit(history, edited)!;
    expect(undone.history.future).toHaveLength(1);
    const branched = recordCanvasEdit(undone.history, edit(3));
    expect(branched.future).toHaveLength(0);
    expect(redoCanvasEdit(branched, edited)).toBeNull();
  });

  it("caps the stack, dropping the oldest step rather than the newest", () => {
    let history: CanvasHistory = EMPTY_CANVAS_HISTORY;
    for (let n = 0; n < CANVAS_HISTORY_LIMIT + 5; n += 1) history = recordCanvasEdit(history, edit(n));
    expect(history.past).toHaveLength(CANVAS_HISTORY_LIMIT);
    expect(history.past[0].before[0].id).toBe("l5");
    expect(history.past[CANVAS_HISTORY_LIMIT - 1].before[0].id).toBe(`l${CANVAS_HISTORY_LIMIT + 4}`);
  });

  it("folds a run of hint keystrokes into one step, and starts a new one after something else", () => {
    const base: Connection[] = [{ id: "conn-1", from: "village", to: "shore", twoWay: true }];
    const typed = ["t", "th", "thr"].map((hint) => applyCanvasIntent(base, hintIntent(base[0], hint)));
    let history = EMPTY_CANVAS_HISTORY;
    let before = base;
    for (const after of typed) {
      history = recordCanvasEdit(history, { slice: "connections", before, after, mergeKey: "hint:conn-1" });
      before = after;
    }
    expect(history.past).toHaveLength(1);

    // One press takes the whole word back off, and putting it back gives the last thing typed.
    const undone = undoCanvasEdit(history, { locations: world, connections: typed[2] })!;
    expect(undone.restore).toEqual({ slice: "connections", connections: base });
    const forward = redoCanvasEdit(undone.history, { locations: world, connections: base })!;
    expect(forward.restore).toEqual({ slice: "connections", connections: typed[2] });

    // A different record's hint is its own step, not a continuation of that run.
    const other = recordCanvasEdit(history, {
      slice: "connections", before: typed[2], after: base, mergeKey: "hint:conn-2",
    });
    expect(other.past).toHaveLength(2);
  });
});

describe("the session's stack", () => {
  const edit: CanvasEdit = {
    slice: "locations", before: world, after: [...world, { id: "new", name: "New" }],
  };

  it("outlives a canvas being unmounted and mounted again", () => {
    const first = canvasHistoryFor("world-1");
    first.current = recordCanvasEdit(first.current, edit);
    // The same world asked for again: what a remounted canvas would pick up.
    expect(canvasHistoryFor("world-1").current.past).toHaveLength(1);
  });

  it("starts over when another world is opened", () => {
    const stack = canvasHistoryFor("world-1");
    stack.current = recordCanvasEdit(stack.current, edit);
    expect(canvasHistoryFor("world-2").current.past).toHaveLength(0);
    // And going back is not a way to reach the first world's steps — they were dropped, not parked.
    expect(canvasHistoryFor("world-1").current.past).toHaveLength(0);
  });
});

describe("the undo and redo chords", () => {
  const chord = (key: string, mods: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}) =>
    historyShortcut({ key, ctrlKey: !!mods.ctrl, metaKey: !!mods.meta, shiftKey: !!mods.shift });

  it("reads Ctrl+Z as undo and both redo chords as redo", () => {
    expect(chord("z", { ctrl: true })).toBe("undo");
    expect(chord("Z", { meta: true })).toBe("undo");
    expect(chord("y", { ctrl: true })).toBe("redo");
    expect(chord("z", { ctrl: true, shift: true })).toBe("redo");
    expect(chord("Z", { meta: true, shift: true })).toBe("redo");
  });

  it("ignores the same keys without the modifier, and other chords", () => {
    expect(chord("z")).toBeNull();
    expect(chord("y")).toBeNull();
    expect(chord("a", { ctrl: true })).toBeNull();
    expect(chord("Escape", { ctrl: true })).toBeNull();
  });
});
