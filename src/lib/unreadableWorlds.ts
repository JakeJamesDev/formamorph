/** The stored worlds this session found it can't read, for the menu to offer a repair. */

export interface UnreadableWorld {
  id: string;
  /** Present when the world's metadata still reads. */
  name?: string;
  sourceId?: string;
  /** Found by opening the world, which a list read can't confirm or clear. */
  foundOnOpen?: boolean;
}

let worlds: readonly UnreadableWorld[] = [];
const listeners = new Set<() => void>();
const announced = new Set<string>();

function publish(next: readonly UnreadableWorld[]): void {
  worlds = next;
  for (const listener of [...listeners]) listener();
}

/** The current list, stable between changes. */
export const getUnreadableWorlds = (): readonly UnreadableWorld[] => worlds;

/** Calls `listener` on each change to the list. Returns the unsubscribe. */
export function subscribeUnreadableWorlds(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Take a list read's answer: `ids` have no readable metadata and no readable record. */
export function syncUnreadableWorlds(ids: readonly string[]): void {
  const found = new Set(ids);
  const kept = worlds.filter((world) => world.foundOnOpen || found.has(world.id));
  const added = ids.filter((id) => !kept.some((world) => world.id === id));
  if (added.length === 0 && kept.length === worlds.length) return;
  if (added.length > 0) console.error('Unreadable worlds in the library:', added);
  publish([...kept, ...added.map((id) => ({ id }))]);
}

/** Add a world whose record failed when it was opened, though its metadata still reads. */
export function reportUnreadableWorld(world: Omit<UnreadableWorld, 'foundOnOpen'>): void {
  if (worlds.some((known) => known.id === world.id)) return;
  console.error('Unreadable world in the library:', world.id);
  publish([...worlds, { ...world, foundOnOpen: true }]);
}

/** Drop a world that was written or removed. */
export function clearUnreadableWorld(id: string): void {
  if (worlds.some((world) => world.id === id)) publish(worlds.filter((world) => world.id !== id));
}

/** How many listed worlds have not had a notice yet this session; counts them as noticed. */
export function takeUnannouncedWorlds(): number {
  const fresh = worlds.filter((world) => !announced.has(world.id));
  for (const world of fresh) announced.add(world.id);
  return fresh.length;
}

/** Whether this session raised a notice. */
export const hasAnnouncedWorlds = (): boolean => announced.size > 0;

/** Test seam: empty the list and the noticed set. */
export function resetUnreadableWorlds(): void {
  worlds = [];
  announced.clear();
}
