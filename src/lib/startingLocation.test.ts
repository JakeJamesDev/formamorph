import { describe, it, expect } from "vitest";
import { startingLocations, resolveStartingLocation, startingLocationIn, inTreeOrder } from "./startingLocation";
import type { GameLocation } from "@/types";

const loc = (id: string, isStarting = false): GameLocation => ({ id, name: id, isStarting });

describe("startingLocations", () => {
  it("returns only the isStarting-flagged locations", () => {
    const locs = [loc("a", true), loc("b"), loc("c", true)];
    expect(startingLocations(locs).map((l) => l.id)).toEqual(["a", "c"]);
  });

  it("returns [] when none are flagged", () => {
    expect(startingLocations([loc("a"), loc("b")])).toEqual([]);
  });
});

describe("resolveStartingLocation", () => {
  const locs = [loc("a", true), loc("b", true), loc("plain")];

  it("resolves a valid chosen id exactly", () => {
    expect(resolveStartingLocation(locs, "b")?.id).toBe("b");
  });

  it("can resolve a chosen non-starting location if the id is valid", () => {
    // The chooser only offers starting locations, but a valid id is honored regardless.
    expect(resolveStartingLocation(locs, "plain")?.id).toBe("plain");
  });

  it("falls back into the starting set when the chosen id is unknown", () => {
    for (let i = 0; i < 20; i++) {
      expect(["a", "b"]).toContain(resolveStartingLocation(locs, "missing")!.id);
    }
  });

  it("falls back into the starting set when no id is given", () => {
    for (let i = 0; i < 20; i++) {
      expect(["a", "b"]).toContain(resolveStartingLocation(locs)!.id);
    }
  });

  it("falls back to all locations when none are flagged as starting", () => {
    const plain = [loc("x"), loc("y")];
    for (let i = 0; i < 20; i++) {
      expect(["x", "y"]).toContain(resolveStartingLocation(plain)!.id);
    }
  });
});

describe("startingLocationIn, under the Enabled gates (Q12, Q51)", () => {
  const child = (id: string, parentId: string, isStarting = false): GameLocation => ({ ...loc(id, isStarting), parentId });
  // Gate (off) holds Yard; Hall holds Attic; Cellar sits at the root after them.
  const world = [loc("gate", true), child("yard", "gate", true), loc("hall"), loc("cellar"), child("attic", "hall")];
  const offOnly = (...off: string[]) => (id: string) => !off.includes(id);
  const every = Array.from({ length: 40 }, (_, i) => i / 40);

  it("never starts in an off starting location", () => {
    for (const r of every) expect(startingLocationIn(world, offOnly("gate"), null, () => r)?.id).toBe("yard");
  });

  it("drops a chosen location that is off", () => {
    expect(startingLocationIn(world, offOnly("gate"), "gate", () => 0)?.id).toBe("yard");
    expect(startingLocationIn(world, offOnly(), "attic", () => 0)?.id).toBe("attic");
  });

  it("takes the first on location in tree order when every starting location is off", () => {
    for (const r of every) expect(startingLocationIn(world, offOnly("gate", "yard"), null, () => r)?.id).toBe("hall");
    for (const r of every) expect(startingLocationIn(world, offOnly("gate", "yard", "hall", "attic"), null, () => r)?.id).toBe("cellar");
  });

  it("falls back to the authored pick when every location is off", () => {
    const start = startingLocationIn(world, () => false, null, () => 0);
    expect(["gate", "yard"]).toContain(start?.id);
  });

  it("picks among the on locations when none is flagged", () => {
    const flat = [loc("a"), loc("b"), loc("c")];
    for (const r of every) expect(startingLocationIn(flat, offOnly("b"), null, () => r)?.id).not.toBe("b");
  });

  it("orders a tree depth-first, each root in list order", () => {
    expect(inTreeOrder(world).map((l) => l.id)).toEqual(["gate", "yard", "hall", "attic", "cellar"]);
  });
});
