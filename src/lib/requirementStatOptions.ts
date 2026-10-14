// The stats the requirement picker offers: one section per owner, each stat ready to add as a Condition.

import { playerOwnerIds, type GateInput, type RequirementOption } from './traitGates';
import type { RequirementOwner } from '@/types';

/** One owner's stats in the picker. */
export interface RequirementStatSection {
  heading: string;
  /** The host's own owner, whose Conditions name no owner. Offered off-world, where nothing else is. */
  own?: true;
  options: RequirementOption[];
}

/**
 * The stats a Condition can read from `hostId`: its own owner first (the player set for a world trait),
 * then You, then each other entity that has stats. The editor has no played persona, so You is the world's
 * player stats plus the Custom Persona's own, and a world persona's stats stay under its own entity (Q28).
 * A new Condition starts at the middle of the stat's span, so its text reads at once. An inert stat is left
 * out: a Condition on it never resolves.
 */
export function requirementStatSections(
  input: Pick<GateInput, 'owners' | 'entities' | 'stats'>, hostId: string,
): RequirementStatSection[] {
  const stats = input.stats ?? {};
  const player = playerOwnerIds({ source: 'none' }, input.entities);
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

  const own = player.includes(hostId) ? section('Player Stats', player) : section(`${name(hostId)} Stats`, [hostId]);
  const sections = [
    { ...own, own: true as const },
    ...(player.includes(hostId) ? [] : [section('Player Stats', player, { kind: 'you' })]),
    ...input.entities
      .filter((e) => e.id !== hostId && !player.includes(e.id))
      .map((e) => section(`${e.name} Stats`, [e.id], { kind: 'entity', id: e.id, name: e.name })),
  ];
  return sections.filter((s) => s.options.length > 0);
}
