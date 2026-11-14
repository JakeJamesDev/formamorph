import { describe, it, expect } from "vitest";
import {
  withStartHere, dropLocationFromEntities, positionedCast, placedIn, carryMap, withCarriedRoutine, presentEntityIds,
  knownInOf, withKnownIn, toggleKnownInPick, knownHere, type Standings,
} from "./entityPresence";
import type { Entity } from "@/types";
import { idsAt, idsAtAny, namedPlacesOf, positionsIn, presenceOf, withMembership } from "@/lib/entityPlaces";
import { APP_VERSION, migrateWorld } from "@/lib/version";
import { startsOf, applyingRoutine, withFirstRoutine, withFirstStarts } from "@/lib/entityKind";
import { oneRoutine } from "@/test/routines";

/** A Generic entity with one Start per place, no rows. */
const generic = (id: string, name: string, places: string[]): Entity => ({
  id, name, kind: "generic", routines: oneRoutine(places.map((place, i) => ({ id: `${id}-${i + 1}`, place, weight: 1, schedule: [] }))),
});
/** An entity with no kind that belongs to `places`. */
const member = (id: string, name: string, places: string[]): Entity => ({ id, name, locations: places });
const alice = member("alice", "Alice", ["bar"]);
const bartender = member("bar-keep", "Bartender", ["bar", "docks"]);
const gull = member("gull", "Gull", ["docks"]);
/** A Unique entity starting at the bar or the docks, standing at the bar by day and wandering the docks and the
 *  attic at night, and allowed into the cellar. */
const sailor: Entity = {
  id: "sailor", name: "Sailor", kind: "unique",
  routines: oneRoutine([
    { id: "s1", place: "bar", weight: 1, schedule: [
      { id: "day", time: { start: 360, end: 1080 }, action: { kind: "stay", place: "bar" } },
      { id: "night", time: { start: 1080, end: 360 }, action: { kind: "wander", places: [{ place: "docks", weight: 1 }, { place: "attic", weight: 1 }], idle: 60 } },
    ] },
    { id: "s2", place: "docks", weight: 1, schedule: [{ id: "pier", time: "allDay", action: { kind: "patrol", stops: [{ place: "bar", idle: 30 }] } }] },
  ], ["cellar", "bar"]),
};
const ghost: Entity = { id: "ghost", name: "Ghost" }; // placed nowhere
const cast = [alice, bartender, gull, ghost];

const NOBODY: Standings = { positions: {}, generics: {} };
const at = (place: string | null | undefined, entities: Entity[], standings = NOBODY) => idsAt(place, entities, positionsIn(standings));

describe("the rosters with nobody placed", () => {
  it("roster everyone listing the location, in cast order", () => {
    expect(at("bar", cast)).toEqual(["alice", "bar-keep"]);
  });

  it("keep a multi-location entity present at every place it lists", () => {
    expect(at("docks", cast)).toContain("bar-keep");
    expect(at("bar", cast)).toContain("bar-keep");
  });

  it("are empty for an unpeopled location, and for no location at all", () => {
    expect(at("attic", cast)).toEqual([]);
    expect(at(null, cast)).toEqual([]);
    expect(at(undefined, cast)).toEqual([]);
  });

  it("union a scope and list a two-place entity once", () => {
    expect(idsAtAny(["bar", "docks"], cast, positionsIn(NOBODY))).toEqual(["alice", "bar-keep", "gull"]);
    expect(idsAtAny([], cast, positionsIn(NOBODY))).toEqual([]);
  });
});

describe("withMembership", () => {
  it("dedupes and never mutates the original", () => {
    const out = withMembership(alice, ["bar", "bar", "docks"]);
    expect(out.locations).toEqual(["bar", "docks"]);
    expect(alice.locations).toEqual(["bar"]);
  });

  it("drops the field entirely rather than storing an empty array", () => {
    expect("locations" in withMembership(alice, [])).toBe(false);
  });
});

