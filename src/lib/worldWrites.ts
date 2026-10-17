import type { DiscoverWrite, WorldWrites } from './statCodeExecutor';

/** `later` laid over `earlier`: the later move wins, advances add, discoveries join once per name, a
 *  described one filling in a bare one, and memory lines, pins and diary lines join in order. */
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
  return {
    ...(location === undefined ? {} : { location }),
    ...(minutes === undefined ? {} : { minutes }),
    ...(discover.length ? { discover } : {}),
    ...(memory.length ? { memory } : {}),
    ...(pins.length ? { pins } : {}),
    ...(diary.length ? { diary } : {}),
  };
}
