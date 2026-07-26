import { describe, it, expect } from "vitest";
import {
  buildLocationContext, buildEntityContext, buildSublocationsContext, buildSublocationEntitiesContext,
  buildReachableLocationsContext, buildReachableEntitiesContext,
  navigableDestinations, buildDestinationsContext, sublocationEntityIds, reachableEntityIds,
} from "./locationContext";
import { NONE_PLACEHOLDER } from "./promptFallbacks";
import type { Entity, GameLocation } from "@/types";

const guard: Entity = {
  id: "e1",
  name: "Guard",
  type: "npc",
  aiDescription: "A burly guard in full plate, scarred from old wars.",
  aiSummary: "A burly scarred guard.",
};

const location: GameLocation & { entity?: string[] } = {
  id: "loc1",
  name: "North Gate",
  aiDescription: "A towering stone gate, portcullis raised, banners snapping in the wind.",
  aiSummary: "A towering stone gate.",
  entities: ["e1"],
};

describe("buildLocationContext", () => {
  it("returns the placeholder for a null location", () => {
    expect(buildLocationContext(null)).toBe(NONE_PLACEHOLDER);
  });

  it("emits only allow-listed fields — an unknown field never leaks to the AI by default", () => {
    const out = buildLocationContext({
      ...location,
      playerDescription: "What the player reads.",
      imageTags: "outdoors, dock, sunset",
      // A field the allowlist doesn't name — the whole point is it's dropped without anyone updating this code.
      someFutureField: "secret editor state",
    } as never);
    expect(out).not.toContain("imageTags"); // booru tags for image gen, not story context
    expect(out).not.toContain("sunset");
    expect(out).not.toContain("playerDescription");
    expect(out).not.toContain("What the player reads.");
    expect(out).not.toContain("someFutureField");
    expect(out).not.toContain("secret editor state");
    expect(out).toContain("description:"); // the allow-listed content still lands
  });

  it("folds the legacy `description` into one description line rather than emitting a second key", () => {
    const out = buildLocationContext({ ...location, description: "Legacy text." });
    expect(out).not.toContain("Legacy text."); // authored aiDescription wins
    expect(out.match(/description:/g)).toHaveLength(1); // never two conflicting description lines
  });

  it("falls back to the legacy `description` when a pre-split world has no AI text", () => {
    // migrateWorld renames inGameDescription/detailedDescription but never folds a plain `description`,
    // so dropping it outright would silently mute those locations.
    const out = buildLocationContext({ id: "old", name: "Old Well", description: "A mossy well." });
    expect(out).toContain("description: A mossy well.");
  });

  it("uses full aiDescription by default", () => {
    const out = buildLocationContext(location);
    expect(out).toContain("description: A towering stone gate, portcullis raised, banners snapping in the wind.");
    // The raw summary field is never dumped.
    expect(out).not.toContain("aiSummary");
    expect(out).not.toContain("A towering stone gate.");
  });

  it("prefers aiSummary when preferSummary is set", () => {
    const out = buildLocationContext(location, { preferSummary: true });
    expect(out).toContain("description: A towering stone gate.");
    expect(out).not.toContain("portcullis raised");
  });

  it("markdown format emits a bold-key bullet per field", () => {
    const out = buildLocationContext(location, { format: "markdown" });
    expect(out).toContain("- **name:** North Gate");
    expect(out).toContain("- **description:** A towering stone gate, portcullis raised, banners snapping in the wind.");
    // Not the plain form.
    expect(out).not.toContain("name: North Gate\n");
  });

  it("xml format emits a <key> child tag per field (section tag is the location wrapper)", () => {
    const out = buildLocationContext(location, { format: "xml" });
    expect(out).toBe(
      "<name>North Gate</name>\n" +
      "<description>A towering stone gate, portcullis raised, banners snapping in the wind.</description>\n",
    );
  });

  it("no longer emits the entities sub-block (entities are their own section)", () => {
    const out = buildLocationContext(location);
    expect(out).not.toContain("entities:");
    expect(out).not.toContain("Guard");
  });

  it("skips a blank description and prints name exactly once", () => {
    const loc: GameLocation & { entity?: string[] } = { id: "loc2", name: "Empty Field" };
    const out = buildLocationContext(loc);
    expect(out).toBe("name: Empty Field\n");
    expect(out).not.toContain("description:");
  });

  it("never emits the sub-location parentId (editor-only; not part of the AI feed)", () => {
    const loc: GameLocation & { entity?: string[] } = { id: "child", name: "Cellar", parentId: "loc1" };
    const out = buildLocationContext(loc);
    expect(out).toBe("name: Cellar\n");
    expect(out).not.toContain("parentId");
    expect(out).not.toContain("loc1");
  });
});

