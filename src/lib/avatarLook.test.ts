import { describe, it, expect } from "vitest";
import type { MorphBinding, Stat, Trait } from "@/types";
import { avatarLookTraits, resolveAvatarLook, type AvatarLookInput, type LookTrait } from "./avatarLook";
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

const elf = (value = 1, name = "Ear Shape"): LookTrait => ({ ownerId: null, traitId: "elf", morphPins: [{ name, value }] });
const human: LookTrait = { ownerId: null, traitId: "human", morphPins: [{ name: "Ear Shape", value: 0 }] };
const look = (input: Partial<AvatarLookInput>) => resolveAvatarLook({ stats: [], authored: [], catalog: null, ...input });

describe("resolveAvatarLook: trait slider pins", () => {
  it("replaces the player's value while the trait is active, and a bound stat adds on top", () => {
    const live = [stat({ id: "corruption", value: 50, morphBindings: bind("Ear Shape") })];
    const out = look({ stats: live, customization: { "Ear Shape": 0.3 }, traits: { on: [], active: [elf(1)] } });
    expect(out.morphs).toEqual({ "Ear Shape": 1.5 });
    expect(out.holders).toEqual({ "Ear Shape": { ownerId: null, traitId: "elf" } });
  });
  it("leaves the player's value with no active trait", () => {
    const out = look({ customization: { "Ear Shape": 0.3 }, traits: { on: [{ ownerId: null, traitId: "elf" }], active: [] } });
    expect(out.morphs).toEqual({ "Ear Shape": 0.3 });
    expect(out.holders).toEqual({});
  });
  it("lets the latest switch-on win over tree order", () => {
    const on = [{ ownerId: null, traitId: "human" }, { ownerId: null, traitId: "elf" }];
    expect(look({ traits: { on, active: [elf(1), human] } }).morphs).toEqual({ "Ear Shape": 1 });
    expect(look({ traits: { on: [...on].reverse(), active: [elf(1), human] } }).morphs).toEqual({ "Ear Shape": 0 });
  });
  it("breaks a tie between traits switched on together by tree order", () => {
    expect(look({ traits: { on: [], active: [human, elf(1)] } }).holders["Ear Shape"].traitId).toBe("elf");
    expect(look({ traits: { on: [], active: [elf(1), human] } }).holders["Ear Shape"].traitId).toBe("human");
  });
  it("counts an active trait missing from the switch-on order as switched on after every listed one", () => {
    const out = look({ traits: { on: [{ ownerId: null, traitId: "human" }], active: [elf(1), human] } });
    expect(out.morphs).toEqual({ "Ear Shape": 1 });
  });
  it("replaces a Thickness customization with a Fat pin, under the model's own name", () => {
    const out = look({ customization: { Thickness: 0.2 }, catalog: ["Fat"], traits: { on: [], active: [elf(0.9, "Fat")] } });
    expect(out.morphs).toEqual({ Fat: 0.9 });
    expect(Object.keys(out.holders)).toEqual(["Fat"]);
  });
  it("ignores a pin on a slider the model lacks", () => {
    const out = look({ customization: { Belly: 0.2 }, catalog: ["Belly"], traits: { on: [], active: [elf(1)] } });
    expect(out).toEqual({ morphs: { Belly: 0.2 }, holders: {} });
  });
  it("accepts a value past the slider's range", () => {
    expect(look({ traits: { on: [], active: [elf(2.5)] } }).morphs).toEqual({ "Ear Shape": 2.5 });
  });
});

describe("avatarLookTraits", () => {
  const scope = {
    global: [{ id: "elf", morphPins: [{ name: "Ear Shape", value: 1 }] }],
    owners: { hero: [{ id: "tall" }], rex: [{ id: "wolf" }] },
    played: ["hero"],
  };
  const on = [{ ownerId: "rex", traitId: "wolf" }];
  it("gives the played Persona the global traits and the played entity's own", () => {
    expect(avatarLookTraits(scope, on).player.active.map((t) => [t.ownerId, t.traitId])).toEqual([[null, "elf"], ["hero", "tall"]]);
  });
  it("gives every other entity its own traits only", () => {
    const { owners } = avatarLookTraits(scope, on);
    expect(Object.keys(owners)).toEqual(["rex"]);
    expect(owners.rex).toEqual({ on, active: [{ ownerId: "rex", traitId: "wolf" }] });
  });
});
