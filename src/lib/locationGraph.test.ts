import { describe, it, expect } from "vitest";
import {
  dropLocationFromConnections, effectiveDestinations, implicitPairs, overriddenPairs, pairKey,
  reachableFromStarts,
} from "./locationGraph";
import type { Connection, GameLocation } from "@/types";

// village > { tavern > cellar, house } ; landing and shore are top-level.
const village: GameLocation = { id: "village", name: "Village", isStarting: true };
const tavern: GameLocation = { id: "tavern", name: "Tavern", parentId: "village" };
const cellar: GameLocation = { id: "cellar", name: "Cellar", parentId: "tavern" };
const house: GameLocation = { id: "house", name: "House", parentId: "village" };
const landing: GameLocation = { id: "landing", name: "Landing" };
const shore: GameLocation = { id: "shore", name: "Shore" };
const world = [village, tavern, cellar, house, landing, shore];

const dests = (id: string, connections: Connection[] = []) =>
  [...effectiveDestinations(id, world, connections).keys()].sort();

describe("implicitPairs", () => {
  it("links parent to child and sibling to sibling, each pair once", () => {
    const keys = implicitPairs(world).map(([a, b]) => pairKey(a, b)).sort();
    expect(keys).toEqual([
      pairKey("cellar", "tavern"),
      pairKey("house", "tavern"),
      pairKey("house", "village"),
      pairKey("tavern", "village"),
    ].sort());
  });

  it("does not make top-level locations siblings of each other", () => {
    // Landing, Shore and Village share no parent, so nothing links them — the pair list is empty.
    expect(implicitPairs([village, landing, shore])).toEqual([]);
  });
});

describe("effectiveDestinations", () => {
  it("hands a location its parent, children and siblings for free", () => {
    expect(dests("tavern")).toEqual(["cellar", "house", "village"]);
    expect(dests("village")).toEqual(["house", "tavern"]);
    expect(dests("landing")).toEqual([]);
  });

  it("adds a Connection's far end, in its own directions", () => {
    const oneWay: Connection = { id: "c1", a: "shore", b: "landing", aToB: {} };
    expect(dests("shore", [oneWay])).toEqual(["landing"]);
    expect(dests("landing", [oneWay])).toEqual([]);
    const twoWay: Connection = { ...oneWay, bToA: {} };
    expect(dests("landing", [twoWay])).toEqual(["shore"]);
  });

  it("replaces the implicit link for a pair it covers, in both directions", () => {
    const oneWay: Connection = { id: "c2", a: "tavern", b: "house", aToB: {} };
    expect(dests("tavern", [oneWay])).toEqual(["cellar", "house", "village"]); // unchanged: it kept the trip
    expect(dests("house", [oneWay])).toEqual(["village"]); // the free walk back to the Tavern is gone
    // Reinstating the pair's implicit link (the bug this guards) would put "tavern" back in that list.
  });

  it("replaces the implicit link declared in either direction", () => {
    const reversed: Connection = { id: "c3", a: "house", b: "tavern", aToB: {} };
    expect(dests("tavern", [reversed])).toEqual(["cellar", "village"]);
  });

  it("leaves pairs no Connection covers exactly as the tree left them", () => {
    const far: Connection = { id: "c4", a: "cellar", b: "shore", aToB: {}, bToA: {} };
    expect(dests("house", [far])).toEqual(["tavern", "village"]);
    expect(dests("cellar", [far])).toEqual(["shore", "tavern"]);
  });

  it("reaches nowhere new through a self-link", () => {
    const loop: Connection = { id: "c5", a: "landing", b: "landing", aToB: {}, bToA: {} };
    expect(dests("landing", [loop])).toEqual([]);
  });

  it("reports the Connection and leg a destination is reached by, and nothing for implicit travel", () => {
    const portal: Connection = {
      id: "c6", a: "house", b: "shore", aToB: { hint: "into the stone" }, bToA: { hint: "out of the stone" },
    };
    const out = effectiveDestinations("house", world, [portal]);
    expect(out.get("shore")).toEqual({ via: "connection", connection: portal, leg: portal.aToB });
    expect(effectiveDestinations("shore", world, [portal]).get("house"))
      .toEqual({ via: "connection", connection: portal, leg: portal.bToA });
    expect(out.get("village")).toEqual({ via: "implicit" });
  });
});

describe("overriddenPairs", () => {
  it("names only the implicit pairs an authored Connection took over", () => {
    const sibling: Connection = { id: "c7", a: "house", b: "tavern", aToB: {}, bToA: {} };
    const far: Connection = { id: "c8", a: "house", b: "shore", aToB: {}, bToA: {} };
    expect(overriddenPairs(world, [sibling, far]).map(([a, b]) => pairKey(a, b)))
      .toEqual([pairKey("house", "tavern")]);
  });
});

describe("reachableFromStarts", () => {
  it("walks the graph in its travel directions from every starting location", () => {
    expect([...reachableFromStarts(world, [])].sort()).toEqual(["cellar", "house", "tavern", "village"]);
    const ferry: Connection = { id: "c9", a: "house", b: "landing", aToB: {} };
    expect([...reachableFromStarts(world, [ferry])].sort())
      .toEqual(["cellar", "house", "landing", "tavern", "village"]);
  });

  it("does not reach a location only a one-way Connection leaves", () => {
    // Shore only ever *departs* to the Village, so no walk from a start ever arrives at it.
    const escape: Connection = { id: "c10", a: "shore", b: "village", aToB: {} };
    expect(reachableFromStarts(world, [escape]).has("shore")).toBe(false);
  });

  it("treats every location as a start when the world flags none, since play begins anywhere", () => {
    const unflagged = world.map((l) => ({ ...l, isStarting: false }));
    expect([...reachableFromStarts(unflagged, [])].sort())
      .toEqual(["cellar", "house", "landing", "shore", "tavern", "village"]);
  });
});

describe("dropLocationFromConnections", () => {
  it("drops every record touching the deleted location, from either end", () => {
    const out: Connection = { id: "c11", a: "house", b: "shore", aToB: {}, bToA: {} };
    const inbound: Connection = { id: "c12", a: "landing", b: "house", aToB: {} };
    const other: Connection = { id: "c13", a: "landing", b: "shore", aToB: {}, bToA: {} };
    expect(dropLocationFromConnections("house", [out, inbound, other])).toEqual([other]);
  });

  it("returns the same array when nothing referenced it", () => {
    const only: Connection[] = [{ id: "c14", a: "landing", b: "shore", aToB: {}, bToA: {} }];
    expect(dropLocationFromConnections("house", only)).toBe(only);
  });
});