describe("withStartHere (Add Entity on a location)", () => {
  it("gives a Generic entity a Start here with weight 1 and no rows", () => {
    const next = withStartHere(generic("gull", "Gull", ["docks"]), "bar");
    expect(startsOf(next).map((s) => [s.place, s.weight, s.schedule])).toEqual([["docks", 1, []], ["bar", 1, []]]);
    expect(next).not.toHaveProperty("locations");
  });

  it("gives a Unique entity one more Start here and keeps its other Starts as they are", () => {
    const next = withStartHere(sailor, "cellar");
    expect(startsOf(next).slice(0, 2)).toEqual(startsOf(sailor));
    expect(startsOf(next)).toHaveLength(3);
    expect(startsOf(next)[2]).toMatchObject({ place: "cellar", weight: 1, schedule: [] });
  });
});

describe("dropLocationFromEntities", () => {
  it("strips a deleted location from every membership", () => {
    const next = dropLocationFromEntities("bar", cast);
    expect(at("bar", next)).toEqual([]);
    expect(at("docks", next)).toEqual(["bar-keep", "gull"]);
  });

  it("returns the same array when nobody listed the location", () => {
    expect(dropLocationFromEntities("attic", cast)).toBe(cast);
  });

  it("drops the place from a Unique entity's Starts, rows and Traversable, with the Start and the row it emptied", () => {
    const [bar] = dropLocationFromEntities("bar", [sailor]);
    // Start s1 began at the bar, and s2's only patrol stop was the bar.
    expect(startsOf(bar)).toEqual([{ id: "s2", place: "docks", weight: 1, schedule: [] }]);
    expect(applyingRoutine(bar)?.traversable).toEqual(["cellar"]);
    expect(bar).not.toHaveProperty("locations");
    const [docks] = dropLocationFromEntities("docks", [sailor]);
    expect(startsOf(docks).map((s) => s.id)).toEqual(["s1"]);
    expect(startsOf(docks)[0].schedule[1].action).toEqual({ kind: "wander", places: [{ place: "attic", weight: 1 }], idle: 60 });
    expect(docks).not.toHaveProperty("locations");
  });

  it("drops a place named only in a Unique entity's Traversable list", () => {
    const [next] = dropLocationFromEntities("cellar", [sailor]);
    expect(applyingRoutine(next)?.traversable).toEqual(["bar"]);
    expect(startsOf(next)).toBe(startsOf(sailor));
  });
});

describe("placedIn", () => {
  const herdsman = generic("bar-keep", "Bartender", ["bar", "docks"]);
  it("carries a Generic entity's Starts through the map, and lists any other entity at the mapped places", () => {
    expect(startsOf(placedIn(herdsman, { docks: "pier" }))).toEqual([{ id: "bar-keep-2", place: "pier", weight: 1, schedule: [] }]);
    expect(placedIn(ghost, { a: "pier", b: "bar" }).locations).toEqual(["pier", "bar"]);
  });

  it("rebuilds a linked copy's routine on repair exactly as a fresh carry of its source", () => {
    const refs = [{ id: "bar", name: "Bar" }, { id: "docks", name: "Docks" }, { id: "attic", name: "Attic" }, { id: "cellar", name: "Cellar" }];
    const source: Entity = { ...sailor, locationRefs: refs };
    const known = new Set(["tavern", "pier", "attic"]);
    const connections = { bar: "tavern", docks: "pier", "ph-1": "ph-world" };
    const map = carryMap(refs, connections, known);
    expect(map).toEqual({ bar: "tavern", docks: "pier", attic: "attic" });
    const stale: Entity = { ...withFirstRoutine(sailor, (routine) => ({ ...routine, starts: [{ id: "x", place: "gone", weight: 1, schedule: [] }], traversable: "anywhere" })), name: "Old Salt" };
    const repaired = withCarriedRoutine(stale, source, connections, known, "unique");
    const fresh = placedIn(source, map);
    expect(repaired.name).toBe("Old Salt");
    expect([startsOf(repaired), applyingRoutine(repaired)?.traversable, repaired.locations]).toEqual([startsOf(fresh), applyingRoutine(fresh)?.traversable, fresh.locations]);
  });

  it("rebuilds a linked Generic copy's Starts from its source on repair, replacing a local Start", () => {
    const source: Entity = { ...herdsman, locationRefs: [{ id: "bar", name: "Bar" }, { id: "docks", name: "Docks" }] };
    const local: Entity = withFirstStarts(herdsman, [...startsOf(herdsman), { id: "mine", place: "tavern", weight: 1, schedule: [] }]);
    const repaired = withCarriedRoutine(local, source, { docks: "pier" }, new Set(["pier", "tavern"]), "generic");
    expect(startsOf(repaired)).toEqual([{ id: "bar-keep-2", place: "pier", weight: 1, schedule: [] }]);
  });

  it("carries a Unique entity's routine, so its Presence names only places of the new world, after a reload too", () => {
    const world = { version: APP_VERSION, locations: [{ id: "pier", name: "Pier" }, { id: "tavern", name: "Tavern" }], connections: [], entities: [] };
    const carried = placedIn(sailor, { bar: "tavern", docks: "pier", cellar: "tavern" });
    const reloaded = migrateWorld(JSON.parse(JSON.stringify({ ...world, entities: [carried] }))).entities[0];
    for (const entity of [carried, reloaded]) {
      expect(presenceOf(entity, world).places.map((p) => p.place)).toEqual(["tavern", "pier"]);
      expect(namedPlacesOf(entity)).toEqual(["tavern", "pier"]);
    }
  });
});

