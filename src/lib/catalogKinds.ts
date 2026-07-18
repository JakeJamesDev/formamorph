/**
 * What a community listing can be. Mirrors the server's `config/kinds` — keep the two in step.
 *
 * The local library calls these worlds/entities/dictionaries (plural, see MainMenu's `cardType`); the
 * server names a single row's kind (singular). `CARD_TYPE_BY_KIND` bridges the two so neither side has to
 * adopt the other's vocabulary.
 */
export const CATALOG_KINDS = ['world', 'entity', 'dictionary'] as const;

export type CatalogKind = (typeof CATALOG_KINDS)[number];

/**
 * What a list request may ask for: one kind, or the opt-in `'all'`.
 *
 * `'all'` exists because the browser fetches the whole catalog in one request and splits it locally. It is
 * a query value only — never a row's kind — and it must be asked for by name, which is what keeps a client
 * that predates kinds seeing worlds only.
 */
export type CatalogKindQuery = CatalogKind | 'all';

/** The local library's tab value for each kind. */
export const CARD_TYPE_BY_KIND: Record<CatalogKind, 'worlds' | 'entities' | 'dictionaries'> = {
  world: 'worlds',
  entity: 'entities',
  dictionary: 'dictionaries',
};

/** The kind behind each local library tab. */
export const KIND_BY_CARD_TYPE = {
  worlds: 'world',
  entities: 'entity',
  dictionaries: 'dictionary',
} as const satisfies Record<string, CatalogKind>;

/** Player-facing name for a kind, singular and plural. */
export const KIND_LABELS: Record<CatalogKind, { one: string; many: string }> = {
  world: { one: 'World', many: 'Worlds' },
  entity: { one: 'Character', many: 'Characters' },
  dictionary: { one: 'Dictionary', many: 'Dictionaries' },
};

/** A listing's kind, defaulting rows that predate the column (or a server that omits it) to 'world'. */
export function kindOf(record: { kind?: string }): CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(record.kind ?? '')
    ? (record.kind as CatalogKind)
    : 'world';
}
