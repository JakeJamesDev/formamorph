import { describe, it, expect } from "vitest";
import { pickMarks, rangeGap, rangeWarning, togglePick } from "./entityPicking";
import type { Connection, Entity, GameLocation } from "@/types";

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
  const captain: Entity = { id: "captain", name: "Captain", locations: ["keep"], presence: "random", movement: "between" };

  it("adds a location in Locations mode, and removes it on the next click", () => {
    const added = togglePick(captain, "locations", "watchtower");
    expect(added.locations).toEqual(["keep", "watchtower"]);
    expect(togglePick(added, "locations", "watchtower").locations).toEqual(["keep"]);
  });

  it("drops the field when the last location goes", () => {
    expect(togglePick(captain, "locations", "keep")).not.toHaveProperty("locations");
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

describe("rangeGap", () => {
  const captain: Entity = { id: "captain", name: "Captain", locations: ["keep", "watchtower"], presence: "random", movement: "between" };
  const road: Connection = { id: "road", a: "keep", b: "watchtower", aToB: {}, bToA: {} };

  it("names each location the first one can't reach through the entity's own locations", () => {
    expect(rangeGap(captain, world, [])).toEqual({ from: "keep", unreachable: ["watchtower"] });
    expect(rangeGap({ ...captain, locations: ["keep", "watchtower", "harbor"] }, world, [road]))
      .toEqual({ from: "keep", unreachable: ["harbor"] });
  });

  it("is clear when a Connection or the tree joins them", () => {
    expect(rangeGap(captain, world, [road])).toBeNull();
    expect(rangeGap({ ...captain, locations: ["keep", "inn"] }, world, [])).toBeNull();
  });

  it("only walks through the entity's own locations", () => {
    // throne → keep → inn joins them, but the keep is not one of its own.
    expect(rangeGap({ ...captain, locations: ["throne", "inn"] }, world, []))
      .toEqual({ from: "throne", unreachable: ["inn"] });
  });

  it("respects one-way Connections", () => {
    const oneWay: Connection = { id: "ladder", a: "watchtower", b: "keep", aToB: {} };
    expect(rangeGap(captain, world, [oneWay])).toEqual({ from: "keep", unreachable: ["watchtower"] });
  });

  it("only applies to Moves Between", () => {
    expect(rangeGap({ ...captain, movement: "follow" }, world, [])).toBeNull();
  });
});

describe("rangeWarning", () => {
  it("reads the copy table's line, listing every unreachable location", () => {
    expect(rangeWarning("Aldric", "Barracks", ["City Gate", "Barbican"])).toBe(
      "Aldric can’t reach City Gate and Barbican from Barracks through its own locations. Add the location between them, or a Connection.",
    );
  });
});
