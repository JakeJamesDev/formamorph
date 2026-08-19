import { describe, it, expect } from "vitest";
import {
  CANVAS_NODE_HEIGHT, CANVAS_NODE_WIDTH, GROUP_HEADER, GROUP_PADDING,
  applyCanvasDrop, buildLocationCanvas, connectIntent, connectionEnds, deleteIntent, directionIntent,
  applyCanvasDrops, directionOf, dropIntent, dropTarget, hintIntent, isStationaryClick, isTravelClick,
  multiDropIntents, leafTarget,
  TOUCH_SLOP,
  newLocationPosition, withCanvasPosition,
  type CanvasIntent,
} from "./locationCanvas";
import { connectionsAt } from "./connectionEditing";
import { buildLocationTree, flattenLocationTree } from "./locationTree";
import type { Connection, GameLocation } from "@/types";

// village > { tavern > cellar, house } ; landing and shore are top-level.
const village: GameLocation = { id: "village", name: "Village", isStarting: true };
const tavern: GameLocation = { id: "tavern", name: "Tavern", parentId: "village" };
const cellar: GameLocation = { id: "cellar", name: "Cellar", parentId: "tavern" };
const house: GameLocation = { id: "house", name: "House", parentId: "village" };
const landing: GameLocation = { id: "landing", name: "Landing", isStarting: true };
const shore: GameLocation = { id: "shore", name: "Shore" };
const world = [village, tavern, cellar, house, landing, shore];

const canvas = (locations: GameLocation[], connections: Connection[] = []) =>
  buildLocationCanvas(locations, connections);
const nodeOf = (locations: GameLocation[], id: string, connections: Connection[] = []) =>
  canvas(locations, connections).nodes.find((n) => n.id === id)!;
const edgeIds = (locations: GameLocation[], connections: Connection[] = []) =>
  canvas(locations, connections).edges.map((e) => e.id).sort();

describe("buildLocationCanvas nodes", () => {
  it("draws a location holding sub-locations as a group and a childless one as a plain node", () => {
    expect(nodeOf(world, "village").type).toBe("locationGroup");
    expect(nodeOf(world, "tavern").type).toBe("locationGroup");
    expect(nodeOf(world, "cellar").type).toBe("location");
    expect(nodeOf(world, "landing").type).toBe("location");
  });

  it("nests a sub-location inside its parent's box", () => {
    expect(nodeOf(world, "tavern").parentId).toBe("village");
    expect(nodeOf(world, "cellar").parentId).toBe("tavern");
    expect(nodeOf(world, "landing").parentId).toBeUndefined();
  });

  it("lists every parent before the children that sit in it", () => {
    // xyflow resolves a child's position against a parent it has already seen, so order is load-bearing.
    const ids = canvas(world).nodes.map((n) => n.id);
    expect(ids.indexOf("village")).toBeLessThan(ids.indexOf("tavern"));
    expect(ids.indexOf("tavern")).toBeLessThan(ids.indexOf("cellar"));
  });

  it("keeps an authored position and lays unplaced locations out without overlapping", () => {
    const placed = { ...shore, canvasPosition: { x: 640, y: 90 } };
    expect(nodeOf([landing, placed], "shore").position).toEqual({ x: 640, y: 90 });
    const [first, second] = canvas([landing, shore]).nodes;
    expect(first.position).not.toEqual(second.position);
  });

  it("lays an unplaced location out past its neighbor's real size, not a fixed column", () => {
    // Village is a wide box (it holds Tavern, Cellar and House); Landing must clear it, not sit on it.
    const nodes = canvas(world).nodes;
    const box = (id: string) => nodes.find((n) => n.id === id)!;
    const overlaps = (a: string, b: string) => {
      const one = box(a);
      const other = box(b);
      return one.position.x < other.position.x + other.width && other.position.x < one.position.x + one.width
        && one.position.y < other.position.y + other.height && other.position.y < one.position.y + one.height;
    };
    expect(overlaps("village", "landing")).toBe(false);
    expect(overlaps("landing", "shore")).toBe(false);
    expect(overlaps("village", "shore")).toBe(false);
  });

  it("places an unplaced location without reading a single position the author wrote", () => {
    // The fallback is a fixed answer to "this location has no position", not a layout that reacts to the
    // arrangement around it — so nothing on the map shifts because a sibling was moved.
    const alone = nodeOf([landing, shore], "shore").position;
    for (const at of [{ x: 0, y: 0 }, { x: -900, y: 2000 }, { x: 40, y: 40 }]) {
      expect(nodeOf([{ ...landing, canvasPosition: at }, shore], "shore").position).toEqual(alone);
    }
  });

  it("draws the same world the same way every time it is opened, and writes nothing back", () => {
    const arranged: GameLocation[] = [
      { ...village, canvasPosition: { x: 300, y: 120 } }, tavern, cellar, house, landing, shore,
    ];
    const before = structuredClone(arranged);
    expect(canvas(arranged).nodes).toEqual(canvas(arranged).nodes);
    expect(arranged).toEqual(before); // opening the canvas is a read: nothing here becomes dirty
  });

  it("wraps a row of unplaced locations instead of running off to the right forever", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, name: `L${i}` }));
    const rows = new Set(canvas(many).nodes.map((n) => n.position.y));
    expect(rows.size).toBeGreaterThan(1);
  });

  it("sizes a group around its children rather than to a fixed box", () => {
    const roomy = { ...cellar, canvasPosition: { x: 400, y: 300 } };
    const grown = nodeOf([village, tavern, roomy, house], "tavern");
    expect(grown.width).toBe(400 + CANVAS_NODE_WIDTH + GROUP_PADDING);
    expect(grown.height).toBe(300 + CANVAS_NODE_HEIGHT + GROUP_PADDING);
    // An empty-looking group still clears its own header and one node.
    const snug = nodeOf([village, { ...tavern, canvasPosition: { x: 0, y: 0 } }, { ...cellar, canvasPosition: { x: 0, y: 0 } }, house], "tavern");
    expect(snug.height).toBeGreaterThanOrEqual(GROUP_HEADER + CANVAS_NODE_HEIGHT);
  });

  it("badges only what no starting location can reach", () => {
    const stranded = nodeOf(world, "shore");
    expect(stranded.data.unreachable).toBe(true);
    expect(nodeOf(world, "landing").data.unreachable).toBe(false);
    expect(nodeOf(world, "cellar").data.unreachable).toBe(false);
    // A one-way link in is enough to clear the badge.
    const oneWay: Connection = { id: "c1", from: "landing", to: "shore", twoWay: false };
    expect(nodeOf(world, "shore", [oneWay]).data.unreachable).toBe(false);
  });

  it("carries the name and starting flag onto the node", () => {
    expect(nodeOf(world, "village").data).toMatchObject({ label: "Village", isStarting: true });
    expect(nodeOf(world, "cellar").data.isStarting).toBe(false);
  });

  it("renders names through a caller's resolver, so chips read as their value", () => {
    const nodes = buildLocationCanvas([{ id: "a", name: "«placement»" }], [], {
      resolveName: (loc) => (loc.id === "a" ? "Sedge Landing" : loc.name),
    }).nodes;
    expect(nodes[0].data.label).toBe("Sedge Landing");
  });
});

