import { describe, it, expect } from 'vitest';
import { chipValues, sceneEntityChipValues } from './chipValues';
import type { ChipScene } from './chipScene';
import { knownPersonaLine } from '../personaContext';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import { baseToken, decodeVariant, encodeVariant, joinToken, tokenVariant, variableForToken, withVariant } from '../promptVariables';
import { renderPromptTemplate } from '../promptTemplate';
import { foreignTokens, spelledTokens } from '@/test/chipTokens';
import type { Connection, DictionaryEntry, Entity, GameLocation, PlayerStat, StatGroup, Trait, TraitGroup } from '@/types';
import { createStatRequest } from '../statRequest';
import type { ResolvedPersona } from '../persona';

// The town: Old Town contains North Gate and the Market; North Gate contains the Gatehouse.
const oldTown: GameLocation = { id: 'old-town', name: 'Old Town', aiDescription: 'Terraced streets above the river.' };
const northGate: GameLocation = {
  id: 'north-gate', name: 'North Gate', parentId: 'old-town',
  aiDescription: 'A towering stone gate, portcullis raised.', aiSummary: 'A towering stone gate.',
};
const gatehouse: GameLocation = { id: 'gatehouse', name: 'Gatehouse', parentId: 'north-gate', aiDescription: 'A cramped guard room.' };
const market: GameLocation = { id: 'market', name: 'Market', parentId: 'old-town', aiDescription: 'Stalls under canvas.' };
const locations = [oldTown, northGate, gatehouse, market];
const connections: Connection[] = [];

// The cast. The Guard also keeps a bunk in the Gatehouse; the Merchant trades in the Gatehouse and the Market.
const guard: Entity = {
  id: 'guard', name: 'Guard', pronouns: 'he/him', locations: ['north-gate', 'gatehouse'],
  aiDescription: 'A burly guard in full plate.', aiSummary: 'A burly guard.',
};
const merchant: Entity = { id: 'merchant', name: 'Merchant', locations: ['gatehouse', 'market'], aiDescription: 'Sells maps.' };
const watchman: Entity = { id: 'watchman', name: 'Watchman', locations: ['market'], aiDescription: 'Walks the stalls.' };
const wanderer: Entity = { id: 'wanderer', name: 'Wanderer', aiDescription: 'Came in with the last caravan.' };
const entities = [guard, merchant, watchman, wanderer];

const health: PlayerStat = {
  id: 'health', name: 'Health', type: 'number', description: 'Physical stamina.', min: 0, max: 100, value: 62, regen: 0,
  descriptors: [{ id: 'd1', threshold: 70, description: 'Winded' }, { id: 'd2', threshold: 100, description: 'Hale' }],
};

const traitGroups: TraitGroup[] = [{ id: 'origin', name: 'Origin', aiDescription: 'Where you come from.', parentId: null }];
const saltborn: Trait = { id: 'saltborn', name: 'Saltborn', groupId: 'origin', aiDescription: 'Raised on the coast.', statChanges: [] };
const lightSleeper: Trait = { id: 'light-sleeper', name: 'Light Sleeper', aiDescription: 'Wakes at the smallest sound.', statChanges: [] };

const traveler: Entity = {
  id: 'traveler', name: 'Traveler', pronouns: 'they/them', aliases: ['the Wanderer'],
  aiDescription: 'A road-worn traveler with a patched coat.', aiSummary: 'A road-worn, quiet traveler.',
};
const libraryPersona: ResolvedPersona = { entity: traveler, source: 'library' };
const worldPersona: ResolvedPersona = { entity: traveler, source: 'world' };

const lore: DictionaryEntry[] = [
  { id: 'ebb', name: 'The Long Ebb', key: ['ebb'], value: 'The season when the wrecks show.', position: 'before' },
  { id: 'glass', name: 'Salt Glass', key: ['glass'], value: 'Green glass the tide grinds smooth.' },
];

