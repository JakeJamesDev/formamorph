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

/** A group holding `names` as plain, never-positioned sub-locations. */
const roomsIn = (group: string, names: string[]): GameLocation[] => [
  { id: group, name: group },
  ...names.map((id) => ({ id, name: id, parentId: group })),
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
/** Whether two placed boxes sit on top of each other — what a pack must never produce. */
const overlaps = (rects: ReturnType<typeof rectsOf>, a: string, b: string) => {
  const one = rects.get(a)!, two = rects.get(b)!;
  return one.x < two.x + two.width && two.x < one.x + one.width
    && one.y < two.y + two.height && two.y < one.y + one.height;
};
/** The block a set of boxes occupies together, which is the shape the pack is aiming at. */
const boundsOf = (rects: ReturnType<typeof rectsOf>, ids: string[]) => {
  const boxes = ids.map((id) => rects.get(id)!);
  const x = Math.min(...boxes.map((r) => r.x));
  const y = Math.min(...boxes.map((r) => r.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((r) => r.x + r.width)) - x,
    height: Math.max(...boxes.map((r) => r.y + r.height)) - y,
  };
};
/** The order the pack laid boxes out in, read off the result the way an author reads it: rows top to bottom,
 *  each row left to right. */
const packOrder = (rects: ReturnType<typeof rectsOf>, ids: string[]) =>
  [...ids].sort((a, b) => {
    const one = rects.get(a)!, two = rects.get(b)!;
    return one.y - two.y || one.x - two.x;
  });
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

  it("packs siblings with no authored travel into a grid, and ranks the pair a Connection joins", () => {
    // Free travel runs between every pair of siblings, so it orders nothing: four rooms of one place have no
    // reason to stand in four columns, and no reason to stand in one either. They get packed.
    const names = ["bar", "kitchen", "loft", "yard"];
    const rooms = roomsIn("inn", names);
    const plain = autoArrange(rooms, [], "inn");
    const columns = new Set(names.map((id) => positionOf(plain, id).x));
    const rows = new Set(names.map((id) => positionOf(plain, id).y));
    expect(columns.size).toBeGreaterThan(1); // not one column
    expect(rows.size).toBeGreaterThan(1); // and not one row either
    const rects = rectsOf(plain);
    for (const [a, b] of names.flatMap((a, i) => names.slice(i + 1).map((b) => [a, b] as const))) {
      expect(overlaps(rects, a, b)).toBe(false);
    }

    // One authored Connection is a real ordering, and it is what pulls its two ends into travel order.
    const wired = autoArrange(rooms, [link("bar", "kitchen")], "inn");
    expect(positionOf(wired, "kitchen").x).toBeGreaterThan(positionOf(wired, "bar").x);
  });

  it("packs a larger plain group into a landscape block rather than a ribbon", () => {
    const names = Array.from({ length: 12 }, (_, i) => `room${i}`);
    const arranged = autoArrange(roomsIn("keep", names), [], "keep");
    const block = boundsOf(rectsOf(arranged), names);
    expect(block.width).toBeGreaterThan(block.height); // landscape...
    expect(block.width / block.height).toBeLessThan(3); // ...but nothing like a ribbon
    expect(new Set(names.map((id) => positionOf(arranged, id).x)).size).toBeGreaterThan(1);
    expect(new Set(names.map((id) => positionOf(arranged, id).y)).size).toBeGreaterThan(1);
  });

  it("keeps a linked cluster whole while the loose sub-locations pack beside it", () => {
    const names = ["one", "two", "three", "four", "five", "six"];
    const rooms = roomsIn("keep", names);
    const arranged = autoArrange(rooms, [link("two", "three")], "keep");
    const rects = rectsOf(arranged);
    // The pair stands in travel order...
    expect(rects.get("three")!.x).toBeGreaterThan(rects.get("two")!.x);
    // ...and nothing else was packed through the block the two of them occupy.
    const cluster = boundsOf(rects, ["two", "three"]);
    for (const id of ["one", "four", "five", "six"]) {
      const loose = rects.get(id)!;
      expect(loose.x < cluster.x + cluster.width && cluster.x < loose.x + loose.width
        && loose.y < cluster.y + cluster.height && cluster.y < loose.y + loose.height).toBe(false);
    }
  });

  it("gives a cluster the slot of its earliest member", () => {
    const names = ["one", "two", "three", "four"];
    const rooms = roomsIn("keep", names);
    // Linking the first and last child makes one cluster whose earliest member is the first child, so the
    // cluster takes the first slot and the unlinked middle two follow it.
    expect(packOrder(rectsOf(autoArrange(rooms, [link("one", "four")], "keep")), names))
      .toEqual(["one", "four", "two", "three"]);
    // Link the middle two instead and the lone first child keeps the first slot ahead of them.
    expect(packOrder(rectsOf(autoArrange(rooms, [link("two", "three")], "keep")), names))
      .toEqual(["one", "two", "three", "four"]);
  });

  it("ignores links that cross the arranged group's frame", () => {
    const names = ["one", "two", "three", "four"];
    const rooms = [...roomsIn("keep", names), { id: "outside", name: "Outside" }];
    const plain = autoArrange(rooms, [], "keep");
    // A link from the group to its own child, and one in from a location the group does not hold, say nothing
    // about the order of what is inside the box — so the box arranges exactly as it does with no links at all.
    const boundary = autoArrange(rooms, [link("keep", "two"), link("outside", "three")], "keep");
    for (const id of names) expect(positionOf(boundary, id)).toEqual(positionOf(plain, id));
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
    expect(overlaps(rects, "tavern", "house")).toBe(false);
    expect(overlaps(rects, "village", "landing")).toBe(false);

    // The House's own rooms were stacked on one spot here, so arranging it makes it wider than the frame that
    // holds it was measured for — laid out the other way about, the Tavern would land inside the House.
    const grown = rectsOf(autoArrangeAll(stacked, []));
    expect(grown.get("house")!.height).toBeGreaterThan(rectsOf(stacked).get("house")!.height);
    expect(overlaps(grown, "tavern", "house")).toBe(false);
  });

  it("arranges the same world into the same layout every time", () => {
    expect(autoArrangeAll(nested, [])).toEqual(autoArrangeAll(nested, []));
  });
});
