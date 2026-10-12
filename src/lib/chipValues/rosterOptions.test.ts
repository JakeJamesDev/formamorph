import { describe, it, expect } from 'vitest';
import { chipValues, sceneEntityChipValues } from './chipValues';
import { splitToken } from '../promptVariables';
import type { ChipScene } from './chipScene';
import { knownPersonaLine } from '../personaContext';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import { renderPromptTemplate } from '../promptTemplate';
import { ownerStatParts } from '../statContext';
import type { ResolvedPersona } from '../persona';
import type { Entity, GameLocation, PlayerStat, Trait } from '@/types';

// The town: Old Town holds North Gate and the Market; North Gate holds the Gatehouse.
const oldTown: GameLocation = { id: 'old-town', name: 'Old Town', aiDescription: 'Terraced streets.' };
const northGate: GameLocation = { id: 'north-gate', name: 'North Gate', parentId: 'old-town', aiDescription: 'A stone gate.' };
const gatehouse: GameLocation = { id: 'gatehouse', name: 'Gatehouse', parentId: 'north-gate', aiDescription: 'A guard room.' };
const market: GameLocation = { id: 'market', name: 'Market', parentId: 'old-town', aiDescription: 'Stalls.' };

const sworn: Trait = { id: 'sworn', name: 'Sworn', aiDescription: 'Bound to the gate captain.', statChanges: [] };
const trust: PlayerStat = {
  id: 'trust', name: 'Trust', type: 'number', description: 'How far he trusts you.', min: 0, max: 100, value: 40, regen: 0,
  descriptors: [{ id: 't1', threshold: 50, description: 'Wary' }, { id: 't2', threshold: 100, description: 'Warm' }],
};

// Who owns what: the Guard both, the Merchant and the Baker stats, the Watchman a trait, the Wanderer nothing.
const guard: Entity = { id: 'guard', name: 'Guard', locations: ['north-gate', 'gatehouse'], aiDescription: 'A burly guard.', aiSummary: 'A guard.', traits: [sworn] };
const merchant: Entity = { id: 'merchant', name: 'Merchant', locations: ['gatehouse', 'market'], aiDescription: 'Sells maps.' };
const watchman: Entity = { id: 'watchman', name: 'Watchman', locations: ['market'], aiDescription: 'Walks the stalls.', traits: [sworn] };
const baker: Entity = { id: 'baker', name: 'Baker', locations: ['market'], aiDescription: 'Bakes at dawn.' };
const wanderer: Entity = { id: 'wanderer', name: 'Wanderer', aiDescription: 'Came with the caravan.' };
const entities = [guard, merchant, watchman, baker, wanderer];

const ownedStats = { guard: [trust], merchant: [trust], baker: [trust] };
const ownedTraits = { guard: ['sworn'], watchman: ['sworn'] };

/** The scene's values, read as a prompt reads them: a spelling resolves to its canonical key first. */
const lookup = (scene: ChipScene) => {
  const values = chipValues(scene);
  return (token: string) => values(splitToken(token)?.key ?? token);
};

/** A chip token spelled from its option ids, bare when there are none. */
const chip = (base: string, ...ids: string[]) => {
  const run = ids.filter(Boolean).join('.');
  return run ? `<${base}|${run}>` : `<${base}>`;
};

const scene = (over: Partial<ChipScene> = {}): ChipScene => ({
  overview: 'A quiet coast.',
  stats: [],
  traits: [],
  traitGroups: [],
  ownedStats,
  ownedTraits,
  persona: null,
  location: northGate,
  locations: [oldTown, northGate, gatehouse, market],
  connections: [],
  entities,
  presentIds: ['guard', 'merchant', 'watchman', 'wanderer'],
  inSceneIds: ['guard', 'merchant', 'watchman', 'wanderer'],
  inSceneNames: ['the ferryman'],
  lore: [],
  notes: '',
  time: null,
  resolve: (text) => text,
  ...over,
});

