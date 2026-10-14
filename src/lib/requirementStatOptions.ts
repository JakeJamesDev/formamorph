// The stats the requirement picker offers: one section per owner, each stat ready to add as a Condition.

import { PLAYER_OWNER, type GateInput, type RequirementOption } from './traitGates';
import { canBePlayer } from './owners';
import type { RequirementOwner } from '@/types';

/** One owner's stats in the picker. */
export interface RequirementStatSection {
  heading: string;
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
  input: Pick<GateInput, 'owners' | 'entities' | 'stats'>, hostId: string,
): RequirementStatSection[] {
  const stats = input.stats ?? {};
  const playable = input.entities.filter(canBePlayer).map((e) => e.id);
  const name = (id: string) => input.entities.find((e) => e.id === id)?.name ?? input.owners.find((o) => o.id === id)?.name ?? '';

  const section = (heading: string, ids: readonly string[], named?: RequirementOwner): RequirementStatSection => {
    const seen = new Set<string>();
    const options: RequirementOption[] = [];
    for (const ownerId of ids) {
      for (const [id, stat] of Object.entries(stats[ownerId] ?? {})) {
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
    return { heading, options };
  };

  const global = hostId === PLAYER_OWNER;
  const sections = [
    { ...(global ? section('Global Stats', [PLAYER_OWNER]) : section(`${name(hostId)} Stats`, [hostId])), own: true as const },
    ...(global ? [] : [section('Global Stats', [PLAYER_OWNER])]),
    section('Persona Stats', playable, { kind: 'you' }),
    ...input.entities
      .filter((e) => e.id !== hostId)
      .map((e) => section(`${e.name} Stats`, [e.id], { kind: 'entity', id: e.id, name: e.name })),
  ];
  return sections.filter((s) => s.options.length > 0);
}
