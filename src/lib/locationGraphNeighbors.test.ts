import { describe, it, expect } from "vitest";
import {
  effectiveDestinations, implicitNeighbors, isImplicitPair, overriddenPairs, pairKey, parentIndex,
  reachableFromStarts,
} from "./locationGraph";
import { migrateWorld } from "./version";
import type { Connection, ConnectionLeg, GameLocation } from "@/types";

// The pair enumeration the neighbor lookup replaced, kept here as the reference the lookup must match.
function referencePairs(locations: GameLocation[]): [string, string][] {
  const byParent = new Map<string, GameLocation[]>();
  for (const loc of locations) {
    const parentId = loc.parentId ?? null;
    if (parentId === null) continue;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), loc]);
  }
  const pairs = new Map<string, [string, string]>();
  for (const [parentId, children] of byParent) {
    for (let i = 0; i < children.length; i++) {
      pairs.set(pairKey(children[i].id, parentId), [children[i].id, parentId]);
      for (let j = i + 1; j < children.length; j++) {
        pairs.set(pairKey(children[i].id, children[j].id), [children[i].id, children[j].id]);
      }
    }
  }
  return [...pairs.values()];
}

const referenceAuthored = (connections: Connection[]) => new Set(connections.map((c) => pairKey(c.a, c.b)));

const legsOf = (c: Connection): { from: string; to: string }[] => [
  ...(c.aToB ? [{ from: c.a, to: c.b }] : []),
  ...(c.bToA ? [{ from: c.b, to: c.a }] : []),
];

function referenceDestinations(
  id: string, locations: GameLocation[], connections: Connection[],
): Map<string, "implicit" | "connection"> {
  const authored = referenceAuthored(connections);
  const out = new Map<string, "implicit" | "connection">();
  for (const [a, b] of referencePairs(locations)) {
    if (authored.has(pairKey(a, b))) continue;
    if (a === id) out.set(b, "implicit");
    if (b === id) out.set(a, "implicit");
  }
  for (const c of connections) for (const { from, to } of legsOf(c)) if (from === id) out.set(to, "connection");
  out.delete(id);
  return out;
}

function referenceReachable(locations: GameLocation[], connections: Connection[]): Set<string> {
  const authored = referenceAuthored(connections);
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: string) => adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  for (const [a, b] of referencePairs(locations)) {
    if (authored.has(pairKey(a, b))) continue;
    link(a, b);
    link(b, a);
  }
  for (const c of connections) for (const { from, to } of legsOf(c)) link(from, to);
  const flagged = locations.filter((l) => l.isStarting);
  const seen = new Set((flagged.length ? flagged : locations).map((l) => l.id));
  const queue = [...seen];
  for (let i = 0; i < queue.length; i++) {
    for (const dest of adjacency.get(queue[i]) ?? []) {
      if (!seen.has(dest)) {
        seen.add(dest);
        queue.push(dest);
      }
    }
  }
  return seen;
}

const sorted = (ids: Iterable<string>) => [...ids].sort();

/** Asserts every public graph function agrees with the reference on one world. */
function expectParity(locations: GameLocation[], connections: Connection[]) {
  const index = parentIndex(locations);
  const authored = referenceAuthored(connections);
  const reference = referencePairs(locations);
  const referenceKeys = new Set(reference.map(([a, b]) => pairKey(a, b)));

  for (const loc of locations) {
    const expected = new Set<string>();
    for (const [a, b] of reference) {
      if (a === loc.id) expected.add(b);
      if (b === loc.id) expected.add(a);
    }
    expect(sorted(implicitNeighbors(loc.id, index)), `neighbors of ${loc.id}`).toEqual(sorted(expected));
    expect(
      sorted(effectiveDestinations(loc.id, locations, connections).keys()),
      `destinations of ${loc.id}`,
    ).toEqual(sorted(referenceDestinations(loc.id, locations, connections).keys()));
  }

  const ids = locations.map((l) => l.id);
  const wrongPairs: string[] = [];
  for (const a of ids) {
    for (const b of ids) {
      if (isImplicitPair(index, a, b) !== referenceKeys.has(pairKey(a, b))) wrongPairs.push(`${a},${b}`);
    }
  }
  expect(wrongPairs).toEqual([]);

  expect(sorted(reachableFromStarts(locations, connections))).toEqual(sorted(referenceReachable(locations, connections)));

  expect(overriddenPairs(locations, connections).map(([a, b]) => pairKey(a, b)).sort())
    .toEqual(reference.map(([a, b]) => pairKey(a, b)).filter((key) => authored.has(key)).sort());
}

