// The one model of the Requires field's traits, groups and stats: the add menu's pages, the owner a pick stores,
// and who a Condition can name as its owner (Q39 to Q44).

import {
  globalItems, heldTargets, withRequirementOwner, type ClauseHost, type GateInput, type GateStatSet, type RequirementOption,
} from './traitGates';
import { canBePlayer } from './owners';
import { partOf, type OwnerId } from './scope';
import type { RequirementOwner, TraitRequirement } from '@/types';

/** A target kind the add menu lists by owner page. */
export type PagedKind = 'trait' | 'group' | 'stat';

/** One page of the add menu: what a host can pick there, each target ready to add with the page's owner. */
export interface RequirementPage {
  key: string;
  heading: string;
  /** The page's name in a section heading, such as "Blueprint" in "Blueprint Stats". */
  sectionName: string;
  /** The page the host reads with no owner; off-world, the one page shown. */
  own?: true;
  /** The owner a pick from this page stores; absent, none. */
  owner?: RequirementOwner;
  options: RequirementOption[];
}

/** The owner choices of one target; `undefined` is the no-owner choice. */
export type OwnerChoices = readonly (RequirementOwner | undefined)[];

export interface RequirementTargets {
  /** The add menu's pages, in order. */
  pages: RequirementPage[];
  /** Each trait and group once, in tree order. */
  swapList: RequirementOption[];
  /** Each target's owner choices, keyed by `targetKey`. */
  owners: ReadonlyMap<string, OwnerChoices>;
}

const keyOf = (kind: string, id: string) => `${kind}:${id}`;

/** The key of a Condition's target in `RequirementTargets.owners`. */
export const targetKey = (req: TraitRequirement): string => keyOf(req.kind, 'id' in req ? req.id ?? '' : '');

/** Whether the host's own reading of `req`'s target is valid, so it can stand with no owner (Q43). A target the
 *  model does not list, such as a persona, always can. */
export const readsWithNoOwner = (targets: RequirementTargets, req: TraitRequirement): boolean =>
  targets.owners.get(targetKey(req))?.includes(undefined) ?? true;

/** The Blueprints, which hold a target beside the world's own scope (null) and each entity. */
const BLUEPRINTS = Symbol('blueprints');
type Holder = OwnerId | typeof BLUEPRINTS;

interface Held {
  key: string;
  option: RequirementOption;
}

type TargetInput = Omit<GateInput, 'active' | 'persona'>;

/** `list` without a repeat of an earlier item's key. */
const firstOf = <T,>(list: Iterable<T>, key: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return [...list].filter((item) => !seen.has(key(item)) && !!seen.add(key(item)));
};

/** Every entity that can hold a target: the world's entities, then any owner the list lacks. */
const entitiesOf = (input: TargetInput): { id: string; name: string }[] =>
  [...input.entities, ...input.owners.filter((o) => !input.entities.some((e) => e.id === o.id))];

/**
 * The traits, groups and stats `host` can require, for the trait `traitId` (empty for a rule with no trait).
 * Pages run: the host's own entity, Global, Blueprints (first on a Blueprint's field), Persona, each other
 * entity. A location's rule opens on Persona and an item's on Item Owner; neither has its own entity page.
 */
