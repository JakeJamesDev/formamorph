import type { Codec } from './usePersistentState';

/** Which entities the library's Entities tab shows. Device-local. */
export type EntityLibraryFilter = 'all' | 'personas';

export const ENTITY_LIBRARY_FILTER_KEY = 'FORMAMORPH_entityFilter';

export const entityLibraryFilterCodec: Codec<EntityLibraryFilter> = {
  parse: (raw) => (raw === 'personas' ? 'personas' : 'all'),
  serialize: (value) => value,
};

/** The grid filter for `filter`, or none when the tab shows everything. */
export function entityLibraryPredicate(
  filter: EntityLibraryFilter,
): ((entity: { persona?: boolean }) => boolean) | undefined {
  return filter === 'personas' ? (entity) => entity.persona === true : undefined;
}
