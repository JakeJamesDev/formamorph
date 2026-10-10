import { describe, it, expect } from "vitest";
import {
  beginGroup, canRedo, canUndo, createHistory, diffSlice, endGroup, HISTORY_LIMIT, historyShortcut, jumpTo, markSaved,
  record, recordFieldMove, redo, replaceRecords, settleKey, undo, WORLD_SLICES,
  type EditorHistory, type RecordOptions, type SliceEdit, type StepOrigin, type WorldSlices,
} from "./editorHistory";
import { joinLabelParts, stepLabel, stepLabelParts } from "./editorHistoryLabels";
import type { Entity, GameLocation, Placeholder, Stat } from "@/types";

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat => ({
  id, name, type: "number", description: "", min: 0, max: 100, regen: 0, descriptors: [], ...extra,
});
const location = (id: string, name: string): GameLocation => ({ id, name });

const baseWorld = (): WorldSlices => ({
  worldOverview: {
    name: "Sedge Landing", description: "", author: "", thumbnail: null, bgm: null, systemPrompt: "",
    use3DModel: true, tags: [],
  },
  stats: [stat("hunger", "Hunger"), stat("thirst", "Thirst"), stat("mood", "Mood")],
  locations: [location("docks", "Docks"), location("market", "Market")],
  connections: [], entities: [], entityGroups: [], traits: [], traitGroups: [], statUpdates: [],
  dictionaries: [], placeholders: [], placeholderGroups: [],
});

/**
 * An editor session: each write replaces slices on the world and records their diff, the way the provider's
 * recorder will. Undo, redo and jump write their restore back.
 */
function session(options: { pauseMs?: number } = {}) {
  let world = baseWorld();
  let history: EditorHistory = createHistory(options);
  const baseline = world;
  return {
    baseline,
    get world() { return world; },
    get history() { return history; },
    write(patch: Partial<WorldSlices>, opts: RecordOptions = {}) {
      const next = { ...world, ...patch };
      const edits = WORLD_SLICES
        .map((slice) => diffSlice(slice, world[slice], next[slice]))
        .filter((edit): edit is SliceEdit => edit !== null);
      world = next;
      history = record(history, edits, { now: 0, ...opts });
    },
    /** A text field's own undo or redo: a move or a join where a Step matches, a plain write otherwise. */
    fieldWrite(patch: Partial<WorldSlices>, opts: RecordOptions = {}) {
      const next = { ...world, ...patch };
      const edits = WORLD_SLICES
        .map((slice) => diffSlice(slice, world[slice], next[slice]))
        .filter((edit): edit is SliceEdit => edit !== null);
      world = next;
      history = recordFieldMove(history, edits, opts.key, opts.now ?? 0) ?? record(history, edits, { now: 0, ...opts });
    },
    /** A write that bypasses the history, standing in for an edit the recorder has not seen yet. */
    writeUnrecorded(patch: Partial<WorldSlices>) { world = { ...world, ...patch }; },
    undo() { const step = undo(history, world); if (step) { history = step.history; world = { ...world, ...step.restore }; } },
    redo() { const step = redo(history, world); if (step) { history = step.history; world = { ...world, ...step.restore }; } },
    jump(to: number) { const step = jumpTo(history, world, to); if (step) { history = step.history; world = { ...world, ...step.restore }; } },
    group(label?: string) { history = beginGroup(history, label); },
    endGroup() { history = endGroup(history); },
    save() { history = markSaved(history); },
    replace(swaps: Map<object, object>) { history = replaceRecords(history, swaps); },
  };
}

const names = (records: { name: string }[]) => records.map((r) => r.name);