describe("buildSublocationsContext / buildSublocationEntitiesContext", () => {
  const keep: GameLocation = { id: "p", name: "Keep" };
  const cellar: GameLocation = { id: "a", name: "Cellar", parentId: "p", aiDescription: "A damp stone cellar.", aiSummary: "A damp cellar.", entities: ["g1"] };
  const tower: GameLocation = { id: "b", name: "Tower", parentId: "p", aiDescription: "A tall watchtower." };
  const subCellar: GameLocation = { id: "gc", name: "Sub-cellar", parentId: "a" }; // grandchild of Keep
  const locs = [keep, cellar, tower, subCellar];
  const rat: Entity = { id: "g1", name: "Rat", aiDescription: "A big rat." };

  it("sublocations: N/A for null or a childless location", () => {
    expect(buildSublocationsContext(null, locs)).toBe(NONE_PLACEHOLDER);
    expect(buildSublocationsContext(tower, locs)).toBe(NONE_PLACEHOLDER); // Tower has no children
  });

  it("sublocations: lists only direct children (not grandchildren) with their descriptions", () => {
    const out = buildSublocationsContext(keep, locs);
    expect(out).toContain("Cellar: A damp stone cellar.");
    expect(out).toContain("Tower: A tall watchtower.");
    expect(out).not.toContain("Sub-cellar"); // grandchild is not surfaced
  });

  it("sublocations: preferSummary uses the summary, markdown bolds the name", () => {
    expect(buildSublocationsContext(keep, locs, { preferSummary: true })).toContain("Cellar: A damp cellar.");
    expect(buildSublocationsContext(keep, locs, { format: "markdown" })).toContain("- **Cellar:** A damp stone cellar.");
  });

  it("sublocation entities: rosters entities from direct children, N/A when none", () => {
    const out = buildSublocationEntitiesContext(keep, locs, [rat]);
    expect(out).toContain("Rat");
    expect(out).toContain("A big rat.");
    // Cellar's own child (Sub-cellar) has no entities → N/A.
    expect(buildSublocationEntitiesContext(cellar, locs, [rat])).toBe(NONE_PLACEHOLDER);
    expect(buildSublocationEntitiesContext(null, locs, [rat])).toBe(NONE_PLACEHOLDER);
  });

  it("sublocation entities: excludeIds drops anyone shown in a higher-precedence roster (present here)", () => {
    expect(buildSublocationEntitiesContext(keep, locs, [rat], { excludeIds: ["g1"] })).toBe(NONE_PLACEHOLDER);
  });

  it("sublocationEntityIds: deduped union across direct children only", () => {
    expect(sublocationEntityIds(keep, locs)).toEqual(["g1"]);
    expect(sublocationEntityIds(tower, locs)).toEqual([]);
    expect(sublocationEntityIds(null, locs)).toEqual([]);
  });
});

