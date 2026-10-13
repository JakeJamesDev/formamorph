import { describe, expect, it } from 'vitest';
import type { Entity, Stat } from '@/types';
import { statCodeReferences } from './statCodeTargets';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', value: 0, min: 0, max: 100, ...extra } as Stat);

const code = 'self.value = 1; const n = stats.find((s) => s.id); return stats.Destruction.value + entities["The Creature"].stats[\'Rage\'].value;';
const rage = stat('rage', 'Rage', { beforeCode: 'owner.stats.Rage.max = 50;' });
const creature: Entity = { id: 'creature', name: 'The Creature', stats: [rage] };
const world = { stats: [stat('destruction', 'Destruction'), stat('alert', 'Alert', { code })], entities: [creature], placeholders: [] };

describe('statCodeReferences', () => {
  const references = statCodeReferences(world);

  it('returns each route that reaches a stat, with its box, its route, the stat, and the key’s range', () => {
    expect(references.map((ref) => ({
      home: ref.box.home, timing: ref.box.timing, route: ref.route, entity: ref.entity, stat: ref.stat,
      key: ref.box.code.slice(ref.from, ref.to), reaches: ref.targets.map((t) => [t.owner.entity?.id ?? null, t.stat.id]),
    }))).toEqual([
      { home: { kind: 'stat', statId: 'alert' }, timing: 'after', route: 'stats', entity: undefined, stat: 'Destruction', key: 'Destruction', reaches: [[null, 'destruction']] },
      { home: { kind: 'stat', statId: 'alert' }, timing: 'after', route: 'entities', entity: 'The Creature', stat: 'Rage', key: '\'Rage\'', reaches: [['creature', 'rage']] },
      { home: { kind: 'entity', entityId: 'creature', statId: 'rage' }, timing: 'before', route: 'owner', entity: undefined, stat: 'Rage', key: 'Rage', reaches: [['creature', 'rage']] },
    ]);
  });
});