describe("order-aware restore", () => {
  it("undoes a reorder to the earlier order and redoes it to the later one", () => {
    const s = session();
    const [hunger, thirst, mood] = s.world.stats;
    s.write({ stats: [mood, hunger, thirst] });

    s.undo();
    expect(names(s.world.stats)).toEqual(["Hunger", "Thirst", "Mood"]);
    s.redo();
    expect(names(s.world.stats)).toEqual(["Mood", "Hunger", "Thirst"]);
  });

  it("returns an undone delete to its earlier index, not the end", () => {
    const s = session();
    s.write({ stats: s.world.stats.filter((st) => st.id !== "thirst") });
    s.undo();
    expect(names(s.world.stats)).toEqual(["Hunger", "Thirst", "Mood"]);
  });

  it("returns the first record to the front when it was deleted", () => {
    const s = session();
    s.write({ stats: s.world.stats.slice(1) });
    s.undo();
    expect(names(s.world.stats)).toEqual(["Hunger", "Thirst", "Mood"]);
  });

  it("keeps an edit made to another record between a Step and its undo", () => {
    const s = session();
    s.write({ stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, description: "Food" } : st)) });
    s.writeUnrecorded({ stats: s.world.stats.map((st) => (st.id === "mood" ? { ...st, name: "Spirit" } : st)) });

    s.undo();
    expect(s.world.stats.find((st) => st.id === "hunger")!.description).toBe("");
    expect(s.world.stats.find((st) => st.id === "mood")!.name).toBe("Spirit");
  });

  it("leaves a later reorder alone when undoing a field edit", () => {
    const s = session();
    s.write({ stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, max: 50 } : st)) });
    const [hunger, thirst, mood] = s.world.stats;
    s.writeUnrecorded({ stats: [mood, thirst, hunger] });

    s.undo();
    expect(names(s.world.stats)).toEqual(["Mood", "Thirst", "Hunger"]);
    expect(s.world.stats.find((st) => st.id === "hunger")!.max).toBe(100);
  });

  it("drops a record the Step added and brings it back on redo", () => {
    const s = session();
    s.write({ stats: [...s.world.stats, stat("fatigue", "Fatigue")] });
    s.undo();
    expect(names(s.world.stats)).toEqual(["Hunger", "Thirst", "Mood"]);
    s.redo();
    expect(names(s.world.stats)).toEqual(["Hunger", "Thirst", "Mood", "Fatigue"]);
  });

  it("restores the overview fields a Step changed and leaves the others", () => {
    const s = session();
    s.write({ worldOverview: { ...s.world.worldOverview, thumbnail: "data:image/webp;base64,AAAA" } });
    s.writeUnrecorded({ worldOverview: { ...s.world.worldOverview, author: "Wren" } });

    s.undo();
    expect(s.world.worldOverview.thumbnail).toBeNull();
    expect(s.world.worldOverview.author).toBe("Wren");
  });

  it("removes an overview field the Step added", () => {
    const s = session();
    s.write({ worldOverview: { ...s.world.worldOverview, readme: "Welcome" } });
    s.undo();
    expect(s.world.worldOverview).toEqual(s.baseline.worldOverview);
  });
});

