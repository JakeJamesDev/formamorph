import type { DiscoverWrite, WorldWrites } from './statCodeExecutor';

/** Story hours the turn's prompts and scripts read: `turnStart` plus every advance `writes` holds (Q45).
 *  Undefined when the turn has not advanced the clock. */
export function advancedClock(turnStart: number, writes: WorldWrites | undefined): number | undefined {
  return writes?.minutes === undefined ? undefined : turnStart + writes.minutes / 60;
}

/** `later` laid over `earlier`: the later move wins, advances add, discoveries join once per name, a
 *  described one filling in a bare one, and memory lines, pins, diary lines, entity writes and memory entry writes
 *  join in order. */
export function mergeWorldWrites(earlier: WorldWrites | undefined, later: WorldWrites | undefined): WorldWrites | undefined {
  if (!earlier || !later) return later ?? earlier;
  const location = later.location ?? earlier.location;
  const minutes = earlier.minutes === undefined && later.minutes === undefined ? undefined
    : (earlier.minutes ?? 0) + (later.minutes ?? 0);
  const byName = new Map<string, DiscoverWrite>();
  for (const entry of [...earlier.discover ?? [], ...later.discover ?? []]) {
    if (!byName.has(entry.name) || entry.description !== undefined) byName.set(entry.name, entry);
  }
  const discover = [...byName.values()];
  const memory = [...earlier.memory ?? [], ...later.memory ?? []];
  const pins = [...earlier.pins ?? [], ...later.pins ?? []];
  const diary = [...earlier.diary ?? [], ...later.diary ?? []];
  const entities = [...earlier.entities ?? [], ...later.entities ?? []];
  const memoryWrites = [...earlier.memoryWrites ?? [], ...later.memoryWrites ?? []];
  return {
    ...(location === undefined ? {} : { location }),
    ...(minutes === undefined ? {} : { minutes }),
    ...(discover.length ? { discover } : {}),
    ...(memory.length ? { memory } : {}),
    ...(pins.length ? { pins } : {}),
    ...(diary.length ? { diary } : {}),
    ...(entities.length ? { entities } : {}),
    ...(memoryWrites.length ? { memoryWrites } : {}),
  };
}
