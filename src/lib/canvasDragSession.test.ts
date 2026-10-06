import { describe, it, expect } from "vitest";
import {
  beginCanvasDrag, dropIntent, dropTarget, leafTarget, multiDropIntents, type CanvasDrop, type DragWorld,
} from "./locationCanvas";
import type { GameLocation } from "@/types";

// region > { town > { inn, smithy }, field } ; shore and dock stand apart at the top level.
const nested: GameLocation[] = [
  { id: "region", name: "Region", isStarting: true, canvasPosition: { x: 0, y: 0 } },
  { id: "town", name: "Town", parentId: "region", canvasPosition: { x: 20, y: 36 } },
  { id: "inn", name: "Inn", parentId: "town", canvasPosition: { x: 20, y: 36 } },
  { id: "smithy", name: "Smithy", parentId: "town", canvasPosition: { x: 20, y: 120 } },
  { id: "field", name: "Field", parentId: "region", canvasPosition: { x: 400, y: 36 } },
  { id: "shore", name: "Shore", canvasPosition: { x: 900, y: 0 } },
  { id: "dock", name: "Dock", canvasPosition: { x: 900, y: 200 } },
];

const show = (drop: CanvasDrop | null) =>
  drop ? `${drop.kind}:${drop.parentId}@${drop.position.x},${drop.position.y}` : "none";

/** Every judging question for every location at a spread of resting places, one line each. */
function judgeAll(world: DragWorld): string[] {
  const sweep = [
    { x: 30, y: 50 }, { x: 40, y: 60 }, { x: 60, y: 130 }, { x: 410, y: 40 },
    { x: 905, y: 10 }, { x: 905, y: 205 }, { x: 2000, y: 2000 }, { x: 0, y: 0 },
  ];
  const lines: string[] = [];
  for (const { id } of nested) {
    for (const at of sweep) {
      lines.push(
        `${id}@${at.x},${at.y} box=${dropTarget(world, id, at)} leaf=${leafTarget(world, id, at)}`
        + ` carried=${leafTarget(world, id, at, ["inn"])} drop=${show(dropIntent(world, id, at))}`
        + ` armed=${show(dropIntent(world, id, at, "field"))}/${show(dropIntent(world, id, at, "dock"))}`,
      );
    }
  }
  const selections = [
    [{ id: "shore", position: { x: 40, y: 60 } }, { id: "dock", position: { x: 410, y: 40 } }],
    [
      { id: "town", position: { x: 905, y: 10 } }, { id: "inn", position: { x: 905, y: 10 } },
      { id: "field", position: { x: 905, y: 205 } },
    ],
    [{ id: "region", position: { x: 2000, y: 2000 } }, { id: "smithy", position: { x: 2000, y: 2000 } }],
  ];
  for (const moves of selections) {
    for (const armed of [undefined, "dock", "field"]) {
      lines.push(`multi ${moves.map((m) => m.id).join("+")} armed=${armed}: ${multiDropIntents(world, moves, armed).map(show).join(" ")}`);
    }
  }
  return lines;
}