describe('Only With on the Entities chip', () => {
  const values = lookup(scene());

  it('keeps only the entities that own a stat in force with Stats, a trait with Traits, either with both', () => {
    expect(values('<ENTITIES|name.withstats>')).toBe('Guard, Merchant');
    expect(values('<ENTITIES|name.withtraits>')).toBe('Guard, Watchman');
    expect(values('<ENTITIES|name.withstats.withtraits>')).toBe('Guard, Merchant, Watchman');
    expect(values('<ENTITIES|name.withtraits.withstats>')).toBe('Guard, Merchant, Watchman');
  });

  it('lists the same entities under the full and summary content, in every format', () => {
    for (const format of ['', 'markdown', 'xml']) {
      for (const content of ['', 'summary']) {
        const out = values(chip('ENTITIES', content, 'withstats', format))!;
        expect(out, content + format).toContain('Merchant');
        expect(out, content + format).toContain('Guard');
        expect(out, content + format).not.toContain('Watchman');
        expect(out, content + format).not.toContain('Wanderer');
      }
    }
  });

  it('drops In Scene names with no entity record, and only while a filter is on', () => {
    expect(values('<ENTITIES|inscene.name>')).toBe('Guard, Merchant, Watchman, Wanderer, the ferryman');
    expect(values('<ENTITIES|inscene.name.withstats>')).toBe('Guard, Merchant');
    expect(values('<ENTITIES|inscene.name.withtraits.withstats>')).toBe('Guard, Merchant, Watchman');
  });

  it('applies to the sub-location and reachable scopes', () => {
    const lower = lookup(scene({ presentIds: ['guard'] }));
    expect(lower('<ENTITIES|sublocations.name>')).toBe('Merchant');
    expect(lower('<ENTITIES|sublocations.name.withtraits>')).toBe(NONE_PLACEHOLDER);
    expect(lower('<ENTITIES|reachable.name>')).toBe('Watchman, Baker');
    expect(lower('<ENTITIES|reachable.name.withstats>')).toBe('Baker');
    expect(lower('<ENTITIES|reachable.name.withtraits>')).toBe('Watchman');
  });

  it('ignores the Include toggles', () => {
    expect(values('<ENTITIES|name.withstats.nostats>')).toBe('Guard, Merchant');
    expect(values('<ENTITIES|name.withtraits.notraits>')).toBe('Guard, Watchman');
    const full = values('<ENTITIES|withtraits.notraits.nostats>')!;
    expect(full).toContain('Watchman');
    expect(full).not.toContain('Merchant');
    expect(full).not.toContain('traits:');
  });

  it('counts the stats in force whatever the scope shows, so Sub-Locations filters on stats it does not list', () => {
    const lower = lookup(scene({ presentIds: ['guard'] }));
    expect(lower('<ENTITIES|sublocations.withstats>')).toContain('Merchant');
    expect(lower('<ENTITIES|sublocations.withstats>')).not.toContain('stats:');
  });

  it('renders the placeholder when nobody passes', () => {
    const none = lookup(scene({ ownedStats: {}, ownedTraits: {} }));
    expect(none('<ENTITIES|withstats>')).toBe(NONE_PLACEHOLDER);
    expect(none('<ENTITIES|name.withtraits>')).toBe(NONE_PLACEHOLDER);
    expect(none('<ENTITIES|inscene.name.withstats>')).toBe(NONE_PLACEHOLDER);
  });

  it('counts an entity that owns an empty stat or trait list as owning none', () => {
    const empty = lookup(scene({ ownedStats: { guard: [] }, ownedTraits: { guard: [] } }));
    expect(empty('<ENTITIES|name.withstats.withtraits>')).toBe(NONE_PLACEHOLDER);
  });

  it('holds on the scene-roster override too', () => {
    const values = sceneEntityChipValues(scene(), ['guard', 'watchman', 'wanderer']);
    const override = (token: string) => values(splitToken(token)?.key ?? token);
    expect(override('<ENTITIES|name.withtraits>')).toBe('Guard, Watchman');
    expect(override('<ENTITIES|name.withstats>')).toBe('Guard');
  });

  it('leaves a bare token as it was', () => {
    const bare = values('<ENTITIES>')!;
    expect(bare).toContain('Wanderer');
    expect(bare).toContain('Watchman');
    expect(values('<ENTITIES|name>')).toBe('Guard, Merchant, Watchman, Wanderer');
  });
});

