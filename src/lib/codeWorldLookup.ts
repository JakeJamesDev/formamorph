/**
 * What one stat code box can ask the world when a card opens. Bound to the box, so `self` and `owner` name
 * that box's stat and owner. Every record holds what code reads at run time: a Link's or a Copy's Overrides,
 * then its Blueprint.
 */

import type { Dictionary, Entity, EntityGroup, GameLocation, Placeholder, ScriptTiming, Stat, StatGroup, Trait, TraitGroup } from '@/types';
import { effectiveCopy } from './blueprints';
import { editorGateInput, resolveOwners, type OwnerWorld } from './owners';
import { startingGateStats } from './gateStats';
import { pinsTargeting, type PinEditorWorld } from './placeholderPins';
import type { CodeCardItem } from './codeCards';
import { itemUses } from './codeItemUses';
import { statUses } from './codeStatUses';
import type { CodeUse } from './codeUses';
import { blueprintGroupStats } from './statLinks';
import { placeholderPathMap } from './statCodePaths';
import { codeDictionaries } from './statCodePlaceholders';
import type { StatOwner, TraitOwner } from './statCodeResolver';
import { blueprintTraitRunners, overridesScripts, statCodeOwners, type CodeOwner, type CodeOwners, type WorldScriptsSource, type WorldToolsSource } from './statCodeTargets';
import { entityTraitNames, worldTraitPlaces } from './statCodeTraits';
import { conditionTexts, gateTrees } from './traitGates';

/** Where an item no single entity owns lives: global scope, the world's placeholder tree, or under Blueprints. */
export type CodeItemScope = 'global' | 'world' | 'blueprint';

/** A stat as a card shows it. */
export interface CodeStatRecord {
  /** Null where the route reaches several unrelated stats, so only their owners show (Q34). */
  stat: Stat | null;
  /** Set for a global stat and a Blueprint box's own stats. */
  scope?: Extract<CodeItemScope, 'global' | 'blueprint'>;
  /** The entity, each playable entity the route reaches, or the entities that run a Blueprint box. Empty for a global stat. */
  owners: readonly string[];
  /** The entity that owns the stat. Absent for a global or Blueprint stat. */
  entityId?: string;
}

/** A trait as a card shows it: the owner's effective trait and its rows already worded. */
export interface CodeTraitRecord {
  trait: Trait;
  /** Set for a global trait, which no entity owns. */
  scope?: Extract<CodeItemScope, 'global'>;
  /** The entity that owns the trait. Absent for a global trait or one a Link brings. */
  entityId?: string;
  /** Each Requirement Row's Conditions, in the gate rows' wording. */
  requires: readonly (readonly string[])[];
  /** Each stat change and stat switch, as "Stamina max +10" or "Fatigue off". */
  changes: readonly string[];
  /** **You**, then each entity whose tree has the trait; on a route over several entities, the reached owners. */
  owners: readonly string[];
}

/** A placeholder as a card shows it: a Copy laid over its Blueprint. */
export interface CodePlaceholderRecord {
  placeholder: Placeholder;
  /** Set for a world placeholder, which no entity or dictionary owns. */
  scope?: Extract<CodeItemScope, 'world'>;
  /** The entity or dictionary that owns it, or on a route over several entities, the ones it reaches that own it.
   *  Empty for a placeholder in the world's tree. */
  owners: readonly string[];
  /** The parent placeholder of a nested placeholder (Q7). */
  parent?: string;
  /** Each Pin on it in precedence order, as "Trait: Brave: calm". */
  pins: readonly string[];
}

/** A route over several entities whose owners have different items, so only the owners show (Q37). */
export interface CodeOwnersRecord {
  trait?: null;
  placeholder?: null;
  owners: readonly string[];
}

/** One entity a placeholder route over several entities reaches, and what it owns there. */
export interface CodePlaceholderOwner {
  entityId: string;
  placeholder: Placeholder;
}

export interface CodeEntityRecord {
  entity: Entity;
  stats: readonly string[];
  traits: readonly string[];
  placeholders: readonly string[];
}

export interface CodeDictionaryRecord {
  dictionary: Dictionary;
  placeholders: readonly string[];
}

export interface CodeLocationRecord {
  location: GameLocation;
  /** The entities placed at the location, by code name. */
  present: readonly string[];
}

/** What `owner` holds in the box. */
export type CodeOwnerRecord =
  | { kind: 'empty' }
  | { kind: 'entity'; entity: CodeEntityRecord }
  | { kind: 'blueprint'; owners: readonly string[] };