describe("buildReachableLocationsContext / buildReachableEntitiesContext", () => {
  // town (Mayor) > { houseA (Alice), Sarah's House (Sarah), Mall } ; houseA > roomA ; plus a top-level location.
  const town: GameLocation = { id: "town", name: "Town", aiDescription: "A small town.", entities: ["mayor"] };
  const houseA: GameLocation = { id: "a", name: "House A", parentId: "town", entities: ["alice"] };
  const sarahs: GameLocation = { id: "b", name: "Sarah's House", parentId: "town", aiDescription: "Where Sarah lives.", entities: ["sarah"] };
  const mall: GameLocation = { id: "m", name: "Mall", parentId: "town", aiDescription: "A big mall." };
  const roomA: GameLocation = { id: "ra", name: "Room A", parentId: "a" }; // child of houseA, not a sibling
  const top: GameLocation = { id: "top", name: "Overworld" }; // top-level, no parent
  const locs = [town, houseA, sarahs, mall, roomA, top];
  const sarah: Entity = { id: "sarah", name: "Sarah", aiDescription: "A friendly neighbor." };
  const mayor: Entity = { id: "mayor", name: "Mayor", aiDescription: "Runs the town." };

  it("reachable locations: the containing location and its neighbors — not self, not children", () => {
    const out = buildReachableLocationsContext(houseA, locs);
    expect(out).toContain("Town: A small town.");
    expect(out).toContain("Sarah's House: Where Sarah lives.");
    expect(out).toContain("Mall: A big mall.");
    expect(out).not.toContain("House A"); // self
    expect(out).not.toContain("Room A"); // child — that's the sub-locations chip's job
  });

  it("reachable locations: the containing location comes first", () => {
    const lines = buildReachableLocationsContext(houseA, locs).trim().split("\n");
    expect(lines[0]).toContain("Town");
  });

  it("reachable locations: an only child still reaches the place that contains it", () => {
    // Room A has no siblings and no children. Without the parent this is N/A and the router has no candidates
    // at all — the player walks in and can never leave.
    expect(buildReachableLocationsContext(roomA, locs)).toContain("House A");
  });

  it("reachable locations: N/A for a top-level location, which has no containing region", () => {
    expect(buildReachableLocationsContext(top, locs)).toBe(NONE_PLACEHOLDER);
  });

  it("reachable locations: a parentId pointing at nothing still lists the neighbors", () => {
    const orphaned = [houseA, sarahs, mall]; // no Town in the world
    const out = buildReachableLocationsContext(houseA, orphaned);
    expect(out).toContain("Sarah's House");
    expect(out).not.toContain("Town");
  });

  it("reachable entities: gathers the containing location's cast alongside the neighbors'", () => {
    const out = buildReachableEntitiesContext(houseA, locs, [sarah, mayor]);
    expect(out).toContain("Sarah");
    expect(out).toContain("Mayor");
    expect(out).toContain("Runs the town.");
  });

  it("reachable entities: honors excludeIds, N/A when nobody is left or nothing is reachable", () => {
    expect(buildReachableEntitiesContext(houseA, locs, [sarah, mayor], { excludeIds: ["sarah", "mayor"] })).toBe(NONE_PLACEHOLDER);
    expect(buildReachableEntitiesContext(top, locs, [sarah])).toBe(NONE_PLACEHOLDER);
  });

  it("reachableEntityIds: dedupes someone standing in two reachable places", () => {
    const alsoMayor: GameLocation = { ...mall, entities: ["mayor"] }; // Mayor is in Town and at the Mall
    expect(reachableEntityIds(houseA, [town, houseA, sarahs, alsoMayor]).sort()).toEqual(["mayor", "sarah"]);
    expect(reachableEntityIds(top, locs)).toEqual([]); // top-level → nothing reachable
  });
});

