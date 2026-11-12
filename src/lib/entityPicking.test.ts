import { describe, it, expect } from "vitest";
import { pickMarks, togglePick } from "./entityPicking";
import { PLAYER_START, type Connection, type Entity, type EntityStart, type GameLocation } from "@/types";

// rosewood > { keep > throne, inn } ; harbor and watchtower are top-level.
const rosewood: GameLocation = { id: "rosewood", name: "Rosewood" };
const keep: GameLocation = { id: "keep", name: "Keep", parentId: "rosewood" };
const throne: GameLocation = { id: "throne", name: "Throne Room", parentId: "keep" };
const inn: GameLocation = { id: "inn", name: "Inn", parentId: "rosewood" };
const harbor: GameLocation = { id: "harbor", name: "Harbor" };
const watchtower: GameLocation = { id: "watchtower", name: "Watchtower" };
const world = [rosewood, keep, throne, inn, harbor, watchtower];

describe("pickMarks", () => {
  const queen: Entity = { id: "queen", name: "Queen", locations: ["throne"], knownIn: ["rosewood", "harbor"] };

  it("marks the entity's locations and its picks, and fades everything else", () => {
    const marks = pickMarks(queen, world, []);
    expect(marks.get("throne")).toEqual({ kind: "member", pick: false });
    expect(marks.get("rosewood")).toEqual({ kind: "covered", pick: true });
    expect(marks.get("harbor")).toEqual({ kind: "covered", pick: true });
    expect(marks.get("watchtower")).toEqual({ kind: "faded", pick: false });
  });

  it("keeps every location inside a pick, at any depth, out of the fade", () => {
    const marks = pickMarks(queen, world, []);
    expect(marks.get("keep")).toEqual({ kind: "covered", pick: false });
    expect(marks.get("inn")).toEqual({ kind: "covered", pick: false });
  });

  it("marks a location that is both a member and a pick with both", () => {
    const marks = pickMarks({ ...queen, knownIn: ["throne"] }, world, []);
    expect(marks.get("throne")).toEqual({ kind: "member", pick: true });
  });

  it("draws no picks for Nowhere or the Custom Persona", () => {
    for (const entity of [
      { ...queen, knownIn: "nowhere" as const },
      { ...queen, customPersona: true },
      { ...queen, knownIn: undefined, customPersona: true },
    ]) {
      const marks = pickMarks(entity, world, []);
      expect(marks.get("rosewood")).toEqual({ kind: "faded", pick: false });
      expect(marks.get("throne")).toEqual({ kind: "member", pick: false });
    }
  });
});