const scene = (over: Partial<ChipScene> = {}): ChipScene => ({
  overview: 'A quiet stretch of coast.',
  stats: [health],
  traits: [saltborn, lightSleeper],
  traitGroups,
  persona: null,
  location: northGate,
  locations,
  connections,
  entities,
  presentIds: ['guard'],
  inSceneIds: ['guard', 'wanderer'],
  lore,
  notes: 'Looking for the map-seller.',
  time: { elapsed: 30 },
  resolve: (text) => text,
  ...over,
});

/** The scene-derived chips, spelled as the registry spells them. The registry carries no scene-derived
 *  flag, so a new family is added here by hand; only its variants are derived. */
const SCENE_CHIPS = [
  '<WORLD DESCRIPTION>', '<STATS DESCRIPTION>', '<TRAITS DESCRIPTION>', '<PERSONA>', '<LOCATION>', '<ENTITIES>',
  '<NOTES>', '<TIME>', '<DICTIONARY>',
];

describe('the render guard', () => {
  it('renders every token a prompt can spell on a scene-derived chip, in any combination of its options', () => {
    // Read from the registry's axes and the parser, so an option added there is expected here before any builder knows it.
    const values = chipValues(scene());
    for (const token of SCENE_CHIPS.flatMap(spelledTokens)) expect(values(token), token).toBeTruthy();
  });

  it('leaves a token with another chip’s id, or an affix, without a value, so it stays text', () => {
    const values = chipValues(scene());
    for (const token of SCENE_CHIPS.flatMap(foreignTokens)) expect(values(token), token).toBeUndefined();
    expect(values('<NOTES|pre=" at ">')).toBeUndefined();
    expect(values('<ENTITIES|markdown.summary>')).toBeUndefined();
  });

  it('renders every spelled token through the prompt renderer, affixes included', () => {
    const values = chipValues(scene());
    for (const token of SCENE_CHIPS.flatMap(spelledTokens)) {
      const value = values(token)!;
      const placed = joinToken({ base: baseToken(token), variantId: tokenVariant(token), pre: '[', post: ']' });
      const expected = value === NONE_PLACEHOLDER ? '' : `[${value}]`;
      expect(renderPromptTemplate(`A${placed}B`, values), token).toBe(`A${expected}B`);
    }
  });

  it('reads the Persona Name for chip Headers', () => {
    expect(chipValues(scene({ playerName: ' Mira ' }))('header:{{user}}')).toBe('Mira');
  });

  it('renders a key once, so two placements of one token share one value', () => {
    let calls = 0;
    const values = chipValues(scene({ resolve: (text) => { calls += 1; return text; } }));
    const first = values('<ENTITIES|summary.markdown>');
    const after = calls;
    expect(values('<ENTITIES|summary.markdown>')).toBe(first);
    expect(calls).toBe(after);
  });
});

describe('the World Description chip', () => {
  it('carries the overview text', () => {
    expect(chipValues(scene())('<WORLD DESCRIPTION>')).toBe('A quiet stretch of coast.');
  });
});