describe('Include on the Entities chip', () => {
  const values = lookup(scene());

  it('removes the traits line in full and summary content, in every format', () => {
    for (const format of ['', 'markdown', 'xml']) {
      for (const content of ['', 'summary']) {
        expect(values(chip('ENTITIES', content, format))!, content + format).toContain('Sworn');
        const off = values(chip('ENTITIES', content, 'notraits', format))!;
        expect(off, content + format).not.toContain('Sworn');
        expect(off, content + format).not.toMatch(/traits/);
        expect(off, content + format).toContain('Watchman');
      }
    }
  });

  it('keeps the stats when only the traits are off', () => {
    expect(values('<ENTITIES|notraits>')).toContain('  stats:\n    Trust: 40/100 (Wary) — How far he trusts you.\n');
  });

  it('lists owned stats in Sub-Locations and Reachable only with the stats-on id', () => {
    const lower = lookup(scene({ presentIds: ['guard'] }));
    expect(lower('<ENTITIES|sublocations>')).not.toContain('stats:');
    expect(lower('<ENTITIES|reachable>')).not.toContain('stats:');
    expect(lower('<ENTITIES|sublocations.stats>')).toContain('Merchant\n  description: Sells maps.\n  stats:\n    Trust: 40/100 (Wary) — How far he trusts you.\n');
    expect(lower('<ENTITIES|reachable.stats.markdown>')).toContain('- **Baker**\n  - **description:** Bakes at dawn.\n  - **stats:**\n    - **Trust:**');
    expect(lower('<ENTITIES|reachable.stats.nostats>')).not.toContain('stats:');
  });

  it('keeps Here and In Scene on stats by default, and the stats-on id changes nothing there', () => {
    expect(values('<ENTITIES|stats>')).toBe(values('<ENTITIES>'));
    expect(values('<ENTITIES|inscene.stats>')).toBe(values('<ENTITIES|inscene>'));
    expect(values('<ENTITIES>')).toContain('stats:');
  });

  it('leaves both Include pieces out of Name content', () => {
    expect(values('<ENTITIES|name.notraits.nostats>')).toBe(values('<ENTITIES|name>'));
  });
});

describe('Stat Detail on the Entities chip', () => {
  const values = lookup(scene({ ownedStats: { guard: [trust] }, presentIds: ['guard'] }));
  const line = (token: string) => values(token)!.split(/ {2}(?:- \*\*)?stats:(?:\*\*)?\n/)[1].replace(/\n$/, '');

  it('renders each combination of Range, Descriptor and Description in the simple format', () => {
    const cases: [string, string][] = [
      ['', '    Trust: 40/100 (Wary) — How far he trusts you.'],
      ['norange', '    Trust: Wary — How far he trusts you.'],
      ['nodescriptor', '    Trust: 40/100 — How far he trusts you.'],
      ['nodescription', '    Trust: 40/100 (Wary)'],
      ['nodescriptor.nodescription', '    Trust: 40/100'],
      ['norange.nodescription', '    Trust: Wary'],
      ['norange.nodescriptor', '    Trust: How far he trusts you.'],
      ['norange.nodescriptor.nodescription', '    Trust'],
    ];
    for (const [ids, expected] of cases) {
      expect(line(chip('ENTITIES', ids)), ids).toBe(expected);
    }
  });

  it('reads the ids in any order, as the Stats chip does', () => {
    expect(line('<ENTITIES|nodescription.norange>')).toBe(line('<ENTITIES|norange.nodescription>'));
  });

  it('renders the pieces in the markdown format', () => {
    expect(line('<ENTITIES|norange.markdown>')).toBe('    - **Trust:** Wary — How far he trusts you.');
    expect(line('<ENTITIES|nodescriptor.markdown>')).toBe('    - **Trust:** 40/100 — How far he trusts you.');
    expect(line('<ENTITIES|nodescription.markdown>')).toBe('    - **Trust:** 40/100 (Wary)');
    expect(line('<ENTITIES|norange.nodescriptor.nodescription.markdown>')).toBe('    - **Trust**');
  });

  it('renders the pieces in the xml format', () => {
    const xml = (ids: string) => values(`<ENTITIES|${ids}.xml>`)!;
    expect(xml('norange')).not.toContain('<value>');
    expect(xml('norange')).toContain('<status>Wary</status>');
    expect(xml('nodescriptor')).not.toContain('<status>');
    expect(xml('nodescriptor')).toContain('<value>40/100</value>');
    expect(xml('nodescription')).not.toContain('<meaning>');
    expect(xml('nodescriptor')).toContain('<meaning>How far he trusts you.</meaning>');
    expect(xml('norange.nodescriptor.nodescription')).toContain('  <stats>\n    <stat>\n      <name>Trust</name>\n    </stat>\n  </stats>\n');
  });

  it('applies in the summary content and in Sub-Locations with stats on', () => {
    expect(line('<ENTITIES|summary.norange>')).toBe('    Trust: Wary — How far he trusts you.');
    const lower = lookup(scene({ presentIds: [], ownedStats: { merchant: [trust] } }));
    expect(lower('<ENTITIES|sublocations.stats.norange>')).toContain('    Trust: Wary — How far he trusts you.');
  });

  it('is moot with stats off and under Name content', () => {
    expect(values('<ENTITIES|nostats.norange>')).toBe(values('<ENTITIES|nostats>'));
    expect(values('<ENTITIES|name.norange.nodescriptor>')).toBe(values('<ENTITIES|name>'));
  });
});

