import type { CascadeOffTraitIds, Entity, EntityGroup, GameState, OwnedTraitStates, Placeholder, Trait, TraitGroup } from '@/types';
import { buildTree, flattenTree, type TreeGroup, type TreeLeaf } from './groupTree';
import { canBePlayer, inCast, playsAs, resolveBearers, type Bearer, type BearerWorld } from './bearers';
import type { SandboxEntity, SandboxPlaceholderNode, SandboxTrait } from './statCodeExecutor';
import type { CodeEntityNames, CodeTraitPlace } from './statCodeAnalysis';
import { statCodeName } from './statCodeNames';
import { refreshChosenTraits } from './traitEffects';
import { traitGates, traitUnlocked, type AppliedTraitValues, type TraitWorld } from './traitRuntime';
import { WORLD_OWNER, type GateStates } from './traitGates';

/** Every Bearer's trait state, the authored world code switches it against, and who is in play and in the scene. */
export interface StatCodeBearers {
  /** The player's list, chosen at creation or acquired in play. Switched-off ones stay listed. */
  acquired: readonly Trait[];
  disabledTraitIds: readonly string[];
  appliedValues: AppliedTraitValues;
  /** Owner id → the traits a cascade turned off. Absent ⇒ none. */
  cascadeOffTraitIds?: CascadeOffTraitIds;
  /** Each entity's owned traits, which a cascade can switch. Absent ⇒ none. */
  ownedTraits?: OwnedTraitStates;
  /** Every authored trait and group, and who the player is, for gates. `traits` maps each authored trait; a code switch-on acquires from here. */
  world: TraitWorld;
  /** The world's entities as authored, chips and all. Code names read these, never the resolved names the
   *  bearers carry. Absent ⇒ none. */
  entities?: readonly Entity[];
  /** The library entities in the playthrough as authored: the library persona, then the added characters. */
  library?: readonly Entity[];
  /** Ids of the entities in the turn's scene. Absent ⇒ none; the played persona is always in it. */
  inSceneIds?: readonly string[];
}

/** The player's traits as a saved state holds them, each re-read from the world as play reads them. */
export function savedTraits(
  saved: Pick<GameState, 'playerTraits' | 'disabledTraitIds' | 'appliedTraitValues' | 'cascadeOffTraitIds' | 'ownedTraits'>,
  authored: Trait[],
): Pick<StatCodeBearers, 'acquired' | 'disabledTraitIds' | 'appliedValues' | 'cascadeOffTraitIds' | 'ownedTraits'> {
  return {
    acquired: refreshChosenTraits(saved.playerTraits, authored),
    disabledTraitIds: saved.disabledTraitIds ?? [],
    appliedValues: saved.appliedTraitValues ?? {},
    cascadeOffTraitIds: saved.cascadeOffTraitIds ?? {},
    ownedTraits: saved.ownedTraits ?? {},
  };
}

/** The sandbox's `traits` entries, one per authored trait in authored order, under their code names — the
 *  rule that names stats, so a chip in a trait's name never reaches code as this playthrough's roll. */
export function sandboxTraits(bearers: StatCodeBearers, placeholders: readonly Placeholder[]): SandboxTrait[] {
  const acquired = new Set(bearers.acquired.map((t) => t.id));
  const off = new Set(bearers.disabledTraitIds);
  const gates = gatesOf(bearers);
  return bearers.world.traits.map((trait) => ({
    ...traitIdentity(trait, WORLD_OWNER, bearers.world.groups, gates, placeholders),
    acquired: acquired.has(trait.id),
    enabled: acquired.has(trait.id) && !off.has(trait.id),
  }));
}

/** Every bearer's gate on its traits, against the state the run reads. */
const gatesOf = (bearers: StatCodeBearers): GateStates =>
  traitGates({ traits: [...bearers.acquired], disabledTraitIds: [...bearers.disabledTraitIds], ownedTraits: bearers.ownedTraits }, bearers.world);

/** The read-only fields of a trait entry: who it is, how it switches, and whether its Bearer's gate holds. */
function traitIdentity(
  trait: Trait,
  ownerId: string,
  groups: readonly TraitGroup[],
  gates: GateStates,
  placeholders: readonly Placeholder[],
): Required<Pick<SandboxTrait, 'id' | 'name' | 'mode' | 'available' | 'group' | 'playerToggle'>> {
  const group = trait.groupId ? groups.find((g) => g.id === trait.groupId) : undefined;
  return {
    id: trait.id,
    name: statCodeName(trait.name, placeholders),
    mode: trait.mode ?? 'optional',
    available: traitUnlocked(gates, ownerId, trait.id),
    group: group ? statCodeName(group.name, placeholders) : '',
    playerToggle: trait.playerToggle === true,
  };
}