describe("merge precedence", () => {
  const typed = (s: ReturnType<typeof session>, text: string, opts: RecordOptions) => s.write({
    stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, description: text } : st)),
  }, opts);
  const descriptionKey = { slice: "stats", id: "hunger", field: "description" } as const;

  it("records one Step for a group open across several writes", () => {
    const s = session();
    s.group("Move Locations");
    s.write({ locations: [s.world.locations[1], s.world.locations[0]] }, { now: 0 });
    s.write({ locations: s.world.locations.map((l) => ({ ...l, canvasPosition: { x: 1, y: 2 } })) }, { now: 5000 });
    s.endGroup();
    expect(s.history.steps).toHaveLength(1);

    s.undo();
    expect(s.world.locations).toEqual(s.baseline.locations);
  });

  it("records one Step for a keyed run within the pause, and a new one after it", () => {
    const s = session();
    typed(s, "F", { key: descriptionKey, now: 0 });
    typed(s, "Fo", { key: descriptionKey, now: 600 });
    typed(s, "Foo", { key: descriptionKey, now: 1200 });
    expect(s.history.steps).toHaveLength(1);

    typed(s, "Food", { key: descriptionKey, now: 2300 });
    expect(s.history.steps).toHaveLength(2);
    s.undo();
    expect(s.world.stats[0].description).toBe("Foo");
    s.undo();
    expect(s.world.stats[0].description).toBe("");
  });

  it("takes the pause as a parameter", () => {
    const s = session({ pauseMs: 100 });
    typed(s, "F", { key: descriptionKey, now: 0 });
    typed(s, "Fo", { key: descriptionKey, now: 150 });
    expect(s.history.steps).toHaveLength(2);
  });

  it("folds writes in one tick into one Step", () => {
    const s = session();
    s.write({ stats: s.world.stats.slice(1) }, { tick: 7 });
    s.write({ locations: s.world.locations.slice(1) }, { tick: 7 });
    expect(s.history.steps).toHaveLength(1);
    s.undo();
    expect(s.world.stats).toEqual(s.baseline.stats);
    expect(s.world.locations).toEqual(s.baseline.locations);
  });

  it("lets an open group beat a key", () => {
    const s = session();
    s.group();
    typed(s, "F", { key: descriptionKey, now: 0 });
    s.write({ stats: s.world.stats.map((st) => (st.id === "mood" ? { ...st, max: 9 } : st)) },
      { key: { slice: "stats", id: "mood", field: "max" }, now: 10 });
    typed(s, "Fo", { key: descriptionKey, now: 5000 });
    s.endGroup();
    expect(s.history.steps).toHaveLength(1);
  });

  it("lets a key beat a tick fold: a folded Step keeps its first key, so the keyed run still merges", () => {
    const s = session();
    typed(s, "F", { key: descriptionKey, tick: 1, now: 0 });
    s.write({ stats: s.world.stats.map((st) => (st.id === "mood" ? { ...st, max: 9 } : st)) },
      { key: { slice: "stats", id: "mood", field: "max" }, tick: 1, now: 0 });
    expect(s.history.steps).toHaveLength(1);

    typed(s, "Fo", { key: descriptionKey, tick: 2, now: 300 });
    expect(s.history.steps).toHaveLength(1);
  });

  describe("an Origin", () => {
    const here: StepOrigin = { tab: "stats", ids: ["hunger"], subTab: "details", view: "list", field: "stats.hunger.description" };
    const run = (first: StepOrigin | undefined, second: StepOrigin | undefined) => {
      const s = session();
      typed(s, "F", { key: descriptionKey, now: 0, origin: first });
      typed(s, "Fo", { key: descriptionKey, now: 300, origin: second });
      return s;
    };

    it("merges a keyed run typed in one place", () => {
      const s = run(here, { ...here, ids: [...here.ids!] });
      expect(s.history.steps).toHaveLength(1);
      expect(s.history.steps[0].origin).toEqual(here);
    });

    it.each([
      ["field", { field: "stats.hunger.name" }],
      ["tab", { tab: "traits" }],
      ["selection", { ids: ["hunger", "thirst"] }],
      ["selection order", { ids: ["thirst", "hunger"] }],
      ["selected record", { ids: ["thirst"] }],
      ["sub-view", { subTab: "rules" }],
      ["Locations view", { view: "canvas" }],
    ] as const)("starts a new Step for a write from a different %s within the pause", (_name, change) => {
      const s = run(here, { ...here, ...change });
      expect(s.history.steps).toHaveLength(2);
      expect(s.history.steps[1].origin).toEqual({ ...here, ...change });
    });

    it("starts a new Step when the second write drops the field", () => {
      const { field: _field, ...fieldless } = here;
      expect(run(here, fieldless).history.steps).toHaveLength(2);
    });

    it("reads an absent selection as an empty one", () => {
      const s = run({ tab: "overview" }, { tab: "overview", ids: [] });
      expect(s.history.steps).toHaveLength(1);
    });

    it("merges writes that carry no Origin", () => {
      expect(run(undefined, undefined).history.steps).toHaveLength(1);
    });

    it("merges a write without an Origin into a Step that has one, and keeps the first", () => {
      const s = run(here, undefined);
      expect(s.history.steps).toHaveLength(1);
      expect(s.history.steps[0].origin).toEqual(here);
    });

    it("keeps the Step's first Origin through a merge", () => {
      const s = session();
      typed(s, "F", { key: descriptionKey, now: 0, origin: here });
      typed(s, "Fo", { key: descriptionKey, now: 300, origin: { ...here } });
      typed(s, "Foo", { key: descriptionKey, now: 600, origin: { ...here, ids: ["hunger"] } });
      expect(s.history.steps).toHaveLength(1);
      // The merged writes carry equal but distinct Origins, so only the first one is the same object.
      expect(s.history.steps[0].origin).toBe(here);
    });

    it("folds a keyed write from another place into the Step of its own tick", () => {
      const s = session();
      typed(s, "F", { key: descriptionKey, tick: 7, now: 0, origin: here });
      typed(s, "Fo", { key: descriptionKey, tick: 7, now: 300, origin: { ...here, field: "stats.hunger.name" } });
      expect(s.history.steps).toHaveLength(1);
    });

    it("folds writes in one tick into one Step whatever their Origins", () => {
      const s = session();
      s.write({ stats: s.world.stats.slice(1) }, { tick: 7, origin: here });
      s.write({ locations: s.world.locations.slice(1) }, { tick: 7, origin: { ...here, tab: "locations" } });
      expect(s.history.steps).toHaveLength(1);
    });
  });

  it("starts a new Step after a group ends, and after an undo", () => {
    const s = session();
    typed(s, "F", { key: descriptionKey, now: 0 });
    s.group();
    s.write({ locations: s.world.locations.slice(1) }, { now: 1 });
    s.endGroup();
    typed(s, "Fo", { key: descriptionKey, now: 2 });
    expect(s.history.steps).toHaveLength(3);

    s.undo();
    typed(s, "Fx", { key: descriptionKey, now: 3 });
    expect(s.history.steps).toHaveLength(3);
    s.undo();
    expect(s.world.stats[0].description).toBe("F");
  });
});

