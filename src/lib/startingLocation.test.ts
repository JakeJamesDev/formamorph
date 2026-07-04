import { describe, it, expect } from "vitest";
import { startingLocations, resolveStartingLocation } from "./startingLocation";
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
