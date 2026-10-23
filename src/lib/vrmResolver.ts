import type { CharacterData, ChosenVrm, Entity, VrmPick, WorldOverview, WorldVrmStore } from '@/types';
import type { ResolvedPersona } from '@/lib/persona';
import { customPersonaEntity } from '@/lib/blueprints';

/** A pick that names one Avatar: a world store entry or a library record. */
type NamedVrm = Exclude<VrmPick, { kind: 'default' }>;

/** Where an entity's Avatar comes from: a world store entry, a library record, or the bundled file. */
export type VrmSource = NamedVrm | { kind: 'bundled' };

type PickedEntity = Pick<Entity, 'id' | 'vrmPick'>;

/** Who the player plays, with the entity for a library or world persona. */
export type PlayedVrmAs =
  | { source: 'library'; entity: PickedEntity }
  | { source: 'world'; entity: PickedEntity }
  | { source: 'none' };

/** Everything the resolver reads besides the entity. */
export interface VrmContext {
  store: WorldVrmStore | undefined;
  /** The ids in the player's Avatar library on this device. */
  libraryIds: ReadonlySet<string>;
  /** The device's default Avatar, a library id. */
  deviceDefault: string | undefined;
  played: PlayedVrmAs;
  /** The world's Custom Persona entity. */
  customPersona: PickedEntity | undefined;
  chosen?: ChosenVrm;
  legacyFallback?: VrmPick;
}

const bundled: VrmSource = { kind: 'bundled' };

/** A library id that is gone resolves like a missing default; a store id that is gone resolves to none. */
export function namedVrmSource(pick: NamedVrm, ctx: Pick<VrmContext, 'store' | 'libraryIds'>): VrmSource | undefined {
  if (pick.kind === 'world') return ctx.store && Object.hasOwn(ctx.store, pick.id) ? { kind: 'world', id: pick.id } : undefined;
  return ctx.libraryIds.has(pick.id) ? { kind: 'library', id: pick.id } : bundled;
}

function resolvePick(pick: VrmPick | undefined, ctx: VrmContext, userDefault: () => VrmSource): VrmSource | undefined {
  if (!pick) return undefined;
  return pick.kind === 'default' ? userDefault() : namedVrmSource(pick, ctx);
}

const deviceDefault = (ctx: VrmContext): VrmSource =>
  ctx.deviceDefault && ctx.libraryIds.has(ctx.deviceDefault) ? { kind: 'library', id: ctx.deviceDefault } : bundled;

/** User's Default for the played entity: the save's chosen Avatar, else the device default. */
const playedDefault = (ctx: VrmContext): VrmSource =>
  (ctx.chosen && resolvePick(ctx.chosen.pick, ctx, () => deviceDefault(ctx))) ?? deviceDefault(ctx);

/** The played entity's id: the persona's, or the Custom Persona's under None. */
export function playedEntityId({ played, customPersona }: Pick<VrmContext, 'played' | 'customPersona'>): string | undefined {
  return played.source === 'none' ? customPersona?.id : played.entity.id;
}

/** The played side's Avatar: the first source by persona that is not none. Also serves the You row, which has no
 *  played entity. */
export function resolvePlayedVrm(ctx: VrmContext): VrmSource | undefined {
  if (ctx.chosen?.legacy) {
    const legacy = resolvePick(ctx.chosen.pick, ctx, () => deviceDefault(ctx));
    if (legacy) return legacy;
  }
  for (const pick of playedOrder(ctx)) {
    const source = resolvePick(pick, ctx, () => playedDefault(ctx));
    if (source) return source;
  }
  return undefined;
}

/** What the played side's precedence reads, apart from the library and the save. */
export type PlayedVrmSources = Pick<VrmContext, 'store' | 'played' | 'customPersona' | 'legacyFallback'>;

/** The played side's picks in precedence order, by persona source. */
function playedOrder({ played, customPersona, legacyFallback }: PlayedVrmSources): (VrmPick | undefined)[] {
  return played.source === 'library' ? [played.entity.vrmPick, customPersona?.vrmPick, legacyFallback]
    : played.source === 'world' ? [played.entity.vrmPick, legacyFallback]
    : [customPersona?.vrmPick, legacyFallback];
}

/** The pick the played side lands on, the save's chosen Avatar aside: the first by persona that is not none.
 *  Only a store id that is gone falls through, so the library list is not needed. */
export function playedVrmPick(sources: PlayedVrmSources): VrmPick | undefined {
  return playedOrder(sources).find((pick) => pick && (pick.kind !== 'world' || namedVrmSource(pick, { ...sources, libraryIds: new Set() })));
}

/** The Avatar `entity` shows in context. The played entity resolves through the played side; any other entity
 *  shows its own pick. */
export function resolveEntityVrm(entity: PickedEntity, ctx: VrmContext): VrmSource | undefined {
  if (entity.id === playedEntityId(ctx)) return resolvePlayedVrm(ctx);
  return resolvePick(entity.vrmPick, ctx, () => deviceDefault(ctx));
}

/** Who the player plays: a library or world persona with its entity, else none. */
export function playedVrmAs(persona: { source: ResolvedPersona['source']; entity: PickedEntity } | null): PlayedVrmAs {
  return persona?.source === 'library' || persona?.source === 'world'
    ? { source: persona.source, entity: persona.entity }
    : { source: 'none' };
}

/** The resolver's context for a playthrough: who is played, the world's store and fallback, the save's choice. */
export function playVrmContext(args: {
  persona: ResolvedPersona | null;
  entities: readonly Entity[];
  overview: Pick<WorldOverview, 'vrmStore' | 'legacyVrmFallback'>;
  characterData: CharacterData | null;
  libraryIds: ReadonlySet<string>;
  deviceDefault: string | undefined;
}): VrmContext {
  const { persona, entities, overview, characterData } = args;
  return {
    store: overview.vrmStore,
    libraryIds: args.libraryIds,
    deviceDefault: args.deviceDefault,
    played: playedVrmAs(persona),
    customPersona: customPersonaEntity(entities),
    chosen: characterData?.chosenVrm ?? undefined,
    legacyFallback: overview.legacyVrmFallback,
  };
}