describe("buildLocationCanvas edges", () => {
  it("draws no line for containment — the box is the relationship", () => {
    // Village↔Tavern and Tavern↔Cellar are implicit pairs, but neither gets ink.
    expect(edgeIds([village, tavern, cellar])).toEqual([]);
  });

  it("draws implicit sibling travel as one dashed arrow per direction", () => {
    const edges = canvas([village, tavern, house]).edges;
    expect(edges.map((e) => e.id).sort()).toEqual(["implicit:house>tavern", "implicit:tavern>house"]);
    expect(edges.every((e) => e.kind === "implicit")).toBe(true);
    expect(edges.map((e) => [e.source, e.target]).sort()).toEqual([["house", "tavern"], ["tavern", "house"]]);
  });

  it("draws nothing implicit for a pair an authored Connection has replaced", () => {
    const oneWay: Connection = { id: "c2", from: "tavern", to: "house", twoWay: false };
    // Only the Connection's own arrow survives — no dashed remnant of the free walk back.
    expect(edgeIds([village, tavern, house], [oneWay])).toEqual(["connection:c2:forward"]);
  });

  it("draws one solid arrow per travelable direction of a Connection", () => {
    const oneWay: Connection = { id: "c3", from: "shore", to: "landing", twoWay: false };
    expect(edgeIds([landing, shore], [oneWay])).toEqual(["connection:c3:forward"]);
    expect(edgeIds([landing, shore], [{ ...oneWay, twoWay: true }]))
      .toEqual(["connection:c3:back", "connection:c3:forward"]);
    const [back, forward] = canvas([landing, shore], [{ ...oneWay, twoWay: true }]).edges
      .sort((a, b) => a.id.localeCompare(b.id));
    expect([forward.source, forward.target]).toEqual(["shore", "landing"]);
    expect([back.source, back.target]).toEqual(["landing", "shore"]);
  });

  it("labels a Connection with its travel hint once, on the direction it was authored in", () => {
    const hinted: Connection = { id: "c4", from: "shore", to: "landing", twoWay: true, aiHint: "along the jetty" };
    const edges = canvas([landing, shore], [hinted]);
    expect(edges.edges.find((e) => e.id === "connection:c4:forward")?.label).toBe("along the jetty");
    expect(edges.edges.find((e) => e.id === "connection:c4:back")?.label).toBeUndefined();
    const plain: Connection = { ...hinted, aiHint: undefined };
    expect(canvas([landing, shore], [plain]).edges.every((e) => e.label === undefined)).toBe(true);
  });

  it("names the Connection each solid arrow came from, so a click can reach the record", () => {
    const conn: Connection = { id: "c5", from: "shore", to: "landing", twoWay: true };
    expect(canvas([landing, shore], [conn]).edges.every((e) => e.connectionId === "c5")).toBe(true);
    expect(canvas([village, tavern, house]).edges.every((e) => e.connectionId === undefined)).toBe(true);
  });

  it("drops an arrow whose far end no longer exists", () => {
    const dangling: Connection = { id: "c6", from: "shore", to: "gone", twoWay: true };
    expect(edgeIds([landing, shore], [dangling])).toEqual([]);
  });
});

