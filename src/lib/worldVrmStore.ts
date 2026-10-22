import { randomUUID } from '@/lib/uuid';
import type { Entity, MediaAsset, VrmPick, WorldVrm } from '@/types';

type Store = Record<string, WorldVrm>;

/** A file's name without its extension, the display name a new Avatar starts on. */
export const vrmDisplayName = (fileName: string | undefined): string =>
  (fileName ?? '').replace(/\.[^.]+$/, '').trim() || 'Avatar';

/** The store with `file` added under a fresh id. */
export function addWorldVrm(store: Store | undefined, name: string, file: MediaAsset, hash?: string): { store: Store; id: string } {
  const id = randomUUID();
  return { store: { ...store, [id]: { name, file, ...(hash ? { hash } : {}) } }, id };
}

/** The store with one entry's display name changed. Entities keep their picks: they hold the id. */
export function renameWorldVrm(store: Store | undefined, id: string, name: string): Store | undefined {
  const entry = store?.[id];
  return entry ? { ...store, [id]: { ...entry, name } } : store;
}

const isPickOf = (pick: VrmPick | undefined, id: string) => pick?.kind === 'world' && pick.id === id;

const NONE = 'none';
const DEFAULT = 'default';
const WORLD = 'world:';
const LIBRARY = 'library:';

/** A pick as one select value. None is the absent pick. */
export const vrmPickValue = (pick: VrmPick | undefined): string =>
  !pick ? NONE : pick.kind === 'default' ? DEFAULT : (pick.kind === 'world' ? WORLD : LIBRARY) + pick.id;

/** The pick a select value stands for; None reads back as absent. */
export const vrmPickFromValue = (value: string): VrmPick | undefined =>
  value === DEFAULT ? { kind: 'default' }
    : value.startsWith(WORLD) ? { kind: 'world', id: value.slice(WORLD.length) }
    : value.startsWith(LIBRARY) ? { kind: 'library', id: value.slice(LIBRARY.length) }
    : undefined;

/** The entities whose pick names store entry `id`, in list order. */
export const entitiesUsingWorldVrm = (entities: Entity[], id: string): Entity[] =>
  entities.filter((entity) => isPickOf(entity.vrmPick, id));

/** The store without entry `id`, and the entities with every pick of it set to none. Untouched entities keep
 *  their identity. */
export function deleteWorldVrm(store: Store | undefined, entities: Entity[], id: string): { store: Store; entities: Entity[] } {
  const { [id]: _removed, ...rest } = store ?? {};
  const next = entities.map((entity) => {
    if (!isPickOf(entity.vrmPick, id)) return entity;
    const { vrmPick: _pick, ...cleared } = entity;
    return cleared;
  });
  return { store: rest, entities: next };
}