export interface CodeWorldLookup {
  /** The stat the box belongs to. */
  self(): CodeStatRecord & { stat: Stat };
  /** Null in an owned box whose entity the world no longer has. */
  owner(): CodeOwnerRecord | null;
  /** The ids of the entities `owner` holds across the box's runs: the entity, or each owner. */
  ownerEntityIds(): readonly string[];
  /** The stat `key` names on `owner`'s map, or null where the map has no such stat. */
  stat(owner: StatOwner, key: string): CodeStatRecord | null;
  /** On a route over several entities, the trait every owner shares, or only the owners (Q37). */
  trait(owner: TraitOwner, key: string): CodeTraitRecord | CodeOwnersRecord | null;
  /** Each owner's trait, for a route that reaches several entities. */
  traits(owner: TraitOwner, key: string): CodeTraitRecord[];
  placeholder(placeholder: Placeholder): CodePlaceholderRecord | null;
  /** The placeholder every owner shares, one Copy or the Blueprint of all, or only the owners (Q37). */
  ownedPlaceholder(reached: readonly CodePlaceholderOwner[]): CodePlaceholderRecord | CodeOwnersRecord | null;
  entity(key: string): CodeEntityRecord | null;
  dictionary(key: string): CodeDictionaryRecord | null;
  /** The location `location.move` reaches by `key`, its code name or id. */
  location(key: string): CodeLocationRecord | null;
  /** The entities the player can play. */
  persona(): readonly string[];
  /** Every box and line whose code reaches the item. */
  uses(item: CodeCardItem): CodeUse[];
}

/** Whose code a box holds: an entity's own stat or Link, or a Blueprint stat. */
export type CodeBoxOwner = { kind: 'entity'; entityId: string } | { kind: 'blueprint' };

export interface CodeBox {
  /** Null for a global stat. */
  owner: CodeBoxOwner | null;
  timing: ScriptTiming;
  /** The box's stat under its code name, as the editor holds it now. */
  self: Stat;
  /** A trait box's trait. A Blueprint trait's owners are the entities whose links run its scripts. */
  traitId?: string;
}

/** A trait box's `self` in a lookup that takes a stat: nothing reads it as one, since a trait's `self` card is
 *  the trait's own. */
export const traitBoxSelf = (id: string, name: string): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 0, regen: 0, descriptors: [] });

/** The authored world a stat code box's cards read. */
export interface CodeCardWorld extends PinEditorWorld, WorldScriptsSource, WorldToolsSource {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  entityGroups?: readonly EntityGroup[];
  statGroups?: readonly StatGroup[];
  dictionaries?: readonly Dictionary[];
  /** Absent ⇒ none. */
  locations?: readonly GameLocation[];
}

/** Each box's lookup over `world`. The world's owners resolve once, on the first card any box opens. */
export function statBoxLookups(world: CodeCardWorld): (box: CodeBox) => CodeWorldLookup {
  let owners: CodeOwners | undefined;
  const ownersOf = () => (owners ??= statCodeOwners(world));
  return (box) => lazyLookup(() => statBoxLookup(ownersOf(), box, world));
}

const UNNAMED = 'Unnamed entity';

/** A lookup that builds on its first question, so a box no card opens on never resolves the world. */
export function lazyLookup(make: () => CodeWorldLookup): CodeWorldLookup {
  let made: CodeWorldLookup | undefined;
  const at = () => (made ??= make());
  return {
    self: () => at().self(),
    owner: () => at().owner(),
    ownerEntityIds: () => at().ownerEntityIds(),
    stat: (owner, key) => at().stat(owner, key),
    trait: (owner, key) => at().trait(owner, key),
    traits: (owner, key) => at().traits(owner, key),
    placeholder: (placeholder) => at().placeholder(placeholder),
    ownedPlaceholder: (reached) => at().ownedPlaceholder(reached),
    entity: (key) => at().entity(key),
    dictionary: (key) => at().dictionary(key),
    location: (key) => at().location(key),
    persona: () => at().persona(),
    uses: (item) => at().uses(item),
  };
}

const signedAmount = (n: number, unit: string) => (n < 0 ? `−${-n}${unit}` : `+${n}${unit}`);

