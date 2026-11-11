import type { CharacterData, ChosenVrm, Entity, VrmPick, WorldOverview, WorldVrmStore } from '@/types';
import type { ResolvedPersona } from '@/lib/persona';
import { customPersonaEntity } from '@/lib/blueprints';
import { firstAvailableAvatar } from '@/lib/defaultAvatar';

/** A pick that names one Avatar: a world store entry or a library record. */
type NamedVrm = Exclude<VrmPick, { kind: 'default' }>;

/** Where an entity's Avatar comes from: a world store entry, a library record, or `pending` while the library
 *  list is still being read. */
export type VrmSource = NamedVrm | { kind: 'pending' };

type PickedEntity = Pick<Entity, 'id' | 'vrmPick'>;

/** Who the player plays, with the entity for a library or world persona. */
export type PlayedVrmAs =
  | { source: 'library'; entity: PickedEntity }
  | { source: 'world'; entity: PickedEntity }
  | { source: 'none' };

/** Everything the resolver reads besides the entity. */
export interface VrmContext {
  store: WorldVrmStore | undefined;
  /** The ids in the player's Avatar library on this device, newest first. `undefined` while the read runs. */
  libraryIds: ReadonlySet<string> | undefined;
  /** The device's default Avatar, a library id. */
  deviceDefault: string | undefined;
  played: PlayedVrmAs;
  /** The world's Custom Persona entity. */
  customPersona: PickedEntity | undefined;
  chosen?: ChosenVrm;
  legacyFallback?: VrmPick;
}

const PENDING: VrmSource = { kind: 'pending' };

/** User's Default on this device: the marked default, else the first available library Avatar, else none. */
function userDefaultSource({ libraryIds, deviceDefault: marked }: Pick<VrmContext, 'libraryIds' | 'deviceDefault'>): VrmSource | undefined {
  if (!libraryIds) return PENDING;
  const id = firstAvailableAvatar(libraryIds, marked);
  return id === undefined ? undefined : { kind: 'library', id };
}

/** A library id that is gone resolves as User's Default; a store id that is gone resolves to none. */
export function namedVrmSource(pick: NamedVrm, ctx: Pick<VrmContext, 'store' | 'libraryIds' | 'deviceDefault'>): VrmSource | undefined {
  if (pick.kind === 'world') return ctx.store && Object.hasOwn(ctx.store, pick.id) ? { kind: 'world', id: pick.id } : undefined;
  if (!ctx.libraryIds) return PENDING;
  return ctx.libraryIds.has(pick.id) ? { kind: 'library', id: pick.id } : userDefaultSource(ctx);
}

function resolvePick(pick: VrmPick | undefined, ctx: VrmContext, userDefault: () => VrmSource | undefined): VrmSource | undefined {
  if (!pick) return undefined;
  return pick.kind === 'default' ? userDefault() : namedVrmSource(pick, ctx);
}

/** User's Default for the played entity: the save's chosen Avatar, else the device default. */
const playedDefault = (ctx: VrmContext): VrmSource | undefined =>
  (ctx.chosen && resolvePick(ctx.chosen.pick, ctx, () => userDefaultSource(ctx))) ?? userDefaultSource(ctx);

/** The played entity's id: the persona's, or the Custom Persona's under None. */
export function playedEntityId({ played, customPersona }: Pick<VrmContext, 'played' | 'customPersona'>): string | undefined {
  return played.source === 'none' ? customPersona?.id : played.entity.id;
}

/** The played side's Avatar: the pick `playedVrmPick` lands on, resolved. Also serves the You row, which has no
 *  played entity. */
export function resolvePlayedVrm(ctx: VrmContext): VrmSource | undefined {
  if (ctx.chosen?.legacy) {
    const legacy = resolvePick(ctx.chosen.pick, ctx, () => userDefaultSource(ctx));
    if (legacy) return legacy;
  }
  return resolvePick(playedVrmPick(ctx), ctx, () => playedDefault(ctx));
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
  return playedOrder(sources).find((pick) => pick && (pick.kind !== 'world' || namedVrmSource(pick, { ...sources, libraryIds: undefined, deviceDefault: undefined })));
}

/** The Avatar `entity` shows in context. The played entity resolves through the played side; any other entity
 *  shows its own pick. */
export function resolveEntityVrm(entity: PickedEntity, ctx: VrmContext): VrmSource | undefined {
  if (entity.id === playedEntityId(ctx)) return resolvePlayedVrm(ctx);
  return resolvePick(entity.vrmPick, ctx, () => userDefaultSource(ctx));
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
  libraryIds: ReadonlySet<string> | undefined;
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