describe('the Entities chip', () => {
  it('lists a character in the highest scope it belongs to: here beats sub-location beats reachable', () => {
    const values = chipValues(scene());
    // The Guard is here and in the Gatehouse; only Here lists him.
    expect(values('<ENTITIES|name>')).toBe('Guard');
    // The Merchant is in the Gatehouse and the Market; the sub-location scope wins over reachable.
    expect(values('<ENTITIES|sublocations.name>')).toBe('Merchant');
    expect(values('<ENTITIES|reachable.name>')).toBe('Watchman');
  });

  it('lists a known entity only in Known, and never one a higher scope lists', () => {
    // Both are Known In Old Town, which holds the North Gate. The Guard is here, so Here wins for him.
    const herald: Entity = { id: 'herald', name: 'Herald', locations: ['market'], knownIn: ['old-town'], aiSummary: 'Reads the decrees.' };
    const values = chipValues(scene({ entities: [{ ...guard, knownIn: ['old-town'] }, merchant, watchman, herald] }));
    expect(values('<ENTITIES|known.name>')).toBe('Herald');
    expect(values('<ENTITIES|known>')).toContain('Reads the decrees.');
    // The Herald stands in the Market, a reachable place, but a picked entity is never Nearby.
    expect(values('<ENTITIES|reachable.name>')).toBe('Watchman');
    expect(values('<ENTITIES|name>')).toBe('Guard');
  });

  it('lists the in-scene roster from the scene ids, wherever they are from', () => {
    const values = chipValues(scene());
    expect(values('<ENTITIES|inscene.name>')).toBe('Guard, Wanderer');
    expect(values('<ENTITIES|inscene>')).toContain('Came in with the last caravan.');
    expect(values('<ENTITIES|inscene>')).not.toContain('Merchant');
  });

  it('renders the Name content as a plain name list in every scope and format', () => {
    const values = chipValues(scene());
    for (const scope of ['', 'sublocations.', 'reachable.', 'inscene.']) {
      for (const format of ['', '.markdown', '.xml']) {
        const value = values(`<ENTITIES|${scope}name${format}>`);
        expect(value, `${scope}name${format}`).toMatch(/^[A-Za-z ,]+$/);
      }
    }
  });

  it('renders the placeholder in every scope when nobody is there', () => {
    const values = chipValues(scene({ presentIds: [], inSceneIds: [], entities: [] }));
    for (const token of ['<ENTITIES>', '<ENTITIES|sublocations.name>', '<ENTITIES|reachable.xml>', '<ENTITIES|inscene>']) {
      expect(values(token)).toBe(NONE_PLACEHOLDER);
    }
  });

  it('lists the outer scopes from their own roster when the scene names one, and Here from the full roster', () => {
    // A runtime character invented in the Gatehouse: Here and In Scene know it; the outer scopes list the
    // authored cast only, as play does.
    const stray: Entity = { id: 'stray', name: 'Stray', locations: ['gatehouse'], aiDescription: 'Turned up one night.' };
    const values = chipValues(scene({ entities: [...entities, stray], outerScopeEntities: entities, inSceneIds: ['stray'] }));
    expect(values('<ENTITIES|sublocations.name>')).toBe('Merchant');
    expect(values('<ENTITIES|inscene.name>')).toBe('Stray');
    // Without the field, one roster serves every scope.
    expect(chipValues(scene({ entities: [...entities, stray] }))('<ENTITIES|sublocations.name>')).toBe('Merchant, Stray');
  });

  it('keeps an unresolved participant name in the In Scene Name content only', () => {
    const values = chipValues(scene({ inSceneIds: ['guard'], inSceneNames: ['the ferryman'] }));
    expect(values('<ENTITIES|inscene.name>')).toBe('Guard, the ferryman');
    expect(values('<ENTITIES|inscene.name.xml>')).toBe('Guard, the ferryman');
    expect(values('<ENTITIES|inscene>')).not.toContain('ferryman');
    // With nobody resolved, the names alone are the list.
    expect(chipValues(scene({ inSceneIds: [], inSceneNames: ['the ferryman'] }))('<ENTITIES|inscene.name>')).toBe('the ferryman');
  });
});