describe("withCanvasPosition", () => {
  it("stores a dragged node's position on its location", () => {
    const next = withCanvasPosition(world, "shore", { x: 120, y: 40 });
    expect(next.find((l) => l.id === "shore")?.canvasPosition).toEqual({ x: 120, y: 40 });
    expect(next.find((l) => l.id === "village")).toBe(village); // untouched locations keep their identity
  });

  it("rounds to whole pixels, so a drag cannot pack the world file with decimals", () => {
    const next = withCanvasPosition(world, "shore", { x: 120.4187, y: 40.9 });
    expect(next.find((l) => l.id === "shore")?.canvasPosition).toEqual({ x: 120, y: 41 });
  });

  it("rests a sub-location against its parent's frame and title strip, never over them", () => {
    // Dragged up and left, the Cellar would otherwise come to rest outside the Tavern box it lives in.
    const next = withCanvasPosition(world, "cellar", { x: -80, y: 4 });
    expect(next.find((l) => l.id === "cellar")?.canvasPosition).toEqual({ x: GROUP_PADDING, y: GROUP_HEADER });
    // Down and to the right it moves freely — the box grows to hold it.
    const far = withCanvasPosition(world, "cellar", { x: 900, y: 700 });
    expect(far.find((l) => l.id === "cellar")?.canvasPosition).toEqual({ x: 900, y: 700 });
    // A top-level location has no frame to stay inside, so nothing is clamped.
    const loose = withCanvasPosition(world, "shore", { x: -80, y: -40 });
    expect(loose.find((l) => l.id === "shore")?.canvasPosition).toEqual({ x: -80, y: -40 });
  });

  describe("group growth", () => {
    // Village holds the Tavern and the Inn, every position authored, so growth is measured against fixed
    // geometry rather than against wherever a fallback happened to put something.
    const yard: GameLocation[] = [
      { id: "village", name: "Village", canvasPosition: { x: 100, y: 50 } },
      { id: "tavern", name: "Tavern", parentId: "village", canvasPosition: { x: 200, y: 100 } },
      { id: "inn", name: "Inn", parentId: "village", canvasPosition: { x: 400, y: 100 } },
    ];
    /** Where a node lands on the canvas itself, which is the only thing an author sees move. */
    const absolute = (locations: GameLocation[], id: string) => {
      const nodes = buildLocationCanvas(locations, []).nodes;
      const at = { x: 0, y: 0 };
      let node = nodes.find((n) => n.id === id);
      while (node) {
        at.x += node.position.x;
        at.y += node.position.y;
        node = nodes.find((n) => n.id === node?.parentId);
      }
      return at;
    };

    it("grows the group left and up instead of pushing the child back inside", () => {
      // 50px left of the frame and 64px above the title strip.
      const grown = withCanvasPosition(yard, "tavern", { x: -30, y: -28 });
      expect(grown.find((l) => l.id === "tavern")?.canvasPosition).toEqual({ x: GROUP_PADDING, y: GROUP_HEADER });
      const box = buildLocationCanvas(grown, []).nodes.find((n) => n.id === "village")!;
      expect(box.position).toEqual({ x: 50, y: -14 }); // the frame's own origin moved out by the overshoot
      expect(box.width).toBeGreaterThan(buildLocationCanvas(yard, []).nodes.find((n) => n.id === "village")!.width);
    });

    it("leaves every sibling exactly where it was drawn", () => {
      const grown = withCanvasPosition(yard, "tavern", { x: -30, y: -28 });
      expect(absolute(grown, "inn")).toEqual(absolute(yard, "inn"));
      // And the dragged node lands where the author let go of it, not where it started.
      expect(absolute(grown, "tavern")).toEqual({ x: 70, y: 22 });
    });

    it("carries the growth up through every group above it", () => {
      const deep: GameLocation[] = [
        { id: "region", name: "Region", canvasPosition: { x: 0, y: 0 } },
        { id: "village", name: "Village", parentId: "region", canvasPosition: { x: GROUP_PADDING, y: GROUP_HEADER } },
        { id: "tavern", name: "Tavern", parentId: "village", canvasPosition: { x: 200, y: 100 } },
        { id: "hall", name: "Hall", parentId: "region", canvasPosition: { x: 400, y: 200 } },
      ];
      const grown = withCanvasPosition(deep, "tavern", { x: -30, y: -28 });
      // The Village would now sit outside the Region's frame, so the Region grows in turn.
      expect(grown.find((l) => l.id === "village")?.canvasPosition).toEqual({ x: GROUP_PADDING, y: GROUP_HEADER });
      expect(absolute(grown, "hall")).toEqual(absolute(deep, "hall"));
      expect(absolute(grown, "tavern")).toEqual({ x: -10, y: 8 });
    });

    it("moves nothing but the dragged node when the drag stays inside the frame", () => {
      const moved = withCanvasPosition(yard, "tavern", { x: 300, y: 100 });
      expect(moved.find((l) => l.id === "inn")).toBe(yard[2]); // untouched, identity and all
      expect(absolute(moved, "inn")).toEqual(absolute(yard, "inn"));
    });
  });

  it("grows the parent box around a sub-location dragged past its edge", () => {
    const moved = withCanvasPosition(world, "cellar", { x: 600, y: 400 });
    const tavernBox = buildLocationCanvas(moved, []).nodes.find((n) => n.id === "tavern")!;
    expect(tavernBox.width).toBeGreaterThanOrEqual(600 + CANVAS_NODE_WIDTH);
    expect(tavernBox.height).toBeGreaterThanOrEqual(400 + CANVAS_NODE_HEIGHT);
  });

  it("returns the same array when the location is unknown", () => {
    expect(withCanvasPosition(world, "nowhere", { x: 1, y: 2 })).toBe(world);
  });
});

describe("newLocationPosition", () => {
  const yard: GameLocation[] = [
    { id: "village", name: "Village", canvasPosition: { x: 0, y: 0 } },
    { id: "tavern", name: "Tavern", parentId: "village", canvasPosition: { x: GROUP_PADDING, y: GROUP_HEADER } },
  ];

  it("starts a world's first location at the canvas origin", () => {
    expect(newLocationPosition([])).toEqual({ x: 0, y: 0 });
  });

  it("puts a new location below everything the canvas already holds", () => {
    const village = buildLocationCanvas(yard, []).nodes.find((n) => n.id === "village")!;
    expect(newLocationPosition(yard)).toEqual({ x: 0, y: village.height + 40 });
  });

  it("puts a new sub-location inside its group's frame, below its siblings", () => {
    const at = newLocationPosition(yard, "village");
    expect(at.x).toBe(GROUP_PADDING);
    expect(at.y).toBeGreaterThan(GROUP_HEADER + CANVAS_NODE_HEIGHT);
    // An unknown parent is nobody's box, so the location is placed at the top level instead of vanishing.
    expect(newLocationPosition(yard, "nowhere")).toEqual(newLocationPosition(yard));
  });

  it("disturbs nothing that is already on the map, and never lands on it", () => {
    const before = buildLocationCanvas(yard, []).nodes;
    const added: GameLocation[] = [...yard, { id: "shore", name: "Shore", canvasPosition: newLocationPosition(yard) }];
    const after = buildLocationCanvas(added, []).nodes;
    for (const node of before) {
      expect(after.find((n) => n.id === node.id)?.position).toEqual(node.position);
    }
    const fresh = after.find((n) => n.id === "shore")!;
    const village = after.find((n) => n.id === "village")!;
    expect(fresh.position.y).toBeGreaterThanOrEqual(village.position.y + village.height);
  });
});

