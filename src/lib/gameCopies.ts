import type { Entity } from '@/types';

/**
 * What this game made its own, in one place. The first edit of a world entity or the persona takes all its text,
 * chips filled in, so from then on an authored change never reaches it. Pictures stay with the source until the
 * player changes them, so a copy costs a save almost nothing. It sits on each turn's snapshot, so a rollback
 * takes it back, and the world itself is never written.
 */

/** The fields of an entity or persona a game can hold its own version of. */
export const ENTITY_COPY_FIELDS = ['name', 'aliases', 'pronouns', 'playerDescription', 'aiDescription', 'aiSummary', 'images'] as const;

export type EntityCopy = Partial<Pick<Entity, (typeof ENTITY_COPY_FIELDS)[number]>>;

/** The world's two descriptions as this game has them. */
export interface WorldCopy {
  /** The world's Player-Facing Description. */
  description?: string;
  /** The world's AI-Facing Description, which the prompts read as the world overview. */
  aiDescription?: string;
}

/** Everything a game holds over its source. */
export interface GameCopies {
  /** By entity id: the world's characters, and the persona played. */
  entities?: Readonly<Record<string, EntityCopy>>;
  world?: WorldCopy;
}

export const NO_GAME_COPIES: GameCopies = {};

/** The text of `entity`, which a copy starts from. Pictures are left out. */
export function takeCopy(entity: Entity): EntityCopy {
  const { name, aliases, pronouns, playerDescription, aiDescription, aiSummary } = entity;
  return { name, aliases, pronouns, playerDescription, aiDescription, aiSummary };
}

/** `entity` as this game plays it. The same object without a copy. */
export const withEntityCopy = <E extends Entity>(entity: E, copy: EntityCopy | undefined): E =>
  (copy ? { ...entity, ...copy } : entity);

/** The entities as this game plays them. The same array when none has a copy. */
export function withEntityCopies<E extends Entity>(entities: E[], copies: GameCopies): E[] {
  const held = copies.entities;
  if (!held || !entities.some((e) => held[e.id])) return entities;
  return entities.map((e) => withEntityCopy(e, held[e.id]));
}

/** A copy as Save keeps it. A new name takes over and the source's joins Aliases, so the story's earlier word
 *  for the entity still finds it; a blank name keeps the source's. */
export function savedCopy(copy: EntityCopy, source: Pick<Entity, 'name' | 'aliases'>): EntityCopy {
  const name = copy.name?.trim() || source.name;
  if (name === source.name) return { ...copy, name };
  const aliases = copy.aliases ?? source.aliases ?? [];
  const known = aliases.some((a) => a.toLowerCase() === source.name.toLowerCase());
  return { ...copy, name, aliases: known ? aliases : [...aliases, source.name] };
}

/** `copies` with one entity's copy set, or dropped by `null`. */
export function withCopyOf(copies: GameCopies, id: string, copy: EntityCopy | null): GameCopies {
  const { [id]: _old, ...entities } = copies.entities ?? {};
  const next = copy ? { ...entities, [id]: copy } : entities;
  const { entities: _all, ...rest } = copies;
  return Object.keys(next).length ? { ...rest, entities: next } : rest;
}

/** The turn a re-generate goes back to, with the copies the player holds now: an edit isn't an outcome of the
 *  turn being rolled again, so it stays. A rollback restores a turn as it was, copies included. */
export const withLiveCopies = <S extends { copies?: GameCopies }>(state: S, live: GameCopies): S => ({ ...state, copies: live });

export const hasCopies = (copies: GameCopies): boolean => !!copies.world || Object.keys(copies.entities ?? {}).length > 0;