describe('entity stats on the Entities chip', () => {
  const trust: PlayerStat = {
    id: 'trust', name: 'Trust', type: 'number', description: 'How far he trusts you.', min: 0, max: 100, value: 40, regen: 0,
    descriptors: [{ id: 't1', threshold: 50, description: 'Wary' }, { id: 't2', threshold: 100, description: 'Warm' }],
  };
  const withStats = scene({ ownedStats: { guard: [trust], merchant: [trust], wanderer: [trust] } });
  const without = scene();
  const line = 'Trust: 40/100 (Wary) — How far he trusts you.';

  it('lists each entity’s stats with range, descriptor and meaning in the simple format, in Here and In Scene', () => {
    const values = chipValues(withStats);
    expect(values('<ENTITIES>')).toContain(`  stats:\n    ${line}\n`);
    expect(values('<ENTITIES|inscene>')).toContain(`  stats:\n    ${line}\n`);
  });

  it('nests the stats in the markdown and XML formats', () => {
    const values = chipValues(withStats);
    expect(values('<ENTITIES|markdown>')).toContain(`  - **stats:**\n    - **Trust:** 40/100 (Wary) — How far he trusts you.\n`);
    expect(values('<ENTITIES|xml>')).toContain(
      '  <stats>\n    <stat>\n      <name>Trust</name>\n      <value>40/100</value>\n      <status>Wary</status>\n'
      + '      <meaning>How far he trusts you.</meaning>\n    </stat>\n  </stats>\n',
    );
  });

  it('carries the stats in the Summary content too, for the planner', () => {
    expect(chipValues(withStats)('<ENTITIES|summary>')).toContain(`  stats:\n    ${line}\n`);
  });

  it('leaves the stats out of the Name content', () => {
    const values = chipValues(withStats);
    expect(values('<ENTITIES|name>')).toBe(chipValues(without)('<ENTITIES|name>'));
    expect(values('<ENTITIES|inscene.name.xml>')).toBe(chipValues(without)('<ENTITIES|inscene.name.xml>'));
  });

  it('leaves the stats out of the Sub and Reachable scopes, who are not present', () => {
    const values = chipValues(scene({ ownedStats: { merchant: [trust], watchman: [trust] } }));
    expect(values('<ENTITIES|sublocations>')).toBe(chipValues(without)('<ENTITIES|sublocations>'));
    expect(values('<ENTITIES|reachable.markdown>')).toBe(chipValues(without)('<ENTITIES|reachable.markdown>'));
  });

  it('renders the block as before when the stats piece is off', () => {
    const values = chipValues(withStats);
    const entitiesChip = variableForToken('<ENTITIES>')!;
    const token = (scope: string | null, content: string | null, stats: string | null, format: string | null) =>
      withVariant('<ENTITIES>', encodeVariant(entitiesChip, { scope, content, stats, format }));
    for (const scope of [null, 'inscene']) {
      for (const content of [null, 'summary']) {
        for (const format of [null, 'markdown', 'xml']) {
          const off = token(scope, content, 'nostats', format);
          expect(values(off), off).toBe(chipValues(without)(token(scope, content, null, format)));
        }
      }
    }
  });

  it('renders an entity with no stats as before', () => {
    const values = chipValues(scene({ ownedStats: { wanderer: [trust] } }));
    expect(values('<ENTITIES>')).toBe(chipValues(without)('<ENTITIES>'));
    expect(values('<ENTITIES|inscene>')).toContain('Wanderer\n  description: Came in with the last caravan.\n  stats:');
    expect(values('<ENTITIES|inscene>')).not.toContain('Guard\n  pronouns: he/him\n  description: A burly guard in full plate.\n  stats:');
  });

  it('renders a hidden stat, since hidden only hides it from the player', () => {
    const secret: PlayerStat = { ...trust, id: 'secret', name: 'Grudge', hidden: true, descriptors: [] };
    expect(chipValues(scene({ ownedStats: { guard: [secret] } }))('<ENTITIES>')).toContain('Grudge: 40/100 — How far he trusts you.');
  });

  it('lists several stats in the order the scene holds them', () => {
    const second: PlayerStat = { ...trust, id: 'fear', name: 'Fear', description: '', descriptors: [], value: 7 };
    const block = chipValues(scene({ ownedStats: { guard: [trust, second] } }))('<ENTITIES>');
    expect(block).toContain(`  stats:\n    ${line}\n    Fear: 7/100\n`);
  });

  it('keeps the scene-roster override on the same stats', () => {
    const values = sceneEntityChipValues(withStats, ['guard']);
    expect(values('<ENTITIES>')).toContain(`stats:\n    ${line}`);
    expect(values('<ENTITIES|nostats>')).not.toContain('stats:');
  });
});