// One line per judging question over `nested`: box, leaf, carried leaf, drop, armed drops, then the selections.
const EXPECTED = [
  "region@30,50 box=null leaf=null carried=null drop=move:null@30,50 armed=move:null@30,50/reparent:dock@-870,-150",
  "region@40,60 box=null leaf=null carried=null drop=move:null@40,60 armed=move:null@40,60/reparent:dock@-860,-140",
  "region@60,130 box=null leaf=null carried=null drop=move:null@60,130 armed=move:null@60,130/reparent:dock@-840,-70",
  "region@410,40 box=null leaf=null carried=null drop=move:null@410,40 armed=move:null@410,40/reparent:dock@-490,-160",
  "region@905,10 box=null leaf=null carried=null drop=move:null@905,10 armed=move:null@905,10/reparent:dock@5,-190",
  "region@905,205 box=null leaf=null carried=null drop=move:null@905,205 armed=move:null@905,205/reparent:dock@5,5",
  "region@2000,2000 box=null leaf=null carried=null drop=move:null@2000,2000 armed=move:null@2000,2000/reparent:dock@1100,1800",
  "region@0,0 box=null leaf=null carried=null drop=move:null@0,0 armed=move:null@0,0/reparent:dock@-900,-200",
  "town@30,50 box=region leaf=null carried=null drop=move:region@30,50 armed=reparent:field@-370,14/reparent:dock@-870,-150",
  "town@40,60 box=region leaf=null carried=null drop=move:region@40,60 armed=reparent:field@-360,24/reparent:dock@-860,-140",
  "town@60,130 box=region leaf=null carried=null drop=move:region@60,130 armed=reparent:field@-340,94/reparent:dock@-840,-70",
  "town@410,40 box=region leaf=null carried=null drop=move:region@410,40 armed=reparent:field@10,4/reparent:dock@-490,-160",
  "town@905,10 box=null leaf=null carried=null drop=reparent:null@905,10 armed=reparent:field@505,-26/reparent:dock@5,-190",
  "town@905,205 box=null leaf=null carried=null drop=reparent:null@905,205 armed=reparent:field@505,169/reparent:dock@5,5",
  "town@2000,2000 box=null leaf=null carried=null drop=reparent:null@2000,2000 armed=reparent:field@1600,1964/reparent:dock@1100,1800",
  "town@0,0 box=region leaf=null carried=null drop=move:region@0,0 armed=reparent:field@-400,-36/reparent:dock@-900,-200",
  "inn@30,50 box=town leaf=null carried=null drop=move:town@30,50 armed=reparent:field@-350,50/reparent:dock@-850,-114",
  "inn@40,60 box=town leaf=null carried=null drop=move:town@40,60 armed=reparent:field@-340,60/reparent:dock@-840,-104",
  "inn@60,130 box=town leaf=smithy carried=smithy drop=move:town@60,130 armed=reparent:field@-320,130/reparent:dock@-820,-34",
  "inn@410,40 box=region leaf=null carried=null drop=reparent:region@430,76 armed=reparent:field@30,40/reparent:dock@-470,-124",
  "inn@905,10 box=null leaf=null carried=null drop=reparent:null@925,46 armed=reparent:field@525,10/reparent:dock@25,-154",
  "inn@905,205 box=null leaf=null carried=null drop=reparent:null@925,241 armed=reparent:field@525,205/reparent:dock@25,41",
  "inn@2000,2000 box=null leaf=null carried=null drop=reparent:null@2020,2036 armed=reparent:field@1620,2000/reparent:dock@1120,1836",
  "inn@0,0 box=town leaf=null carried=null drop=move:town@0,0 armed=reparent:field@-380,0/reparent:dock@-880,-164",
  "smithy@30,50 box=town leaf=inn carried=null drop=move:town@30,50 armed=reparent:field@-350,50/reparent:dock@-850,-114",
  "smithy@40,60 box=town leaf=inn carried=null drop=move:town@40,60 armed=reparent:field@-340,60/reparent:dock@-840,-104",
  "smithy@60,130 box=town leaf=null carried=null drop=move:town@60,130 armed=reparent:field@-320,130/reparent:dock@-820,-34",
  "smithy@410,40 box=region leaf=null carried=null drop=reparent:region@430,76 armed=reparent:field@30,40/reparent:dock@-470,-124",
  "smithy@905,10 box=null leaf=null carried=null drop=reparent:null@925,46 armed=reparent:field@525,10/reparent:dock@25,-154",
  "smithy@905,205 box=null leaf=null carried=null drop=reparent:null@925,241 armed=reparent:field@525,205/reparent:dock@25,41",
  "smithy@2000,2000 box=null leaf=null carried=null drop=reparent:null@2020,2036 armed=reparent:field@1620,2000/reparent:dock@1120,1836",
  "smithy@0,0 box=town leaf=null carried=null drop=move:town@0,0 armed=reparent:field@-380,0/reparent:dock@-880,-164",
  "field@30,50 box=town leaf=inn carried=null drop=reparent:town@10,14 armed=reparent:town@10,14/reparent:dock@-870,-150",
  "field@40,60 box=town leaf=inn carried=null drop=reparent:town@20,24 armed=reparent:town@20,24/reparent:dock@-860,-140",
  "field@60,130 box=town leaf=smithy carried=smithy drop=reparent:town@40,94 armed=reparent:town@40,94/reparent:dock@-840,-70",
  "field@410,40 box=region leaf=null carried=null drop=move:region@410,40 armed=move:region@410,40/reparent:dock@-490,-160",
  "field@905,10 box=null leaf=shore carried=shore drop=reparent:null@905,10 armed=reparent:null@905,10/reparent:dock@5,-190",
  "field@905,205 box=null leaf=dock carried=dock drop=reparent:null@905,205 armed=reparent:null@905,205/reparent:dock@5,5",
  "field@2000,2000 box=null leaf=null carried=null drop=reparent:null@2000,2000 armed=reparent:null@2000,2000/reparent:dock@1100,1800",
  "field@0,0 box=region leaf=null carried=null drop=move:region@0,0 armed=move:region@0,0/reparent:dock@-900,-200",
  "shore@30,50 box=town leaf=inn carried=null drop=reparent:town@10,14 armed=reparent:field@-370,14/reparent:dock@-870,-150",
  "shore@40,60 box=town leaf=inn carried=null drop=reparent:town@20,24 armed=reparent:field@-360,24/reparent:dock@-860,-140",
  "shore@60,130 box=town leaf=smithy carried=smithy drop=reparent:town@40,94 armed=reparent:field@-340,94/reparent:dock@-840,-70",
  "shore@410,40 box=region leaf=field carried=field drop=reparent:region@410,40 armed=reparent:field@10,4/reparent:dock@-490,-160",
  "shore@905,10 box=null leaf=null carried=null drop=move:null@905,10 armed=reparent:field@505,-26/reparent:dock@5,-190",
  "shore@905,205 box=null leaf=dock carried=dock drop=move:null@905,205 armed=reparent:field@505,169/reparent:dock@5,5",
  "shore@2000,2000 box=null leaf=null carried=null drop=move:null@2000,2000 armed=reparent:field@1600,1964/reparent:dock@1100,1800",
  "shore@0,0 box=region leaf=null carried=null drop=reparent:region@0,0 armed=reparent:field@-400,-36/reparent:dock@-900,-200",
  "dock@30,50 box=town leaf=inn carried=null drop=reparent:town@10,14 armed=reparent:field@-370,14/reparent:town@10,14",
  "dock@40,60 box=town leaf=inn carried=null drop=reparent:town@20,24 armed=reparent:field@-360,24/reparent:town@20,24",
  "dock@60,130 box=town leaf=smithy carried=smithy drop=reparent:town@40,94 armed=reparent:field@-340,94/reparent:town@40,94",
  "dock@410,40 box=region leaf=field carried=field drop=reparent:region@410,40 armed=reparent:field@10,4/reparent:region@410,40",
  "dock@905,10 box=null leaf=shore carried=shore drop=move:null@905,10 armed=reparent:field@505,-26/move:null@905,10",
  "dock@905,205 box=null leaf=null carried=null drop=move:null@905,205 armed=reparent:field@505,169/move:null@905,205",
  "dock@2000,2000 box=null leaf=null carried=null drop=move:null@2000,2000 armed=reparent:field@1600,1964/move:null@2000,2000",
  "dock@0,0 box=region leaf=null carried=null drop=reparent:region@0,0 armed=reparent:field@-400,-36/reparent:region@0,0",
  "multi shore+dock armed=undefined: reparent:town@20,24 reparent:region@410,40",
  "multi shore+dock armed=dock: reparent:town@20,24 reparent:region@410,40",
  "multi shore+dock armed=field: reparent:field@-360,24 reparent:field@10,4",
  "multi town+inn+field armed=undefined: reparent:null@905,10 reparent:null@905,205",
  "multi town+inn+field armed=dock: reparent:dock@5,-190 reparent:dock@5,5",
  "multi town+inn+field armed=field: reparent:null@905,10 reparent:null@905,205",
  "multi region+smithy armed=undefined: move:null@2000,2000",
  "multi region+smithy armed=dock: reparent:dock@1100,1800",
  "multi region+smithy armed=field: move:null@2000,2000",
];