describe("pickMarks under Nearby", () => {
  // rosewood > { keep > throne, inn } ; harbor, watchtower, island and cove are top-level.
  const island: GameLocation = { id: "island", name: "Island" };
  const cove: GameLocation = { id: "cove", name: "Cove" };
  const map = [...world, island, cove];
  const roads: Connection[] = [
    { id: "road", a: "inn", b: "harbor", aToB: {}, bToA: {} },
    { id: "sea", a: "harbor", b: "watchtower", aToB: {}, bToA: {}, distance: "far" },
  ];
  const kinds = (entity: Entity, locations = map, connections = roads) =>
    Object.fromEntries([...pickMarks(entity, locations, connections)].map(([id, m]) => [id, m.kind]));
  const start = (place: string, schedule: EntityStart["schedule"] = []): EntityStart => ({ id: place, place, weight: 1, schedule });

  it("marks where a staying entity begins and lightly marks each place one Nearby link from it", () => {
    const guard: Entity = { id: "guard", name: "Guard", kind: "unique", locations: ["watchtower"], starts: [start("inn")] };
    expect(kinds(guard)).toEqual({
      inn: "routine", rosewood: "nearby", keep: "nearby", harbor: "nearby",
      throne: "faded", watchtower: "faded", island: "faded", cove: "faded",
    });
  });

  it("marks every place a wandering entity's rows name, over the whole day", () => {
    const rows: EntityStart["schedule"] = [
      { id: "r1", time: { start: 0, end: 600 }, action: { kind: "wander", places: [{ place: "throne", weight: 1 }, { place: "inn", weight: 1 }], idle: 30 } },
      { id: "r2", time: "allDay", action: { kind: "stay", place: "harbor" } },
    ];
    const marks = kinds({ id: "bard", name: "Bard", kind: "unique", starts: [start("keep", rows)] });
    expect(marks).toMatchObject({ keep: "routine", throne: "routine", inn: "routine", harbor: "routine", rosewood: "nearby" });
    expect(marks.watchtower).toBe("faded");
  });

  it("skips a row place the Start cannot reach, as the engine does", () => {
    const rows: EntityStart["schedule"] = [{ id: "r", time: "allDay", action: { kind: "stay", place: "island" } }];
    expect(kinds({ id: "x", name: "X", kind: "unique", starts: [start("inn", rows)] }).island).toBe("faded");
  });

  it("marks every Start of a Generic entity", () => {
    const herd: Entity = { id: "herd", name: "Herd", kind: "generic", starts: [start("throne"), start("cove")] };
    expect(kinds(herd)).toMatchObject({ throne: "routine", cove: "routine", keep: "nearby", inn: "faded" });
  });

  it("stands Player's Starting Location for the world's starting locations, or every location with none", () => {
    const follower: Entity = { id: "f", name: "F", kind: "unique", starts: [start(PLAYER_START)] };
    const flagged = map.map((l) => (l.id === "harbor" ? { ...l, isStarting: true } : l));
    expect(kinds(follower, flagged)).toMatchObject({ harbor: "routine", inn: "nearby", watchtower: "faded", cove: "faded" });
    expect(new Set(Object.values(kinds(follower)))).toEqual(new Set(["routine"]));
  });

  it("gives no mark across a Far Connection", () => {
    const keeper: Entity = { id: "k", name: "K", kind: "unique", starts: [start("harbor")] };
    expect(kinds(keeper)).toMatchObject({ harbor: "routine", inn: "nearby", watchtower: "faded" });
  });

  it("gives no mark to a child joined to its parent by a Far Connection", () => {
    const farKeep: Connection[] = [{ id: "stair", a: "keep", b: "throne", aToB: {}, bToA: {}, distance: "far" }];
    const steward: Entity = { id: "s", name: "S", kind: "unique", starts: [start("keep")] };
    expect(kinds(steward, map, farKeep)).toMatchObject({ keep: "routine", rosewood: "nearby", inn: "nearby", throne: "faded" });
  });

  it("draws Picked Locations while that choice has no pick yet, from the routine, not the stored list", () => {
    const keeper: Entity = { id: "k", name: "K", kind: "unique", locations: ["cove"], starts: [start("harbor")] };
    const marks = pickMarks(keeper, map, roads, true);
    expect(marks.get("harbor")).toEqual({ kind: "member", pick: false });
    expect(marks.get("cove")).toEqual({ kind: "faded", pick: false });
  });

  it("marks a Can Also Go place, and nothing extra for Anywhere", () => {
    const scout: Entity = { id: "s", name: "S", kind: "unique", traversable: ["island"], starts: [start("harbor")] };
    expect(kinds(scout).island).toBe("routine");
    const free = kinds({ ...scout, traversable: "anywhere" });
    expect(Object.keys(free).filter((id) => free[id] === "routine")).toEqual(["harbor"]);
  });

  it("does not draw the entity's old locations", () => {
    const marks = kinds({ id: "q", name: "Q", kind: "unique", locations: ["cove"], starts: [start("harbor")] });
    expect(marks.cove).toBe("faded");
  });
});