describe('the scene-roster override for the Choices prompt', () => {
  it('covers every unscoped Entities token, so no chip can slip the scene filter, and leaves the scoped ones', () => {
    const entitiesChip = variableForToken('<ENTITIES>')!;
    const values = sceneEntityChipValues(scene(), ['guard']);
    for (const token of spelledTokens('<ENTITIES>')) {
      const unscoped = decodeVariant(entitiesChip, tokenVariant(token)).scope == null;
      if (unscoped) expect(values(token), token).toBeTruthy();
      else expect(values(token), token).toBeUndefined();
    }
  });

  it('lists only the scene cast under the Name content, resolved, and leaves the scoped variants alone', () => {
    const values = sceneEntityChipValues(
      scene({ resolve: (text) => text.replace('Merchant', 'Peddler') }),
      ['guard', 'merchant'],
    );
    expect(values('<ENTITIES|name>')).toBe('Guard, Peddler');
    expect(values('<ENTITIES|name.markdown>')).toBe('Guard, Peddler');
    expect(values('<ENTITIES>')).toContain('Sells maps.');
    expect(values('<ENTITIES|sublocations.name>')).toBeUndefined();
  });

  it('renders the placeholder when nobody is in the scene', () => {
    expect(sceneEntityChipValues(scene(), [])('<ENTITIES|name>')).toBe(NONE_PLACEHOLDER);
  });
});

describe('the Location chip', () => {
  it('renders the current location, its parent, its sub-locations and its neighbors by scope', () => {
    const values = chipValues(scene());
    expect(values('<LOCATION|name>')).toBe('North Gate');
    expect(values('<LOCATION|parent.name>')).toBe('Old Town');
    expect(values('<LOCATION|sublocations.name>')).toBe('Gatehouse');
    expect(values('<LOCATION|reachable.name>')).toBe('Old Town, Market');
    expect(values('<LOCATION|summary>')).toContain('A towering stone gate.');
    expect(values('<LOCATION|summary>')).not.toContain('portcullis');
  });

  it('renders the placeholder in every scope with no location', () => {
    const values = chipValues(scene({ location: null }));
    for (const token of ['<LOCATION>', '<LOCATION|parent.name>', '<LOCATION|destinations.markdown>']) {
      expect(values(token)).toBe(NONE_PLACEHOLDER);
    }
  });
});

describe('the Stats chip', () => {
  it('combines the pieces the token selects, in each format', () => {
    const values = chipValues(scene());
    // Descriptor alone: a word and no number.
    expect(values('<STATS DESCRIPTION|descriptions>')).toBe('Health: Winded');
    expect(values('<STATS DESCRIPTION|numbers>')).toBe('Health: 62/100');
    expect(values('<STATS DESCRIPTION|numbers.descriptions.meaning>')).toBe('Health: 62/100 (Winded) — Physical stamina.');
    expect(values('<STATS DESCRIPTION|numbers.markdown>')).toBe('- **Health:** 62/100');
    expect(values('<STATS DESCRIPTION|meaning.xml>')).toBe('<stat>\n  <name>Health</name>\n  <meaning>Physical stamina.</meaning>\n</stat>');
  });

  it('renders the placeholder with no stats', () => {
    expect(chipValues(scene({ stats: [] }))('<STATS DESCRIPTION|numbers.descriptions>')).toBe(NONE_PLACEHOLDER);
  });
});

