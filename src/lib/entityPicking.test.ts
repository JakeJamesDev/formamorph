import { describe, it, expect } from "vitest";
import { pickMarks, togglePick } from "./entityPicking";
import type { Entity, GameLocation } from "@/types";

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
    const marks = pickMarks(queen, world);
    expect(marks.get("throne")).toEqual({ kind: "member", pick: false });
    expect(marks.get("rosewood")).toEqual({ kind: "covered", pick: true });
    expect(marks.get("harbor")).toEqual({ kind: "covered", pick: true });
    expect(marks.get("watchtower")).toEqual({ kind: "faded", pick: false });
  });

  it("keeps every location inside a pick, at any depth, out of the fade", () => {
    const marks = pickMarks(queen, world);
    expect(marks.get("keep")).toEqual({ kind: "covered", pick: false });
    expect(marks.get("inn")).toEqual({ kind: "covered", pick: false });
  });

  it("marks a location that is both a member and a pick with both", () => {
    const marks = pickMarks({ ...queen, knownIn: ["throne"] }, world);
    expect(marks.get("throne")).toEqual({ kind: "member", pick: true });
  });

  it("draws no picks for Nearby, Nowhere, or the Custom Persona", () => {
    for (const entity of [
      { ...queen, knownIn: undefined },
      { ...queen, knownIn: "nowhere" as const },
      { ...queen, customPersona: true },
    ]) {
      const marks = pickMarks(entity, world);
      expect(marks.get("rosewood")).toEqual({ kind: "faded", pick: false });
      expect(marks.get("throne")).toEqual({ kind: "member", pick: false });
    }
  });
});

describe("togglePick", () => {
  const captain: Entity = {
    id: "captain", name: "Captain", locations: ["keep"], kind: "generic", starts: [{ id: "c1", place: "keep", weight: 1, schedule: [] }],
  };
  const customPersona: Entity = { id: "me", name: "Me", customPersona: true, locations: ["keep"] };
  const scout: Entity = {
    id: "scout", name: "Scout", kind: "unique", locations: ["keep", "inn"],
    starts: [{ id: "s1", place: "keep", weight: 1, schedule: [] }, { id: "s2", place: "inn", weight: 2, schedule: [] }],
  };

  it("moves a Unique entity's first Start to the clicked location in Locations mode, keeping the others", () => {
    const moved = togglePick(scout, "locations", "watchtower");
    expect(moved.starts?.map((s) => [s.id, s.place, s.weight])).toEqual([["s1", "watchtower", 1], ["s2", "inn", 2]]);
    expect(moved.locations).toEqual(["watchtower", "inn"]);
  });

  it("gives a Unique entity with no Start its first one at the clicked location", () => {
    const placed = togglePick({ id: "new", name: "New", kind: "unique", traversable: "anywhere" }, "locations", "harbor");
    expect(placed.starts).toEqual([expect.objectContaining({ place: "harbor", weight: 1, schedule: [] })]);
    expect(placed.locations).toEqual(["harbor"]);
  });

  it("adds a Generic entity's Start in Locations mode, and removes it on the next click", () => {
    const added = togglePick(captain, "locations", "watchtower");
    expect(added.starts?.map((s) => [s.place, s.schedule])).toEqual([["keep", []], ["watchtower", []]]);
    expect(added.locations).toEqual(["keep", "watchtower"]);
    const removed = togglePick(added, "locations", "watchtower");
    expect(removed.starts?.map((s) => s.id)).toEqual(["c1"]);
    expect(removed.locations).toEqual(["keep"]);
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
    expect(togglePick(captain, "knownIn", "rosewood").locations).toEqual(["keep"]);
  });

  it("falls back to Nearby when the last pick is removed", () => {
    expect(togglePick({ ...captain, knownIn: ["rosewood"] }, "knownIn", "rosewood")).not.toHaveProperty("knownIn");
  });
});