describe("dropIntent", () => {
  // Every position authored, so a drop is judged against fixed geometry rather than against the layout.
  // Village sits at (100, 50) holding Tavern, and measures 220 x 108 around it; Shore stands apart.
  const placed: GameLocation[] = [
    { id: "village", name: "Village", isStarting: true, canvasPosition: { x: 100, y: 50 } },
    { id: "tavern", name: "Tavern", parentId: "village", canvasPosition: { x: GROUP_PADDING, y: GROUP_HEADER } },
    { id: "shore", name: "Shore", canvasPosition: { x: 400, y: 0 } },
  ];

  it("reads a drop inside a group box as that box coming to hold the location", () => {
    // Shore's center comes to rest at (240, 136) — inside Village's box, which spans (100, 50)–(320, 158).
    const drop = dropIntent(placed, "shore", { x: 150, y: 110 });
    // The resting place is re-read against its new box, not left in canvas coordinates.
    expect(drop).toEqual({ kind: "reparent", id: "shore", parentId: "village", position: { x: 50, y: 60 } });
    const after = applyCanvasDrop(placed, drop!);
    expect(after.find((l) => l.id === "shore")).toMatchObject({
      parentId: "village", canvasPosition: { x: 50, y: 60 },
    });
  });

  it("reads a drop clear of every box as the location returning to the top level", () => {
    const drop = dropIntent(placed, "tavern", { x: 500, y: 300 });
    expect(drop).toEqual({ kind: "reparent", id: "tavern", parentId: null, position: { x: 600, y: 350 } });
    const after = applyCanvasDrop(placed, drop!);
    expect(after.find((l) => l.id === "tavern")?.parentId).toBeNull();
    expect(after.find((l) => l.id === "tavern")?.canvasPosition).toEqual({ x: 600, y: 350 });
  });

  it("moves rather than reparents when the drop lands in the box it started in", () => {
    // Inside its own parent: Tavern's center lands at (250, 136), still within Village.
    // A move names the box it stays in, so a drag can tell "lands here" from "changes what holds it".
    const inside = dropIntent(placed, "tavern", { x: 60, y: 60 });
    expect(inside).toEqual({ kind: "move", id: "tavern", parentId: "village", position: { x: 60, y: 60 } });
    // And out on open canvas, where a top-level location stays top-level.
    expect(dropIntent(placed, "shore", { x: 420, y: 20 }))
      .toEqual({ kind: "move", id: "shore", parentId: null, position: { x: 420, y: 20 } });
    expect(applyCanvasDrop(placed, inside!).find((l) => l.id === "tavern")?.parentId).toBe("village");
  });

  it("holds a moved sub-location clear of its parent's frame, as a plain move does", () => {
    const drop = dropIntent(placed, "tavern", { x: 4, y: 4 });
    expect(drop?.kind).toBe("move");
    expect(applyCanvasDrop(placed, drop!).find((l) => l.id === "tavern")?.canvasPosition)
      .toEqual({ x: GROUP_PADDING, y: GROUP_HEADER });
  });

  // village > tavern > cellar, all authored flush against their parent's frame.
  const nested: GameLocation[] = [
    { id: "village", name: "Village", isStarting: true, canvasPosition: { x: 0, y: 0 } },
    { id: "tavern", name: "Tavern", parentId: "village", canvasPosition: { x: GROUP_PADDING, y: GROUP_HEADER } },
    { id: "cellar", name: "Cellar", parentId: "tavern", canvasPosition: { x: GROUP_PADDING, y: GROUP_HEADER } },
    { id: "shore", name: "Shore", canvasPosition: { x: 400, y: 0 } },
  ];

  it("gives the location to the innermost box it landed in, not the outermost", () => {
    // (130, 86) sits inside Village (0, 0)–(260, 164) and inside Tavern (20, 36)–(240, 144).
    expect(dropIntent(nested, "shore", { x: 40, y: 60 })).toMatchObject({ parentId: "tavern" });
  });

  it("never hands a location to itself or to what it already holds", () => {
    // Village's own center sits inside Tavern's box, which is nested in Village.
    expect(dropIntent(nested, "village", { x: 0, y: 0 })).toEqual({
      kind: "move", id: "village", parentId: null, position: { x: 0, y: 0 },
    });
  });

  it("ignores a childless location, so two nodes brushing past each other never nest", () => {
    const flat: GameLocation[] = [
      { id: "landing", name: "Landing", canvasPosition: { x: 0, y: 0 } },
      { id: "shore", name: "Shore", canvasPosition: { x: 400, y: 0 } },
    ];
    expect(dropIntent(flat, "shore", { x: 10, y: 0 })).toMatchObject({ kind: "move" });
  });

  it("asks for nothing on behalf of a location that is not there", () => {
    expect(dropIntent(placed, "nowhere", { x: 0, y: 0 })).toBeNull();
  });

  it("recomputes free travel and the unreachable badge from the new nesting", () => {
    const stranded = [...nested.slice(0, 3), { ...nested[3], isStarting: false }];
    const before = buildLocationCanvas(stranded, []);
    expect(before.nodes.find((n) => n.id === "shore")!.data.unreachable).toBe(true);
    expect(before.edges.filter((e) => e.id.includes("shore"))).toEqual([]);

    const after = applyCanvasDrop(stranded, dropIntent(stranded, "shore", { x: 40, y: 60 })!);
    const map = buildLocationCanvas(after, []);
    // Held by the Tavern, Shore is now a sibling of the Cellar: free travel both ways, and reachable.
    expect(map.nodes.find((n) => n.id === "shore")!.data.unreachable).toBe(false);
    expect(map.edges.filter((e) => e.kind === "implicit").map((e) => e.id).sort())
      .toEqual(["implicit:cellar>shore", "implicit:shore>cellar"]);
  });

  it("leaves authored Connections untouched — they are id-based, not containment-based", () => {
    // Shore is dropped into the Tavern, which puts it inside the Village it is linked to: containment would
    // otherwise be its own travel rule for the pair, and the one-way link would quietly become a walk back.
    const conns: Connection[] = [{ id: "c12", from: "shore", to: "village", twoWay: false, aiHint: "up the path" }];
    const before = buildLocationCanvas(nested, conns).edges.filter((e) => e.connectionId === "c12");
    const after = applyCanvasDrop(nested, dropIntent(nested, "shore", { x: 40, y: 60 })!);
    expect(buildLocationCanvas(after, conns).edges.filter((e) => e.connectionId === "c12")).toEqual(before);
    expect(before.map((e) => e.id)).toEqual(["connection:c12:forward"]);
  });

  it("holds a location dropped on a group's title strip clear of the frame it now sits in", () => {
    // Aimed at the Tavern's top-left corner, where the title strip is: it lands under the strip, not over it.
    const drop = dropIntent(nested, "shore", { x: 25, y: 40 });
    expect(drop).toMatchObject({ kind: "reparent", parentId: "tavern", position: { x: 5, y: 4 } });
    expect(applyCanvasDrop(nested, drop!).find((l) => l.id === "shore")?.canvasPosition)
      .toEqual({ x: GROUP_PADDING, y: GROUP_HEADER });
  });

  it("names the box a drag is over, so the highlight is the drop's own answer", () => {
    // Every case the drop obeys, asked of the highlight: the innermost box wins...
    expect(dropTarget(nested, "shore", { x: 40, y: 60 })).toBe("tavern");
    // ...a leaf is never a target, and neither is open canvas...
    expect(dropTarget(nested, "shore", { x: 900, y: 700 })).toBeNull();
    expect(dropTarget([
      { id: "landing", name: "Landing", canvasPosition: { x: 0, y: 0 } },
      { id: "shore", name: "Shore", canvasPosition: { x: 400, y: 0 } },
    ], "shore", { x: 10, y: 0 })).toBeNull();
    // ...and a location can never be handed to a box nested inside itself.
    expect(dropTarget(nested, "village", { x: 0, y: 0 })).toBeNull();
    // The box a location already sits in still lights up: the drag says where it lands, not what changes.
    expect(dropTarget(nested, "cellar", { x: GROUP_PADDING, y: GROUP_HEADER })).toBe("tavern");
  });

  it("lights up exactly the box the drop then commits to", () => {
    // One code path, proven by the answers matching over the whole grid the drag crosses.
    for (let x = -40; x <= 460; x += 20) {
      for (let y = -40; y <= 220; y += 20) {
        const highlighted = dropTarget(nested, "shore", { x, y });
        const drop = dropIntent(nested, "shore", { x, y })!;
        const committed = drop.kind === "reparent" ? drop.parentId : null; // Shore starts at the top level
        expect(committed).toBe(highlighted);
      }
    }
  });

  it("judges a whole selection's drops against the map the drag began on", () => {
    // The Village is as wide as the Attic standing at its right edge. Both children are dragged in one
    // gesture: the Attic out to open canvas, the Cellar to a spot near that right edge. Judged one after the
    // other, the Attic leaving would shrink the Village out from under the Cellar and read it as leaving too.
    const both: GameLocation[] = [
      { id: "village", name: "Village", isStarting: true, canvasPosition: { x: 0, y: 0 } },
      { id: "attic", name: "Attic", parentId: "village", canvasPosition: { x: 400, y: GROUP_HEADER } },
      { id: "cellar", name: "Cellar", parentId: "village", canvasPosition: { x: GROUP_PADDING, y: GROUP_HEADER } },
    ];
    const drops = multiDropIntents(both, [
      { id: "attic", position: { x: 900, y: 700 } },
      { id: "cellar", position: { x: 400, y: GROUP_HEADER } },
    ]);
    expect(drops).toEqual([
      { kind: "reparent", id: "attic", parentId: null, position: { x: 900, y: 700 } },
      { kind: "move", id: "cellar", parentId: "village", position: { x: 400, y: GROUP_HEADER } },
    ]);
    const after = applyCanvasDrops(both, drops);
    expect(after.find((l) => l.id === "attic")).toMatchObject({ parentId: null, canvasPosition: { x: 900, y: 700 } });
    expect(after.find((l) => l.id === "cellar")).toMatchObject({ parentId: "village" });
  });

  it("moves a selection as a unit, each node judged where it personally landed", () => {
    // Both are dragged in one gesture; only the Shore's own resting place is over the Tavern.
    const drops = multiDropIntents(nested, [
      { id: "shore", position: { x: 40, y: 60 } },
      { id: "village", position: { x: 900, y: 700 } },
    ]);
    expect(drops.map((d) => (d.kind === "reparent" ? d.parentId : "move"))).toEqual(["tavern", "move"]);
  });

  it("leaves a location riding inside a selected group where its group put it", () => {
    // The Tavern and its Cellar are both in the selection. The Cellar's position is measured against the
    // Tavern, which carried it — reading it as a drop of its own would land it wherever the Tavern was.
    const drops = multiDropIntents(nested, [
      { id: "tavern", position: { x: 300, y: 200 } },
      { id: "cellar", position: { x: GROUP_PADDING, y: GROUP_HEADER } },
    ]);
    expect(drops.map((d) => d.id)).toEqual(["tavern"]);
    const after = applyCanvasDrops(nested, drops);
    expect(after.find((l) => l.id === "cellar")).toEqual(nested.find((l) => l.id === "cellar"));
  });

  it("nests the same way in the list view as on the canvas", () => {
    const after = applyCanvasDrop(nested, dropIntent(nested, "shore", { x: 40, y: 60 })!);
    const rows = flattenLocationTree(buildLocationTree(after));
    expect(rows.find((r) => r.id === "shore")).toMatchObject({ parentId: "tavern", depth: 2 });
    // And back out again: the row returns to the top of the list.
    const out = applyCanvasDrop(after, dropIntent(after, "shore", { x: 900, y: 700 })!);
    expect(flattenLocationTree(buildLocationTree(out)).find((r) => r.id === "shore"))
      .toMatchObject({ parentId: null, depth: 0 });
  });
});