describe("the stats of played entities that are not the persona, in the Stats chip", () => {
  const calm: PlayerStat = { ...health, id: 'calm', name: 'Calm', description: 'Composure.', value: 30, descriptors: [] };
  const statsOf = (over: Partial<ChipScene>) => chipValues(scene(over));
  const played = (...stats: PlayerStat[]) => ({ ownerId: 'marked', stats, placement: { groups: [], authored: stats } });

  it("lists each played entity's stats after the world's, in each format", () => {
    const values = statsOf({ playedStats: [played(calm)] });
    expect(values('<STATS DESCRIPTION|numbers>')).toBe('Health: 62/100\nCalm: 30/100');
    expect(values('<STATS DESCRIPTION|numbers.meaning.markdown>'))
      .toBe('- **Health:** 62/100 — Physical stamina.\n- **Calm:** 30/100 — Composure.');
    expect(values('<STATS DESCRIPTION|numbers.xml>')).toBe(
      '<stat>\n  <name>Health</name>\n  <value>62/100</value>\n</stat>\n<stat>\n  <name>Calm</name>\n  <value>30/100</value>\n</stat>',
    );
  });

  it('lays each owner out by its own groups', () => {
    const mind: StatGroup = { id: 'mind', name: 'Mind', parentId: null };
    const grouped = { ...calm, groupId: 'mind' };
    const values = statsOf({ playedStats: [{ ownerId: 'marked', stats: [grouped], placement: { groups: [mind], authored: [grouped] } }] });
    expect(values('<STATS DESCRIPTION|numbers>')).toBe('Health: 62/100\nMind:\n  Calm: 30/100');
  });

  it('renders as before when no played entity holds a stat', () => {
    const before = statsOf({});
    const after = statsOf({ playedStats: [played()] });
    for (const token of [...SCENE_CHIPS.flatMap(spelledTokens), 'header:{{user}}']) expect(after(token), token).toBe(before(token));
    // Two world stats that share a name stay as the author wrote them.
    const twin = { ...health, id: 'twin' };
    expect(statsOf({ stats: [health, twin], playedStats: [played()] })('<STATS DESCRIPTION|numbers>'))
      .toBe('Health: 62/100\nHealth: 62/100');
  });

  it('lists the played stats alone when the world has none', () => {
    expect(statsOf({ stats: [], playedStats: [played(calm)] })('<STATS DESCRIPTION|numbers>')).toBe('Calm: 30/100');
  });

  it('numbers a played stat whose name clashes, as the stat request keys it', () => {
    const own = { ...health, id: 'own-health', name: '**Health**', value: 10 };
    const healthMax = { ...calm, id: 'health-max', name: 'Health max' };
    const values = statsOf({ playedStats: [played(own, healthMax)] });
    expect(values('<STATS DESCRIPTION|numbers>')).toBe('Health: 62/100\nHealth (2): 10/100\nHealth max (2): 30/100');
    const request = createStatRequest([health], {
      persona: { id: 'persona', name: 'Traveler', stats: [own, healthMax] },
    });
    // The persona's targets come first in the request; its keys number after the loose stat's.
    expect(request.targets.map((t) => t.key)).toEqual(['Health (2)', 'Health max (2)', 'Health']);
  });

  it('compares names as resolved', () => {
    const named = { ...calm, name: '{{vital}}' };
    const values = statsOf({ playedStats: [played(named)], resolve: (text) => text.replaceAll('{{vital}}', 'Health') });
    expect(values('<STATS DESCRIPTION|numbers>')).toBe('Health: 62/100\nHealth (2): 30/100');
  });

  it('renders a hidden stat, since hidden only hides it from the player', () => {
    expect(statsOf({ playedStats: [played({ ...calm, hidden: true })] })('<STATS DESCRIPTION|numbers>')).toContain('Calm: 30/100');
  });
});