describe("drag judgment on a nested map", () => {
  it("pins drops, targets and leaves for single and multi-select drags", () => {
    expect(judgeAll(beginCanvasDrag(nested))).toEqual(EXPECTED);
  });

  it("gives the same answers from the bare world as from a session", () => {
    expect(judgeAll(nested)).toEqual(EXPECTED);
  });

  it("treats a location whose parent is missing as top-level", () => {
    const orphaned: GameLocation[] = [
      ...nested,
      { id: "lost", name: "Lost", parentId: "gone", canvasPosition: { x: 1400, y: 0 } },
    ];
    // Resting clear of every box: it never had a holder, so this is a plain move.
    expect(dropIntent(orphaned, "lost", { x: 2000, y: 2000 }))
      .toEqual({ kind: "move", id: "lost", parentId: null, position: { x: 2000, y: 2000 } });
    // Resting inside Town: a different holder, so it is handed over.
    expect(dropIntent(orphaned, "lost", { x: 40, y: 60 }))
      .toMatchObject({ kind: "reparent", id: "lost", parentId: "town" });
  });

  it("answers for a map whose parents form a cycle, and never offers a cycle member as a place to land", () => {
    const cyclic: GameLocation[] = [
      { id: "a", name: "A", parentId: "b", canvasPosition: { x: 0, y: 0 } },
      { id: "b", name: "B", parentId: "a", canvasPosition: { x: 0, y: 0 } },
      { id: "shore", name: "Shore", canvasPosition: { x: 900, y: 0 } },
    ];
    const session = beginCanvasDrag(cyclic);
    expect(dropIntent(session, "shore", { x: 2000, y: 2000 })).toMatchObject({ kind: "move", parentId: null });
    expect(dropTarget(session, "a", { x: 0, y: 0 })).toBeNull();
  });
});