describe("a text field's own undo and redo", () => {
  const description = (s: ReturnType<typeof session>, text: string) => ({
    stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, description: text } : st)),
  });
  const descriptionKey = { slice: "stats", id: "hunger", field: "description" } as const;
  const typed = (s: ReturnType<typeof session>, text: string, now: number) =>
    s.write(description(s, text), { key: descriptionKey, now });
  const fieldMove = (s: ReturnType<typeof session>, text: string, now = 5000) =>
    s.fieldWrite(description(s, text), { key: descriptionKey, now });
  const removeMood = (s: ReturnType<typeof session>) =>
    s.write({ stats: s.world.stats.filter((st) => st.id !== "mood") }, { now: 0 });

  it("moves the cursor back when the text reads as the top Step's earlier side, and adds no Step", () => {
    const s = session();
    removeMood(s);
    typed(s, "Food", 2000);
    fieldMove(s, "");
    expect(s.history.steps).toHaveLength(2);
    expect(s.history.cursor).toBe(1);

    // The next world undo is the Step before the typing.
    s.undo();
    expect(names(s.world.stats)).toEqual(["Hunger", "Thirst", "Mood"]);
  });

  it("joins the top Step whatever the pause when the text lies between its sides, then moves back from its earlier side", () => {
    const s = session();
    typed(s, "Foo", 0);
    typed(s, "Fo", 100);
    fieldMove(s, "Foo", 60_000);
    expect(s.history.steps).toHaveLength(1);
    expect(s.history.cursor).toBe(1);
    fieldMove(s, "", 60_001);
    expect(s.history.cursor).toBe(0);

    // The Step's later side followed the field, so a world redo lands where the field left the text.
    s.redo();
    expect(s.world.stats[0].description).toBe("Foo");
  });

  it("moves the cursor forward when the text reads as the next Step's later side", () => {
    const s = session();
    typed(s, "Food", 0);
    fieldMove(s, "");
    fieldMove(s, "Food");
    expect(s.history.steps).toHaveLength(1);
    expect(s.history.cursor).toBe(1);
  });

  it("joins a Step that holds more than the field rather than moving past it, so its other edits undo with it", () => {
    const s = session();
    s.write(description(s, "Food"), { key: descriptionKey, tick: 1, now: 0 });
    s.write({ stats: s.world.stats.filter((st) => st.id !== "mood") }, { tick: 1, now: 0 });
    fieldMove(s, "");
    expect(s.history.cursor).toBe(1);

    s.undo();
    expect(names(s.world.stats)).toEqual(["Hunger", "Thirst", "Mood"]);
  });

  it("joins rather than moves when the text reads as the earlier side on the keyed field only", () => {
    const s = session();
    // A typed run whose Step also changed another field of the record, as a linked copy's mark does.
    s.write({ stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, description: "Food", max: 90 } : st)) },
      { key: descriptionKey, now: 0 });
    fieldMove(s, "");
    expect(s.history.cursor).toBe(1);

    s.undo();
    expect(s.world.stats[0].max).toBe(100);
  });

  it("seals a field move against a plain keyed write, so the write never merges across the Saved marker", () => {
    const s = session();
    typed(s, "Foo", 0);
    s.save();
    typed(s, "Food", 100);
    fieldMove(s, "Foo", 200);
    expect(s.history.cursor).toBe(1);

    typed(s, "Fool", 300);
    expect(s.history.steps).toHaveLength(2);
    expect(s.history.saved).toBe(1);
  });

  it("lets the field's own walk join past the seal its move set, so the list never grows", () => {
    const s = session();
    typed(s, "a", 0);
    typed(s, "ab", 100);
    typed(s, "abcd", 5000);
    fieldMove(s, "ab", 6000);
    expect(s.history.cursor).toBe(1);
    // A join is a write, so it drops the undone Step as any write does.
    fieldMove(s, "a", 6001);
    fieldMove(s, "", 6002);
    expect(s.history.steps).toHaveLength(1);
    expect(s.history.cursor).toBe(0);
  });

  it("drops a Saved marker on the undone Step a join cuts away", () => {
    const s = session();
    typed(s, "a", 0);
    typed(s, "ab", 100);
    typed(s, "abcd", 5000);
    s.save();
    fieldMove(s, "ab", 6000);
    fieldMove(s, "a", 6001);
    expect(s.history.steps).toHaveLength(1);
    expect(s.history.saved).toBeNull();
  });

  it("records a plain write when no Step matches by key", () => {
    const s = session();
    typed(s, "Food", 0);
    removeMood(s);
    fieldMove(s, "");
    expect(s.history.steps).toHaveLength(3);
  });

  it("records a plain write against a sealed top and at the saved point", () => {
    const sealed = session();
    typed(sealed, "Foo", 0);
    sealed.save();
    fieldMove(sealed, "Fo");
    expect(sealed.history.steps).toHaveLength(2);

    // Moved off the saved point and back by the field, so only the marker holds the edge.
    const saved = session();
    typed(saved, "Foo", 0);
    saved.save();
    fieldMove(saved, "");
    fieldMove(saved, "Foo");
    fieldMove(saved, "Fo");
    expect(saved.history.steps).toHaveLength(2);
    expect(saved.history.saved).toBe(1);
  });
});