describe('the Traits chip', () => {
  it('groups the traits in force under their group header, per format', () => {
    const values = chipValues(scene());
    expect(values('<TRAITS DESCRIPTION>')).toBe(
      'Light Sleeper: Wakes at the smallest sound.\nOrigin:\n  Where you come from.\n  Saltborn: Raised on the coast.',
    );
    expect(values('<TRAITS DESCRIPTION|markdown>')).toContain('- **Origin:** Where you come from.\n  - **Saltborn:** Raised on the coast.');
    expect(values('<TRAITS DESCRIPTION|xml>')).toContain('<group>');
    expect(values('<TRAITS DESCRIPTION|xml>')).toContain('<name>Saltborn</name>');
  });

  it('renders a Hidden trait in force like any other, with no marker (Q19)', () => {
    const secret: Trait = { ...lightSleeper, mode: 'hidden' };
    const values = chipValues(scene({ traits: [saltborn, secret] }));
    expect(values('<TRAITS DESCRIPTION>')).toBe(chipValues(scene())('<TRAITS DESCRIPTION>'));
    expect(values('<TRAITS DESCRIPTION>')).toContain('Light Sleeper: Wakes at the smallest sound.');
  });

  it('renders the placeholder when no trait is in force', () => {
    const values = chipValues(scene({ traits: [] }));
    expect(values('<TRAITS DESCRIPTION>')).toBe(NONE_PLACEHOLDER);
    expect(values('<TRAITS DESCRIPTION|xml>')).toBe(NONE_PLACEHOLDER);
  });

  // The traveler, played as a world persona, owns a scar in force and a vow that is not.
  const scarred: Trait = { id: 'scarred', name: 'Scarred', aiDescription: 'A pale line across one cheek.', statChanges: [] };
  const vow: Trait = { id: 'vow', name: 'Vow of Silence', aiDescription: 'Speaks to no one.', statChanges: [] };
  const played: ResolvedPersona = { source: 'world', entity: { ...traveler, traits: [scarred, vow] } };

  it("keeps the played entity's owned traits out of the Traits chip", () => {
    const values = chipValues(scene({ persona: played, ownedTraits: { traveler: ['scarred'] } }));
    expect(values('<TRAITS DESCRIPTION>')).toBe(chipValues(scene())('<TRAITS DESCRIPTION>'));
    expect(chipValues(scene({ traits: [], persona: played, ownedTraits: { traveler: ['scarred'] } }))('<TRAITS DESCRIPTION>'))
      .toBe(NONE_PLACEHOLDER);
  });
});

describe('owned traits in the Persona chip', () => {
  const scarred: Trait = { id: 'scarred', name: 'Scarred', aiDescription: 'A pale line across one cheek.', statChanges: [] };
  const vow: Trait = { id: 'vow', name: 'Vow of Silence', aiDescription: 'Speaks to no one.', statChanges: [] };
  const played: ResolvedPersona = { source: 'world', entity: { ...traveler, traits: [scarred, vow] } };
  const values = chipValues(scene({ persona: played, ownedTraits: { traveler: ['scarred'] } }));

  it("nests the played entity's owned traits in force in its block, as a cast member's", () => {
    expect(values('<PERSONA>')).toContain('  traits:\n    Scarred: A pale line across one cheek.');
    expect(values('<PERSONA>')).not.toContain('Vow of Silence');
    expect(values('<PERSONA|summary>')).toContain('  traits: Scarred');
    expect(values('<PERSONA|xml>')).toContain('<traits>');
  });

  it('places the traits inside the block, before the known-person line', () => {
    expect(values('<PERSONA>')!.indexOf('Scarred')).toBeLessThan(values('<PERSONA>')!.indexOf(knownPersonaLine('Traveler')));
  });

  it('leaves the name content bare', () => {
    expect(values('<PERSONA|name>')).not.toContain('Scarred');
  });
});

describe('owned traits in the Entities chip', () => {
  const oath: Trait = { id: 'oath', name: 'Sworn', aiDescription: 'Bound to the gate captain.', statChanges: [] };
  const sworn = scene({ entities: [{ ...guard, traits: [oath] }, merchant, watchman, wanderer], ownedTraits: { guard: ['oath'] } });

  it("gives every scope an NPC's owned traits in force", () => {
    const values = chipValues(sworn);
    expect(values('<ENTITIES>')).toContain('  traits:\n    Sworn: Bound to the gate captain.');
    expect(values('<ENTITIES|summary>')).toContain('  traits: Sworn');
    expect(values('<ENTITIES|inscene>')).toContain('Sworn: Bound to the gate captain.');
    // From the Market, the Guard is in the reachable scope.
    expect(chipValues({ ...sworn, location: market, presentIds: ['watchman'] })('<ENTITIES|reachable>'))
      .toContain('Sworn: Bound to the gate captain.');
    expect(sceneEntityChipValues(sworn, ['guard'])('<ENTITIES>')).toContain('Sworn: Bound to the gate captain.');
  });
});

