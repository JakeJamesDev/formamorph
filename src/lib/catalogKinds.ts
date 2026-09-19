import { BookOpen, Earth, PersonStanding, ScrollText, User, type LucideIcon } from 'lucide-react';

/**
 * What a community listing can be. Mirrors the server's `config/kinds` — keep the two in step.
 *
 * The local library calls these worlds/entities/dictionaries (plural, see MainMenu's `cardType`); the
 * server names a single row's kind (singular). `CARD_TYPE_BY_KIND` bridges the two so neither side has to
 * adopt the other's vocabulary.
 */
export const CATALOG_KINDS = ['world', 'entity', 'dictionary', 'model', 'prompt'] as const;

export type CatalogKind = (typeof CATALOG_KINDS)[number];

/**
 * What a list request may ask for: one kind, or the opt-in `'all'`.
 *
 * `'all'` exists because the browser fetches the whole catalog in one request and splits it locally. It is
 * a query value only — never a row's kind — and it must be asked for by name, which is what keeps a client
 * that predates kinds seeing worlds only.
 */
export type CatalogKindQuery = CatalogKind | 'all';

/** A kind the local library has a tab for. Prompt presets live in Settings instead. */
export type LibraryCatalogKind = Exclude<CatalogKind, 'prompt'>;

/** The local library's tab value for each kind that has one. */
export const CARD_TYPE_BY_KIND: Record<LibraryCatalogKind, 'worlds' | 'entities' | 'dictionaries' | 'models'> = {
  world: 'worlds',
  entity: 'entities',
  dictionary: 'dictionaries',
  model: 'models',
};

/** The kind behind each local library tab. */
export const KIND_BY_CARD_TYPE = {
  worlds: 'world',
  entities: 'entity',
  dictionaries: 'dictionary',
  models: 'model',
} as const satisfies Record<string, CatalogKind>;

/** Player-facing name for a kind, singular and plural. */
export const KIND_LABELS: Record<CatalogKind, { one: string; many: string }> = {
  world: { one: 'World', many: 'Worlds' },
  entity: { one: 'Entity', many: 'Entities' },
  dictionary: { one: 'Dictionary', many: 'Dictionaries' },
  // The kind id keeps the library's own `models` spelling, because `avatar` in code means Profile
  // Picture on both sides of the wire. The player-facing word is Avatar.
  model: { one: 'Avatar', many: 'Avatars' },
  prompt: { one: 'Prompt', many: 'Prompts' },
};

/** The icon each kind wears everywhere: the browser's sections, profile tabs, and a prompt's card art. */
export const KIND_ICONS: Record<CatalogKind, LucideIcon> = {
  world: Earth,
  entity: User,
  dictionary: BookOpen,
  // The same figure the local library's Avatars tab wears.
  model: PersonStanding,
  prompt: ScrollText,
};

/** Whether a kind's listings carry cover art. A prompt shows its kind icon instead. */
export const kindHasThumbnail = (kind: CatalogKind): boolean => kind !== 'prompt';

/** A listing's kind, defaulting rows that predate the column (or a server that omits it) to 'world'. */
export function kindOf(record: { kind?: string }): CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(record.kind ?? '')
    ? (record.kind as CatalogKind)
    : 'world';
}

/** The model names a listing says it works with. Only prompts carry any; a malformed field reads as none. */
export function listingModels(record: { models?: unknown }): string[] {
  return Array.isArray(record.models) ? record.models.filter((m): m is string => typeof m === 'string' && m !== '') : [];
}

/** A listing's tags; a malformed field reads as none. */
export function listingTags(record: { tags?: unknown }): string[] {
  return Array.isArray(record.tags) ? record.tags.filter((t): t is string => typeof t === 'string') : [];
}

/** The app version a listing was made for, or null when the server sent none. */
export function listingAppVersion(record: { app_version?: unknown }): string | null {
  return typeof record.app_version === 'string' && record.app_version !== '' ? record.app_version : null;
}