describe("navigableDestinations / buildDestinationsContext", () => {
  // hamlet > { green, cottage, eelhouse } ; green connects to a top-level Landing + its siblings.
  const green: GameLocation = { id: "green", name: "Green", parentId: "hamlet", connections: ["Landing", "Cottage"] };
  const cottage: GameLocation = { id: "cottage", name: "Cottage", parentId: "hamlet", aiSummary: "A blue-doored cottage." };
  const eelhouse: GameLocation = { id: "eel", name: "Eelhouse", parentId: "hamlet" };
  const landing: GameLocation = { id: "landing", name: "Landing", connections: ["Green"] }; // top-level
  const locs = [green, cottage, eelhouse, landing];

  // The same hamlet, with the containing location actually present in the world.
  const hamlet: GameLocation = { id: "hamlet", name: "Hamlet", aiSummary: "A reed-thatched hamlet." };
  const nested = [hamlet, green, cottage, eelhouse, landing];

  it("is empty for an unconnected top-level location, however many exist in the world", () => {
    // The shape a real 50-turn session ran in: four top-level locations, none linked to any other.
    // Every one is a dead end, so the location router's reply can never match anything — which is why
    // GameViewer gates the request on this list rather than on `locations.length > 1`.
    const a: GameLocation = { id: "a", name: "Office" };
    const b: GameLocation = { id: "b", name: "Dorms" };
    const c: GameLocation = { id: "c", name: "Academy" };
    expect(navigableDestinations(a, [a, b, c])).toEqual([]);
    expect(buildDestinationsContext(a, [a, b, c])).toBe(NONE_PLACEHOLDER);
  });

  it("unions connections + sub-locations + reachable siblings, deduped, excluding self", () => {
    const names = navigableDestinations(green, locs).map((l) => l.name).sort();
    // Cottage is both a connection AND a reachable sibling → appears once; Eelhouse is a sibling; Landing is a connection.
    expect(names).toEqual(["Cottage", "Eelhouse", "Landing"]);
  });

  it("includes the containing location, so nesting is two-way", () => {
    expect(navigableDestinations(green, nested).map((l) => l.name).sort())
      .toEqual(["Cottage", "Eelhouse", "Hamlet", "Landing"]);
  });

  it("lets a leaf sub-location back out instead of stranding the player", () => {
    // No children, no siblings, no connections: the containing location is the only way out. Without it this
    // is empty, the router has zero candidates, and the player is stuck for the rest of the playthrough.
    const cellar: GameLocation = { id: "cellar", name: "Cellar", parentId: "cottage" };
    expect(navigableDestinations(cellar, [hamlet, cottage, cellar]).map((l) => l.name)).toEqual(["Cottage"]);
  });

  it("skips dangling connection names and never includes the current location", () => {
    const withDangling: GameLocation = { ...green, connections: ["Nowhere", "Green"] };
    const names = navigableDestinations(withDangling, [withDangling, cottage, eelhouse]).map((l) => l.name).sort();
    expect(names).toEqual(["Cottage", "Eelhouse"]); // "Nowhere" unresolved, "Green" is self
  });

  it("a top-level location still surfaces its connections as destinations", () => {
    expect(navigableDestinations(landing, locs).map((l) => l.name)).toEqual(["Green"]);
  });

  it("buildDestinationsContext renders name: summary lines and N/A when nothing is reachable", () => {
    const out = buildDestinationsContext(green, locs, { preferSummary: true });
    expect(out).toContain("Cottage: A blue-doored cottage.");
    expect(out).toContain("Eelhouse");
    const isolated: GameLocation = { id: "iso", name: "Void" };
    expect(buildDestinationsContext(isolated, [isolated])).toBe(NONE_PLACEHOLDER);
    expect(buildDestinationsContext(null, locs)).toBe(NONE_PLACEHOLDER);
  });
});