describe('the Persona chip options', () => {
  const traveler: Entity = { id: 'traveler', name: 'Traveler', pronouns: 'they/them', aiDescription: 'A road-worn traveler.', aiSummary: 'A quiet traveler.', traits: [sworn] };
  const library: ResolvedPersona = { entity: traveler, source: 'library' };
  const world: ResolvedPersona = { entity: traveler, source: 'world' };
  const played = (stats: PlayerStat[]) => ownerStatParts([traveler], { traveler: stats });
  const withStatsAndTrait = scene({ persona: library, playedStats: played([trust]), ownedTraits: { traveler: ['sworn'] }, ownedStats: { traveler: [trust] } });
  const bare = scene({ persona: library, playedStats: played([]), ownedTraits: {}, ownedStats: {} });
  const traitOnly = scene({ persona: library, playedStats: played([]), ownedTraits: { traveler: ['sworn'] }, ownedStats: {} });

  it('keeps a persona that owns a picked kind and renders the same block as without the filter', () => {
    const values = lookup(withStatsAndTrait);
    for (const format of ['', 'markdown', 'xml']) {
      expect(values(chip('PERSONA', 'withstats', format))).toBe(values(chip('PERSONA', format)));
      expect(values(chip('PERSONA', 'withtraits', format))).toBe(values(chip('PERSONA', format)));
    }
    expect(values('<PERSONA|name.withstats>')).toBe('Traveler (they/them)');
  });

  it('renders what an unset persona renders when the persona owns none of the picked kind', () => {
    const noPersona = lookup(scene({ persona: null }));
    for (const [label, values] of [['stat-less', lookup(traitOnly)], ['empty', lookup(bare)]] as const) {
      expect(values('<PERSONA|withstats>'), label).toBe(NONE_PLACEHOLDER);
      expect(values('<PERSONA|withstats.markdown>'), label).toBe(noPersona('<PERSONA|markdown>'));
      expect(values('<PERSONA|name.withstats>'), label).toBe(NONE_PLACEHOLDER);
      expect(values('<PERSONA|summary.withstats.xml>'), label).toBe(noPersona('<PERSONA|summary.xml>'));
    }
    expect(lookup(bare)('<PERSONA|withtraits>')).toBe(NONE_PLACEHOLDER);
    expect(lookup(traitOnly)('<PERSONA|withtraits>')).toContain('Sworn');
  });

  it('renders nothing under a header, pre or post when the filter drops the persona', () => {
    const template = 'Before\n<PERSONA|withstats.markdown|pre="\n## Player Character\n"|post="\n"|header="Player Character">\nAfter';
    const dropped = renderPromptTemplate(template, lookup(traitOnly));
    expect(dropped).toBe(renderPromptTemplate(template, lookup(scene({ persona: null }))));
    expect(dropped).not.toContain('Player Character');
    expect(renderPromptTemplate('<PERSONA|withstats>', lookup(traitOnly))).toBe(NONE_PLACEHOLDER);
    expect(renderPromptTemplate(template, lookup(withStatsAndTrait))).toContain('Player Character');
  });

  it('drops the known-person line with a filtered-out world persona', () => {
    const dropped = lookup({ ...traitOnly, persona: world })('<PERSONA|withstats>');
    expect(dropped).toBe(NONE_PLACEHOLDER);
    expect(lookup({ ...withStatsAndTrait, persona: world })('<PERSONA|withstats>')).toContain(knownPersonaLine('Traveler'));
  });

  it('ignores the Include toggles in the filter', () => {
    const values = lookup(withStatsAndTrait);
    const out = values('<PERSONA|withtraits.notraits.nostats>')!;
    expect(out).toContain('Traveler');
    expect(out).not.toContain('Sworn');
    expect(out).not.toContain('stats:');
  });

  it('turns traits off and picks stat detail', () => {
    const values = lookup(withStatsAndTrait);
    expect(values('<PERSONA>')).toContain('traits:');
    expect(values('<PERSONA|notraits>')).not.toContain('traits');
    expect(values('<PERSONA|summary.notraits.markdown>')).not.toContain('traits');
    expect(values('<PERSONA|notraits>')).toContain('stats:');
    expect(values('<PERSONA|norange.nodescriptor>')).toContain('  stats:\n    Trust: How far he trusts you.\n');
    expect(values('<PERSONA|nodescription.markdown>')).toContain('    - **Trust:** 40/100 (Wary)\n');
  });
});