const loc = (id: string, parentId?: string, isStarting = false): GameLocation =>
  ({ id, name: id, ...(parentId ? { parentId } : {}), ...(isStarting ? { isStarting } : {}) });

const leg: ConnectionLeg = {};
const oneWay = (id: string, a: string, b: string): Connection => ({ id, a, b, aToB: leg });
const twoWay = (id: string, a: string, b: string): Connection => ({ id, a, b, aToB: leg, bToA: leg });

describe("neighbor lookup parity with the pair enumeration", () => {
  // village > { tavern > cellar, house, mill } ; landing, shore and quarry are top-level.
  const nested = [
    loc("village", undefined, true), loc("tavern", "village"), loc("cellar", "tavern"), loc("house", "village"),
    loc("mill", "village"), loc("landing"), loc("shore"), loc("quarry"),
  ];

  it("matches on a nested tree with top-level locations and no Connections", () => {
    expectParity(nested, []);
  });

  it("matches with one-way and two-way Connections between unrelated locations", () => {
    expectParity(nested, [oneWay("c1", "shore", "landing"), twoWay("c2", "cellar", "quarry")]);
  });

  it("matches when Connections override a sibling pair and a parent pair", () => {
    expectParity(nested, [
      oneWay("c3", "house", "mill"), // one-way over a sibling pair
      twoWay("c4", "tavern", "village"), // two-way over a parent pair
      oneWay("c5", "cellar", "tavern"), // one-way over a parent pair, declared child-first
    ]);
  });

  it("matches when a Connection repeats a pair, declares it twice, or links a location to itself", () => {
    expectParity(nested, [
      oneWay("c6", "house", "mill"), oneWay("c7", "mill", "house"), twoWay("c8", "landing", "landing"),
    ]);
  });

  it("reaches siblings through sibling travel alone, and stops where overrides cut it", () => {
    // Children cannot climb to the parent (one-way down), so a, b and c reach each other only as siblings.
    const family = [loc("p"), loc("a", "p", true), loc("b", "p"), loc("c", "p")];
    const down = [oneWay("d1", "p", "a"), oneWay("d2", "p", "b"), oneWay("d3", "p", "c")];
    expect(sorted(reachableFromStarts(family, down))).toEqual(["a", "b", "c"]);
    // Cut b off from both siblings: nothing else leads to it, so it drops out.
    const cut = [...down, oneWay("x1", "b", "a"), oneWay("x2", "b", "c")];
    expect(sorted(reachableFromStarts(family, cut))).toEqual(["a", "c"]);
    expectParity(family, down);
    expectParity(family, cut);
  });

  it("matches when no location is flagged as a start", () => {
    expectParity(nested.map((l) => ({ ...l, isStarting: false })), [oneWay("c9", "shore", "landing")]);
  });

  it("matches when a location points at a parent that is not in the world", () => {
    expectParity([loc("a", "ghost", true), loc("b", "ghost"), loc("c")], [twoWay("c10", "a", "b")]);
  });

  it("matches when a location names itself its parent", () => {
    expectParity([loc("loop", "loop", true), loc("kid", "loop"), loc("solo")], [twoWay("c11", "loop", "loop")]);
  });

  it("matches on a world shaped like the editor-speed bench world", () => {
    // 150 children under one hub, 150 more nested under the first 40, a third as many two-way Connections.
    let seed = 7;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const locations = [loc("l0", undefined, true)];
    for (let i = 1; i < 300; i++) {
      locations.push(loc(`l${i}`, i <= 150 ? "l0" : locations[1 + Math.floor(rand() * Math.min(i - 1, 40))].id));
    }
    const connections = Array.from({ length: 100 }, (_, i) =>
      twoWay(`bc${i}`, locations[Math.floor(rand() * 300)].id, locations[Math.floor(rand() * 300)].id))
      .filter((c) => c.a !== c.b);
    expectParity(locations, connections);
  });

  it("matches on a hub with many children where overrides cut some siblings off", () => {
    const hub = [loc("hub", undefined, true), ...Array.from({ length: 40 }, (_, i) => loc(`k${i}`, "hub"))];
    const cuts = Array.from({ length: 12 }, (_, i) => oneWay(`x${i}`, `k${i}`, `k${(i * 7 + 3) % 40}`));
    expectParity(hub, cuts);
  });

  it("matches on generated worlds of mixed depth and Connection density", () => {
    let seed = 20261006;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let round = 0; round < 25; round++) {
      const count = 5 + Math.floor(rand() * 40);
      const locations: GameLocation[] = [];
      for (let i = 0; i < count; i++) {
        const parent = i > 0 && rand() < 0.75 ? locations[Math.floor(rand() * i)].id : undefined;
        locations.push(loc(`g${round}-${i}`, parent, rand() < 0.1));
      }
      const connections: Connection[] = [];
      const links = Math.floor(rand() * count);
      for (let i = 0; i < links; i++) {
        const first = locations[Math.floor(rand() * count)];
        // Half the links land on a tree neighbor, so overrides cut real implicit travel.
        const kin = locations.filter((l) => l.id !== first.id && (l.parentId === first.parentId || l.id === first.parentId));
        const a = first.id;
        const b = rand() < 0.5 && kin.length ? kin[Math.floor(rand() * kin.length)].id
          : locations[Math.floor(rand() * count)].id;
        const kind = rand();
        connections.push({
          id: `gc${round}-${i}`, a, b,
          ...(kind < 0.7 ? { aToB: leg } : {}),
          ...(kind > 0.3 ? { bToA: leg } : {}),
        });
      }
      expectParity(locations, connections);
    }
  });

  it("matches on every bundled world", () => {
    const worlds = import.meta.glob("../defaultworlds/*.json", { eager: true, import: "default" });
    expect(Object.keys(worlds).length).toBeGreaterThan(0);
    for (const raw of Object.values(worlds)) {
      const world = migrateWorld(structuredClone(raw) as Record<string, unknown>) as unknown as {
        locations: GameLocation[]; connections?: Connection[];
      };
      expectParity(world.locations, world.connections ?? []);
    }
  });
});

