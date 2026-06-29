import { describe, it, expect } from "vitest";
import { buildLocationContext } from "./locationContext";
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
    expect(buildLocationContext(null, [])).toBe("");
  });

  it("uses full aiDescription by default for location and entities", () => {
    const out = buildLocationContext(location, [guard]);
    expect(out).toContain("description: A towering stone gate, portcullis raised, banners snapping in the wind.");
    expect(out).toContain("    description: A burly guard in full plate, scarred from old wars.");
    // The raw summary field is never dumped.
    expect(out).not.toContain("aiSummary");
    expect(out).not.toContain("A towering stone gate.");
  });

  it("prefers aiSummary for location and entities when preferSummary is set", () => {
    const out = buildLocationContext(location, [guard], { preferSummary: true });
    expect(out).toContain("description: A towering stone gate.");
    expect(out).toContain("    description: A burly scarred guard.");
    expect(out).not.toContain("portcullis raised");
    expect(out).not.toContain("full plate");
  });

  it("falls back to aiDescription when aiSummary is empty or whitespace", () => {
    const loc: GameLocation & { entity?: string[] } = {
      ...location,
      aiSummary: "   ",
      entities: ["e2"],
    };
    const ent: Entity = { id: "e2", name: "Merchant", aiDescription: "A shrewd traveling merchant.", aiSummary: "" };
    const out = buildLocationContext(loc, [ent], { preferSummary: true });
    expect(out).toContain("description: A towering stone gate, portcullis raised, banners snapping in the wind.");
    expect(out).toContain("    description: A shrewd traveling merchant.");
  });

  it("skips a blank description and omits the entities block when there are none", () => {
    const loc: GameLocation & { entity?: string[] } = { id: "loc2", name: "Empty Field" };
    const out = buildLocationContext(loc, []);
    // `name` prints exactly once (no double-print), no `description:` line, no `entities:` block.
    expect(out).toBe("name: Empty Field\n");
    expect(out).not.toContain("description:");
    expect(out).not.toContain("entities:");
  });
});