/** Everything trait, placeholder, entity and dictionary cards read, built once per lookup. */
function cardIndex(owners: CodeOwners, world: CodeCardWorld) {
  const { placeholders } = world;
  const ownerWorld: OwnerWorld = { traits: world.traits, traitGroups: world.traitGroups, entities: world.entities };
  const named = new Map(entityTraitNames(ownerWorld, placeholders).map((entity) => [entity.id, entity]));
  const ownerById = new Map(resolveOwners(ownerWorld, undefined).owners.map((owner) => [owner.id, owner]));
  const gate = editorGateInput(ownerWorld, startingGateStats({ stats: world.stats, statGroups: world.statGroups, entities: world.entities }));
  const textOf = conditionTexts(gate);
  // Later names win, as the sandbox's map keys them.
  const worldTraits = new Map(worldTraitPlaces(ownerWorld, placeholders).map((place) => [place.name, place.id]));
  const map = placeholderPathMap({ list: placeholders, owners: world.placeholderOwners });
  const books = codeDictionaries(world.dictionaries, placeholders);
  const stats = new Map([...owners.statWorld.stats, ...world.entities.flatMap((entity) => entity.stats ?? [])].map((stat) => [stat.id, stat]));

  const statName = (id: string) => {
    const stat = stats.get(id);
    return stat ? owners.codeName(stat.name) : 'a missing stat';
  };
  const changesOf = (trait: Trait): string[] => [
    ...trait.statChanges.map((change) => {
      const unit = stats.get(change.statId)?.type === 'percentage' ? '%' : '';
      return `${statName(change.statId)}${change.type ? ` ${change.type}` : ''} ${signedAmount(change.value, unit)}`;
    }),
    ...(trait.statToggles ?? []).map((toggle) => `${statName(toggle.statId)} ${toggle.enabled ? 'on' : 'off'}`),
  ];
  const nameOf = (entityId: string) => named.get(entityId)?.name || UNNAMED;
  const traitRecord = (trait: Trait, entityId?: string): CodeTraitRecord => ({
    trait,
    ...(entityId ? { entityId } : {}),
    requires: (trait.requires ?? []).map((row) => row.all.map(textOf)),
    changes: changesOf(trait),
    // Entity owners only: global scope holds a Blueprint trait too, and is never an owner (Q8).
    owners: gateTrees(gate).flatMap((owner) => (owner.id !== null && owner.traits.some((held) => held.id === trait.id) ? [nameOf(owner.id)] : [])),
  });
  const placeholderNames = (ownerId: string) => map.owners.get(ownerId)?.children.map((child) => child.name) ?? [];

  return {
    entityName: nameOf,
    /** The one placeholder `held` reads: the same one, or the Blueprint every Copy in it shares. */
    sharedPlaceholder(held: readonly Placeholder[]): Placeholder | null {
      const [first] = held;
      if (held.every((placeholder) => placeholder.id === first.id)) return first;
      const family = (placeholder: Placeholder) => placeholder.blueprintId ?? placeholder.id;
      if (!held.every((placeholder) => family(placeholder) === family(first))) return null;
      return placeholders.find((candidate) => candidate.id === family(first)) ?? null;
    },
    worldTrait(key: string): CodeTraitRecord | null {
      const trait = world.traits.find((candidate) => candidate.id === worldTraits.get(key));
      return trait ? { ...traitRecord(trait), scope: 'global' as const } : null;
    },
    /** The trait `key` names in one entity's set, owned or linked. */
    entityTrait(entityId: string, key: string): CodeTraitRecord | null {
      const place = named.get(entityId)?.traits.findLast((candidate) => candidate.name === key);
      const owner = ownerById.get(entityId);
      const trait = place && owner?.traits.find((candidate) => candidate.id === place.id);
      if (!trait) return null;
      const owned = owner?.entity?.traits?.some((candidate) => candidate.id === trait.id);
      return traitRecord(trait, owned ? entityId : undefined);
    },
    /** `reached` replaces the placeholder's own owner on a route over several entities. */
    placeholder(placeholder: Placeholder, reached?: readonly string[]): CodePlaceholderRecord {
      const blueprint = placeholder.blueprintId ? placeholders.find((candidate) => candidate.id === placeholder.blueprintId) : undefined;
      const effective = blueprint ? effectiveCopy(placeholder, blueprint) : placeholder;
      const home = world.placeholderOwners?.get(placeholder.id);
      const parent = placeholder.ownerId ? placeholders.find((candidate) => candidate.id === placeholder.ownerId) : undefined;
      const valueText = (valueId: string | undefined, value: string) => effective.values.find((v) => v.id === valueId)?.text ?? value;
      const owned = reached ?? (home ? [owners.codeName(home.name)] : []);
      return {
        placeholder: effective,
        ...(!reached && !home ? { scope: 'world' as const } : {}),
        owners: owned,
        ...(parent ? { parent: owners.codeName(parent.name) } : {}),
        pins: pinsTargeting(world, placeholder.id).map((row) => `${row.label}: ${valueText(row.pin.valueId, row.pin.value)}`),
      };
    },
    /** The trait and placeholder names one entity's maps hold. */
    entityNames(entityId: string): Pick<CodeEntityRecord, 'traits' | 'placeholders'> {
      return { traits: named.get(entityId)?.traits.map((trait) => trait.name) ?? [], placeholders: placeholderNames(entityId) };
    },
    dictionary(key: string): CodeDictionaryRecord | null {
      const id = books.findLast((book) => book.name === key)?.id;
      const dictionary = world.dictionaries?.find((book) => book.id === id);
      return dictionary ? { dictionary, placeholders: placeholderNames(dictionary.id) } : null;
    },
    /** The id wins over a name, as `location.move` finds it; the first location wins a shared name. */
    location(key: string): CodeLocationRecord | null {
      const places = world.locations ?? [];
      const location = places.find((place) => place.id === key) ?? places.find((place) => owners.codeName(place.name) === key);
      if (!location) return null;
      const present = world.entities.filter((entity) => entity.locations?.includes(location.id)).map((entity) => owners.codeName(entity.name));
      return { location, present };
    },
  };
}

