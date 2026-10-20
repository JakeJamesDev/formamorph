import { describe, it, expect } from "vitest";
import {
  entityIdsAt, entityIdsAtAny, withEntityLocations, setLocationRoster, dropLocationFromEntities,
  entitiesInPlay, startingPositions, reconcilePositions, positionedCast, movementOptions, withPresence, withMovement,
  knownInOf, withKnownIn, toggleKnownInPick, knownHere,
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

describe("presence rules", () => {
  const captain: Entity = { id: "cap", name: "Captain", locations: ["bar", "docks"], presence: "random", movement: "between" };

  it("offers no Moves Between to an entity at every listed location", () => {
    expect(movementOptions(bartender)).toEqual(["free", "stays", "follow"]);
    expect(movementOptions(captain)).toEqual(["free", "stays", "between", "follow"]);
  });

  it("resets Moves Between to Free on a switch to Everywhere Listed", () => {
    const everywhere = withPresence(captain, undefined);
    expect("presence" in everywhere).toBe(false);
    expect("movement" in everywhere).toBe(false);
    expect(withPresence({ ...captain, movement: "stays" }, undefined).movement).toBe("stays");
  });

  it("resets Moves Between when a location edit makes an Everywhere entity listed twice", () => {
    const solo: Entity = { id: "solo", name: "Solo", locations: ["bar"], movement: "between" };
    expect("movement" in withEntityLocations(solo, ["bar", "docks"])).toBe(false);
    expect(withEntityLocations(captain, ["bar", "docks", "attic"]).movement).toBe("between");
  });

  it("stores Free as no field", () => {
    expect("movement" in withMovement(captain, "free")).toBe(false);
    expect(withMovement(bartender, "stays").movement).toBe("stays");
  });
});

describe("entitiesInPlay", () => {
  it("puts a positioned entity at its position only", () => {
    const placed = entitiesInPlay(cast, { "bar-keep": "docks" });
    expect(entityIdsAt("bar", placed)).toEqual(["alice"]);
    expect(entityIdsAt("docks", placed)).toEqual(["bar-keep", "gull"]);
  });

  it("keeps an entity without a position at every location it lists", () => {
    const placed = entitiesInPlay(cast, { gull: "bar" });
    expect(entityIdsAt("bar", placed)).toEqual(["alice", "bar-keep", "gull"]);
    expect(entityIdsAt("docks", placed)).toEqual(["bar-keep"]);
  });

  it("returns the same array when nobody has a position", () => {
    expect(entitiesInPlay(cast, {})).toBe(cast);
  });

  it("reads through the multi-location scopes too", () => {
    expect(entityIdsAtAny(["bar"], entitiesInPlay(cast, { "bar-keep": "docks" }))).toEqual(["alice"]);
  });
});

/** A draw that always takes the option at `index` of `of`. */
const pick = (index: number, of: number) => () => index / of;
const wanderer: Entity = { id: "wanderer", name: "Wanderer", presence: "random", locations: ["bar", "docks", "attic"] };

describe("startingPositions", () => {
  it("draws a One entity's start from its locations", () => {
    expect(startingPositions([...cast, wanderer], ["bar", "docks", "attic"], pick(1, 3))).toEqual({ wanderer: "docks" });
    expect(startingPositions([...cast, wanderer], ["bar", "docks", "attic"], pick(2, 3))).toEqual({ wanderer: "attic" });
  });

  it("places a one-location entity with a Movement at that location, and a Free one nowhere", () => {
    const rooted: Entity = { ...alice, movement: "stays" };
    expect(startingPositions([rooted, alice], ["bar", "docks"], pick(0, 1))).toEqual({ alice: "bar" });
  });

  it("gives an Everywhere entity no position, even with a Movement", () => {
    const rooted: Entity = { ...bartender, movement: "stays" };
    expect(startingPositions([rooted], ["bar", "docks"], pick(0, 2))).toEqual({});
  });

  it("draws only from locations the world still has", () => {
    expect(startingPositions([wanderer], ["attic"], pick(0, 3))).toEqual({ wanderer: "attic" });
    expect(startingPositions([wanderer], [], pick(0, 3))).toEqual({});
  });
});

describe("positionedCast", () => {
  const sylvie: Entity = { ...wanderer, id: "sylvie", persona: true };
  const custom: Entity = { ...wanderer, id: "custom", customPersona: true };

  it("leaves out the played world persona and the Custom Persona", () => {
    const ids = (ref?: Parameters<typeof positionedCast>[1]) => positionedCast([wanderer, sylvie, custom], ref).map((e) => e.id);
    expect(ids({ source: "world", entityId: "sylvie" })).toEqual(["wanderer"]);
    expect(ids({ source: "none" })).toEqual(["wanderer", "sylvie"]);
    expect(ids(undefined)).toEqual(["wanderer", "sylvie"]);
  });

  it("gives the played persona no starting position", () => {
    expect(startingPositions(positionedCast([sylvie], { source: "world", entityId: "sylvie" }), ["bar"], pick(0, 1))).toEqual({});
  });
});

describe("reconcilePositions", () => {
  const locationIds = ["bar", "docks", "attic"];

  it("keeps a position on a live entity and a live location", () => {
    expect(reconcilePositions({ wanderer: "attic" }, [wanderer], locationIds, pick(0, 3))).toEqual({ wanderer: "attic" });
  });

  it("re-places a One entity whose location is gone by the Presence rule", () => {
    expect(reconcilePositions({ wanderer: "cellar" }, [wanderer], locationIds, pick(1, 3))).toEqual({ wanderer: "docks" });
  });

  it("places a One entity the save holds no position for", () => {
    expect(reconcilePositions({}, [wanderer], locationIds, pick(2, 3))).toEqual({ wanderer: "attic" });
  });

  it("places a one-location entity with a Movement the save holds no position for", () => {
    expect(reconcilePositions({}, [{ ...gull, movement: "follow" }], locationIds, pick(0, 1))).toEqual({ gull: "docks" });
  });

  it("drops a stale position of an Everywhere entity, so it is back at every listed location", () => {
    expect(reconcilePositions({ "bar-keep": "cellar" }, cast, locationIds, pick(0, 3))).toEqual({});
  });

  it("keeps a valid position of an entity that is no longer One", () => {
    expect(reconcilePositions({ "bar-keep": "docks" }, cast, locationIds, pick(0, 3))).toEqual({ "bar-keep": "docks" });
  });

  it("drops the position of a deleted entity", () => {
    expect(reconcilePositions({ gone: "bar" }, cast, locationIds, pick(0, 3))).toEqual({});
  });

  it("returns the saved map itself when nothing changes", () => {
    const saved = { wanderer: "bar" };
    expect(reconcilePositions(saved, [wanderer], locationIds, pick(0, 3))).toBe(saved);
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
