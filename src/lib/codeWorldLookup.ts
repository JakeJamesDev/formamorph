/**
 * What one stat code box can ask the world when a card opens. Bound to the box, so `self` and `owner` name
 * that box's stat and owner. Every record holds what code reads at run time: a Link's or a Copy's Overrides,
 * then its Blueprint.
 */

import type { Dictionary, Entity, Placeholder, Stat, StatGroup, Trait, TraitGroup } from '@/types';
import { effectiveCopy } from './blueprints';
import { editorGateInput, resolveBearers, type BearerWorld } from './bearers';
import { startingGateStats } from './gateStats';
import { pinsTargeting, type PinEditorWorld } from './placeholderPins';
import type { CodeCardItem } from './codeCards';
import { itemUses } from './codeItemUses';
import { statUses, type CodeStatUse } from './codeStatUses';
import { blueprintGroupStats } from './statLinks';
import { placeholderPathMap } from './statCodePaths';
import { codeDictionaries } from './statCodePlaceholders';
import type { StatOwner, TraitOwner } from './statCodeResolver';
import { overridesBox, type CodeOwner, type CodeOwners } from './statCodeTargets';
import type { StatCodeTiming } from './statCodeTiming';
import { entityTraitNames, worldTraitPlaces } from './statCodeTraits';
import { conditionTexts, WORLD_OWNER } from './traitGates';

/** A stat as a card shows it. */
export interface CodeStatRecord {
  /** Null where the route reaches several unrelated stats, so only their owners show (Q34). */
  stat: Stat | null;
  /** The Owner row: the entity's name, World, Blueprint, or every playable entity that has the stat. */
  owner: string;
  /** The entity that holds the stat. Absent for a world or Blueprint stat. */
  entityId?: string;
  /** Who runs the box's code: set for a Blueprint box's own stats. */
  bearers?: readonly string[];
}

/** A trait as a card shows it: the bearer's effective trait and its rows already worded. */
export interface CodeTraitRecord {
  trait: Trait;
  /** The entity that owns the trait. Absent for a world trait or one a Link brings. */
  entityId?: string;
  /** Each Requirement Row's Conditions, in the gate rows' wording. */
  requires: readonly (readonly string[])[];
  /** Each stat change and stat switch, as "Stamina max +10" or "Fatigue off". */
  changes: readonly string[];
  /** **You**, then each entity whose tree has the trait; on a route over several entities, the reached holders. */
  bearers: readonly string[];
}

/** A placeholder as a card shows it: a Copy laid over its Blueprint. */
export interface CodePlaceholderRecord {
  placeholder: Placeholder;
  /** World, or the entity, dictionary or placeholder that owns it. */
  owner: string;
  /** Each Pin on it in precedence order, as "Trait: Brave: calm". */
  pins: readonly string[];
  /** On a route over several entities, the ones it reaches that hold it. */
  bearers?: readonly string[];
}

/** A route over several entities whose holders hold different items, so only the holders show (Q37). */
export interface CodeHoldersRecord {
  trait?: null;
  placeholder?: null;
  bearers: readonly string[];
}

/** One entity a placeholder route over several entities reaches, and what it holds there. */
export interface CodePlaceholderHolder {
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

/** What `owner` holds in the box. */
export type CodeOwnerRecord =
  | { kind: 'empty' }
  | { kind: 'entity'; entity: CodeEntityRecord }
  | { kind: 'blueprint'; bearers: readonly string[] };

export interface CodeWorldLookup {
  /** The stat the box belongs to. */
  self(): CodeStatRecord & { stat: Stat };
  /** Null in an owned box whose entity the world no longer has. */
  owner(): CodeOwnerRecord | null;
  /** The ids of the entities `owner` holds across the box's runs: the entity, or each bearer. */
  ownerEntityIds(): readonly string[];
  /** The stat `key` names on `owner`'s map, or null where the map has no such stat. */
  stat(owner: StatOwner, key: string): CodeStatRecord | null;
  /** On a route over several entities, the trait every holder shares, or only the holders (Q37). */
  trait(owner: TraitOwner, key: string): CodeTraitRecord | CodeHoldersRecord | null;
  /** Each holder's trait, for a route that reaches several entities. */
  traits(owner: TraitOwner, key: string): CodeTraitRecord[];
  placeholder(placeholder: Placeholder): CodePlaceholderRecord | null;
  /** The placeholder every holder shares, one Copy or the Blueprint of all, or only the holders (Q37). */
  heldPlaceholder(holders: readonly CodePlaceholderHolder[]): CodePlaceholderRecord | CodeHoldersRecord | null;
  entity(key: string): CodeEntityRecord | null;
  dictionary(key: string): CodeDictionaryRecord | null;
  /** The entities the player can play. */
  persona(): readonly string[];
  /** Every box and line whose code reaches the item. */
  uses(item: CodeCardItem): CodeStatUse[];
}

/** Whose code a box holds: an entity's own stat or Link, or a Blueprint stat. */
export type CodeBoxOwner = { kind: 'entity'; entityId: string } | { kind: 'blueprint' };

export interface CodeBox {
  /** Null for a world stat. */
  owner: CodeBoxOwner | null;
  timing: StatCodeTiming;
  /** The box's stat under its code name, as the editor holds it now. */
  self: Stat;
}

/** The authored world beyond its stats, for trait, placeholder, entity and dictionary cards. */
export interface CodeCardWorld extends PinEditorWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  statGroups?: readonly StatGroup[];
  dictionaries?: readonly Dictionary[];
}