/** One entity as code reads it: its identity, and each trait in its set by id. */
export interface CodeEntity extends SandboxEntity {
  /** Empty for the empty persona. */
  id: string;
  type: string;
  pronouns: string;
  inScene: boolean;
  traits: (SandboxTrait & { id: string })[];
}

/** What a turn's `entities` and `persona` read: every entity in play, and the played persona among them. */
export interface CodeEntities {
  /** In play order: the world's, then the library's. */
  entities: CodeEntity[];
  /** The empty entry when no persona entity plays. */
  persona: CodeEntity;
}

const NO_PERSONA: CodeEntity = { id: '', name: '', type: '', pronouns: '', inScene: false, traits: [] };

/** The entity the player plays: the picked world or library persona, else the Custom Persona entity under
 *  None. Null when none plays. */
function playedPersonaId(bearers: StatCodeBearers): string | null {
  const { persona, entities } = bearers.world;
  if (!persona) return null;
  if (persona.source !== 'none') return persona.entityId;
  return (entities ?? bearers.entities ?? []).find((e) => e.customPersona)?.id ?? null;
}

/** One entity's entry: its Bearer's own trait set, owned or linked, under the authored code names. */
function codeEntity(
  bearers: StatCodeBearers,
  placeholders: readonly Placeholder[],
  authored: Entity,
  gates: GateStates,
  played: string | null,
): CodeEntity {
  const bearer = bearers.world.bearers?.find((o) => o.id === authored.id);
  const state = bearers.ownedTraits?.[authored.id];
  const chosen = new Set(state?.chosen ?? []);
  const off = new Set(state?.disabled ?? []);
  const named = withOwnPlaceholders(placeholders, authored);
  return {
    id: authored.id,
    name: statCodeName(authored.name, named),
    type: statCodeName(authored.type, named),
    pronouns: statCodeName(authored.pronouns, named),
    inScene: authored.id === played || !!bearers.inSceneIds?.includes(authored.id),
    traits: (bearer?.traits ?? []).map((trait) => ({
      ...traitIdentity({ ...trait, name: authoredTraitName(trait, authored, bearers.world.traits) }, authored.id,
        [...(bearer?.groups ?? []), ...bearers.world.groups], gates, named),
      acquired: chosen.has(trait.id),
      enabled: chosen.has(trait.id) && !off.has(trait.id),
    })),
  };
}

/** Every entity in play, the played persona among them: the world's cast and persona, then the library's. */
export function codeEntities(bearers: StatCodeBearers, placeholders: readonly Placeholder[]): CodeEntities {
  const ref = bearers.world.persona;
  const world = (bearers.entities ?? []).filter((e) => playsAs(e, ref) || inCast(e, ref));
  const id = playedPersonaId(bearers);
  const gates = gatesOf(bearers);
  const entities = [...world, ...bearers.library ?? []].map((e) => codeEntity(bearers, placeholders, e, gates, id));
  return { entities, persona: entities.find((e) => e.id === id) ?? NO_PERSONA };
}

/** A bearer's trait as authored: the entity's own, else the original a link brings. */
const authoredTraitName = (trait: Trait, entity: Entity | null | undefined, worldTraits: readonly Trait[]): string =>
  entity?.traits?.find((t) => t.id === trait.id)?.name ?? worldTraits.find((t) => t.id === trait.id)?.name ?? trait.name;

/** The placeholders an entity's chips can name: the world's, then the entity's own. */
const withOwnPlaceholders = (placeholders: readonly Placeholder[], entity: Entity | null | undefined): readonly Placeholder[] =>
  (entity?.placeholders?.length ? [...placeholders, ...entity.placeholders] : placeholders);

/** Each leaf in its tab's tree order, with its folder names outermost first. */
export function inTreeOrder<G extends TreeGroup, L extends TreeLeaf>(
  groups: readonly G[], leaves: readonly L[], nameOf: (group: G) => string,
): { leaf: L; path: string[] }[] {
  const paths = new Map<string, string[]>();
  const out: { leaf: L; path: string[] }[] = [];
  for (const node of flattenTree(buildTree(groups, leaves))) {
    const path = (node.parentId && paths.get(node.parentId)) || [];
    if (node.group) paths.set(node.id, [...path, nameOf(node.group)]);
    else if (node.leaf) out.push({ leaf: node.leaf, path });
  }
  return out;
}