type CardIndex = ReturnType<typeof cardIndex>;
const cardIndexes = new WeakMap<CodeCardWorld, WeakMap<CodeOwners, CardIndex>>();

/** One index per world and owners, so a scan that binds a lookup to every box builds it once. */
function sharedCardIndex(owners: CodeOwners, world: CodeCardWorld): CardIndex {
  let byOwners = cardIndexes.get(world);
  if (!byOwners) cardIndexes.set(world, byOwners = new WeakMap());
  let index = byOwners.get(owners);
  if (!index) byOwners.set(owners, index = cardIndex(owners, world));
  return index;
}

/** A lookup over `owners`, bound to `box`. Without `world`, cards on traits, placeholders and dictionaries
 *  get no World Details, and an entity's lists hold its stats only. */
export function statBoxLookup(owners: CodeOwners, box: CodeBox, world?: CodeCardWorld): CodeWorldLookup {
  const entityName = (owner: CodeOwner | null) => (owner?.entity && owners.codeName(owner.entity.name)) || UNNAMED;
  const boxEntityId = box.owner?.kind === 'entity' ? box.owner.entityId : null;
  const entityOwner = boxEntityId === null ? null : owners.all.find((owner) => owner.entity?.id === boxEntityId) ?? null;
  const boxOwnerName = entityName(entityOwner);

  // An owner runs a Blueprint box unless its Link overrides that box.
  let running: readonly (CodeOwner & { entity: Entity })[] | undefined;
  const runningOwners = () => (running ??= (() => {
    if (box.traitId !== undefined) return world ? blueprintTraitRunners(owners, world, box.traitId) : [];
    const original = owners.statWorld.stats.find((stat) => stat.id === box.self.id);
    if (!original) return [];
    return owners.all.flatMap((owner) => {
      const link = owner.linkOf.get(original.id);
      return owner.entity && link && !overridesScripts(link, original) ? [{ ...owner, entity: owner.entity }] : [];
    });
  })());
  const runningOwnerNames = () => runningOwners().map(entityName);

  let groupMap: ReadonlyMap<string, Stat> | undefined;
  const blueprintGroup = () => (groupMap ??= owners.byCodeName(blueprintGroupStats(owners.statWorld, box.self)));

  const cards = () => (world ? sharedCardIndex(owners, world) : null);

  const onEntity = (owner: CodeOwner, key: string): CodeStatRecord | null => {
    const stat = owner.byCodeName.get(key);
    return stat && owner.entity ? { stat, owners: [entityName(owner)], entityId: owner.entity.id } : null;
  };
  const entityRecord = (owner: CodeOwner & { entity: Entity }): CodeEntityRecord => ({
    entity: owner.entity,
    stats: [...owner.byCodeName.keys()],
    ...cards()?.entityNames(owner.entity.id) ?? { traits: [], placeholders: [] },
  });

  const ownerEntityIds = (): readonly string[] => {
    if (!box.owner) return [];
    if (box.owner.kind === 'blueprint') return runningOwners().map((owner) => owner.entity.id);
    return [box.owner.entityId];
  };
  /** Each of `entityIds` whose set has a trait `key` names, in that order, with that trait. */
  const ownersWithTrait = (entityIds: readonly string[], key: string): { name: string; record: CodeTraitRecord }[] => {
    const index = cards();
    return index ? entityIds.flatMap((id) => {
      const record = index.entityTrait(id, key);
      return record ? [{ name: index.entityName(id), record }] : [];
    }) : [];
  };
  const traitsOn = (entityIds: readonly string[], key: string) => ownersWithTrait(entityIds, key).map((found) => found.record);
  /** The entities `persona` or `owner` reaches, where there are two or more (T15-1). */
  const severalReached = (route: TraitOwner['route']): readonly string[] | null => {
    const reached = route === 'persona' ? owners.playable.map((target) => target.entity.id) : route === 'owner' ? ownerEntityIds() : [];
    return reached.length > 1 ? reached : null;
  };
  const traits = (owner: TraitOwner, key: string): CodeTraitRecord[] => {
    switch (owner.route) {
      case 'world': {
        const record = cards()?.worldTrait(key);
        return record ? [record] : [];
      }
      case 'owner': return traitsOn(ownerEntityIds(), key);
      case 'entity': {
        const target = owners.byName.get(owner.entity);
        return target ? traitsOn([target.entity.id], key) : [];
      }
      case 'persona': return traitsOn(owners.playable.map((target) => target.entity.id), key);
    }
  };

  return {
    self() {
      if (!box.owner) return { stat: box.self, scope: 'global', owners: [] };
      if (box.owner.kind === 'blueprint') return { stat: box.self, scope: 'blueprint', owners: runningOwnerNames() };
      return { stat: box.self, owners: [boxOwnerName], entityId: box.owner.entityId };
    },
    owner() {
      if (!box.owner) return { kind: 'empty' };
      if (box.owner.kind === 'blueprint') return { kind: 'blueprint', owners: runningOwnerNames() };
      if (!entityOwner?.entity) return null;
      return { kind: 'entity', entity: entityRecord({ ...entityOwner, entity: entityOwner.entity }) };
    },
    ownerEntityIds,
    stat(owner, key) {
      switch (owner.route) {
        case 'world': {
          const stat = owners.world.byCodeName.get(key);
          return stat ? { stat, scope: 'global', owners: [] } : null;
        }
        case 'owner': {
          if (!box.owner) return null;
          if (box.owner.kind === 'blueprint') {
            const stat = blueprintGroup().get(key);
            return stat ? { stat, scope: 'blueprint', owners: runningOwnerNames() } : null;
          }
          return entityOwner && onEntity(entityOwner, key);
        }
        case 'entity': {
          const target = owners.byName.get(owner.entity);
          return target ? onEntity(target, key) : null;
        }
        case 'persona': {
          // One playable entity is no route over several: its stat reads as `entities[...]` reads it (T15-1).
          if (owners.playable.length === 1) return onEntity(owners.playable[0], key);
          // Values show only where every owner links one Blueprint stat, which then supplies them (Q34).
          const withStat = owners.playable.flatMap((target) => {
            const stat = target.byCodeName.get(key);
            return stat ? [{ owner: target, stat }] : [];
          });
          if (!withStat.length) return null;
          // A linked stat keeps its Blueprint's id, which no own stat shares.
          const id = withStat[0].stat.id;
          const shared = withStat.every((found) => found.stat.id === id);
          return { stat: shared ? owners.statWorld.stats.find((stat) => stat.id === id) ?? null : null, owners: withStat.map((found) => entityName(found.owner)) };
        }
      }
    },
    trait(owner, key) {
      const reached = severalReached(owner.route);
      if (!reached) return traits(owner, key)[0] ?? null;
      const found = ownersWithTrait(reached, key);
      if (!found.length) return null;
      const names = found.map((each) => each.name);
      const [{ record }] = found;
      return found.every((each) => each.record.trait.id === record.trait.id) ? { ...record, owners: names } : { trait: null, owners: names };
    },
    traits,
    placeholder: (placeholder) => cards()?.placeholder(placeholder) ?? null,
    ownedPlaceholder(reached) {
      const index = cards();
      if (!index || !reached.length) return null;
      const names = reached.map((each) => index.entityName(each.entityId));
      const shared = index.sharedPlaceholder(reached.map((each) => each.placeholder));
      return shared ? index.placeholder(shared, names) : { placeholder: null, owners: names };
    },
    entity(key) {
      const target = owners.byName.get(key);
      return target ? entityRecord(target) : null;
    },
    dictionary: (key) => cards()?.dictionary(key) ?? null,
    location: (key) => cards()?.location(key) ?? null,
    persona: () => owners.playable.map(entityName),
    uses: (item) => {
      if (item.kind === 'stat') return statUses(owners, item, world);
      // Other kinds are read the way their cards are, so they need the world beyond its stats.
      return world ? itemUses(owners, world, item, (other) => statBoxLookup(owners, other, world)) : [];
    },
  };
}