describe("pickMarks under Known In picks", () => {
  const island: GameLocation = { id: "island", name: "Island" };
  const map = [...world, island];
  const roads: Connection[] = [{ id: "road", a: "inn", b: "harbor", aToB: {}, bToA: {} }];
  const members = (entity: Entity, locations = map) =>
    [...pickMarks({ ...entity, knownIn: ["watchtower"] }, locations, roads)].filter(([, m]) => m.kind === "member").map(([id]) => id);
  const start = (place: string, schedule: EntityStart["schedule"] = []): EntityStart => ({ id: place, place, weight: 1, schedule });

  it("marks the starting locations for Player's Starting Location, or every location with none flagged", () => {
    const follower: Entity = { id: "f", name: "F", kind: "unique", starts: [start(PLAYER_START)] };
    const flagged = map.map((l) => (l.id === "harbor" ? { ...l, isStarting: true } : l));
    expect(members(follower, flagged)).toEqual(["harbor"]);
    expect(members(follower)).toEqual(map.map((l) => l.id));
  });

  it("marks a Can Also Go place, and nothing extra for Anywhere", () => {
    const scout: Entity = { id: "s", name: "S", kind: "unique", traversable: ["island"], starts: [start("harbor")] };
    expect(members(scout)).toEqual(["harbor", "island"]);
    expect(members({ ...scout, traversable: "anywhere" })).toEqual(["harbor"]);
  });

  it("skips a row place the Start cannot reach, as Nearby does", () => {
    const rows: EntityStart["schedule"] = [
      { id: "a", time: "allDay", action: { kind: "stay", place: "island" } },
      { id: "b", time: { start: 0, end: 600 }, action: { kind: "stay", place: "harbor" } },
    ];
    expect(members({ id: "x", name: "X", kind: "unique", starts: [start("inn", rows)] })).toEqual(["inn", "harbor"]);
  });
});

describe("togglePick", () => {
  const captain: Entity = {
    id: "captain", name: "Captain", kind: "generic", starts: [{ id: "c1", place: "keep", weight: 1, schedule: [] }],
  };
  const customPersona: Entity = { id: "me", name: "Me", customPersona: true, locations: ["keep"] };
  const scout: Entity = {
    id: "scout", name: "Scout", kind: "unique",
    starts: [{ id: "s1", place: "keep", weight: 1, schedule: [] }, { id: "s2", place: "inn", weight: 2, schedule: [] }],
  };

  it("moves a Unique entity's first Start to the clicked location in Locations mode, keeping the others", () => {
    const moved = togglePick(scout, "locations", "watchtower");
    expect(moved.starts?.map((s) => [s.id, s.place, s.weight])).toEqual([["s1", "watchtower", 1], ["s2", "inn", 2]]);
    expect(moved).not.toHaveProperty("locations");
  });

  it("gives a Unique entity with no Start its first one at the clicked location", () => {
    const placed = togglePick({ id: "new", name: "New", kind: "unique", traversable: "anywhere" }, "locations", "harbor");
    expect(placed.starts).toEqual([expect.objectContaining({ place: "harbor", weight: 1, schedule: [] })]);
    expect(placed).not.toHaveProperty("locations");
  });

  it("adds a Generic entity's Start in Locations mode, and removes it on the next click", () => {
    const added = togglePick(captain, "locations", "watchtower");
    expect(added.starts?.map((s) => [s.place, s.schedule])).toEqual([["keep", []], ["watchtower", []]]);
    expect(added).not.toHaveProperty("locations");
    const removed = togglePick(added, "locations", "watchtower");
    expect(removed.starts?.map((s) => s.id)).toEqual(["c1"]);
    expect(removed).not.toHaveProperty("locations");
  });

  it("keeps a Generic entity's last Start", () => {
    expect(togglePick(captain, "locations", "keep")).toBe(captain);
  });

  it("toggles a Custom Persona's locations, and drops the field when the last one goes", () => {
    expect(togglePick(customPersona, "locations", "inn").locations).toEqual(["keep", "inn"]);
    expect(togglePick(customPersona, "locations", "keep")).not.toHaveProperty("locations");
  });

  it("resets Moves Between once an Everywhere entity lists two places", () => {
    const everywhere = { ...captain, presence: undefined };
    expect(togglePick(everywhere, "locations", "watchtower")).not.toHaveProperty("movement");
  });

  it("writes Known In picks in Known In mode, starting from Nearby or Nowhere", () => {
    expect(togglePick(captain, "knownIn", "rosewood").knownIn).toEqual(["rosewood"]);
    expect(togglePick({ ...captain, knownIn: "nowhere" }, "knownIn", "harbor").knownIn).toEqual(["harbor"]);
    expect(togglePick({ ...captain, knownIn: ["rosewood"] }, "knownIn", "harbor").knownIn).toEqual(["rosewood", "harbor"]);
    expect(togglePick(captain, "knownIn", "rosewood").starts).toBe(captain.starts);
  });

  it("falls back to Nearby when the last pick is removed", () => {
    expect(togglePick({ ...captain, knownIn: ["rosewood"] }, "knownIn", "rosewood")).not.toHaveProperty("knownIn");
  });
});