/** Every authored entity, persona-only ones included, as the editor reads it: code names only, since the
 *  editor knows no playthrough. Authored order, which decides who holds a shared name. */
export function entityTraitNames(
  world: BearerWorld & { entityGroups?: readonly EntityGroup[] }, placeholders: readonly Placeholder[],
): CodeEntityNames[] {
  const bearers = new Map(resolveBearers(world, undefined).bearers.map((bearer) => [bearer.id, bearer]));
  const tab = new Map(inTreeOrder(world.entityGroups ?? [], world.entities, (group) => statCodeName(group.name, placeholders))
    .map(({ leaf, path }, position) => [leaf.id, { folder: path, tabPosition: position }]));
  return world.entities.map((entity) => {
    const named = withOwnPlaceholders(placeholders, entity);
    return {
      id: entity.id,
      persona: canBePlayer(entity),
      name: statCodeName(entity.name, named),
      traits: traitPlaces(bearers.get(entity.id), entity, world.traits, named),
      ...tab.get(entity.id),
    };
  });
}

/** A bearer's traits, owned or linked, in the order play reads them, each placed in the bearer's tree. */
function traitPlaces(
  bearer: Bearer | undefined, entity: Entity, worldTraits: readonly Trait[], named: readonly Placeholder[],
): CodeTraitPlace[] {
  const tab = new Map(inTreeOrder(bearer?.groups ?? [], bearer?.traits ?? [], (group) => statCodeName(group.name, named))
    .map(({ leaf, path }, position) => [leaf.id, { path, tabPosition: position }]));
  return (bearer?.traits ?? []).map((trait) => ({
    id: trait.id, name: statCodeName(authoredTraitName(trait, entity, worldTraits), named), path: [], ...tab.get(trait.id),
  }));
}

/** The world's own traits in Traits-tab order, which `traits` keys. */
export const worldTraitPlaces = (
  world: Pick<BearerWorld, 'traits' | 'traitGroups'>, placeholders: readonly Placeholder[],
): CodeTraitPlace[] =>
  inTreeOrder(world.traitGroups, world.traits, (group) => statCodeName(group.name, placeholders))
    .map(({ leaf, path }) => ({ id: leaf.id, name: statCodeName(leaf.name, placeholders), path }));

/** The entries a run with no playthrough reads: every authored entity with nothing chosen, each with its
 *  owner node. No persona plays. */
export const unplayedEntities = (
  entities: readonly CodeEntityNames[], owners: ReadonlyMap<string, SandboxPlaceholderNode>,
): SandboxEntity[] => entities.map(({ id, name, traits }) => ({
  id, name, traits: traits.map((trait) => ({ name: trait.name, enabled: false, acquired: false })), placeholders: owners.get(id),
}));

/** Whose trait maps hold one trait: the world's `traits`, the persona's, and each entity's by code name. */
export interface TraitHolders {
  world: boolean;
  persona: boolean;
  entities: readonly string[];
}

/** Whose trait maps hold a trait, as the editor reads the world: the world's own `traits` when it is a world
 *  trait, each entity whose set holds it owned or linked, and `persona` when one of those can be played. */
export function traitHolders(world: BearerWorld, placeholders: readonly Placeholder[], traitId: string): TraitHolders {
  const codeNameOf = (trait: Trait, entity: Entity) =>
    statCodeName(authoredTraitName(trait, entity, world.traits), withOwnPlaceholders(placeholders, entity));
  const bearers = resolveBearers(world, undefined).bearers.flatMap((bearer) => (bearer.entity ? [{ entity: bearer.entity, traits: bearer.traits }] : []));
  const holding = bearers.flatMap(({ entity, traits }) => {
    const trait = traits.find((t) => t.id === traitId);
    return trait ? [{ entity, trait }] : [];
  });
  const playable = holding.find(({ entity }) => canBePlayer(entity));
  const oldName = playable && codeNameOf(playable.trait, playable.entity);
  // Another playable entity holding a different trait under the old name may be the one played.
  const sharedName = bearers.some(({ entity, traits }) => canBePlayer(entity)
    && traits.some((trait) => trait.id !== traitId && codeNameOf(trait, entity) === oldName));
  return {
    world: world.traits.some((trait) => trait.id === traitId),
    persona: !!playable && !sharedName,
    entities: holding.map(({ entity }) => statCodeName(entity.name, withOwnPlaceholders(placeholders, entity))),
  };
}