describe("a writer's key, settled by the commit", () => {
  const statsEdit = (was: Stat, now: Stat) => diffSlice("stats", [was], [now])!;
  const hunger = stat("hunger", "Hunger");

  it("takes the one field its record changed", () => {
    expect(settleKey({ slice: "stats", id: "hunger" }, [statsEdit(hunger, { ...hunger, max: 90 })], ["stats"]))
      .toEqual({ slice: "stats", id: "hunger", field: "max" });
  });

  it("drops a named field when the record changed more than one", () => {
    const renamed = { ...hunger, name: "Appetite", descriptors: [{ id: "d0", threshold: 30, description: "Appetite is low" }] };
    expect(settleKey({ slice: "stats", id: "hunger", field: "name" }, [statsEdit(hunger, renamed)], ["stats"]))
      .toEqual({ slice: "stats", id: "hunger" });
  });

  it("keeps a named field when the record changed that one alone", () => {
    expect(settleKey({ slice: "stats", id: "hunger", field: "sub" }, [statsEdit(hunger, { ...hunger, max: 90 })], ["stats"]))
      .toEqual({ slice: "stats", id: "hunger", field: "sub" });
  });

  it("reads past a linked copy's mark, so the mark never splits a typed run", () => {
    const wick: Entity = { id: "wick", name: "Wick", link: { sourceId: "src" } };
    const edited: Entity = { ...wick, playerDescription: "A lamplighter.", link: { ...wick.link!, localReplacement: true } };
    const edits = [diffSlice("entities", [wick], [edited])!];
    expect(settleKey({ slice: "entities", id: "wick" }, edits, ["entities"]))
      .toEqual({ slice: "entities", id: "wick", field: "playerDescription" });
  });

  it("finds a record one array down, as an entry inside its book", () => {
    const entry = { id: "tide", name: "Tide Tables", key: ["tide"], value: "Low at dawn." };
    const book = { id: "lore", name: "Lore", enabled: true, entries: [entry] };
    const edits = [diffSlice("dictionaries", [book], [{ ...book, entries: [{ ...entry, value: "Low at dusk." }] }])!];
    expect(settleKey({ slice: "dictionaries", id: "tide" }, edits, ["dictionaries"]))
      .toEqual({ slice: "dictionaries", id: "tide", field: "value" });
  });

  it("leaves a key whose record the commit did not touch", () => {
    const key = { slice: "locations", ids: ["docks", "market"], field: "canvasPosition" } as const;
    expect(settleKey(key, [statsEdit(hunger, { ...hunger, max: 90 })], ["locations"])).toBe(key);
  });
});