export function requirementTargets(input: TargetInput, host: ClauseHost, traitId = ''): RequirementTargets {
  const { byHolder: held, treeOrder } = holdings(input, traitId);
  const entities = entitiesOf(input);
  // Only a world entity carries the persona marks.
  const playable = input.entities.filter(canBePlayer).map((e) => e.id);
  const hostId = host.kind === 'entity' ? host.id : undefined;

  const page = (key: string, heading: string, holders: readonly Holder[], owner?: RequirementOwner, sectionName = heading): RequirementPage => ({
    key, heading, sectionName, ...(owner && { owner }),
    options: firstOf(holders.flatMap((h) => held.get(h) ?? []), (h) => h.key)
      .map((h) => ({ ...h.option, requirement: withRequirementOwner(h.option.requirement, owner) })),
  });
  const own = (p: RequirementPage): RequirementPage => ({ ...p, own: true });
  const global = page('global', 'Global', [null]);
  const blueprints = page('blueprints', 'Blueprints', [BLUEPRINTS], undefined, 'Blueprint');
  const persona = page('persona', 'Persona', playable, { kind: 'you' });
  const others = entities.filter((e) => e.id !== hostId)
    .map((e) => page(`entity:${e.id}`, e.name, [e.id], { kind: 'entity', id: e.id, name: e.name }));

  // Each host's pages, and the scopes it reads with no owner besides the world's own (Q43, Q44).
  const { list, reads } = ((): { list: RequirementPage[]; reads: (holder: Holder) => boolean } => {
    switch (host.kind) {
      case 'world': return { list: [own(global), blueprints, persona, ...others], reads: () => false };
      case 'blueprint': return { list: [own(blueprints), global, persona, ...others], reads: (h) => h === BLUEPRINTS };
      case 'persona': return { list: [own(page('persona', 'Persona', playable)), global, blueprints, ...others], reads: (h) => typeof h === 'string' && playable.includes(h) };
      // Linked Blueprint targets reach Item Owner through the entities that link them.
      case 'item': return { list: [own(page('itemOwner', 'Item Owner', [null, ...entities.map((e) => e.id)])), persona, ...others], reads: () => true };
      case 'entity': {
        const ownPage = hostId ? [own(page(`entity:${hostId}`, host.name ?? entities.find((e) => e.id === hostId)?.name ?? '', [hostId]))] : [];
        // With no id the model cannot know what the host holds, so its own reading stands.
        return { list: [...ownPage, global, blueprints, persona, ...others], reads: (h) => hostId === undefined || h === hostId };
      }
    }
  })();

  // Who holds each target, in holder order.
  const holders = new Map<string, Holder[]>();
  for (const [holder, heldList] of held) {
    for (const h of heldList) holders.set(h.key, [...(holders.get(h.key) ?? []), holder]);
  }
  // The host itself is the no-owner choice, so it never shows again by name.
  const selfNamed = (owner: RequirementOwner) => (owner.kind === 'you' ? host.kind === 'persona' : owner.id === hostId);
  const owners = new Map<string, OwnerChoices>();
  for (const [key, by] of holders) {
    const named: RequirementOwner[] = [
      ...(by.some((h) => typeof h === 'string' && playable.includes(h)) ? [{ kind: 'you' } as const] : []),
      ...entities.filter((e) => by.includes(e.id)).map((e): RequirementOwner => ({ kind: 'entity', id: e.id, name: e.name })),
    ].filter((o) => !selfNamed(o));
    owners.set(key, [...(by.some((h) => h === null || reads(h)) ? [undefined] : []), ...named]);
  }
  // Anyone can own an item, so every world entity is a choice beside the player; items stay outside Q43.
  const itemOwners: OwnerChoices = [undefined, { kind: 'you' }, ...input.entities.map((e): RequirementOwner => ({ kind: 'entity', id: e.id, name: e.name }))];
  for (const item of input.worldItems ?? []) owners.set(keyOf('item', item.id), itemOwners);

  return { pages: list.filter((p) => p.options.length > 0), swapList: firstOf(treeOrder, (h) => h.key).map((h) => h.option), owners };
}

/** Every trait, group and stat each holder holds, by holder, and the traits and groups in tree order. A new stat
 *  Condition starts at the middle of its holder's span, so its text reads at once. An inert stat is left out: a
 *  Condition on it never resolves. */
function holdings(input: TargetInput, traitId: string): { byHolder: Map<Holder, Held[]>; treeOrder: Held[] } {
  const byHolder = new Map<Holder, Held[]>();
  const treeOrder: Held[] = [];
  const push = (holder: Holder, h: Held) => byHolder.set(holder, [...(byHolder.get(holder) ?? []), h]);
  // A world target outside the global set is a Blueprint one.
  const global = globalItems(input);
  for (const { requirement, label, breadcrumb, scope } of heldTargets(input, traitId)) {
    const isGlobal = (requirement.kind === 'trait' ? global.traits : global.groups).has(requirement.id);
    const h: Held = { key: keyOf(requirement.kind, requirement.id), option: { requirement, label, breadcrumb } };
    push(scope === null && !isGlobal ? BLUEPRINTS : scope, h);
    treeOrder.push(h);
  }
  const statsOf = (ownerId: OwnerId): GateStatSet => (input.stats && partOf(input.stats, ownerId)) ?? {};
  const statSets: [Holder, GateStatSet][] = [
    [null, statsOf(null)], [BLUEPRINTS, input.blueprintStats ?? {}], ...entitiesOf(input).map((e): [Holder, GateStatSet] => [e.id, statsOf(e.id)]),
  ];
  for (const [holder, set] of statSets) {
    for (const [id, stat] of Object.entries(set)) {
      if (stat.inert) continue;
      const requirement: TraitRequirement = { kind: 'stat', id, operator: '>=', value: Math.round((stat.min + stat.max) / 2), unit: 'raw' };
      push(holder, { key: keyOf('stat', id), option: { requirement, label: stat.name, breadcrumb: [] } });
    }
  }
  return { byHolder, treeOrder };
}