/** A map of `n` locations: top-level groups of ten, nine children each, none positioned (the fallback layout). */
function groupedWorld(n: number): GameLocation[] {
  const world: GameLocation[] = [];
  for (let g = 0; g < n / 10; g++) {
    world.push({ id: `g${g}`, name: `Group ${g}` });
    for (let c = 0; c < 9; c++) world.push({ id: `g${g}c${c}`, name: `Child ${g}.${c}`, parentId: `g${g}` });
  }
  return world;
}

/** Milliseconds for a drag's worth of pointer moves, each asking what a frame of the canvas asks. */
function dragCostMs(n: number): number {
  const session = beginCanvasDrag(groupedWorld(n));
  const frame = (i: number) => {
    const at = { x: 20 + i * 7, y: 40 + i * 5 };
    leafTarget(session, "g0c0", at, ["g0c0"]);
    multiDropIntents(session, [{ id: "g0c0", position: at }]);
  };
  for (let i = 0; i < 3; i++) frame(i);
  let best = Infinity;
  for (let trial = 0; trial < 5; trial++) {
    const start = performance.now();
    for (let i = 0; i < 20; i++) frame(i);
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

describe("drag frame cost", () => {
  it("grows in step with the map, not with its square", () => {
    const small = dragCostMs(400);
    const large = dragCostMs(1600);
    // A map four times the size costs ~4x per frame; a per-location rebuild of the ancestry costs ~16x.
    expect(large / small).toBeLessThan(9);
  });
});
