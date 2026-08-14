import { describe, it, expect } from "vitest";
import { autoArrange, autoArrangeAll } from "./locationArrange";
import { CANVAS_GRID, GROUP_HEADER, GROUP_PADDING, buildLocationCanvas } from "./locationCanvas";
import { createConnection } from "./connectionEditing";
import type { Connection, GameLocation } from "@/types";

// A chain of four top-level locations, wired end to end, and a group holding two children.
const link = (from: string, to: string): Connection => ({ ...createConnection(from, to), id: `c-${from}-${to}` });

const chain: GameLocation[] = [
  { id: "a", name: "A", canvasPosition: { x: 900, y: 40 } },
  { id: "b", name: "B", canvasPosition: { x: 20, y: 600 } },
  { id: "c", name: "C", canvasPosition: { x: 500, y: 300 } },
  { id: "d", name: "D", canvasPosition: { x: 100, y: 80 } },
];
const chainLinks = [link("a", "b"), link("b", "c"), link("c", "d")];

// village > { tavern > cellar, house }, plus one top-level neighbor.
const nested: GameLocation[] = [
  { id: "village", name: "Village" },
  { id: "tavern", name: "Tavern", parentId: "village", canvasPosition: { x: 400, y: 300 } },
  { id: "house", name: "House", parentId: "village", canvasPosition: { x: 60, y: 700 } },
  // Off the grid on purpose: the Tavern is measured around it, so the frame the layout is handed is an odd
  // size, and a layout that never snapped its output would show it.
  { id: "cellar", name: "Cellar", parentId: "tavern", canvasPosition: { x: 141, y: 223 } },
  { id: "landing", name: "Landing" },
];

// The same shape with the House's two rooms hand-stacked on one spot, so the House is drawn at its smallest
// and arranging it makes it wider than the Village was measured around — and the Tavern beside it is what a
// stale measurement would be run over.
const stacked: GameLocation[] = [
  { id: "village", name: "Village" },
  { id: "house", name: "House", parentId: "village" },
  { id: "tavern", name: "Tavern", parentId: "village" }, // laid out after the House, so its growth is felt
  { id: "cellar", name: "Cellar", parentId: "house", canvasPosition: { x: 20, y: 40 } },
  { id: "attic", name: "Attic", parentId: "house", canvasPosition: { x: 20, y: 40 } },
];

const positionOf = (locations: GameLocation[], id: string) =>
  locations.find((l) => l.id === id)!.canvasPosition!;
