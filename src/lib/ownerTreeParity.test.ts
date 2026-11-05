// Records the link bind and portable helpers on bundled worlds, the path an entity file takes on import.
import { describe, expect, it } from 'vitest';
import type { Entity, World } from '@/types';
import { migrateWorld } from './version';
import { bindOwnedStats, portableOwnedStats } from './portableStats';
import { bindOwnedTraits, portableOwnedTraits, traitWorldOf } from './portableTraits';

const bundled = new Map(Object.entries(import.meta.glob<string>('@/defaultworlds/*.json', { query: '?raw', import: 'default', eager: true }))
  .map(([file, raw]): [string, World] => [file.split('/').at(-1)!.replace('.json', ''), migrateWorld(JSON.parse(raw))]));
const bundledWorld = (name: string): World => {
  const w = bundled.get(name);
  if (!w) throw new Error(`No bundled world ${name}`);
  return w;
};

/** Emberwatch with Albus holding a second Health link, stored last but placed above the first. */
function emberwatchOverlap(): World {
  const w = bundledWorld('emberwatch');
  const above = { id: 'parity-health-above', originalId: 'health', kind: 'stat' as const, originalName: 'Health', groupId: null, order: -1 };
  return { ...w, entities: w.entities.map((e) => (e.name === 'Albus' ? { ...e, statLinks: [...e.statLinks ?? [], above] } : e)) };
}

const statLists = (w: World) => ({ stats: w.stats, statGroups: w.statGroups ?? [] });
const TREE_FIELDS: readonly string[] = ['traits', 'traitGroups', 'traitLinks', 'stats', 'statGroups', 'statLinks'];

/** The record as JSON with every object's keys sorted, since key order is no behavior. */
const json = (value: unknown) => `${JSON.stringify(value, (_k, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v), 2)}\n`;

/** The entity as a world with other ids carries it: each link's original known by its stored name only. */
const carried = (entity: Entity): Entity => {
  const rename = <L extends { originalId: string }>(links: L[] | undefined) => links?.map((l) => ({ ...l, originalId: `carried-${l.originalId}` }));
  return { ...entity, traitLinks: rename(entity.traitLinks), statLinks: rename(entity.statLinks) };
};
const owning = (e: Entity) => TREE_FIELDS.some((k) => (e[k as keyof Entity] as unknown[] | undefined)?.length);
const traitFields = ({ traits, traitGroups, traitLinks }: Entity) => ({ traits, traitGroups, traitLinks });
const statFields = ({ stats, statGroups, statLinks }: Entity) => ({ stats, statGroups, statLinks });

describe('owner-tree link parity', () => {
  const entities = [...bundled].sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([file, w]) => w.entities.filter(owning).map((e) => ({ file, w, e })));

  /** The entity's portable lists, and its lists bound back into its world by id and by stored name. */
  const linkRecord = ({ w, e }: (typeof entities)[number]) => {
    const traitWorld = traitWorldOf(w);
    if (!traitWorld) throw new Error('A bundled world without traits');
    const portableTraits = portableOwnedTraits(e, traitWorld);
    const portableStats = portableOwnedStats(e, statLists(w));
    const portable = { ...e, ...portableTraits, ...portableStats };
    return {
      portableTraits, portableStats,
      boundTraits: traitFields(bindOwnedTraits(portable, traitWorld)),
      boundStats: statFields(bindOwnedStats(portable, statLists(w))),
      carriedTraits: traitFields(bindOwnedTraits(carried(portable), traitWorld)),
      carriedStats: statFields(bindOwnedStats(carried(portable), statLists(w))),
    };
  };

  it.each(entities.map((x) => [`${x.file}: ${x.e.name}`, x] as const))('binds every link of %s back, by id and by name', (_label, x) => {
    const r = linkRecord(x);
    const links = [r.portableTraits.traitLinks?.length ?? 0, r.portableStats.statLinks?.length ?? 0];
    expect([r.boundTraits.traitLinks?.length ?? 0, r.boundStats.statLinks?.length ?? 0]).toEqual(links);
    expect([r.carriedTraits.traitLinks?.length ?? 0, r.carriedStats.statLinks?.length ?? 0]).toEqual(links);
  });

  const overlap = (() => {
    const w = emberwatchOverlap();
    return { file: 'emberwatch-overlap', w, e: w.entities.find((e) => e.name === 'Albus')! };
  })();

  it('binds the tree-first of two overlapping stat links, by id and by name', () => {
    const r = linkRecord(overlap);
    expect(r.boundStats.statLinks?.filter((l) => l.originalId === 'health').map((l) => l.id)).toEqual(['parity-health-above']);
    expect(r.carriedStats.statLinks?.filter((l) => l.originalId === 'health').map((l) => l.id)).toEqual(['parity-health-above']);
  });

  it('records the portable and bound lists of every owning bundled entity', async () => {
    const record: Record<string, Record<string, ReturnType<typeof linkRecord>>> = {};
    for (const x of [...entities, overlap]) (record[x.file] ??= {})[x.e.name] = linkRecord(x);
    await expect(json(record)).toMatchFileSnapshot('./__parity__/ownerTreeLinks.json');
  });
});
