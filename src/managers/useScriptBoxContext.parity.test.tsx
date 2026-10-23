import { beforeAll, describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import type { CodeWorldLookup } from '@/lib/codeWorldLookup';
import type { UnitHome } from '@/lib/sandboxSnapshot';
import { offWorldOf, statPanelHome, traitPanelHome } from '@/lib/scriptBoxHome';
import { entityStatRows } from '@/lib/statLinks';
import { worldScriptEntries, type ScriptHomeRef } from '@/lib/worldScripts';
import type { Entity, Script, ScriptTiming, Stat, Trait, World } from '@/types';
import type { ScriptBoxContext, ScriptBoxOwner } from './ScriptBox';
import { useScriptBoxContext } from './useScriptBoxContext';

// The provider initializes IndexedDB storage on mount; stub it out so these tests exercise only the store.
vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const script = (id: string): Script => ({ id, timing: 'before', code: 'return 1;' });
const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat => ({
  id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra,
});
const trait = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], ...extra });

const STATS = [
  stat('health', 'Health', { scripts: [script('s-health')] }),
  stat('bp-trust', 'Trust', { groupId: 'bp-bond', scripts: [script('s-trust')] }),
  stat('bp-fear', 'Fear', { groupId: 'bp-bond' }),
];
const STAT_GROUPS = [
  { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' as const },
  { id: 'bp-bond', name: 'Bond', parentId: 'bp' },
];
const BRAM: Entity = {
  id: 'bram',
  name: 'Bram',
  stats: [stat('mood', 'Mood', { scripts: [script('s-mood')] })],
  traits: [trait('brave', 'Brave', { scripts: [script('s-brave')] })],
  statLinks: [{
    id: 'l-trust', originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId: null,
    overrides: { 'bp-trust': { scripts: { value: [script('s-trust-link')], blueprint: [script('s-trust')] } } },
  }],
} as Entity;

/** One script in each home: global, entity-owned and Blueprint stats and traits, a root link override, and the world's. */
const world = {
  id: 'w',
  worldOverview: { name: 'w', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  scripts: [script('s-world')],
  stats: STATS,
  statGroups: STAT_GROUPS,
  traits: [
    trait('lucky', 'Lucky', { scripts: [script('s-lucky')] }),
    trait('cursed', 'Cursed', { groupId: 'tbp', scripts: [script('s-cursed')] }),
  ],
  traitGroups: [{ id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  entities: [BRAM, {
    // Links both Blueprints and leaves their scripts alone, so each Blueprint box runs under her.
    id: 'odette',
    name: 'Odette',
    statLinks: [{ id: 'l-odette-trust', originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId: null }],
    traitLinks: [{ id: 'l-odette-cursed', originalId: 'cursed', kind: 'trait', originalName: 'Cursed', groupId: null }],
  }],
  locations: [], statUpdates: [], placeholders: [], dictionaries: [],
} as unknown as World;

const wrapper = ({ children }: { children: ReactNode }) => <GameDataProvider>{children}</GameDataProvider>;

type Home = 'globalStat' | 'entityStat' | 'linkedStat' | 'blueprintStat' | 'globalTrait' | 'entityTrait' | 'blueprintTrait' | 'worldScript';
type Surface = 'statPanel' | 'traitTab' | 'scriptsTab';

/** What a box reads of its home, in comparable form. */
interface BoxRecord {
  self: { kind: 'stat' | 'trait'; id: string } | { kind: 'world' };
  owner: ScriptBoxOwner | null;
  selfName: string;
  /** Each `owner.stats` entry as id and code name. */
  ownerStats: [string, string][];
  ownerStatNames: string[] | 'absent';
  lookup: LookupRecord | 'none';
}

interface LookupRecord {
  self: { id: string; name: string };
  owner: { kind: 'empty' } | { kind: 'entity'; entityId: string } | { kind: 'blueprint'; owners: string[] } | null;
  ownerEntityIds: string[];
}

/** The card lookup's answer for this Timing. */
const SAMPLE_TIMING: ScriptTiming = 'before';

function lookupRecord(lookup: CodeWorldLookup): LookupRecord {
  const { stat: self } = lookup.self();
  const owner = lookup.owner();
  return {
    self: { id: self.id, name: self.name },
    owner: !owner ? null
      : owner.kind === 'entity' ? { kind: 'entity', entityId: owner.entity.entity.id }
        : owner.kind === 'blueprint' ? { kind: 'blueprint', owners: [...owner.owners] }
          : { kind: 'empty' },
    ownerEntityIds: [...lookup.ownerEntityIds()],
  };
}

const selfOf = (home: UnitHome): BoxRecord['self'] =>
  ('stat' in home ? { kind: 'stat', id: home.stat.id } : 'trait' in home ? { kind: 'trait', id: home.trait.id } : { kind: 'world' });

function recordOf(context: ScriptBoxContext): BoxRecord {
  return {
    self: selfOf(context.home),
    owner: context.owner,
    selfName: context.selfName,
    ownerStats: context.ownerStats.map((s) => [s.id, s.name]),
    ownerStatNames: context.ownerStatNames ?? 'absent',
    lookup: context.lookup ? lookupRecord(context.lookup(SAMPLE_TIMING)) : 'none',
  };
}

const bram = { kind: 'entity', entityId: 'bram' } as const;
const bramLookup = { kind: 'entity', entityId: 'bram' } as const;
const bramStats: [string, string][] = [['mood', 'Mood'], ['bp-trust', 'Trust']];

/** What every surface reads for each home. */
const RECORD: Record<Home, BoxRecord> = {
  globalStat: {
    self: { kind: 'stat', id: 'health' }, owner: null, selfName: 'Health', ownerStats: [], ownerStatNames: 'absent',
    lookup: { self: { id: 'health', name: 'Health' }, owner: { kind: 'empty' }, ownerEntityIds: [] },
  },
  entityStat: {
    self: { kind: 'stat', id: 'mood' }, owner: bram, selfName: 'Mood', ownerStats: bramStats, ownerStatNames: ['Mood', 'Trust'],
    lookup: { self: { id: 'mood', name: 'Mood' }, owner: bramLookup, ownerEntityIds: ['bram'] },
  },
  // Play runs a linked stat under the original id.
  linkedStat: {
    self: { kind: 'stat', id: 'bp-trust' }, owner: bram, selfName: 'Trust', ownerStats: bramStats, ownerStatNames: ['Mood', 'Trust'],
    lookup: { self: { id: 'bp-trust', name: 'Trust' }, owner: bramLookup, ownerEntityIds: ['bram'] },
  },
  blueprintStat: {
    self: { kind: 'stat', id: 'bp-trust' }, owner: { kind: 'blueprint' }, selfName: 'Trust',
    ownerStats: [['bp-trust', 'Trust'], ['bp-fear', 'Fear']], ownerStatNames: ['Trust', 'Fear'],
    lookup: { self: { id: 'bp-trust', name: 'Trust' }, owner: { kind: 'blueprint', owners: ['Odette'] }, ownerEntityIds: ['odette'] },
  },
  globalTrait: {
    self: { kind: 'trait', id: 'lucky' }, owner: null, selfName: 'Lucky', ownerStats: [], ownerStatNames: 'absent',
    lookup: { self: { id: 'lucky', name: 'Lucky' }, owner: { kind: 'empty' }, ownerEntityIds: [] },
  },
  entityTrait: {
    self: { kind: 'trait', id: 'brave' }, owner: bram, selfName: 'Brave', ownerStats: bramStats, ownerStatNames: ['Mood', 'Trust'],
    lookup: { self: { id: 'brave', name: 'Brave' }, owner: bramLookup, ownerEntityIds: ['bram'] },
  },
  // Odette links the trait and leaves its scripts alone, as she does the Blueprint stat (T04-1).
  blueprintTrait: {
    self: { kind: 'trait', id: 'cursed' }, owner: { kind: 'blueprint' }, selfName: 'Cursed', ownerStats: [], ownerStatNames: 'absent',
    lookup: { self: { id: 'cursed', name: 'Cursed' }, owner: { kind: 'blueprint', owners: ['Odette'] }, ownerEntityIds: ['odette'] },
  },
  worldScript: {
    self: { kind: 'world' }, owner: null, selfName: '', ownerStats: [], ownerStatNames: 'absent',
    lookup: { self: { id: '', name: '' }, owner: { kind: 'empty' }, ownerEntityIds: [] },
  },
};

/** The world loaded into the provider, and each home's box as each surface that shows it names the home. */
function loadFixture() {
  const { result, rerender } = renderHook(
    ({ home }: { home: ScriptHomeRef }) => ({ data: useGameData(), box: useScriptBoxContext(home) }),
    { wrapper, initialProps: { home: { kind: 'world' } as ScriptHomeRef } },
  );
  act(() => { result.current.data.loadWorldData(world); });
  const { data } = result.current;
  const boxAt = (home: ScriptHomeRef) => {
    rerender({ home });
    return result.current.box;
  };
  const entries = worldScriptEntries({
    scripts: data.worldScripts, stats: data.stats, statGroups: data.statGroups, traits: data.traits,
    traitGroups: data.traitGroups, entities: data.entities, placeholders: data.placeholders,
  });
  const scriptsTab = (scriptId: string) => boxAt(entries.find((e) => e.script.id === scriptId)!.home);
  // The link's row, as the entity's Stats tab opens its panel: the row carries the link id.
  const { stats: rows, linked } = entityStatRows(data, data.entities.find((e) => e.id === 'bram')!);
  const linkRow = rows.find((s) => linked.get(s.id)?.root)!;
  const { link, originalId } = linked.get(linkRow.id)!;

  const built: Record<Home, Partial<Record<Surface, ScriptBoxContext>>> = {
    globalStat: { statPanel: boxAt(statPanelHome('health')), scriptsTab: scriptsTab('s-health') },
    entityStat: { statPanel: boxAt(statPanelHome('mood', 'bram')), scriptsTab: scriptsTab('s-mood') },
    linkedStat: { statPanel: boxAt(statPanelHome(linkRow.id, 'bram', { linkId: link.id, originalId })), scriptsTab: scriptsTab('s-trust-link') },
    blueprintStat: { statPanel: boxAt(statPanelHome('bp-trust')), scriptsTab: scriptsTab('s-trust') },
    globalTrait: { traitTab: boxAt(traitPanelHome('lucky')), scriptsTab: scriptsTab('s-lucky') },
    entityTrait: { traitTab: boxAt(traitPanelHome('brave', 'bram')), scriptsTab: scriptsTab('s-brave') },
    blueprintTrait: { traitTab: boxAt(traitPanelHome('cursed')), scriptsTab: scriptsTab('s-cursed') },
    worldScript: { scriptsTab: scriptsTab('s-world') },
  };
  // A panel left open on an entity the world no longer has.
  const gone = boxAt(statPanelHome('mood', 'gone'));
  return { built, linkRowId: linkRow.id, gone };
}

const HOMES = Object.keys(RECORD) as Home[];
const SURFACES: Record<Home, Surface[]> = {
  globalStat: ['statPanel', 'scriptsTab'],
  entityStat: ['statPanel', 'scriptsTab'],
  linkedStat: ['statPanel', 'scriptsTab'],
  blueprintStat: ['statPanel', 'scriptsTab'],
  globalTrait: ['traitTab', 'scriptsTab'],
  entityTrait: ['traitTab', 'scriptsTab'],
  blueprintTrait: ['traitTab', 'scriptsTab'],
  worldScript: ['scriptsTab'],
};

describe('script box context parity across the three surfaces', () => {
  let fixture: ReturnType<typeof loadFixture>;
  beforeAll(() => { fixture = loadFixture(); });

  it.each(HOMES.flatMap((home) => SURFACES[home].map((surface) => [home, surface] as const)))(
    '%s on the %s reads the recorded context',
    (home, surface) => {
      const box = fixture.built[home][surface];
      expect(box, `${surface} shows ${home}`).toBeDefined();
      expect(recordOf(box!)).toEqual(RECORD[home]);
    },
  );

  it('runs a root-linked stat under the original id on both surfaces, though its panel opens on the link’s row', () => {
    expect(fixture.linkRowId).toBe('l-trust');
    for (const surface of SURFACES.linkedStat) {
      const box = fixture.built.linkedStat[surface]!;
      expect([surface, selfOf(box.home), box.lookup?.(SAMPLE_TIMING).self().stat.id]).toEqual([surface, { kind: 'stat', id: 'bp-trust' }, 'bp-trust']);
    }
  });

  it('runs a home the world no longer holds as a bare stat, its lookup’s owner null (T04-5)', () => {
    const { gone } = fixture;
    expect([gone.home, gone.selfName, gone.ownerStats]).toEqual([{ kind: 'entityStat', entityId: 'gone', stat: { id: 'mood', name: '' } }, '', []]);
    expect(gone.lookup!(SAMPLE_TIMING).owner()).toBeNull();
  });
});

describe('a library entity’s boxes, with no world loaded', () => {
  const offWorldBox = (home: ScriptHomeRef, links: Parameters<typeof offWorldOf>[1]) =>
    renderHook(() => useScriptBoxContext(home, offWorldOf(BRAM, links))).result.current;

  it('complete a stat’s and a trait’s box against the entity’s own stats, its links resolved, with no card lookup', () => {
    const links = { stats: STATS, statGroups: STAT_GROUPS };
    for (const home of [statPanelHome('mood', 'bram'), traitPanelHome('brave', 'bram')]) {
      const box = offWorldBox(home, links);
      expect([home.kind, box.owner, box.ownerStats.map((s) => [s.id, s.name]), box.ownerStatNames, box.lookup])
        .toEqual([home.kind, bram, bramStats, ['Mood', 'Trust'], undefined]);
    }
    expect(offWorldBox(statPanelHome('mood', 'bram'), links).home).toMatchObject({ kind: 'entityStat', entityId: 'bram', stat: { id: 'mood', name: 'Mood' } });
  });

  it('read the entity’s own stats alone when no world opened the library', () => {
    const box = offWorldBox(traitPanelHome('brave', 'bram'), null);
    expect(box.ownerStats.map((s) => s.id)).toEqual(['mood']);
    expect(box.home).toMatchObject({ kind: 'trait', trait: { id: 'brave', name: 'Brave' }, entityId: 'bram' });
  });
});
