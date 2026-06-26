import { describe, it, expect } from "vitest";
import type { Stat } from "@/types";
import {
  normalizeStat,
  statMorphMap,
  mergeBodyMorphs,
  boundMorphNamesExcluding,
  autoBindLegacyBodyStats,
} from "./bodyMorphs";

// Minimal Stat factory — only the fields these helpers read matter; the rest satisfy the type.
function stat(partial: Partial<Stat> & Pick<Stat, "id" | "name">): Stat {
  return {
    type: "number",
    description: "",
    min: 0,
    max: 100,
    regen: 0,
    descriptors: [],
    ...partial,
  } as Stat;
}

describe("normalizeStat", () => {
  it("maps the midpoint to 0.5 and the endpoints to 0 and 1", () => {
    expect(normalizeStat(50, 0, 100)).toBe(0.5);
    expect(normalizeStat(0, 0, 100)).toBe(0);
    expect(normalizeStat(100, 0, 100)).toBe(1);
  });
  it("clamps values outside the range", () => {
    expect(normalizeStat(-20, 0, 100)).toBe(0);
    expect(normalizeStat(180, 0, 100)).toBe(1);
  });
  it("handles a non-zero-based range", () => {
    expect(normalizeStat(15, 10, 20)).toBe(0.5);
  });
  it("returns 0 when min === max (no range to scale across)", () => {
    expect(normalizeStat(5, 5, 5)).toBe(0);
  });
});

describe("statMorphMap", () => {
  it("ignores stats without bindings or without a numeric value", () => {
    const stats = [
      stat({ id: "a", name: "A", value: 50 }), // no bindings
      stat({ id: "b", name: "B", morphBindings: ["Belly"] }), // no value
    ];
    expect(statMorphMap(stats)).toEqual({});
  });
  it("contributes a stat's normalized value to each bound morph", () => {
    const stats = [stat({ id: "a", name: "A", value: 25, morphBindings: ["Belly", "Fat"] })];
    expect(statMorphMap(stats)).toEqual({ Belly: 0.25, Fat: 0.25 });
  });
  it("combines multiple stats", () => {
    const stats = [
      stat({ id: "a", name: "A", value: 100, morphBindings: ["Belly"] }),
      stat({ id: "b", name: "B", value: 10, min: 0, max: 20, morphBindings: ["Breasts"] }),
    ];
    expect(statMorphMap(stats)).toEqual({ Belly: 1, Breasts: 0.5 });
  });
});

describe("mergeBodyMorphs", () => {
  it("sums overlapping keys and keeps disjoint ones", () => {
    const base = { Belly: 0.2, B_Pear: 0.5 };
    const fromStats = { Belly: 0.3, Fat: 0.4 };
    expect(mergeBodyMorphs(base, fromStats)).toEqual({ Belly: 0.5, B_Pear: 0.5, Fat: 0.4 });
  });
  it("does not mutate the inputs", () => {
    const base = { Belly: 0.2 };
    mergeBodyMorphs(base, { Belly: 0.3 });
    expect(base).toEqual({ Belly: 0.2 });
  });
});

describe("boundMorphNamesExcluding", () => {
  it("unions morphs from other stats and excludes the given one", () => {
    const stats = [
      stat({ id: "a", name: "A", morphBindings: ["Belly", "Fat"] }),
      stat({ id: "b", name: "B", morphBindings: ["Breasts"] }),
    ];
    expect(boundMorphNamesExcluding(stats, "b")).toEqual(new Set(["Belly", "Fat"]));
    expect(boundMorphNamesExcluding(stats, "a")).toEqual(new Set(["Breasts"]));
  });
});

describe("autoBindLegacyBodyStats", () => {
  it("binds the standard trio and leaves other stats alone", () => {
    const stats = [
      stat({ id: "1", name: "Stomach" }),
      stat({ id: "2", name: "Fatness" }),
      stat({ id: "3", name: "Breastsize" }),
      stat({ id: "4", name: "Health" }),
    ];
    const out = autoBindLegacyBodyStats(stats);
    expect(out[0].morphBindings).toEqual(["Belly"]);
    expect(out[1].morphBindings).toEqual(["Fat"]);
    expect(out[2].morphBindings).toEqual(["Breasts"]);
    expect(out[3].morphBindings).toBeUndefined();
  });
  it("is idempotent — a stat that already carries the field is untouched", () => {
    const stats = [stat({ id: "1", name: "Stomach", morphBindings: [] })];
    const out = autoBindLegacyBodyStats(stats);
    expect(out[0].morphBindings).toEqual([]);
    expect(out[0]).toBe(stats[0]); // unchanged reference
  });
});
