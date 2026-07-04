import { describe, it, expect } from "vitest";
import {
  buildLocationContext, buildEntityContext, buildSublocationsContext, buildSublocationEntitiesContext,
  buildReachableLocationsContext, buildReachableEntitiesContext,
  navigableDestinations, buildDestinationsContext,
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
});

describe("buildReachableLocationsContext / buildReachableEntitiesContext", () => {
  // town > { houseA (Alice), Sarah's House (Sarah), Mall } ; houseA > roomA ; plus a top-level location.
  const houseA: GameLocation = { id: "a", name: "House A", parentId: "town", entities: ["alice"] };
  const sarahs: GameLocation = { id: "b", name: "Sarah's House", parentId: "town", aiDescription: "Where Sarah lives.", entities: ["sarah"] };
  const mall: GameLocation = { id: "m", name: "Mall", parentId: "town", aiDescription: "A big mall." };
  const roomA: GameLocation = { id: "ra", name: "Room A", parentId: "a" }; // child of houseA, not a sibling
  const top: GameLocation = { id: "top", name: "Overworld" }; // top-level, no parent
  const locs = [houseA, sarahs, mall, roomA, top];
  const sarah: Entity = { id: "sarah", name: "Sarah", aiDescription: "A friendly neighbor." };

  it("reachable locations: siblings only — not self, not children, N/A for top-level/only-child", () => {
    const out = buildReachableLocationsContext(houseA, locs);
    expect(out).toContain("Sarah's House: Where Sarah lives.");
    expect(out).toContain("Mall: A big mall.");
    expect(out).not.toContain("House A"); // self
    expect(out).not.toContain("Room A"); // child, not sibling
    expect(buildReachableLocationsContext(top, locs)).toBe(NONE_PLACEHOLDER); // no parent
    expect(buildReachableLocationsContext(roomA, locs)).toBe(NONE_PLACEHOLDER); // only child of houseA
  });

  it("reachable entities: gathers siblings' entities, honors excludeIds, N/A when none", () => {
    const out = buildReachableEntitiesContext(houseA, locs, [sarah]);
    expect(out).toContain("Sarah");
    expect(out).toContain("A friendly neighbor.");
    expect(buildReachableEntitiesContext(houseA, locs, [sarah], { excludeIds: ["sarah"] })).toBe(NONE_PLACEHOLDER);
    expect(buildReachableEntitiesContext(top, locs, [sarah])).toBe(NONE_PLACEHOLDER);
  });
});

describe("navigableDestinations / buildDestinationsContext", () => {
  // hamlet > { green, cottage, eelhouse } ; green connects to a top-level Landing + its siblings.
  const green: GameLocation = { id: "green", name: "Green", parentId: "hamlet", connections: ["Landing", "Cottage"] };
  const cottage: GameLocation = { id: "cottage", name: "Cottage", parentId: "hamlet", aiSummary: "A blue-doored cottage." };
  const eelhouse: GameLocation = { id: "eel", name: "Eelhouse", parentId: "hamlet" };
  const landing: GameLocation = { id: "landing", name: "Landing", connections: ["Green"] }; // top-level
  const locs = [green, cottage, eelhouse, landing];

  it("unions connections + sub-locations + reachable siblings, deduped, excluding self", () => {
    const names = navigableDestinations(green, locs).map((l) => l.name).sort();
    // Cottage is both a connection AND a reachable sibling → appears once; Eelhouse is a sibling; Landing is a connection.
    expect(names).toEqual(["Cottage", "Eelhouse", "Landing"]);
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
});
