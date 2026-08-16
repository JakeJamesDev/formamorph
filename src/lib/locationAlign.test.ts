import { describe, it, expect } from "vitest";
import { alignLocations, distributeLocations, nudgeLocations } from "./locationAlign";
import { CANVAS_GRID, buildLocationCanvas } from "./locationCanvas";
import type { GameLocation } from "@/types";

/** Every node's box measured from the canvas origin — the coordinates a selection is lined up in. */
const rectsOf = (locations: GameLocation[]) => {
  const rects = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const node of buildLocationCanvas(locations, []).nodes) {
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
const centerOf = (locations: GameLocation[], id: string) => {
  const rect = rectsOf(locations).get(id)!;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};

// Three top-level locations, scattered: no two share an edge and no two are evenly spaced.
const scattered: GameLocation[] = [
  { id: "a", name: "A", canvasPosition: { x: 40, y: 60 } },
  { id: "b", name: "B", canvasPosition: { x: 300, y: 220 } },
  { id: "c", name: "C", canvasPosition: { x: 900, y: 500 } },
  { id: "d", name: "D", canvasPosition: { x: 120, y: 900 } },
];

// A group holding one child, beside a location standing on its own — a selection spanning two frames.
const acrossFrames: GameLocation[] = [
  { id: "harbor", name: "Harbor", canvasPosition: { x: 400, y: 100 } },
  { id: "dock", name: "Dock", parentId: "harbor", canvasPosition: { x: 60, y: 60 } },
  { id: "beach", name: "Beach", canvasPosition: { x: 1000, y: 700 } },
];

describe("alignLocations", () => {
  it("stacks the selection's left edges on the leftmost of them", () => {
    const aligned = alignLocations(scattered, ["a", "b", "c"], "left");
    const rects = rectsOf(aligned);
    expect(rects.get("b")!.x).toBe(40);
    expect(rects.get("c")!.x).toBe(40);
    // The one that was already leftmost is where the others came to, and its y is untouched.
    expect(rects.get("a")!.x).toBe(40);
    expect(rects.get("b")!.y).toBe(220);
    // And a location nobody picked stands exactly where it stood.
    expect(rects.get("d")!).toMatchObject({ x: 120, y: 900 });
  });

  it("stacks the selection's top edges on the topmost of them", () => {
    const rects = rectsOf(alignLocations(scattered, ["a", "b", "c"], "top"));
    expect(rects.get("b")!.y).toBe(60);
    expect(rects.get("c")!.y).toBe(60);
    expect(rects.get("b")!.x).toBe(300); // across, not along
  });

  it("lines a nested location up with one outside its frame", () => {
    const aligned = alignLocations(acrossFrames, ["dock", "beach"], "left");
    const rects = rectsOf(aligned);
    // Absolute edges, so the Dock's stored position is read against the Harbor's frame rather than the canvas.
    expect(rects.get("beach")!.x).toBe(rects.get("dock")!.x);
    expect(rects.get("dock")!.x).toBe(460); // where it already was: the Harbor's corner plus its own offset
    // And the frame still holds what it held — lining a child up is not a way out of its group.
    expect(aligned.find((l) => l.id === "dock")!.parentId).toBe("harbor");
  });

  it("leaves a selection with nothing to line up exactly as it was", () => {
    expect(alignLocations(scattered, ["a"], "left")).toBe(scattered);
    expect(alignLocations(scattered, [], "top")).toBe(scattered);
  });

  it("hands the same world back when the selection is already on that edge", () => {
    // Asked for twice, the second is a press that changes nothing — and a world nothing moved in is not a
    // step for the author to take back.
    const once = alignLocations(scattered, ["a", "b", "c"], "left");
    expect(alignLocations(once, ["a", "b", "c"], "left")).toBe(once);
  });

  it("counts a location and the frame holding it as one box, not two", () => {
    // The Harbor carries the Dock wherever it goes, so picking both is picking one thing to line up — and the
    // Dock is not dragged onto its own frame's edge to make a second.
    expect(alignLocations(acrossFrames, ["harbor", "dock"], "left")).toBe(acrossFrames);
  });
});

describe("distributeLocations", () => {
  it("spaces the selection's centers evenly between the two ends", () => {
    const spread = distributeLocations(scattered, ["a", "b", "c"], "horizontal");
    const [a, b, c] = ["a", "b", "c"].map((id) => centerOf(spread, id));
    // The ends stay put; only what sits between them moves.
    expect(a.x).toBe(centerOf(scattered, "a").x);
    expect(c.x).toBe(centerOf(scattered, "c").x);
    expect(b.x - a.x).toBeCloseTo(c.x - b.x, 0);
    // Across the axis nothing moved at all.
    expect(b.y).toBe(centerOf(scattered, "b").y);
  });

  it("spaces them vertically when asked for the other axis", () => {
    const spread = distributeLocations(scattered, ["a", "b", "c"], "vertical");
    const [a, b, c] = ["a", "b", "c"].map((id) => centerOf(spread, id));
    expect(b.y - a.y).toBeCloseTo(c.y - b.y, 0);
    expect(b.x).toBe(centerOf(scattered, "b").x);
  });

  it("reads the order off the canvas rather than off the selection", () => {
    // Picked back to front: what is distributed is the row as it is drawn, not as it was clicked.
    const spread = distributeLocations(scattered, ["c", "a", "b"], "horizontal");
    const [a, b, c] = ["a", "b", "c"].map((id) => centerOf(spread, id));
    expect(b.x - a.x).toBeCloseTo(c.x - b.x, 0);
  });

  it("leaves a pair alone: two locations are already evenly spaced", () => {
    expect(distributeLocations(scattered, ["a", "b"], "horizontal")).toBe(scattered);
    expect(distributeLocations(scattered, ["a"], "vertical")).toBe(scattered);
  });
});

describe("nudgeLocations", () => {
  it("moves every picked location by the same step", () => {
    const nudged = nudgeLocations(scattered, ["a", "b"], { x: CANVAS_GRID, y: 0 });
    const rects = rectsOf(nudged);
    expect(rects.get("a")!.x).toBe(40 + CANVAS_GRID);
    expect(rects.get("b")!.x).toBe(300 + CANVAS_GRID);
    expect(rects.get("b")!.y).toBe(220);
    expect(rects.get("d")!.x).toBe(120);
  });

  it("moves a location held by a picked group once, not twice", () => {
    // The group carries its child, so nudging both would step the child two cells for one press.
    const nudged = nudgeLocations(acrossFrames, ["harbor", "dock"], { x: 0, y: CANVAS_GRID });
    const before = rectsOf(acrossFrames);
    const after = rectsOf(nudged);
    expect(after.get("harbor")!.y - before.get("harbor")!.y).toBe(CANVAS_GRID);
    expect(after.get("dock")!.y - before.get("dock")!.y).toBe(CANVAS_GRID);
  });

  it("grows the frame around a child nudged past its edge instead of refusing the step", () => {
    const nudged = nudgeLocations(acrossFrames, ["dock"], { x: -CANVAS_GRID * 4, y: 0 });
    const before = rectsOf(acrossFrames);
    const after = rectsOf(nudged);
    expect(after.get("dock")!.x).toBe(before.get("dock")!.x - CANVAS_GRID * 4);
    // The frame followed it out rather than holding it back: its near edge is where the child now is.
    expect(after.get("harbor")!.x).toBeLessThan(before.get("harbor")!.x);
    expect(after.get("dock")!.x).toBeGreaterThanOrEqual(after.get("harbor")!.x);
  });

  it("leaves an empty selection exactly as it was", () => {
    expect(nudgeLocations(scattered, [], { x: CANVAS_GRID, y: 0 })).toBe(scattered);
  });
});