describe("the stack", () => {
  const renameHunger = (s: ReturnType<typeof session>, name: string) =>
    s.write({ stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, name } : st)) });

  it("jumps across several Steps to the same world as the equivalent presses, in both directions", () => {
    const build = () => {
      const s = session();
      renameHunger(s, "Appetite");
      s.write({ stats: s.world.stats.filter((st) => st.id !== "thirst") });
      s.write({ locations: [s.world.locations[1], s.world.locations[0]] });
      s.write({ worldOverview: { ...s.world.worldOverview, author: "Wren" } });
      return s;
    };
    const jumped = build();
    const pressed = build();

    jumped.jump(1);
    pressed.undo(); pressed.undo(); pressed.undo();
    expect(jumped.world).toEqual(pressed.world);
    expect(jumped.history.cursor).toBe(1);

    jumped.jump(4);
    pressed.redo(); pressed.redo(); pressed.redo();
    expect(jumped.world).toEqual(pressed.world);
  });

  it("restores the loaded baseline from the World opened head", () => {
    const s = session();
    renameHunger(s, "Appetite");
    s.write({ stats: s.world.stats.slice(1) });
    s.jump(0);
    expect(s.world).toEqual(s.baseline);
    expect(canUndo(s.history)).toBe(false);
    expect(canRedo(s.history)).toBe(true);
  });

  it("drops the undone future on a new write", () => {
    const s = session();
    renameHunger(s, "A");
    renameHunger(s, "B");
    s.undo();
    s.write({ locations: [] });
    expect(s.history.steps).toHaveLength(2);
    expect(canRedo(s.history)).toBe(false);
  });

  it(`keeps ${HISTORY_LIMIT} Steps and still restores the baseline from the head`, () => {
    const s = session();
    for (let n = 0; n < HISTORY_LIMIT + 5; n += 1) {
      s.write({ stats: [...s.world.stats, stat(`s${n}`, `Stat ${n}`)] });
    }
    expect(s.history.steps).toHaveLength(HISTORY_LIMIT);
    expect(stepLabel(s.history.steps[0])).toBe("Add Stat Stat 5");

    s.jump(0);
    expect(s.world.stats).toEqual(s.baseline.stats);
    s.jump(HISTORY_LIMIT);
    expect(s.world.stats).toHaveLength(3 + HISTORY_LIMIT + 5);
  });

  it("keeps the Saved marker in place across later writes and allows undo past it", () => {
    const s = session();
    renameHunger(s, "A");
    s.save();
    renameHunger(s, "B");
    expect(s.history.saved).toBe(1);
    s.undo();
    s.undo();
    expect(s.history.saved).toBe(1);
    expect(s.world.stats[0].name).toBe("Hunger");
  });

  it("never merges a keyed write across the Saved marker", () => {
    const s = session();
    const key = { slice: "stats", id: "hunger", field: "name" } as const;
    s.write({ stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, name: "A" } : st)) }, { key, now: 0 });
    s.save();
    s.write({ stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, name: "AB" } : st)) }, { key, now: 10 });
    expect(s.history.steps).toHaveLength(2);
  });

  it("drops a Saved marker whose Step the cap dropped, and keeps one at the head", () => {
    const fill = (s: ReturnType<typeof session>) => {
      for (let n = 0; n < HISTORY_LIMIT; n += 1) s.write({ stats: [...s.world.stats, stat(`s${n}`, `Stat ${n}`)] });
    };
    const atStep = session();
    atStep.write({ locations: [] });
    atStep.save();
    fill(atStep);
    expect(atStep.history.saved).toBeNull();

    const atHead = session();
    atHead.save();
    fill(atHead);
    atHead.write({ locations: [] });
    expect(atHead.history.saved).toBe(0);
  });

  it("never folds a same-tick write across the Saved marker", () => {
    const s = session();
    s.write({ stats: s.world.stats.slice(1) }, { tick: 4 });
    s.save();
    s.write({ locations: [] }, { tick: 4 });
    expect(s.history.steps).toHaveLength(2);
    expect(s.history.saved).toBe(1);
  });

  it("drops the Saved marker when an open group swallows a write past it", () => {
    const s = session();
    s.group();
    s.write({ stats: s.world.stats.slice(1) });
    s.save();
    s.write({ locations: [] });
    s.endGroup();
    expect(s.history.steps).toHaveLength(1);
    expect(s.history.saved).toBeNull();
  });

  it("keeps an open group when another one begins inside it", () => {
    const s = session();
    s.group("Move Locations");
    s.write({ locations: s.world.locations.slice(1) });
    s.group("Inner");
    s.write({ stats: s.world.stats.slice(1) });
    s.endGroup();
    expect(s.history.steps).toHaveLength(1);
    expect(stepLabel(s.history.steps[0])).toBe("Move Locations");
  });

  it("drops the Saved marker when the Steps after it are cut off", () => {
    const s = session();
    renameHunger(s, "A");
    renameHunger(s, "B");
    s.save();
    s.undo();
    renameHunger(s, "C");
    expect(s.history.saved).toBeNull();
  });
});

