import { describe, it, expect } from "vitest";
import { buildLocationContext, buildEntityContext } from "./locationContext";
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
  it("returns empty string for a null location", () => {
    expect(buildLocationContext(null)).toBe("");
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
});

describe("buildEntityContext", () => {
  it("returns empty string for a null location or no entities", () => {
    expect(buildEntityContext(null, [guard])).toBe("");
    expect(buildEntityContext({ id: "loc2", name: "Empty Field" }, [guard])).toBe("");
  });

  it("emits a top-level roster with full aiDescription by default", () => {
    const out = buildEntityContext(location, [guard]);
    expect(out).toContain("- name: Guard");
    expect(out).toContain("  description: A burly guard in full plate, scarred from old wars.");
    expect(out).toContain("  type: npc");
    expect(out).not.toContain("aiSummary");
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

  it("skips ids that don't resolve to a known entity", () => {
    const loc: GameLocation & { entity?: string[] } = { ...location, entities: ["missing"] };
    expect(buildEntityContext(loc, [guard])).toBe("");
  });
});