describe("buildEntityContext", () => {
  it("returns the placeholder for a null location or no entities", () => {
    expect(buildEntityContext(null, [guard])).toBe(NONE_PLACEHOLDER);
    expect(buildEntityContext({ id: "loc2", name: "Empty Field" }, [guard])).toBe(NONE_PLACEHOLDER);
  });

  it("emits only allow-listed fields — an unknown field never leaks to the AI by default", () => {
    const out = buildEntityContext(
      location,
      [{ ...guard, playerDescription: "What the player reads.", imageTags: "1girl, blue_hair", placeholders: [], someFutureField: "secret editor state" } as never],
    );
    expect(out).not.toContain("imageTags"); // booru tags for image gen, not story context
    expect(out).not.toContain("blue_hair");
    expect(out).not.toContain("playerDescription");
    expect(out).not.toContain("What the player reads.");
    expect(out).not.toContain("placeholders");
    expect(out).not.toContain("someFutureField"); // dropped without anyone updating the builder
    expect(out).not.toContain("secret editor state");
    expect(out).toContain("description: A burly guard in full plate, scarred from old wars."); // aiDescription still lands
  });

  it("emits a top-level roster (name as subject, indented fields) with full aiDescription by default", () => {
    const out = buildEntityContext(location, [guard]);
    expect(out).toContain("Guard\n");
    expect(out).toContain("  description: A burly guard in full plate, scarred from old wars.");
    expect(out).toContain("  type: npc");
    expect(out).not.toContain("- name:"); // no field-label bullet in the simple form
    expect(out).not.toContain("aiSummary");
  });

  it("markdown format leads each entity with a bold-name bullet and nested bold-key fields", () => {
    const out = buildEntityContext(location, [guard], { format: "markdown" });
    expect(out).toContain("- **Guard**");
    expect(out).toContain("  - **description:** A burly guard in full plate, scarred from old wars.");
    expect(out).toContain("  - **type:** npc");
  });

  it("xml format wraps each entity in <entity> with <name> and one <key> child per field", () => {
    const out = buildEntityContext(location, [guard], { format: "xml" });
    expect(out).toBe(
      "<entity>\n" +
      "  <name>Guard</name>\n" +
      "  <description>A burly guard in full plate, scarred from old wars.</description>\n" +
      "  <type>npc</type>\n" +
      "</entity>\n",
    );
  });

  it("prefers aiSummary for entities when preferSummary is set", () => {
    const out = buildEntityContext(location, [guard], { preferSummary: true });
    expect(out).toContain("  description: A burly scarred guard.");
    expect(out).not.toContain("full plate");
  });

  it("falls back to aiDescription when aiSummary is empty or whitespace", () => {
    const loc: GameLocation & { entity?: string[] } = { ...location, entities: ["e2"] };
    const ent: Entity = { id: "e2", name: "Merchant", aiDescription: "A shrewd traveling merchant.", aiSummary: "" };
    const out = buildEntityContext(loc, [ent], { preferSummary: true });
    expect(out).toContain("  description: A shrewd traveling merchant.");
  });

  it("returns the placeholder when no ids resolve to a known entity", () => {
    const loc: GameLocation & { entity?: string[] } = { ...location, entities: ["missing"] };
    expect(buildEntityContext(loc, [guard])).toBe(NONE_PLACEHOLDER);
  });

  it("surfaces aliases as an 'also known as' line, joined, right after the name", () => {
    const aka = { ...guard, aliases: ["Matron", "Em"] };
    const simple = buildEntityContext(location, [aka]);
    expect(simple).toContain("  also known as: Matron, Em");
    const md = buildEntityContext(location, [aka], { format: "markdown" });
    expect(md).toContain("  - **also known as:** Matron, Em");
    const xml = buildEntityContext(location, [aka], { format: "xml" });
    expect(xml).toContain("  <name>Guard</name>\n  <aliases>Matron, Em</aliases>\n"); // spaced label can't be an xml tag
  });

  it("emits no alias line when aliases are absent, empty, or blank", () => {
    expect(buildEntityContext(location, [guard])).not.toContain("also known as");
    expect(buildEntityContext(location, [{ ...guard, aliases: [] }])).not.toContain("also known as");
    expect(buildEntityContext(location, [{ ...guard, aliases: ["  "] }])).not.toContain("also known as");
  });

  it("never emits editor-only grouping fields (groupId/order) to the AI", () => {
    // Grouping is purely organizational; the entity context is identical whether grouped or not.
    const grouped: Entity = { id: "g9", name: "Synthia", aiDescription: "The matron.", groupId: "elf", order: 2 };
    const loc = { id: "l", name: "Hall", entities: ["g9"] };
    const out = buildEntityContext(loc, [grouped]);
    expect(out).toContain("Synthia\n");
    expect(out).toContain("description: The matron.");
    expect(out).not.toContain("groupId");
    expect(out).not.toContain("order");
  });
});

describe('name-only content variant', () => {
  const here: GameLocation = {
    id: 'l1', name: "Sarah's Place", description: '', aiDescription: 'A cramped flat above the laundromat.',
    aiSummary: 'A cramped flat.', entities: ['e1', 'e2'],
  } as GameLocation;
  const cast: Entity[] = [
    { id: 'e1', name: 'Sarah Jones', description: '', aiDescription: 'The tenant.' } as Entity,
    { id: 'e2', name: 'Mira', description: '', aiDescription: 'A visitor.' } as Entity,
  ];

  it('returns the bare location name, with none of the description or field labels', () => {
    const out = buildLocationContext(here, { nameOnly: true });
    expect(out).toBe("Sarah's Place");
    expect(out).not.toContain('name:');
    expect(out).not.toContain('laundromat');
  });

  it('returns entity names as a plain comma-separated list', () => {
    expect(buildEntityContext(here, cast, { nameOnly: true })).toBe('Sarah Jones, Mira');
  });

  it('ignores format, since a bare list has nothing to decorate', () => {
    for (const format of ['simple', 'markdown', 'xml'] as const) {
      expect(buildLocationContext(here, { nameOnly: true, format })).toBe("Sarah's Place");
      expect(buildEntityContext(here, cast, { nameOnly: true, format })).toBe('Sarah Jones, Mira');
    }
  });

  it('still returns the N/A placeholder when there is nothing to name', () => {
    expect(buildEntityContext({ ...here, entities: [] }, cast, { nameOnly: true })).toBe(NONE_PLACEHOLDER);
  });

  it('leaves the full and summary variants untouched', () => {
    expect(buildLocationContext(here, {})).toContain('laundromat');
    expect(buildLocationContext(here, { preferSummary: true })).toContain('A cramped flat.');
  });
});
