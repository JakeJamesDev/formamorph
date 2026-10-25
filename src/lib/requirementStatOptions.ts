// The stats the requirement picker offers: one section per owner, each stat ready to add as a Condition.

import type { GateInput, GateStatSet, RequirementOption } from './traitGates';
import { canBePlayer } from './owners';
import { partOf, type OwnerId } from './scope';
import type { RequirementOwner } from '@/types';

/** One owner's stats in the picker. */
export interface RequirementStatSection {
  heading: string;
  /** The owner alone, such as `Ash` for the heading `Ash Stats`. */
  owner: string;
  /** The host's own owner, whose Conditions name no owner. Offered off-world, where nothing else is. */
  own?: true;
  options: RequirementOption[];
}

/**
 * The stats a Condition can read from `hostId`: its own owner first, then the global stats with no owner
 * (Q10), then the stats of every entity that can be played under You, then each other entity that has stats
 * (Q29). A global host's own section is the global stats. A new Condition starts at the middle of the stat's
 * span, so its text reads at once. An inert stat is left out: a Condition on it never resolves.
 */
export function requirementStatSections(
  input: Pick<GateInput, 'owners' | 'entities' | 'stats'>, hostId: OwnerId,
): RequirementStatSection[] {
  const { section, playable, name } = sectionsOf(input);
  const sections = [
    { ...(hostId === null ? section('Global', [null]) : section(name(hostId), [hostId])), own: true as const },
    ...(hostId === null ? [] : [section('Global', [null])]),
    section('Persona', playable, { kind: 'you' }),
    ...input.entities
      .filter((e) => e.id !== hostId)
      .map((e) => section(e.name, [e.id], { kind: 'entity', id: e.id, name: e.name })),
  ];
  return sections.filter((s) => s.options.length > 0);
}

/**
 * The stats a location rule's Condition can read. The played persona hosts the rule, so its stats come first
 * and name no owner (Q48); then the global stats, then each entity that has stats.
 */
export function personaHostStatSections(input: Pick<GateInput, 'owners' | 'entities' | 'stats'>): RequirementStatSection[] {
  const { section, playable } = sectionsOf(input);
  const sections = [
    { ...section('Persona', playable), own: true as const },
    section('Global', [null]),
    ...input.entities.map((e) => section(e.name, [e.id], { kind: 'entity', id: e.id, name: e.name })),
  ];
  return sections.filter((s) => s.options.length > 0);
}

/** The section builder over `input`'s stats, the entities a persona can be, and an owner's name. */
function sectionsOf(input: Pick<GateInput, 'owners' | 'entities' | 'stats'>) {
  const statsOf = (ownerId: OwnerId): GateStatSet => (input.stats && partOf(input.stats, ownerId)) ?? {};
  const playable = input.entities.filter(canBePlayer).map((e) => e.id);
  const name = (id: string) => input.entities.find((e) => e.id === id)?.name ?? input.owners.find((o) => o.id === id)?.name ?? '';

  const section = (owner: string, ids: readonly OwnerId[], named?: RequirementOwner): RequirementStatSection => {
    const seen = new Set<string>();
    const options: RequirementOption[] = [];
    for (const ownerId of ids) {
      for (const [id, stat] of Object.entries(statsOf(ownerId))) {
        if (seen.has(id) || stat.inert) continue;
        seen.add(id);
        options.push({
          requirement: { kind: 'stat', id, ...(named ? { owner: named } : {}), operator: '>=', value: Math.round((stat.min + stat.max) / 2), unit: 'raw' },
          label: stat.name,
          breadcrumb: [],
          owners: [],
        });
      }
    }
    return { heading: `${owner} Stats`, owner, options };
  };
  return { section, playable, name };
}