describe("the rosters in play read Position", () => {
  it("list a Generic entity once at each place its Generic Entity Instances stand, and nowhere else it lists", () => {
    const generics = { "bar-keep": { "bar-keep-1": { position: "docks", lastRun: 0 }, "bar-keep-2": { position: "docks", lastRun: 0 } } };
    expect(at("bar", cast, { positions: {}, generics })).toEqual(["alice"]);
    expect(at("docks", cast, { positions: {}, generics })).toEqual(["bar-keep", "gull"]);
  });

  it("put a positioned entity at its position only", () => {
    const standings = { positions: { "bar-keep": "docks" }, generics: {} };
    expect(at("bar", cast, standings)).toEqual(["alice"]);
    expect(at("docks", cast, standings)).toEqual(["bar-keep", "gull"]);
    expect(idsAtAny(["bar"], cast, positionsIn(standings))).toEqual(["alice"]);
  });

  it("keep an entity without a position at every location it lists", () => {
    const standings = { positions: { gull: "bar" }, generics: {} };
    expect(at("bar", cast, standings)).toEqual(["alice", "bar-keep", "gull"]);
    expect(at("docks", cast, standings)).toEqual(["bar-keep"]);
  });

  // A list a world stored before kinds owned their routine (Q10).
  const stale: Entity = { id: "stale", name: "Stale", kind: "unique", routines: oneRoutine([]), locations: ["bar", "docks"] };
  it("stand an entity with a kind, a stale stored list and no Position nowhere, through every roster", () => {
    const standings = { positions: { "bar-keep": "docks" }, generics: {} };
    const withStale = [...cast, stale];
    for (const place of ["bar", "docks"]) {
      expect(at(place, withStale, standings)).not.toContain("stale");
      expect(presentEntityIds(withStale, standings, place)).not.toContain("stale");
    }
    expect(idsAtAny(["bar", "docks"], withStale, positionsIn(standings))).not.toContain("stale");
  });
});

const wanderer: Entity = { id: "wanderer", name: "Wanderer", kind: "unique", locations: ["bar"] };

describe("positionedCast", () => {
  const sylvie: Entity = { ...wanderer, id: "sylvie", persona: true };
  const custom: Entity = { ...wanderer, id: "custom", customPersona: true };

  const only: Entity = { ...wanderer, id: "only", persona: true, personaOnly: true };

  it("leaves out the played world persona, the Custom Persona and an unpicked Persona-Only entity", () => {
    const ids = (ref?: Parameters<typeof positionedCast>[1]) => positionedCast([wanderer, sylvie, custom, only], ref).map((e) => e.id);
    expect(ids({ source: "world", entityId: "sylvie" })).toEqual(["wanderer"]);
    expect(ids({ source: "world", entityId: "only" })).toEqual(["wanderer", "sylvie"]);
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
