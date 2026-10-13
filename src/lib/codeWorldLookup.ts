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
  /** **You** for the player, then each entity whose tree has the trait. */
  bearers: readonly string[];
}

/** A placeholder as a card shows it: a Copy laid over its Blueprint. */
export interface CodePlaceholderRecord {
  placeholder: Placeholder;
  /** World, or the entity, dictionary or placeholder that owns it. */
  owner: string;
  /** Each Pin on it in precedence order, as "Trait: Brave: calm". */
  pins: readonly string[];
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
  trait(owner: TraitOwner, key: string): CodeTraitRecord | null;
  placeholder(placeholder: Placeholder): CodePlaceholderRecord | null;
  entity(key: string): CodeEntityRecord | null;
  dictionary(key: string): CodeDictionaryRecord | null;
  /** The entities the player can play. */
  persona(): readonly string[];
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
    placeholder: (placeholder) => at().placeholder(placeholder),
    entity: (key) => at().entity(key),
    dictionary: (key) => at().dictionary(key),
    persona: () => at().persona(),
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

  let index: ReturnType<typeof cardIndex> | undefined;
  const cards = () => (world ? (index ??= cardIndex(owners, world)) : null);

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
  /** The first of `entityIds` whose set has the trait `key` names. */
  const traitOn = (entityIds: readonly string[], key: string) => {
    const index = cards();
    for (const id of entityIds) {
      const record = index?.entityTrait(id, key);
      if (record) return record;
    }
    return null;
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
      switch (owner.route) {
        case 'world': return cards()?.worldTrait(key) ?? null;
        case 'owner': return traitOn(ownerEntityIds(), key);
        case 'entity': {
          const target = owners.byName.get(owner.entity);
          return target ? traitOn([target.entity.id], key) : null;
        }
        case 'persona': return traitOn(owners.playable.map((target) => target.entity.id), key);
      }
    },
    placeholder: (placeholder) => cards()?.placeholder(placeholder) ?? null,
    entity(key) {
      const target = owners.byName.get(key);
      return target ? entityRecord(target) : null;
    },
    dictionary: (key) => cards()?.dictionary(key) ?? null,
    persona: () => owners.playable.map(entityName),
  };
}
