import { describe, it, expect } from "vitest";
import type { MorphBinding, Stat, Trait } from "@/types";
import { resolveAvatarLook, type AvatarLookInput } from "./avatarLook";
import { activeStatEnabled } from "./traitEffects";

function stat(partial: Partial<Stat> & Pick<Stat, "id">): Stat {
  return { name: partial.id, type: "number", description: "", min: 0, max: 100, regen: 0, descriptors: [], ...partial } as Stat;
}

const bind = (...names: string[]): MorphBinding[] => names.map((name) => ({ name }));

const morphs = (input: Partial<AvatarLookInput> & Pick<AvatarLookInput, "stats">) =>
  resolveAvatarLook({ authored: [], catalog: null, ...input }).morphs;

describe("resolveAvatarLook: stats with no Change By", () => {
  it("adds a full stat on top of the player's value", () => {
    const live = [stat({ id: "fat", value: 100, morphBindings: bind("Belly") })];
    expect(morphs({ stats: live, authored: live, customization: { Belly: 0.5 } })).toEqual({ Belly: 1.5 });
  });
  it("keeps growing above the authored max", () => {
    const authored = [stat({ id: "fat", max: 50, morphBindings: bind("Belly") })];
    const live = [stat({ id: "fat", max: 100, value: 100, morphBindings: bind("Belly") })];
    expect(morphs({ stats: live, authored })).toEqual({ Belly: 2 });
  });
  it("does not shrink when the live max rises at the same value", () => {
    const authored = [stat({ id: "fat", max: 50, morphBindings: bind("Belly") })];
    const before = morphs({ stats: [stat({ id: "fat", max: 50, value: 25, morphBindings: bind("Belly") })], authored });
    const after = morphs({ stats: [stat({ id: "fat", max: 200, value: 25, morphBindings: bind("Belly") })], authored });
    expect(after).toEqual(before);
    expect(after).toEqual({ Belly: 0.5 });
  });
  it("caps a percentage stat at 1", () => {
    const authored = [stat({ id: "p", type: "percentage", max: 50, morphBindings: bind("Belly") })];
    const live = [stat({ id: "p", type: "percentage", max: 100, value: 100, morphBindings: bind("Belly") })];
    expect(morphs({ stats: live, authored })).toEqual({ Belly: 1 });
  });
  it("falls back to the live max for a stat with no authored twin", () => {
    expect(morphs({ stats: [stat({ id: "r", max: 20, value: 10, morphBindings: bind("Fat") })] })).toEqual({ Fat: 0.5 });
  });
  it("skips a stat with no value or no bindings", () => {
    expect(morphs({ stats: [stat({ id: "a", value: 50 }), stat({ id: "b", morphBindings: bind("Belly") })] })).toEqual({});
  });
});

describe("resolveAvatarLook: Change By", () => {
  it("scales the stat's share by the amount", () => {
    expect(morphs({ stats: [stat({ id: "a", value: 50, morphBindings: [{ name: "Belly", by: 0.4 }] })] })).toEqual({ Belly: 0.2 });
  });
  it("shrinks the slider with a negative amount", () => {
    const live = [stat({ id: "hunger", value: 100, morphBindings: [{ name: "Thickness", by: -1 }] })];
    expect(morphs({ stats: live, customization: { Thickness: 0.8 } }).Thickness).toBeCloseTo(-0.2);
  });
  it("sums two stats on one slider", () => {
    const live = [
      stat({ id: "hunger", value: 50, morphBindings: bind("Thickness") }),
      stat({ id: "weight", value: 100, morphBindings: [{ name: "Thickness", by: 0.5 }] }),
    ];
    expect(morphs({ stats: live, customization: { Thickness: 0.1 } })).toEqual({ Thickness: 1.1 });
  });
});

describe("resolveAvatarLook: stats that are off", () => {
  const live = [
    stat({ id: "a", value: 50, morphBindings: bind("Bruise") }),
    stat({ id: "b", value: 50, morphBindings: bind("Fat") }),
  ];
  it("adds nothing for a stat whose own flag is off", () => {
    expect(morphs({ stats: [{ ...live[0], enabled: false }, live[1]] })).toEqual({ Fat: 0.5 });
  });
  it("adds nothing for a stat a trait toggle switched off", () => {
    const trait = { id: "t", name: "Healed", statToggles: [{ statId: "a", enabled: false }] } as unknown as Trait;
    expect(morphs({ stats: live, enabled: activeStatEnabled(live, [trait]) })).toEqual({ Fat: 0.5 });
  });
  it("adds a stat a trait toggle switched on, though its own flag is off", () => {
    const off = [{ ...live[0], enabled: false }];
    const trait = { id: "t", name: "Hurt", statToggles: [{ statId: "a", enabled: true }] } as unknown as Trait;
    expect(morphs({ stats: off, enabled: activeStatEnabled(off, [trait]) })).toEqual({ Bruise: 0.5 });
  });
});

describe("resolveAvatarLook: the model's key catalog", () => {
  it("drives a model's Fat from a Thickness binding, merged with the player's Thickness", () => {
    const live = [stat({ id: "w", value: 100, morphBindings: bind("Thickness") })];
    expect(morphs({ stats: live, customization: { Thickness: 0.25 }, catalog: ["Fat", "Belly"] })).toEqual({ Fat: 1.25 });
  });
  it("skips keys the model lacks, from the player and from stats", () => {
    const live = [stat({ id: "a", value: 100, morphBindings: bind("Tusks", "Belly") })];
    expect(morphs({ stats: live, customization: { B_Pear: 0.3 }, catalog: ["Belly"] })).toEqual({ Belly: 1 });
  });
  it("counts a stat once on a key two of its bindings resolve to, with the first binding's amount", () => {
    const live = [stat({ id: "a", value: 100, morphBindings: [{ name: "Thickness", by: 0.5 }, { name: "Fat", by: 2 }] })];
    expect(morphs({ stats: live, catalog: ["Fat"] })).toEqual({ Fat: 0.5 });
  });
  it("passes names through as given while the catalog is unknown", () => {
    const live = [stat({ id: "a", value: 100, morphBindings: bind("Thickness") })];
    expect(morphs({ stats: live, customization: { Fat: 0.2 } })).toEqual({ Fat: 0.2, Thickness: 1 });
  });
});