describe("leaf nesting", () => {
  // Two locations standing apart at the top level, both drawn as plain boxes: Landing at (0, 0) and Shore
  // out at (400, 0), each 180 x 52. Dragging Shore to (10, 0) brings its center to (100, 26) — over Landing.
  const flat: GameLocation[] = [
    { id: "landing", name: "Landing", isStarting: true, canvasPosition: { x: 0, y: 0 } },
    { id: "shore", name: "Shore", canvasPosition: { x: 400, y: 0 } },
    { id: "reef", name: "Reef", canvasPosition: { x: 400, y: 200 } },
  ];

  it("names the leaf a drag is over, so the canvas knows what it may arm", () => {
    expect(leafTarget(flat, "shore", { x: 10, y: 0 })).toBe("landing");
    expect(leafTarget(flat, "shore", { x: 900, y: 700 })).toBeNull();
  });

  it("never offers the dragged location itself, or anything it holds", () => {
    // Village holds Tavern; dragging the Village over its own Tavern must not arm the Tavern.
    const held: GameLocation[] = [
      { id: "village", name: "Village", isStarting: true, canvasPosition: { x: 0, y: 0 } },
      { id: "tavern", name: "Tavern", parentId: "village", canvasPosition: { x: GROUP_PADDING, y: GROUP_HEADER } },
    ];
    expect(leafTarget(held, "village", { x: 0, y: 0 })).toBeNull();
    expect(leafTarget(flat, "shore", { x: 400, y: 0 })).toBeNull();
  });

  it("never offers a location riding along in the same drag", () => {
    expect(leafTarget(flat, "shore", { x: 10, y: 0 }, ["landing"])).toBeNull();
  });

  it("leaves an unarmed drag over a leaf a plain move", () => {
    expect(dropIntent(flat, "shore", { x: 10, y: 0 })).toEqual({
      kind: "move", id: "shore", parentId: null, position: { x: 10, y: 0 },
    });
  });

  it("nests into an armed leaf, at the point the drag was released", () => {
    const drop = dropIntent(flat, "shore", { x: 10, y: 0 }, "landing");
    expect(drop).toEqual({ kind: "reparent", id: "shore", parentId: "landing", position: { x: 10, y: 0 } });
    const after = applyCanvasDrop(flat, drop!);
    expect(after.find((l) => l.id === "shore")?.parentId).toBe("landing");
    // The leaf is a box around its new child now, and the child is held clear of the frame it sits in.
    expect(buildLocationCanvas(after, []).nodes.find((n) => n.id === "landing")!.type).toBe("locationGroup");
  });

  it("re-reads the release point against the box that is about to hold it", () => {
    // Landing stands at (100, 50); Shore released at (60, 40) has its center at (150, 66), inside Landing.
    // The stored position is measured from Landing's own corner, so it is behind and above it, not (60, 40).
    const apart: GameLocation[] = [
      { id: "landing", name: "Landing", isStarting: true, canvasPosition: { x: 100, y: 50 } },
      { id: "shore", name: "Shore", canvasPosition: { x: 400, y: 0 } },
    ];
    expect(leafTarget(apart, "shore", { x: 60, y: 40 })).toBe("landing");
    expect(dropIntent(apart, "shore", { x: 60, y: 40 }, "landing")).toEqual({
      kind: "reparent", id: "shore", parentId: "landing", position: { x: -40, y: -10 },
    });
  });

  it("ignores an armed target the drop could never legally make", () => {
    expect(dropIntent(flat, "shore", { x: 10, y: 0 }, "shore")).toMatchObject({ kind: "move" });
    expect(dropIntent(flat, "shore", { x: 10, y: 0 }, "nowhere")).toMatchObject({ kind: "move" });
    const held: GameLocation[] = [
      { id: "village", name: "Village", isStarting: true, canvasPosition: { x: 0, y: 0 } },
      { id: "tavern", name: "Tavern", parentId: "village", canvasPosition: { x: GROUP_PADDING, y: GROUP_HEADER } },
    ];
    expect(dropIntent(held, "village", { x: 0, y: 0 }, "tavern")).toMatchObject({ kind: "move" });
  });

  it("hands a leaf that has since become a group back to plain containment", () => {
    // Armed frames ago, the Village has taken a child in the meantime: it is a box now, and a box takes the
    // drop only when the drag is actually inside it — which, out at (900, 700), this one is not.
    const grown: GameLocation[] = [
      { id: "village", name: "Village", isStarting: true, canvasPosition: { x: 0, y: 0 } },
      { id: "tavern", name: "Tavern", parentId: "village", canvasPosition: { x: GROUP_PADDING, y: GROUP_HEADER } },
      { id: "shore", name: "Shore", canvasPosition: { x: 400, y: 0 } },
    ];
    expect(dropIntent(grown, "shore", { x: 900, y: 700 }, "village")).toEqual({
      kind: "move", id: "shore", parentId: null, position: { x: 900, y: 700 },
    });
  });

  it("nests a whole selection into one armed leaf", () => {
    const drops = multiDropIntents(flat, [
      { id: "shore", position: { x: 10, y: 0 } },
      { id: "reef", position: { x: 30, y: 20 } },
    ], "landing");
    expect(drops).toEqual([
      { kind: "reparent", id: "shore", parentId: "landing", position: { x: 10, y: 0 } },
      { kind: "reparent", id: "reef", parentId: "landing", position: { x: 30, y: 20 } },
    ]);
    const after = applyCanvasDrops(flat, drops);
    expect(after.filter((l) => l.parentId === "landing").map((l) => l.id)).toEqual(["shore", "reef"]);
  });

  it("ignores an armed leaf that is itself part of the drag", () => {
    const drops = multiDropIntents(flat, [
      { id: "shore", position: { x: 10, y: 0 } },
      { id: "landing", position: { x: 0, y: 0 } },
    ], "landing");
    expect(drops.every((d) => d.kind === "move")).toBe(true);
  });

  it("leaves authored Connections between the nested pair untouched", () => {
    const conns: Connection[] = [{ id: "c1", from: "shore", to: "landing", twoWay: false, aiHint: "along the sand" }];
    const before = buildLocationCanvas(flat, conns).edges.filter((e) => e.connectionId === "c1");
    const after = applyCanvasDrop(flat, dropIntent(flat, "shore", { x: 10, y: 0 }, "landing")!);
    expect(after.find((l) => l.id === "shore")?.parentId).toBe("landing");
    // The one-way link is still one arrow after the nest, hint and all: the pair is now parent and child,
    // whose free travel would otherwise be its own rule for them and quietly hand back the walk home.
    const drawn = buildLocationCanvas(after, conns).edges.filter((e) => e.connectionId === "c1");
    expect(drawn).toEqual(before);
    expect(drawn.map((e) => e.id)).toEqual(["connection:c1:forward"]);
    expect(connectionsAt("shore", conns).map((v) => v.connection)).toEqual(conns);
  });
});