/** Every node's box measured from the canvas origin, which is where crossings and neighbors are judged. */
const rectsOf = (locations: GameLocation[], connections: Connection[] = []) => {
  const rects = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const node of buildLocationCanvas(locations, connections).nodes) {
    const origin = (node.parentId && rects.get(node.parentId)) || { x: 0, y: 0 };
    rects.set(node.id, {
      x: origin.x + node.position.x,
      y: origin.y + node.position.y,
      width: node.width,
      height: node.height,
    });
  }
  return rects;
};
const centerOf = (rects: ReturnType<typeof rectsOf>, id: string) => {
  const r = rects.get(id)!;
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
const distance = (rects: ReturnType<typeof rectsOf>, a: string, b: string) => {
  const from = centerOf(rects, a);
  const to = centerOf(rects, b);
  return Math.hypot(to.x - from.x, to.y - from.y);
};
/** Whether two straight center-to-center segments cross, which is what a layered layout is minimizing. */
const crosses = (
  rects: ReturnType<typeof rectsOf>,
  [a, b]: [string, string],
  [c, d]: [string, string],
) => {
  const p1 = centerOf(rects, a), p2 = centerOf(rects, b);
  const p3 = centerOf(rects, c), p4 = centerOf(rects, d);
  const side = (o: typeof p1, p: typeof p1, q: typeof p1) =>
    Math.sign((p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x));
  return side(p1, p2, p3) !== side(p1, p2, p4) && side(p3, p4, p1) !== side(p3, p4, p2);
};

describe("autoArrange", () => {
  it("writes every direct child of the arranged group and nothing else", () => {
    const arranged = autoArrange(nested, [], "village");
    expect(positionOf(arranged, "tavern")).not.toEqual({ x: 400, y: 300 });
    expect(positionOf(arranged, "house")).not.toEqual({ x: 60, y: 700 });
    // The grandchild is the Tavern's business, and the top-level neighbor is nobody's.
    expect(positionOf(arranged, "cellar")).toEqual({ x: 141, y: 223 });
    expect(arranged.find((l) => l.id === "landing")!.canvasPosition).toBeUndefined();
  });

  it("leaves a nested group's own arrangement alone while its frame resizes to fit", () => {
    const before = rectsOf(nested);
    const arranged = autoArrange(nested, [], "village");
    const after = rectsOf(arranged);
    // The Cellar sits where it sat *inside* the Tavern; only the Tavern's own corner moved.
    const relative = (rects: ReturnType<typeof rectsOf>) => ({
      x: rects.get("cellar")!.x - rects.get("tavern")!.x,
      y: rects.get("cellar")!.y - rects.get("tavern")!.y,
    });
    expect(relative(after)).toEqual(relative(before));
    // And the Village's frame is drawn around what it now holds, rather than around where they used to be.
    const village = after.get("village")!;
    for (const id of ["tavern", "house"]) {
      const child = after.get(id)!;
      expect(child.x).toBeGreaterThanOrEqual(village.x);
      expect(child.y).toBeGreaterThanOrEqual(village.y);
      expect(child.x + child.width).toBeLessThanOrEqual(village.x + village.width);
      expect(child.y + child.height).toBeLessThanOrEqual(village.y + village.height);
    }
  });

  it("lands every written position on the grid, clear of the group's frame", () => {
    const arranged = autoArrange(nested, [], "village");
    for (const id of ["tavern", "house"]) {
      const at = positionOf(arranged, id);
      expect(at.x % CANVAS_GRID).toBe(0);
      expect(at.y % CANVAS_GRID).toBe(0);
      expect(at.x).toBeGreaterThanOrEqual(GROUP_PADDING);
      expect(at.y).toBeGreaterThanOrEqual(GROUP_HEADER);
    }
    const top = autoArrange(chain, chainLinks, null);
    for (const id of ["a", "b", "c", "d"]) {
      const at = positionOf(top, id);
      expect(at.x % CANVAS_GRID).toBe(0);
      expect(at.y % CANVAS_GRID).toBe(0);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("arranges the same world into the same layout every time", () => {
    const once = autoArrange(chain, chainLinks, null);
    const twice = autoArrange(chain, chainLinks, null);
    expect(twice).toEqual(once);
    // And running it on its own output changes nothing further: the layout is a fixed point.
    expect(autoArrange(once, chainLinks, null)).toEqual(once);
  });

  it("draws connected locations together and uncrosses the arrows between them", () => {
    // Scattered by hand into a shape whose chain arrows cross; the layout has to undo that.
    const before = rectsOf(chain, chainLinks);
    expect(crosses(before, ["a", "b"], ["c", "d"])).toBe(true);

    const arranged = autoArrange(chain, chainLinks, null);
    const after = rectsOf(arranged, chainLinks);
    expect(crosses(after, ["a", "b"], ["c", "d"])).toBe(false);
    expect(crosses(after, ["a", "b"], ["b", "c"])).toBe(false);
    expect(crosses(after, ["b", "c"], ["c", "d"])).toBe(false);
    // Each link is shorter than the diagonal the hand layout left it as.
    for (const [from, to] of [["a", "b"], ["b", "c"], ["c", "d"]] as const) {
      expect(distance(after, from, to)).toBeLessThan(distance(before, from, to));
    }
    // And the chain reads along the travel: each link's far end stands one rank further out than its near
    // end, which is the layering itself rather than four boxes that merely stopped overlapping.
    for (const [from, to] of [["a", "b"], ["b", "c"], ["c", "d"]] as const) {
      expect(after.get(to)!.x).toBeGreaterThan(after.get(from)!.x);
    }
  });

  it("keeps siblings with no authored travel in one rank, and ranks the pair a Connection joins", () => {
    // Free travel runs between every pair of siblings, so it orders nothing: four rooms of one place have no
    // reason to stand in four columns, and a layout built on it would put them there.
    const rooms: GameLocation[] = [
      { id: "inn", name: "Inn" },
      ...["bar", "kitchen", "loft", "yard"].map((id) => ({ id, name: id, parentId: "inn" })),
    ];
    const plain = autoArrange(rooms, [], "inn");
    const columns = new Set(["bar", "kitchen", "loft", "yard"].map((id) => positionOf(plain, id).x));
    expect(columns.size).toBe(1);
    expect(rectsOf(plain).get("inn")!.width).toBeLessThan(rectsOf(rooms).get("inn")!.width * 2);

    // One authored Connection is a real ordering, and it is what pulls its two ends into travel order.
    const wired = autoArrange(rooms, [link("bar", "kitchen")], "inn");
    expect(positionOf(wired, "kitchen").x).toBeGreaterThan(positionOf(wired, "bar").x);
    expect(positionOf(wired, "loft").x).toBe(positionOf(wired, "bar").x);
  });

  it("leaves a world with nothing to arrange exactly as it was", () => {
    expect(autoArrange(nested, [], "cellar")).toBe(nested); // a leaf holds no children
    expect(autoArrange(nested, [], "nowhere")).toBe(nested);
  });
});

describe("autoArrangeAll", () => {
  it("arranges the root and every group beneath it", () => {
    const arranged = autoArrangeAll(nested, []);
    for (const id of ["village", "landing", "tavern", "house", "cellar"]) {
      expect(positionOf(arranged, id)).toBeDefined();
    }
    // The Cellar was arranged as the Tavern's own child, so its stored place is on the grid too.
    const cellar = positionOf(arranged, "cellar");
    expect(cellar.x % CANVAS_GRID).toBe(0);
    expect(cellar.y % CANVAS_GRID).toBe(0);
    expect(cellar).not.toEqual({ x: 141, y: 223 });
  });

  it("sizes a group around children that were arranged after it would have been measured", () => {
    // The deepest groups are laid out first, so a parent is measured around frames that are already final —
    // a parent laid out first would place its children against sizes that then changed underneath them.
    const arranged = autoArrangeAll(nested, []);
    const rects = rectsOf(arranged);
    const tavern = rects.get("tavern")!;
    const cellar = rects.get("cellar")!;
    expect(cellar.x + cellar.width).toBeLessThanOrEqual(tavern.x + tavern.width);
    expect(cellar.y + cellar.height).toBeLessThanOrEqual(tavern.y + tavern.height);

    // Nothing the arrangement placed sits on top of anything else placed beside it.
    const overlap = (of: ReturnType<typeof rectsOf>, a: string, b: string) => {
      const one = of.get(a)!, two = of.get(b)!;
      return one.x < two.x + two.width && two.x < one.x + one.width
        && one.y < two.y + two.height && two.y < one.y + one.height;
    };
    expect(overlap(rects, "tavern", "house")).toBe(false);
    expect(overlap(rects, "village", "landing")).toBe(false);

    // The House's own rooms were stacked on one spot here, so arranging it makes it wider than the frame that
    // holds it was measured for — laid out the other way about, the Tavern would land inside the House.
    const grown = rectsOf(autoArrangeAll(stacked, []));
    expect(grown.get("house")!.height).toBeGreaterThan(rectsOf(stacked).get("house")!.height);
    expect(overlap(grown, "tavern", "house")).toBe(false);
  });

  it("arranges the same world into the same layout every time", () => {
    expect(autoArrangeAll(nested, [])).toEqual(autoArrangeAll(nested, []));
  });
});