describe("replacing records", () => {
  const rename = (s: ReturnType<typeof session>, name: string) =>
    s.write({ stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, name } : st)) });

  // The records a run of edits leaves, as the objects a stamp would swap.
  const after = (edits: SliceEdit[] | undefined): object[] =>
    (edits ?? []).flatMap((e) => (e.slice === "worldOverview" ? [] : (e.after as object[])));

  it("restores the replacement where a redo or an undo brings the record back", () => {
    const s = session();
    rename(s, "Appetite");
    rename(s, "Craving");
    const [appetite] = after(s.history.steps[0].edits);
    const stamped = { ...appetite, description: "stamped" };
    s.replace(new Map([[appetite, stamped]]));

    s.undo();
    expect(s.world.stats[0]).toBe(stamped);
    s.undo();
    s.redo();
    expect(s.world.stats[0]).toBe(stamped);
  });

  it("leaves the Steps alone when the map names nothing they hold", () => {
    const s = session();
    rename(s, "Appetite");
    const before = s.history;
    s.replace(new Map());
    expect(s.history).toBe(before);
    s.replace(new Map([[{ id: "other" }, { id: "other", name: "Other" }]]));
    s.undo();
    expect(s.world.stats[0].name).toBe("Hunger");
  });

  it("replaces inside the edits a cap folded into the next Step", () => {
    const s = session();
    for (let i = 0; i <= HISTORY_LIMIT; i += 1) rename(s, `Hunger ${i}`);
    const carried = after(s.history.steps[0].carry);
    expect(carried.length).toBeGreaterThan(0);
    const stamped = { ...carried[0], description: "stamped" };
    s.replace(new Map([[carried[0], stamped]]));
    const swapped = after(s.history.steps[0].carry);
    expect(swapped).toContain(stamped);
    expect(swapped).not.toContain(carried[0]);
  });

  it("passes an overview edit through", () => {
    const s = session();
    s.write({ worldOverview: { ...s.world.worldOverview, author: "Wren" } });
    const before = s.history.steps[0].edits;
    s.replace(new Map([[{ id: "x" }, { id: "y" }]]));
    expect(s.history.steps[0].edits).toEqual(before);
  });
});

describe("labels", () => {
  const only = (s: ReturnType<typeof session>) => stepLabel(s.history.steps[s.history.steps.length - 1]);

  it("names an add, an edit with its field, and a remove", () => {
    const s = session();
    s.write({ stats: [stat("fatigue", "Fatigue"), ...s.world.stats] });
    expect(only(s)).toBe("Add Stat Fatigue");

    s.write({ stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, description: "Food" } : st)) },
      { key: { slice: "stats", id: "hunger", field: "description" } });
    expect(only(s)).toBe("Edit Stat Hunger: Description");

    s.write({ locations: s.world.locations.filter((l) => l.id !== "docks") });
    expect(only(s)).toBe("Remove Location Docks");
  });

  it("labels an added record by its key", () => {
    const s = session();
    s.write({ stats: [...s.world.stats, stat("hunger2", "Hunger")] }, { key: { slice: "stats", id: "hunger2" } });
    expect(only(s)).toBe("Add Stat Hunger");
  });

  it("labels an overview Step as the world and its field", () => {
    const s = session();
    s.write({ worldOverview: { ...s.world.worldOverview, thumbnail: "data:image/webp;base64,AAAA" } });
    expect(only(s)).toBe("Edit World: Thumbnail");
    s.write({ worldOverview: { ...s.world.worldOverview, name: "Reedwater" } },
      { key: { slice: "worldOverview", field: "name" } });
    expect(only(s)).toBe("Edit World: World Name");
  });

  it("reads a field missing from the table in title case", () => {
    const s = session();
    s.write({ stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, thresholdUnit: "percent" } : st)) },
      { key: { slice: "stats", id: "hunger", field: "thresholdUnit" } });
    expect(only(s)).toBe("Edit Stat Hunger: Threshold Unit");
  });

  it("labels a Copy edit inside an entity as the placeholder", () => {
    const eyes: Placeholder = { id: "eyes-copy", name: "Eyes", values: [], blueprintId: "eyes" };
    const wren = { id: "wren", name: "Wren", placeholders: [eyes] } as Entity;
    const s = session();
    s.writeUnrecorded({ entities: [wren] });
    const edited = { ...wren, placeholders: [{ ...eyes, weights: { a: 2 } }] };
    s.write({ entities: [edited] }, { key: { slice: "placeholders", id: "eyes-copy" } });
    expect(only(s)).toBe("Edit Placeholder Eyes");
  });

  it("uses a group's label", () => {
    const s = session();
    s.group("Optimize Images");
    s.write({ stats: s.world.stats.slice(1) });
    expect(only(s)).toBe("Optimize Images");
  });

  it("labels a reorder", () => {
    const s = session();
    s.write({ stats: [...s.world.stats].reverse() });
    expect(only(s)).toBe("Reorder Stats");
  });
});

