import { describe, it, expect } from "vitest";
import { searchLocations } from "./locationSearch";
import type { GameLocation } from "@/types";

// village > { tavern > cellar }, a top-level Cellar of its own, and two names sharing a run of letters.
const world: GameLocation[] = [
  { id: "village", name: "Village" },
  { id: "tavern", name: "Old Tavern", parentId: "village" },
  { id: "cellar-inn", name: "Cellar", parentId: "tavern" },
  { id: "cellar-top", name: "Cellar" },
  { id: "windmills", name: "Windmills" },
  { id: "mill", name: "Mill" },
  // Four ways to hold "tav", one per tier: the whole name, its start, a word's start, and buried mid-word.
  { id: "tav", name: "Tav" },
  { id: "tavern-hall", name: "Tavern Hall" },
  { id: "octavern", name: "Octavern" },
];

const ids = (query: string, opts?: Parameters<typeof searchLocations>[2]) =>
  searchLocations(world, query, opts).map((m) => m.id);

describe("searchLocations", () => {
  it("names nothing for a blank query, rather than everything", () => {
    expect(searchLocations(world, "")).toEqual([]);
    expect(searchLocations(world, "   ")).toEqual([]);
  });

  it("matches by name regardless of case, anywhere in the name", () => {
    expect(ids("TAVERN")).toEqual(["tavern-hall", "tavern", "octavern"]);
    // Buried mid-word in all three, so nothing separates them but their names.
    expect(ids("avern")).toEqual(["octavern", "tavern", "tavern-hall"]);
    expect(ids("harbor")).toEqual([]);
  });

  it("finds a location nested inside boxes, and says which ones hold it", () => {
    const [deepest] = searchLocations(world, "cellar").filter((m) => m.id === "cellar-inn");
    expect(deepest.path).toEqual(["Village", "Old Tavern"]);
    // The top-level twin comes back with no path at all, which is what tells the two apart.
    expect(searchLocations(world, "cellar").find((m) => m.id === "cellar-top")!.path).toEqual([]);
  });

  it("puts the whole name first, then a name starting with the query, then a word, then anywhere", () => {
    expect(ids("tav")).toEqual(["tav", "tavern-hall", "tavern", "octavern"]);
    // The pair either side of the word rule: "Old Tavern" starts a word with it, "Windmills" does not.
    expect(ids("mill")).toEqual(["mill", "windmills"]);
    expect(ids("old")).toEqual(["tavern"]);
  });

  it("resolves the name the author reads, so a chip is searchable by what it says", () => {
    const chipped: GameLocation[] = [{ id: "keep", name: "The {{ruler}} Keep" }];
    const resolveName = (l: GameLocation) => l.name.replace("{{ruler}}", "Queen's");
    expect(searchLocations(chipped, "queen", { resolveName })[0]).toMatchObject({
      id: "keep", label: "The Queen's Keep",
    });
    expect(searchLocations(chipped, "queen")).toEqual([]); // unresolved, the chip is not what it says
  });

  it("offers at most the limit, keeping the best matches", () => {
    expect(ids("cellar", { limit: 1 })).toHaveLength(1);
    expect(ids("l", { limit: 3 })).toHaveLength(3);
  });

  it("keeps its footing on a world whose tree points at itself", () => {
    const cyclic: GameLocation[] = [
      { id: "a", name: "Attic", parentId: "b" },
      { id: "b", name: "Basement", parentId: "a" },
    ];
    expect(searchLocations(cyclic, "attic")[0].path).toEqual(["Basement"]);
  });

  it("reads a location whose parent is gone as standing on its own", () => {
    const stranded: GameLocation[] = [{ id: "a", name: "Attic", parentId: "gone" }];
    expect(searchLocations(stranded, "attic")[0].path).toEqual([]);
  });

  it("falls back to a name for a location that has none", () => {
    expect(searchLocations([{ id: "x", name: "" }], "unnamed")[0]).toMatchObject({ label: "Unnamed Location" });
  });
});
