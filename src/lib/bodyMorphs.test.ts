import { describe, it, expect } from "vitest";
import type { Stat } from "@/types";
import {
  normalizeStat,
  autoBindLegacyBodyStats,
  buildMorphGroups,
  migrateStatListMorphBindings,
  resolveMorphAlias,
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
  it("clamps below the floor but not above the top", () => {
    expect(normalizeStat(-20, 0, 100)).toBe(0);
    expect(normalizeStat(180, 0, 100)).toBe(1.8);
  });
  it("handles a non-zero-based range", () => {
    expect(normalizeStat(15, 10, 20)).toBe(0.5);
  });
  it("returns 0 when min === refMax (no range to scale across)", () => {
    expect(normalizeStat(5, 5, 5)).toBe(0);
  });
  it("scales against refMax, so a raised max grows the influence past 1", () => {
    // Authored max 50; play raised it to 100 and the stat climbed with it.
    expect(normalizeStat(50, 0, 100, 50)).toBe(1);
    expect(normalizeStat(100, 0, 100, 50)).toBe(2);
  });
});

describe("buildMorphGroups", () => {
  it("splits each model into Body Sliders and Head Features groups of {label,value} options", () => {
    const groups = buildMorphGroups([
      { heading: "Alpha", morphs: ["Height", "Muscle"], head: ["EarShape"] },
      { heading: "Beta", morphs: ["Width"] },
    ]);
    expect(groups).toEqual([
      { heading: "Alpha · Body Sliders", options: [{ label: "Height", value: "Height" }, { label: "Muscle", value: "Muscle" }] },
      { heading: "Alpha · Head Features", options: [{ label: "EarShape", value: "EarShape" }] },
      { heading: "Beta · Body Sliders", options: [{ label: "Width", value: "Width" }] },
    ]);
  });
  it("shows a shared morph under every model that has it", () => {
    const groups = buildMorphGroups([
      { heading: "Alpha", morphs: ["Height"] },
      { heading: "Beta", morphs: ["Height"] },
    ]);
    expect(groups.map((g) => g.heading)).toEqual(["Alpha · Body Sliders", "Beta · Body Sliders"]);
    expect(groups.every((g) => g.options[0].value === "Height")).toBe(true);
  });
  it("drops a group with no sliders", () => {
    expect(buildMorphGroups([{ heading: "Alpha", morphs: [] }, { heading: "Beta", morphs: ["Width"] }]).map((g) => g.heading))
      .toEqual(["Beta · Body Sliders"]);
  });
  it("de-duplicates a name repeated within one model", () => {
    const groups = buildMorphGroups([{ heading: "Alpha", morphs: ["Height", "Height"] }]);
    expect(groups[0].options).toEqual([{ label: "Height", value: "Height" }]);
  });
});

describe("autoBindLegacyBodyStats", () => {
  it("binds the standard trio in the object form and leaves other stats alone", () => {
    const stats = [
      stat({ id: "1", name: "Stomach" }),
      stat({ id: "2", name: "Fatness" }),
      stat({ id: "3", name: "Breastsize" }),
      stat({ id: "4", name: "Health" }),
    ];
    const out = autoBindLegacyBodyStats(stats);
    expect(out[0].morphBindings).toEqual([{ name: "Belly" }]);
    expect(out[1].morphBindings).toEqual([{ name: "Fat" }]);
    expect(out[2].morphBindings).toEqual([{ name: "Breasts" }]);
    expect(out[3].morphBindings).toBeUndefined();
  });
  it("is idempotent — a stat that already carries the field is untouched", () => {
    const stats = [stat({ id: "1", name: "Stomach", morphBindings: [] })];
    const out = autoBindLegacyBodyStats(stats);
    expect(out[0].morphBindings).toEqual([]);
    expect(out[0]).toBe(stats[0]); // unchanged reference
  });
});

describe("migrateStatListMorphBindings", () => {
  it("turns bare names into objects and keeps objects as they are", () => {
    const raw = [{ id: "a", morphBindings: ["Belly", { name: "Fat", by: -1 }] }];
    expect(migrateStatListMorphBindings(raw)).toEqual([{ id: "a", morphBindings: [{ name: "Belly" }, { name: "Fat", by: -1 }] }]);
  });
  it("returns the same list when nothing holds a bare name", () => {
    const raw = [{ id: "a", morphBindings: [{ name: "Belly" }] }, { id: "b" }];
    expect(migrateStatListMorphBindings(raw)).toBe(raw);
  });
});

describe("resolveMorphAlias", () => {
  const model = (names: string[]) => (candidate: string) => names.includes(candidate);

  it("returns the exact name when the model exposes it", () => {
    expect(resolveMorphAlias("Belly", model(["Belly", "Fat"]))).toBe("Belly");
  });

  it("prefers the exact name over a present alias-mate", () => {
    expect(resolveMorphAlias("Belly", model(["Belly", "Waist"]))).toBe("Belly");
  });

  it("resolves an old world name onto the renamed model", () => {
    expect(resolveMorphAlias("Belly", model(["Waist", "Bust", "Thickness"]))).toBe("Waist");
    expect(resolveMorphAlias("Fat", model(["Waist", "Bust", "Thickness"]))).toBe("Thickness");
    expect(resolveMorphAlias("Breasts", model(["Waist", "Bust", "Thickness"]))).toBe("Bust");
  });

  it("resolves a new world name onto an old model", () => {
    expect(resolveMorphAlias("Waist", model(["Belly", "Breasts", "Fat"]))).toBe("Belly");
    expect(resolveMorphAlias("Chest", model(["Belly", "Breasts", "Fat"]))).toBe("Breasts");
  });

  it("returns null when neither the name nor any alias-mate exists", () => {
    expect(resolveMorphAlias("Belly", model(["B_Pear"]))).toBeNull();
    expect(resolveMorphAlias("B_Pear", model(["Belly"]))).toBeNull();
  });
});