describe("travel on a hub with many children", () => {
  // The bench world's worst case: one parent holding every other location.
  const hubWorld = (children: number) => [
    loc("hub", undefined, true), ...Array.from({ length: children }, (_, i) => loc(`c${i}`, "hub")),
  ];
  const time = (fn: () => void) => {
    const start = performance.now();
    fn();
    return performance.now() - start;
  };
  const best = (fn: () => void) => Math.min(...Array.from({ length: 3 }, () => time(fn)));

  it("grows linearly with the child count", () => {
    const cut = [oneWay("cut", "c0", "c1")];
    const walk = (children: number) => {
      const locations = hubWorld(children);
      return best(() => {
        reachableFromStarts(locations, cut);
        effectiveDestinations("c5", locations, cut);
      });
    };
    // 4x the children: linear costs about 4x, quadratic about 16x. The 5 ms floor keeps timer noise out.
    expect(walk(16_000)).toBeLessThan(Math.max(walk(4_000), 5) * 10);
  });

  it("finds one child's destinations and the reachable set without listing every sibling pair", () => {
    // 20,000 children make 200 million sibling pairs: listing them takes minutes, a lookup takes milliseconds.
    const locations = hubWorld(20_000);
    const cut = [oneWay("cut", "c0", "c1")];
    expect(time(() => {
      const out = effectiveDestinations("c5", locations, cut);
      expect(out.size).toBe(20_000); // every sibling but itself, plus the parent
    })).toBeLessThan(1000);
    expect(time(() => {
      expect(reachableFromStarts(locations, cut).size).toBe(20_001);
    })).toBeLessThan(1000);
  });
});