describe('the Persona chip', () => {
  it('renders the three contents from the persona entity', () => {
    const values = chipValues(scene({ persona: libraryPersona }));
    expect(values('<PERSONA>')).toContain('A road-worn traveler with a patched coat.');
    expect(values('<PERSONA|summary>')).toContain('A road-worn, quiet traveler.');
    expect(values('<PERSONA|summary>')).not.toContain('patched coat');
    expect(values('<PERSONA|name>')).toBe('Traveler (they/them)');
    expect(values('<PERSONA|name.xml>')).toBe('Traveler (they/them)');
  });

  it('ends a world persona in the known-person line, and never a library one', () => {
    const world = chipValues(scene({ persona: worldPersona }));
    const library = chipValues(scene({ persona: libraryPersona }));
    expect(world('<PERSONA|markdown>')).toBe(`${library('<PERSONA|markdown>')}${knownPersonaLine('Traveler')}\n`);
    expect(library('<PERSONA>')).not.toContain(knownPersonaLine('Traveler'));
    expect(world('<PERSONA|name>')).toBe('Traveler (they/them)');
  });

  it('renders the placeholder with no persona', () => {
    expect(chipValues(scene())('<PERSONA|summary.markdown>')).toBe(NONE_PLACEHOLDER);
  });
});

describe('the lore blocks', () => {
  it('splits the entries by position: Background before, Foreground after', () => {
    const values = chipValues(scene());
    expect(values('<DICTIONARY|before>')).toBe('The Long Ebb: The season when the wrecks show.');
    expect(values('<DICTIONARY>')).toBe('Salt Glass: Green glass the tide grinds smooth.');
  });

  it('renders the placeholder for an empty block', () => {
    const values = chipValues(scene({ lore: [] }));
    expect(values('<DICTIONARY>')).toBe(NONE_PLACEHOLDER);
    expect(values('<DICTIONARY|before>')).toBe(NONE_PLACEHOLDER);
  });
});

describe('the Notes and Time chips', () => {
  it('carry the notes and the story clock', () => {
    const values = chipValues(scene());
    expect(values('<NOTES>')).toBe('Looking for the map-seller.');
    expect(values('<TIME>')).toBe('Day 2, afternoon');
  });

  it('render the placeholder when absent', () => {
    const values = chipValues(scene({ notes: '', time: null }));
    expect(values('<NOTES>')).toBe(NONE_PLACEHOLDER);
    expect(values('<TIME>')).toBe(NONE_PLACEHOLDER);
  });
});

describe('placeholder resolution', () => {
  it('applies to every value', () => {
    // A chip in every authored text; resolution draws it, so no value may still carry the token.
    const chip = '{{ph:coast:world:p1}}';
    const values = chipValues(scene({
      overview: `A coast of ${chip}.`,
      location: { ...northGate, aiDescription: `Gate of ${chip}.`, aiSummary: `Gate of ${chip}.` },
      locations: locations.map((l) => ({ ...l, aiDescription: `Place of ${chip}.` })),
      entities: entities.map((e) => ({ ...e, name: `${e.name} of ${chip}`, aiDescription: `Person of ${chip}.` })),
      stats: [{ ...health, name: `Health of ${chip}`, description: `Stamina of ${chip}.` }],
      traits: [{ ...saltborn, aiDescription: `Raised on ${chip}.` }],
      traitGroups: [{ ...traitGroups[0], aiDescription: `From ${chip}.` }],
      persona: { entity: { ...traveler, aiDescription: `Walks ${chip}.`, aiSummary: `Of ${chip}.` }, source: 'world' },
      lore: lore.map((entry) => ({ ...entry, value: `Lore of ${chip}.` })),
      notes: `Notes of ${chip}.`,
      resolve: (text) => text.replaceAll(chip, 'salt'),
    }));
    const unresolved = SCENE_CHIPS.flatMap(spelledTokens).filter((token) => values(token)?.includes(chip));
    expect(unresolved).toEqual([]);
    expect(values('<ENTITIES|name>')).toBe('Guard of salt');
    expect(values('<NOTES>')).toBe('Notes of salt.');
  });
});