const WORLD = 'World';
const BLUEPRINT = 'Blueprint';
const UNNAMED = 'Unnamed entity';
const YOU = 'You';

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
    heldPlaceholder: (holders) => at().heldPlaceholder(holders),
    entity: (key) => at().entity(key),
    dictionary: (key) => at().dictionary(key),
    persona: () => at().persona(),
    uses: (item) => at().uses(item),
  };
}

const signedAmount = (n: number, unit: string) => (n < 0 ? `−${-n}${unit}` : `+${n}${unit}`);

/** Everything trait, placeholder, entity and dictionary cards read, built once per lookup. */
function cardIndex(owners: CodeOwners, world: CodeCardWorld) {
  const { placeholders } = world;
  const bearerWorld: BearerWorld = { traits: world.traits, traitGroups: world.traitGroups, entities: world.entities };
  const named = new Map(entityTraitNames(bearerWorld, placeholders).map((entity) => [entity.id, entity]));
  const bearers = new Map(resolveBearers(bearerWorld, undefined).bearers.map((bearer) => [bearer.id, bearer]));
  const gate = editorGateInput(bearerWorld, startingGateStats({ stats: world.stats, statGroups: world.statGroups, entities: world.entities }));
  const textOf = conditionTexts(gate);
  // Later names win, as the sandbox's map keys them.
  const worldTraits = new Map(worldTraitPlaces(bearerWorld, placeholders).map((place) => [place.name, place.id]));
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
    bearers: gate.owners
      .filter((owner) => owner.traits.some((held) => held.id === trait.id))
      .map((owner) => (owner.id === WORLD_OWNER ? YOU : nameOf(owner.id))),
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
      return trait ? traitRecord(trait) : null;
    },
    /** The trait `key` names in one entity's set, owned or linked. */
    entityTrait(entityId: string, key: string): CodeTraitRecord | null {
      const place = named.get(entityId)?.traits.findLast((candidate) => candidate.name === key);
      const bearer = bearers.get(entityId);
      const trait = place && bearer?.traits.find((candidate) => candidate.id === place.id);
      if (!trait) return null;
      const owned = bearer?.entity?.traits?.some((candidate) => candidate.id === trait.id);
      return traitRecord(trait, owned ? entityId : undefined);
    },
    placeholder(placeholder: Placeholder): CodePlaceholderRecord {
      const blueprint = placeholder.blueprintId ? placeholders.find((candidate) => candidate.id === placeholder.blueprintId) : undefined;
      const effective = blueprint ? effectiveCopy(placeholder, blueprint) : placeholder;
      const home = world.placeholderOwners?.get(placeholder.id);
      const holder = placeholder.ownerId ? placeholders.find((candidate) => candidate.id === placeholder.ownerId) : undefined;
      const valueText = (valueId: string | undefined, value: string) => effective.values.find((v) => v.id === valueId)?.text ?? value;
      return {
        placeholder: effective,
        owner: home ? owners.codeName(home.name) : holder ? owners.codeName(holder.name) : WORLD,
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

  // A bearer runs a Blueprint box unless its Link overrides that box.
  let bearers: readonly (CodeOwner & { entity: Entity })[] | undefined;
  const bearerOwners = () => (bearers ??= (() => {
    const original = owners.statWorld.stats.find((stat) => stat.id === box.self.id);
    if (!original) return [];
    return owners.all.flatMap((owner) => {
      const link = owner.linkOf.get(original.id);
      return owner.entity && link && !overridesBox(link, original, box.timing) ? [{ ...owner, entity: owner.entity }] : [];
    });
  })());
  const bearersOf = () => bearerOwners().map(entityName);

  let groupMap: ReadonlyMap<string, Stat> | undefined;
  const blueprintGroup = () => (groupMap ??= owners.byCodeName(blueprintGroupStats(owners.statWorld, box.self)));

  const cards = () => (world ? sharedCardIndex(owners, world) : null);

  const onEntity = (owner: CodeOwner, key: string): CodeStatRecord | null => {
    const stat = owner.byCodeName.get(key);
    return stat && owner.entity ? { stat, owner: entityName(owner), entityId: owner.entity.id } : null;
  };
  const entityRecord = (owner: CodeOwner & { entity: Entity }): CodeEntityRecord => ({
    entity: owner.entity,
    stats: [...owner.byCodeName.keys()],
    ...cards()?.entityNames(owner.entity.id) ?? { traits: [], placeholders: [] },
  });

  const ownerEntityIds = (): readonly string[] => {
    if (!box.owner) return [];
    if (box.owner.kind === 'blueprint') return bearerOwners().map((owner) => owner.entity.id);
    return [box.owner.entityId];
  };
  /** Each of `entityIds` whose set has a trait `key` names, in that order, with that trait. */
  const holdersOf = (entityIds: readonly string[], key: string): { name: string; record: CodeTraitRecord }[] => {
    const index = cards();
    return index ? entityIds.flatMap((id) => {
      const record = index.entityTrait(id, key);
      return record ? [{ name: index.entityName(id), record }] : [];
    }) : [];
  };
  const traitsOn = (entityIds: readonly string[], key: string) => holdersOf(entityIds, key).map((holder) => holder.record);
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
      if (!box.owner) return { stat: box.self, owner: WORLD };
      if (box.owner.kind === 'blueprint') return { stat: box.self, owner: BLUEPRINT, bearers: bearersOf() };
      return { stat: box.self, owner: boxOwnerName, entityId: box.owner.entityId };
    },
    owner() {
      if (!box.owner) return { kind: 'empty' };
      if (box.owner.kind === 'blueprint') return { kind: 'blueprint', bearers: bearersOf() };
      if (!entityOwner?.entity) return null;
      return { kind: 'entity', entity: entityRecord({ ...entityOwner, entity: entityOwner.entity }) };
    },
    ownerEntityIds,
    stat(owner, key) {
      switch (owner.route) {
        case 'world': {
          const stat = owners.world.byCodeName.get(key);
          return stat ? { stat, owner: WORLD } : null;
        }
        case 'owner': {
          if (!box.owner) return null;
          if (box.owner.kind === 'blueprint') {
            const stat = blueprintGroup().get(key);
            return stat ? { stat, owner: BLUEPRINT, bearers: bearersOf() } : null;
          }
          return entityOwner && onEntity(entityOwner, key);
        }
        case 'entity': {
          const target = owners.byName.get(owner.entity);
          return target ? onEntity(target, key) : null;
        }
        case 'persona': {
          // Values show only where every holder links one Blueprint stat, which then supplies them (Q34).
          const holders = owners.playable.flatMap((target) => {
            const stat = target.byCodeName.get(key);
            return stat ? [{ owner: target, stat }] : [];
          });
          if (!holders.length) return null;
          const owner = holders.map((holder) => entityName(holder.owner)).join(', ');
          // A linked stat keeps its Blueprint's id, which no own stat shares.
          const id = holders[0].stat.id;
          const shared = holders.every((holder) => holder.stat.id === id);
          return { stat: shared ? owners.statWorld.stats.find((stat) => stat.id === id) ?? null : null, owner };
        }
      }
    },
    trait(owner, key) {
      const reached = severalReached(owner.route);
      if (!reached) return traits(owner, key)[0] ?? null;
      const holders = holdersOf(reached, key);
      if (!holders.length) return null;
      const bearers = holders.map((holder) => holder.name);
      const [{ record }] = holders;
      return holders.every((holder) => holder.record.trait.id === record.trait.id) ? { ...record, bearers } : { trait: null, bearers };
    },
    traits,
    placeholder: (placeholder) => cards()?.placeholder(placeholder) ?? null,
    heldPlaceholder(holders) {
      const index = cards();
      if (!index || !holders.length) return null;
      const bearers = holders.map((holder) => index.entityName(holder.entityId));
      const shared = index.sharedPlaceholder(holders.map((holder) => holder.placeholder));
      return shared ? { ...index.placeholder(shared), bearers } : { placeholder: null, bearers };
    },
    entity(key) {
      const target = owners.byName.get(key);
      return target ? entityRecord(target) : null;
    },
    dictionary: (key) => cards()?.dictionary(key) ?? null,
    persona: () => owners.playable.map(entityName),
    uses: (item) => {
      if (item.kind === 'stat') return statUses(owners, item);
      // Other kinds are read the way their cards are, so they need the world beyond its stats.
      return world ? itemUses(owners, world, item, (other) => statBoxLookup(owners, other, world)) : [];
    },
  };
}
