import { beforeAll, describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { statBoxLookups, type CodeWorldLookup } from '@/lib/codeWorldLookup';
import { entityStatRows, resolvedEntityStats } from '@/lib/statLinks';
import { useScriptWorldNames } from '@/lib/useScriptWorldNames';
import { worldScriptEntries, type ScriptEntry } from '@/lib/worldScripts';
import type { Script, ScriptTiming, Stat, Trait, World } from '@/types';
import type { ScriptBoxOwner } from './ScriptBox';
import { statPanelBoxContext, traitTabBoxContext, type BuiltBoxContext } from './scriptBoxBuilders';
import { useScriptEntryContext } from './useScriptEntryContext';

// The provider initializes IndexedDB storage on mount; stub it out so these tests exercise only the store.
vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const script = (id: string): Script => ({ id, timing: 'before', code: 'return 1;' });
const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat => ({
  id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra,
});
const trait = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], ...extra });

/** One script in each home: global, entity-owned and Blueprint stats and traits, a root link override, and the world's. */
const world = {
  id: 'w',
  worldOverview: { name: 'w', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  scripts: [script('s-world')],
  stats: [
    stat('health', 'Health', { scripts: [script('s-health')] }),
    stat('bp-trust', 'Trust', { groupId: 'bp-bond', scripts: [script('s-trust')] }),
    stat('bp-fear', 'Fear', { groupId: 'bp-bond' }),
  ],
  statGroups: [
    { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' },
    { id: 'bp-bond', name: 'Bond', parentId: 'bp' },
  ],
  traits: [
    trait('lucky', 'Lucky', { scripts: [script('s-lucky')] }),
    trait('cursed', 'Cursed', { groupId: 'tbp', scripts: [script('s-cursed')] }),
  ],
  traitGroups: [{ id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  entities: [{
    id: 'bram',
    name: 'Bram',
    stats: [stat('mood', 'Mood', { scripts: [script('s-mood')] })],
    traits: [trait('brave', 'Brave', { scripts: [script('s-brave')] })],
    statLinks: [{
      id: 'l-trust', originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId: null,
      overrides: { 'bp-trust': { scripts: { value: [script('s-trust-link')], blueprint: [script('s-trust')] } } },
    }],
  }, {
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

function recordOf({ self, context }: BuiltBoxContext): BoxRecord {
  return {
    self: self.kind === 'world' ? self : { kind: self.kind, id: self.kind === 'stat' ? self.stat.id : self.id },
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

/** What every surface agrees on today, per home; where one surface differs, the value here is the one play reads. */
const RECORD: Record<Home, BoxRecord> = {
  globalStat: {
    self: { kind: 'stat', id: 'health' }, owner: null, selfName: 'Health', ownerStats: [], ownerStatNames: [],
    lookup: { self: { id: 'health', name: 'Health' }, owner: { kind: 'empty' }, ownerEntityIds: [] },
  },
  entityStat: {
    self: { kind: 'stat', id: 'mood' }, owner: bram, selfName: 'Mood', ownerStats: bramStats, ownerStatNames: ['Mood', 'Trust'],
    lookup: { self: { id: 'mood', name: 'Mood' }, owner: bramLookup, ownerEntityIds: ['bram'] },
  },
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
  blueprintTrait: {
    self: { kind: 'trait', id: 'cursed' }, owner: { kind: 'blueprint' }, selfName: 'Cursed', ownerStats: [], ownerStatNames: 'absent',
    // The lookup finds a Blueprint box's owners by its self stat, which a trait box has none of, so Odette is missing.
    lookup: { self: { id: 'cursed', name: 'Cursed' }, owner: { kind: 'blueprint', owners: [] }, ownerEntityIds: [] },
  },
  worldScript: {
    self: { kind: 'world' }, owner: null, selfName: '', ownerStats: [], ownerStatNames: [],
    lookup: { self: { id: '', name: '' }, owner: { kind: 'empty' }, ownerEntityIds: [] },
  },
};

/** Where a surface reads its home differently today: the fields it differs on, under a name. */
interface Disagreement {
  name: string;
  home: Home;
  surface: Surface;
  differs: Partial<BoxRecord>;
}

const DISAGREEMENTS: Disagreement[] = [
  {
    name: "linked stat self id: the stat panel's self carries the link id",
    home: 'linkedStat',
    surface: 'statPanel',
    differs: {
      self: { kind: 'stat', id: 'l-trust' },
      lookup: { self: { id: 'l-trust', name: 'Trust' }, owner: bramLookup, ownerEntityIds: ['bram'] },
    },
  },
  {
    name: "global trait owner stat names: the Scripts tab checks an empty list",
    home: 'globalTrait',
    surface: 'scriptsTab',
    differs: { ownerStatNames: [] },
  },
];

/** A row the Scripts tab hook holds before the fixture loads. */
const PROBE: ScriptEntry = { key: 'probe', home: { kind: 'world' }, script: script('probe'), ownerName: '', label: '', entity: null };

/** The world loaded into the provider, with what each surface reads beside its home. The Scripts tab's boxes come
 *  from its own hook. */
function loadFixture() {
  const { result, rerender } = renderHook(
    ({ entry }: { entry: ScriptEntry }) => ({ data: useGameData(), shared: useScriptWorldNames(), entryBox: useScriptEntryContext(entry) }),
    { wrapper, initialProps: { entry: PROBE } },
  );
  act(() => { result.current.data.loadWorldData(world); });
  const { data, shared } = result.current;
  const lookups = statBoxLookups(data);
  const entity = data.entities.find((e) => e.id === 'bram')!;
  const rows = entityStatRows(data, entity);
  const store = { stats: resolvedEntityStats(data, entity), ownerId: entity.id };
  const entries = worldScriptEntries({
    scripts: data.worldScripts, stats: data.stats, statGroups: data.statGroups, traits: data.traits,
    traitGroups: data.traitGroups, entities: data.entities, placeholders: data.placeholders,
  });
  const entryOf = (scriptId: string): ScriptEntry => entries.find((e) => e.script.id === scriptId)!;

  const panel = (s: Stat, owned: boolean) => statPanelBoxContext({
    stat: s, editingStat: s, store: owned ? store : undefined, world: data, lookups, shared,
  });
  const traitTab = (t: Trait, owned: boolean) => traitTabBoxContext({ trait: t, owner: owned ? entity : undefined, world: data, lookups, shared });
  const scriptsTab = (scriptId: string) => {
    rerender({ entry: entryOf(scriptId) });
    return result.current.entryBox;
  };
  const worldStat = (id: string) => data.stats.find((s) => s.id === id)!;
  const worldTrait = (id: string) => data.traits.find((t) => t.id === id)!;

  // Each home's boxes, as each surface that shows it builds them.
  const built: Record<Home, Partial<Record<Surface, BuiltBoxContext>>> = {
    globalStat: { statPanel: panel(worldStat('health'), false), scriptsTab: scriptsTab('s-health') },
    entityStat: { statPanel: panel(rows.stats.find((s) => s.id === 'mood')!, true), scriptsTab: scriptsTab('s-mood') },
    linkedStat: { statPanel: panel(rows.stats.find((s) => s.id === 'l-trust')!, true), scriptsTab: scriptsTab('s-trust-link') },
    blueprintStat: { statPanel: panel(worldStat('bp-trust'), false), scriptsTab: scriptsTab('s-trust') },
    globalTrait: { traitTab: traitTab(worldTrait('lucky'), false), scriptsTab: scriptsTab('s-lucky') },
    entityTrait: { traitTab: traitTab(entity.traits!.find((t) => t.id === 'brave')!, true), scriptsTab: scriptsTab('s-brave') },
    blueprintTrait: { traitTab: traitTab(worldTrait('cursed'), false), scriptsTab: scriptsTab('s-cursed') },
    worldScript: { scriptsTab: scriptsTab('s-world') },
  };
  return built;
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

const expectedOf = (home: Home, surface: Surface): BoxRecord => ({
  ...RECORD[home],
  ...DISAGREEMENTS.find((d) => d.home === home && d.surface === surface)?.differs,
});

describe('script box context parity across the three surfaces', () => {
  let built: ReturnType<typeof loadFixture>;
  beforeAll(() => { built = loadFixture(); });

  it.each(HOMES.flatMap((home) => SURFACES[home].map((surface) => [home, surface] as const)))(
    '%s on the %s reads the recorded context',
    (home, surface) => {
      const box = built[home][surface];
      expect(box, `${surface} shows ${home}`).toBeDefined();
      expect(recordOf(box!)).toEqual(expectedOf(home, surface));
    },
  );

  // Fixture hygiene: an entry that matches the record names no disagreement.
  it.each(DISAGREEMENTS.map((d) => [d.name, d] as const))('the disagreement table differs from the record: %s', (_name, { home, surface, differs }) => {
    expect(SURFACES[home]).toContain(surface);
    for (const [field, value] of Object.entries(differs)) {
      expect(value, field).not.toEqual(RECORD[home][field as keyof BoxRecord]);
    }
  });
});
