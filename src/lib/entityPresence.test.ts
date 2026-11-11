import { describe, it, expect } from "vitest";
import {
  entityIdsAt, entityIdsAtAny, withEntityLocations, withStartHere, dropLocationFromEntities,
  entitiesInPlay, positionedCast, placedIn,
  knownInOf, withKnownIn, toggleKnownInPick, knownHere,
} from "./entityPresence";
import type { Entity } from "@/types";

/** A Generic entity with one Start per place, no rows. */
const generic = (id: string, name: string, places: string[]): Entity => ({
  id, name, kind: "generic", locations: places, starts: places.map((place, i) => ({ id: `${id}-${i + 1}`, place, weight: 1, schedule: [] })),
});
const alice = generic("alice", "Alice", ["bar"]);
const bartender = generic("bar-keep", "Bartender", ["bar", "docks"]);
const gull = generic("gull", "Gull", ["docks"]);
/** A Unique entity starting at the bar or the docks, standing at the bar by day and wandering the docks and the
 *  attic at night, and allowed into the cellar. */
const sailor: Entity = {
  id: "sailor", name: "Sailor", kind: "unique", locations: ["bar", "docks", "attic"], traversable: ["cellar", "bar"],
  starts: [
    { id: "s1", place: "bar", weight: 1, schedule: [
      { id: "day", time: { start: 360, end: 1080 }, action: { kind: "stay", place: "bar" } },
      { id: "night", time: { start: 1080, end: 360 }, action: { kind: "wander", places: [{ place: "docks", weight: 1 }, { place: "attic", weight: 1 }], idle: 60 } },
    ] },
    { id: "s2", place: "docks", weight: 1, schedule: [{ id: "pier", time: "allDay", action: { kind: "patrol", stops: [{ place: "bar", idle: 30 }] } }] },
  ],
};
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