describe("label parts", () => {
  const last = (s: ReturnType<typeof session>) => s.history.steps[s.history.steps.length - 1];
  /** The parts and the flat text of the newest Step: the flat text must be the parts joined. */
  const read = (s: ReturnType<typeof session>) => ({ parts: stepLabelParts(last(s)), flat: stepLabel(last(s)) });

  it("splits a keyed record edit into verb, type, name and field", () => {
    const s = session();
    s.write({ stats: s.world.stats.map((st) => (st.id === "hunger" ? { ...st, description: "Food" } : st)) },
      { key: { slice: "stats", id: "hunger", field: "description" } });
    const { parts, flat } = read(s);
    expect(parts).toEqual({ verb: "Edit", type: "Stat", slice: "stats", name: "Hunger", field: "Description" });
    expect(flat).toBe("Edit Stat Hunger: Description");
    expect(joinLabelParts(parts)).toBe(flat);
  });

  it("splits an add and a remove, with no field", () => {
    const s = session();
    s.write({ stats: [stat("fatigue", "Fatigue"), ...s.world.stats] });
    expect(read(s)).toEqual({
      parts: { verb: "Add", type: "Stat", slice: "stats", name: "Fatigue" },
      flat: "Add Stat Fatigue",
    });
    s.write({ locations: s.world.locations.filter((l) => l.id !== "docks") });
    expect(read(s)).toEqual({
      parts: { verb: "Remove", type: "Location", slice: "locations", name: "Docks" },
      flat: "Remove Location Docks",
    });
  });

  it("splits a Copy edit inside an entity as the placeholder", () => {
    const eyes: Placeholder = { id: "eyes-copy", name: "Eyes", values: [], blueprintId: "eyes" };
    const wren = { id: "wren", name: "Wren", placeholders: [eyes] } as Entity;
    const s = session();
    s.writeUnrecorded({ entities: [wren] });
    s.write({ entities: [{ ...wren, placeholders: [{ ...eyes, weights: { a: 2 } }] }] },
      { key: { slice: "placeholders", id: "eyes-copy" } });
    expect(read(s)).toEqual({
      parts: { verb: "Edit", type: "Placeholder", slice: "placeholders", name: "Eyes" },
      flat: "Edit Placeholder Eyes",
    });
  });

  it("splits a dictionary entry edit with the type Entry", () => {
    const tide = { id: "tide", name: "Tide Tables", key: ["tide"], value: "Low at dawn." };
    const book = { id: "lore", name: "Lore", enabled: true, entries: [tide] };
    const s = session();
    s.writeUnrecorded({ dictionaries: [book] });
    s.write({ dictionaries: [{ ...book, entries: [{ ...tide, value: "Low at dusk." }] }] },
      { key: { slice: "dictionaries", id: "tide", field: "value" } });
    expect(read(s)).toEqual({
      parts: { verb: "Edit", type: "Entry", slice: "dictionaries", name: "Tide Tables", field: "Value" },
      flat: "Edit Entry Tide Tables: Value",
    });
  });

  it("splits a World overview edit with one field, and with several", () => {
    const s = session();
    s.write({ worldOverview: { ...s.world.worldOverview, thumbnail: "data:image/webp;base64,AAAA" } });
    expect(read(s)).toEqual({
      parts: { verb: "Edit", type: "World", slice: "worldOverview", field: "Thumbnail" },
      flat: "Edit World: Thumbnail",
    });
    s.write({ worldOverview: { ...s.world.worldOverview, author: "Wren", description: "Marsh." } });
    expect(read(s)).toEqual({
      parts: { verb: "Edit", type: "World", slice: "worldOverview" },
      flat: "Edit World",
    });
  });

  it("splits a multi-record edit as the plural type with no name", () => {
    const s = session();
    s.write({ stats: s.world.stats.map((st) => ({ ...st, description: "x" })) });
    expect(read(s)).toEqual({
      parts: { verb: "Edit", type: "Stats", slice: "stats" },
      flat: "Edit Stats",
    });
  });

  it("splits a reorder as the verb and the plural type", () => {
    const s = session();
    s.write({ stats: [...s.world.stats].reverse() });
    expect(read(s)).toEqual({
      parts: { verb: "Reorder", type: "Stats", slice: "stats" },
      flat: "Reorder Stats",
    });
  });

  it("returns a labeled batch as its label alone", () => {
    const s = session();
    s.group("Optimize Images");
    s.write({ stats: s.world.stats.slice(1) });
    expect(read(s)).toEqual({ parts: { verb: "Optimize Images" }, flat: "Optimize Images" });
  });

  it("drops an empty record name", () => {
    const s = session();
    s.write({ stats: [...s.world.stats, stat("blank", "")] });
    const { parts, flat } = read(s);
    expect(parts).toEqual({ verb: "Add", type: "Stat", slice: "stats" });
    expect(parts).not.toHaveProperty("name");
    expect(flat).toBe("Add Stat");
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