describe("isStationaryClick", () => {
  // The right button pans and opens the menu, and the platform asks for the menu on the release of both.
  it("tells a right-click apart from the pan that ends under the same button", () => {
    expect(isStationaryClick({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(true);
    expect(isStationaryClick({ x: 100, y: 100 }, { x: 102, y: 101 })).toBe(true); // a hand is never still
    expect(isStationaryClick({ x: 100, y: 100 }, { x: 140, y: 100 })).toBe(false);
    expect(isStationaryClick({ x: 100, y: 100 }, { x: 100, y: 60 })).toBe(false);
  });

  it("gives a finger more room to wobble than a mouse on a desk", () => {
    // The same 8px of travel: a mouse went somewhere, a finger resting on a location did not.
    expect(isStationaryClick({ x: 100, y: 100 }, { x: 108, y: 100 })).toBe(false);
    expect(isStationaryClick({ x: 100, y: 100 }, { x: 108, y: 100 }, TOUCH_SLOP)).toBe(true);
    // A finger that traveled is still a drag, whatever it is being asked to hold still for.
    expect(isStationaryClick({ x: 100, y: 100 }, { x: 140, y: 100 }, TOUCH_SLOP)).toBe(false);
  });

  it("reads a menu asked for without any press at all as a click", () => {
    // The keyboard's menu key, and anything else that raises the request on its own.
    expect(isStationaryClick(null, { x: 100, y: 100 })).toBe(true);
  });
});

describe("isTravelClick", () => {
  it("travels on a click that stayed put, refuses the one ending a pan", () => {
    expect(isTravelClick({ at: { x: 100, y: 100 } }, { x: 102, y: 101, detail: 1 })).toBe(true);
    expect(isTravelClick({ at: { x: 100, y: 100 } }, { x: 160, y: 100, detail: 1 })).toBe(false);
  });

  it("gives a finger the touch slop the press recorded", () => {
    // The same 8px of travel: refused as a mouse click, accepted as a tap.
    expect(isTravelClick({ at: { x: 100, y: 100 } }, { x: 108, y: 100, detail: 1 })).toBe(false);
    expect(isTravelClick({ at: { x: 100, y: 100 }, slop: TOUCH_SLOP }, { x: 108, y: 100, detail: 1 })).toBe(true);
  });

  it("always travels on a keyboard activation, whatever press came before it", () => {
    // Enter on a focused box raises a click with detail 0 at coordinates unrelated to any prior press.
    expect(isTravelClick({ at: { x: 100, y: 100 } }, { x: 0, y: 0, detail: 0 })).toBe(true);
  });

  it("travels when no press was recorded at all", () => {
    expect(isTravelClick(null, { x: 50, y: 50, detail: 1 })).toBe(true);
  });
});

/** The world an intent asks for, so a gesture is judged by what the map becomes, not by its own shape. */
const applied = (connections: Connection[], intent: CanvasIntent | null): Connection[] => {
  if (!intent) return connections;
  if (intent.kind === "add") return [...connections, intent.connection];
  if (intent.kind === "remove") return connections.filter((c) => c.id !== intent.connectionId);
  return connections.map((c) => (c.id === intent.connection.id ? intent.connection : c));
};

describe("connectIntent", () => {
  it("gives a dragged pair a two-way Connection", () => {
    const intent = connectIntent("landing", "shore", []);
    expect(intent).toMatchObject({ kind: "add", connection: { from: "landing", to: "shore", twoWay: true } });
    expect(edgeIds([landing, shore], applied([], intent)).length).toBe(2);
  });

  it("materializes a dashed implicit arrow into the pair's whole travel rule", () => {
    // Clicking Tavern↔House's dashed arrow is the same gesture as dragging between them.
    const before = canvas([village, tavern, house]).edges;
    expect(before.every((e) => e.kind === "implicit")).toBe(true);
    const after = canvas([village, tavern, house], applied([], connectIntent("tavern", "house", []))).edges;
    expect(after.map((e) => e.kind)).toEqual(["connection", "connection"]);
  });

  it("asks for nothing from a self-drag", () => {
    expect(connectIntent("shore", "shore", [])).toBeNull();
  });

  it("asks for nothing where a record already runs, whichever end the drag started from", () => {
    const existing: Connection = { id: "c7", from: "shore", to: "landing", twoWay: false };
    expect(connectIntent("shore", "landing", [existing])).toBeNull();
    expect(connectIntent("landing", "shore", [existing])).toBeNull();
  });
});

describe("directionIntent", () => {
  const conn: Connection = { id: "c8", from: "shore", to: "landing", twoWay: true, aiHint: "along the jetty" };
  // Ends read in a stable order, so a flip doesn't shuffle the control the author just clicked.
  const [a, b] = connectionEnds(conn);

  it("reads a record's current direction from its stable ends", () => {
    expect(directionOf(conn)).toBe("two-way");
    expect(directionOf({ ...conn, twoWay: false, from: a, to: b })).toBe("outgoing");
    expect(directionOf({ ...conn, twoWay: false, from: b, to: a })).toBe("incoming");
  });

  it("names the same two ends whichever way the record currently runs", () => {
    expect(connectionEnds({ ...conn, from: "landing", to: "shore" })).toEqual([a, b]);
  });

  it("narrows travel to one way, and flips which way, by rewriting the record's ends", () => {
    const oneWay = directionIntent(conn, "outgoing");
    expect(oneWay.kind).toBe("update");
    const forward = applied([conn], oneWay);
    expect(forward[0]).toMatchObject({ id: "c8", from: a, to: b, twoWay: false, aiHint: "along the jetty" });
    // One arrow, pointing the way travel now runs.
    const drawn = canvas([landing, shore], forward).edges;
    expect(drawn.map((e) => [e.source, e.target])).toEqual([[a, b]]);
    const flipped = applied(forward, directionIntent(forward[0], "incoming"));
    expect(canvas([landing, shore], flipped).edges.map((e) => [e.source, e.target])).toEqual([[b, a]]);
  });

  it("widens a one-way record back to two-way without moving its ends", () => {
    const oneWay: Connection = { ...conn, twoWay: false, from: b, to: a };
    const both = applied([oneWay], directionIntent(oneWay, "two-way"));
    expect(both[0]).toMatchObject({ from: b, to: a, twoWay: true });
    expect(canvas([landing, shore], both).edges.length).toBe(2);
  });

  it("shows the same edit from both ends in the list editor", () => {
    const oneWay = applied([conn], directionIntent(conn, "outgoing"));
    expect(connectionsAt(a, oneWay)[0].direction).toBe("outgoing");
    expect(connectionsAt(b, oneWay)[0].direction).toBe("incoming");
  });

  it("recomputes the unreachable badge as travel narrows", () => {
    // Shore is an island until Landing links it; a one-way link out again strands it.
    expect(nodeOf([landing, shore], "shore").data.unreachable).toBe(true);
    const linked = applied([], connectIntent("landing", "shore", []));
    expect(nodeOf([landing, shore], "shore", linked).data.unreachable).toBe(false);
    const leavingShore = connectionEnds(linked[0])[0] === "shore" ? "outgoing" : "incoming";
    const away = applied(linked, directionIntent(linked[0], leavingShore));
    expect(away[0]).toMatchObject({ from: "shore", to: "landing", twoWay: false });
    expect(nodeOf([landing, shore], "shore", away).data.unreachable).toBe(true);
  });
});

describe("hintIntent", () => {
  const conn: Connection = { id: "c9", from: "shore", to: "landing", twoWay: true };

  it("labels the arrow with what the author typed", () => {
    const hinted = applied([conn], hintIntent(conn, "along the jetty"));
    expect(canvas([landing, shore], hinted).edges.find((e) => e.label)?.label).toBe("along the jetty");
  });

  it("drops the field when the hint is cleared, so an empty hint has one shape", () => {
    const hinted = { ...conn, aiHint: "along the jetty" };
    const cleared = applied([hinted], hintIntent(hinted, ""));
    expect(cleared[0].aiHint).toBeUndefined();
    expect(canvas([landing, shore], cleared).edges.every((e) => e.label === undefined)).toBe(true);
    // Spaces are not a hint either, and a hint being typed keeps the space the author just pressed.
    expect(applied([hinted], hintIntent(hinted, "   "))[0].aiHint).toBeUndefined();
    expect(applied([conn], hintIntent(conn, "along the "))[0].aiHint).toBe("along the ");
  });
});

describe("deleteIntent", () => {
  it("removes the record both of a pair's arrows came from, and hands the pair back to implicit travel", () => {
    const conn: Connection = { id: "c10", from: "tavern", to: "house", twoWay: false };
    const gone = applied([conn], deleteIntent(conn));
    expect(gone).toEqual([]);
    expect(edgeIds([village, tavern, house], gone)).toEqual(["implicit:house>tavern", "implicit:tavern>house"]);
  });
});
