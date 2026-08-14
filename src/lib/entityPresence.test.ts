import { describe, it, expect } from "vitest";
import {
  entityIdsAt, entityIdsAtAny, withEntityLocations, setLocationRoster, dropLocationFromEntities,
} from "./entityPresence";
import type { Entity } from "@/types";

const alice: Entity = { id: "alice", name: "Alice", locations: ["bar"] };
const bartender: Entity = { id: "bar-keep", name: "Bartender", locations: ["bar", "docks"] };
const gull: Entity = { id: "gull", name: "Gull", locations: ["docks"] };
const ghost: Entity = { id: "ghost", name: "Ghost" }; // placed nowhere
const cast = [alice, bartender, gull, ghost];

describe("entityIdsAt", () => {
  it("rosters everyone listing the location, in cast order", () => {
    expect(entityIdsAt("bar", cast)).toEqual(["alice", "bar-keep"]);
  });

  it("keeps a multi-location entity present at every place it lists", () => {
    expect(entityIdsAt("docks", cast)).toContain("bar-keep");
    expect(entityIdsAt("bar", cast)).toContain("bar-keep");
  });

  it("is empty for an unpeopled location, and for no location at all", () => {
    expect(entityIdsAt("attic", cast)).toEqual([]);
    expect(entityIdsAt(null, cast)).toEqual([]);
    expect(entityIdsAt(undefined, cast)).toEqual([]);
  });
});

describe("entityIdsAtAny", () => {
  it("unions the scope and lists a two-place entity once", () => {
    expect(entityIdsAtAny(["bar", "docks"], cast)).toEqual(["alice", "bar-keep", "gull"]);
  });

  it("is empty for an empty scope", () => {
    expect(entityIdsAtAny([], cast)).toEqual([]);
  });
});

describe("withEntityLocations", () => {
  it("dedupes and never mutates the original", () => {
    const out = withEntityLocations(alice, ["bar", "bar", "docks"]);
    expect(out.locations).toEqual(["bar", "docks"]);
    expect(alice.locations).toEqual(["bar"]);
  });

  it("drops the field entirely rather than storing an empty array", () => {
    expect("locations" in withEntityLocations(alice, [])).toBe(false);
  });
});

describe("setLocationRoster (location-first editing writes through to the entities)", () => {
  it("adds the location to newcomers and removes it from anyone dropped", () => {
    const next = setLocationRoster("bar", ["gull"], cast);
    expect(entityIdsAt("bar", next)).toEqual(["gull"]);
    // Removing Bartender from the Bar leaves their other membership alone.
    expect(next.find((e) => e.id === "bar-keep")!.locations).toEqual(["docks"]);
  });

  it("leaves untouched entities by reference, so unrelated editors don't re-render", () => {
    const next = setLocationRoster("bar", ["alice", "bar-keep"], cast);
    expect(next[0]).toBe(alice);
    expect(next[2]).toBe(gull);
  });

  it("clearing a roster leaves an entity that lives nowhere else with no locations field", () => {
    const next = setLocationRoster("bar", [], cast);
    expect("locations" in next.find((e) => e.id === "alice")!).toBe(false);
  });
});

describe("dropLocationFromEntities", () => {
  it("strips a deleted location from every membership", () => {
    const next = dropLocationFromEntities("bar", cast);
    expect(entityIdsAt("bar", next)).toEqual([]);
    expect(entityIdsAt("docks", next)).toEqual(["bar-keep", "gull"]);
  });

  it("returns the same array when nobody listed the location", () => {
    expect(dropLocationFromEntities("attic", cast)).toBe(cast);
  });
});
