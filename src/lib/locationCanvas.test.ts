import { describe, it, expect } from "vitest";
import {
  CANVAS_NODE_HEIGHT, CANVAS_NODE_WIDTH, GROUP_HEADER, GROUP_PADDING,
  buildLocationCanvas, withCanvasPosition,
} from "./locationCanvas";
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

  it("flows an unplaced location clear of the siblings the author placed by hand", () => {
    // A location added long after the map was arranged must not land on top of the arrangement.
    const placed = { ...landing, canvasPosition: { x: 0, y: 0 } };
    const fresh = nodeOf([placed, shore], "shore");
    expect(fresh.position.y).toBeGreaterThanOrEqual(CANVAS_NODE_HEIGHT);
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

  it("holds a sub-location clear of its parent's frame and title strip", () => {
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