describe("withStartHere (Add Entity on a location)", () => {
  it("gives a Generic entity a Start here with weight 1 and no rows", () => {
    const next = withStartHere(gull, "bar");
    expect(next.starts?.map((s) => [s.place, s.weight, s.schedule])).toEqual([["docks", 1, []], ["bar", 1, []]]);
    expect(next.locations).toEqual(["docks", "bar"]);
  });

  it("gives a Unique entity one more Start here and keeps its other Starts as they are", () => {
    const next = withStartHere(sailor, "cellar");
    expect(next.starts?.slice(0, 2)).toEqual(sailor.starts);
    expect(next.starts).toHaveLength(3);
    expect(next.starts?.[2]).toMatchObject({ place: "cellar", weight: 1, schedule: [] });
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

  it("drops the place from a Unique entity's Starts, rows and Traversable, with the Start and the row it emptied", () => {
    const [bar] = dropLocationFromEntities("bar", [sailor]);
    // Start s1 began at the bar, and s2's only patrol stop was the bar.
    expect(bar.starts).toEqual([{ id: "s2", place: "docks", weight: 1, schedule: [] }]);
    expect(bar.traversable).toEqual(["cellar"]);
    expect(bar.locations).toEqual(["docks"]);
    const [docks] = dropLocationFromEntities("docks", [sailor]);
    expect(docks.starts?.map((s) => s.id)).toEqual(["s1"]);
    expect(docks.starts?.[0].schedule[1].action).toEqual({ kind: "wander", places: [{ place: "attic", weight: 1 }], idle: 60 });
    expect(docks.locations).toEqual(["bar", "attic"]);
  });

  it("drops a place named only in a Unique entity's Traversable list", () => {
    const [next] = dropLocationFromEntities("cellar", [sailor]);
    expect(next.traversable).toEqual(["bar"]);
    expect(next.starts).toBe(sailor.starts);
  });
});

describe("placedIn", () => {
  it("carries a Generic entity's Starts through the map, and lists any other entity at the mapped places", () => {
    expect(placedIn(bartender, { docks: "pier" }).starts).toEqual([{ id: "bar-keep-2", place: "pier", weight: 1, schedule: [] }]);
    expect(placedIn(ghost, { a: "pier", b: "bar" }).locations).toEqual(["pier", "bar"]);
  });
});

describe("entitiesInPlay", () => {
  it("lists a Generic entity once at each place its presences stand, and nowhere else it lists", () => {
    const generics = { "bar-keep": { "bar-keep-1": { position: "docks", lastRun: 0 }, "bar-keep-2": { position: "docks", lastRun: 0 } } };
    const placed = entitiesInPlay(cast, { positions: {}, generics });
    expect(entityIdsAt("bar", placed)).toEqual(["alice"]);
    expect(entityIdsAt("docks", placed)).toEqual(["bar-keep", "gull"]);
    expect(placed[1].locations).toEqual(["docks"]);
  });

  it("puts a positioned entity at its position only", () => {
    const placed = entitiesInPlay(cast, { positions: { "bar-keep": "docks" }, generics: {} });
    expect(entityIdsAt("bar", placed)).toEqual(["alice"]);
    expect(entityIdsAt("docks", placed)).toEqual(["bar-keep", "gull"]);
  });

  it("keeps an entity without a position at every location it lists", () => {
    const placed = entitiesInPlay(cast, { positions: { gull: "bar" }, generics: {} });
    expect(entityIdsAt("bar", placed)).toEqual(["alice", "bar-keep", "gull"]);
    expect(entityIdsAt("docks", placed)).toEqual(["bar-keep"]);
  });

  it("returns the same array when nobody has a position", () => {
    expect(entitiesInPlay(cast, { positions: {}, generics: {} })).toBe(cast);
  });

  it("reads through the multi-location scopes too", () => {
    expect(entityIdsAtAny(["bar"], entitiesInPlay(cast, { positions: { "bar-keep": "docks" }, generics: {} }))).toEqual(["alice"]);
  });
});

const wanderer: Entity = { id: "wanderer", name: "Wanderer", kind: "unique", locations: ["bar"] };

describe("positionedCast", () => {
  const sylvie: Entity = { ...wanderer, id: "sylvie", persona: true };
  const custom: Entity = { ...wanderer, id: "custom", customPersona: true };

  it("leaves out the played world persona and the Custom Persona", () => {
    const ids = (ref?: Parameters<typeof positionedCast>[1]) => positionedCast([wanderer, sylvie, custom], ref).map((e) => e.id);
    expect(ids({ source: "world", entityId: "sylvie" })).toEqual(["wanderer"]);
    expect(ids({ source: "none" })).toEqual(["wanderer", "sylvie"]);
    expect(ids(undefined)).toEqual(["wanderer", "sylvie"]);
  });
});

describe("Known In", () => {
  const queen: Entity = { id: "queen", name: "Queen", locations: ["throne"] };

  it("reads an absent field and an empty list as Nearby", () => {
    expect(knownInOf(queen)).toBe("nearby");
    expect(knownInOf({ ...queen, knownIn: [] })).toBe("nearby");
    expect(knownInOf({ ...queen, knownIn: "nowhere" })).toBe("nowhere");
    expect(knownInOf({ ...queen, knownIn: ["rosewood"] })).toEqual(["rosewood"]);
  });

  it("stores Nearby and an empty list as no field", () => {
    expect(withKnownIn({ ...queen, knownIn: "nowhere" }, "nearby")).not.toHaveProperty("knownIn");
    expect(withKnownIn({ ...queen, knownIn: ["rosewood"] }, [])).not.toHaveProperty("knownIn");
    expect(withKnownIn(queen, ["rosewood", "rosewood", "ashby"]).knownIn).toEqual(["rosewood", "ashby"]);
  });

  it("toggles one pick, starting a list from Nearby or Nowhere", () => {
    expect(toggleKnownInPick(queen, "rosewood").knownIn).toEqual(["rosewood"]);
    expect(toggleKnownInPick({ ...queen, knownIn: "nowhere" }, "rosewood").knownIn).toEqual(["rosewood"]);
    expect(toggleKnownInPick({ ...queen, knownIn: ["rosewood"] }, "ashby").knownIn).toEqual(["rosewood", "ashby"]);
  });

  it("falls back to Nearby when the last pick is toggled off", () => {
    expect(toggleKnownInPick({ ...queen, knownIn: ["rosewood"] }, "rosewood")).not.toHaveProperty("knownIn");
  });

  it("drops a deleted location from every Known In list, an emptied list falling back to Nearby", () => {
    const herald: Entity = { id: "herald", name: "Herald", knownIn: ["rosewood", "ashby"] };
    const out = dropLocationFromEntities("rosewood", [{ ...queen, knownIn: ["rosewood"] }, herald]);
    expect(out[0]).not.toHaveProperty("knownIn");
    expect(out[0].locations).toEqual(["throne"]);
    expect(out[1].knownIn).toEqual(["ashby"]);
  });

  describe("knownHere", () => {
    // rosewood > inn > cellar
    const locations = [
      { id: "rosewood", name: "Rosewood" },
      { id: "inn", name: "Inn", parentId: "rosewood" },
      { id: "cellar", name: "Cellar", parentId: "inn" },
    ];
    const herald: Entity = { id: "herald", name: "Herald", knownIn: ["inn"] };
    const crowned: Entity = { ...queen, knownIn: ["rosewood"] };

    it("marks a pick on this location as its own", () => {
      expect(knownHere("inn", locations, [herald])).toEqual([{ entity: herald, via: null }]);
    });

    it("names the nearest picked location that contains this one", () => {
      expect(knownHere("cellar", locations, [herald, crowned])).toEqual([
        { entity: herald, via: "inn" }, { entity: crowned, via: "rosewood" },
      ]);
    });

    it("prefers this location's own pick over a parent's", () => {
      const both = { ...herald, knownIn: ["rosewood", "inn"] };
      expect(knownHere("inn", locations, [both])).toEqual([{ entity: both, via: null }]);
    });

    it("leaves out Nearby, Nowhere, the Custom Persona and picks elsewhere", () => {
      const persona: Entity = { ...herald, id: "me", customPersona: true };
      const elsewhere = { ...herald, id: "far", knownIn: ["cellar"] };
      expect(knownHere("inn", locations, [queen, { ...queen, knownIn: "nowhere" }, persona, elsewhere])).toEqual([]);
    });
  });

  it("leaves the cast as it is when nobody picked the deleted location", () => {
    const entities: Entity[] = [{ ...queen, knownIn: ["ashby"] }, { ...queen, id: "q2", knownIn: "nowhere" }];
    expect(dropLocationFromEntities("rosewood", entities)).toBe(entities);
  });
});
