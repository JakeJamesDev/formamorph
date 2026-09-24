import { describe, it, expect } from 'vitest';
import { chipValues } from './chipValues';
import type { ChipScene } from './chipScene';
import { knownPersonaLine } from '../personaContext';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import { variableForToken, variableVariantIds, withVariant } from '../promptVariables';
import type { Connection, DictionaryEntry, Entity, GameLocation, PlayerStat, Trait, TraitGroup } from '@/types';
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

describe('the drift guard', () => {
  it('has a value for every token and variant the registry defines for each scene-derived chip, and no other', () => {
    // Derived from the registry's axes, so an option added there is expected here before any builder knows it.
    const expected = SCENE_CHIPS.flatMap((base) => {
      const variable = variableForToken(base)!;
      return [base, ...variableVariantIds(variable).map((id) => withVariant(base, id))];
    });
    const values = chipValues(scene());
    expect(Object.keys(values).sort()).toEqual([...expected].sort());
    for (const token of expected) expect(values[token], token).toBeTruthy();
  });
});

describe('the World Description chip', () => {
  it('carries the overview text', () => {
    expect(chipValues(scene())['<WORLD DESCRIPTION>']).toBe('A quiet stretch of coast.');
  });
});

describe('the Entities chip', () => {
  it('lists a character in the highest scope it belongs to: here beats sub-location beats reachable', () => {
    const values = chipValues(scene());
    // The Guard is here and in the Gatehouse; only Here lists him.
    expect(values['<ENTITIES|name>']).toBe('Guard');
    // The Merchant is in the Gatehouse and the Market; the sub-location scope wins over reachable.
    expect(values['<ENTITIES|sublocations.name>']).toBe('Merchant');
    expect(values['<ENTITIES|reachable.name>']).toBe('Watchman');
  });

  it('lists the in-scene roster from the scene ids, wherever they are from', () => {
    const values = chipValues(scene());
    expect(values['<ENTITIES|inscene.name>']).toBe('Guard, Wanderer');
    expect(values['<ENTITIES|inscene>']).toContain('Came in with the last caravan.');
    expect(values['<ENTITIES|inscene>']).not.toContain('Merchant');
  });

  it('renders the Name content as a plain name list in every scope and format', () => {
    const values = chipValues(scene());
    for (const scope of ['', 'sublocations.', 'reachable.', 'inscene.']) {
      for (const format of ['', '.markdown', '.xml']) {
        const value = values[`<ENTITIES|${scope}name${format}>`];
        expect(value, `${scope}name${format}`).toMatch(/^[A-Za-z ,]+$/);
      }
    }
  });

  it('renders the placeholder in every scope when nobody is there', () => {
    const values = chipValues(scene({ presentIds: [], inSceneIds: [], entities: [] }));
    for (const token of ['<ENTITIES>', '<ENTITIES|sublocations.name>', '<ENTITIES|reachable.xml>', '<ENTITIES|inscene>']) {
      expect(values[token]).toBe(NONE_PLACEHOLDER);
    }
  });
});

describe('the Location chip', () => {
  it('renders the current location, its parent, its sub-locations and its neighbors by scope', () => {
    const values = chipValues(scene());
    expect(values['<LOCATION|name>']).toBe('North Gate');
    expect(values['<LOCATION|parent.name>']).toBe('Old Town');
    expect(values['<LOCATION|sublocations.name>']).toBe('Gatehouse');
    expect(values['<LOCATION|reachable.name>']).toBe('Old Town, Market');
    expect(values['<LOCATION|summary>']).toContain('A towering stone gate.');
    expect(values['<LOCATION|summary>']).not.toContain('portcullis');
  });

  it('renders the placeholder in every scope with no location', () => {
    const values = chipValues(scene({ location: null }));
    for (const token of ['<LOCATION>', '<LOCATION|parent.name>', '<LOCATION|destinations.markdown>']) {
      expect(values[token]).toBe(NONE_PLACEHOLDER);
    }
  });
});

describe('the Stats chip', () => {
  it('combines the pieces the token selects, in each format', () => {
    const values = chipValues(scene());
    // Descriptor alone: a word and no number.
    expect(values['<STATS DESCRIPTION|descriptions>']).toBe('Health: Winded');
    expect(values['<STATS DESCRIPTION|numbers>']).toBe('Health: 62/100');
    expect(values['<STATS DESCRIPTION|numbers.descriptions.meaning>']).toBe('Health: 62/100 (Winded) — Physical stamina.');
    expect(values['<STATS DESCRIPTION|numbers.markdown>']).toBe('- **Health:** 62/100');
    expect(values['<STATS DESCRIPTION|meaning.xml>']).toBe('<stat>\n  <name>Health</name>\n  <meaning>Physical stamina.</meaning>\n</stat>');
  });

  it('renders the placeholder with no stats', () => {
    expect(chipValues(scene({ stats: [] }))['<STATS DESCRIPTION|numbers.descriptions>']).toBe(NONE_PLACEHOLDER);
  });
});

describe('the Traits chip', () => {
  it('groups the traits in force under their group header, per format', () => {
    const values = chipValues(scene());
    expect(values['<TRAITS DESCRIPTION>']).toBe(
      'Light Sleeper: Wakes at the smallest sound.\nOrigin:\n  Where you come from.\n  Saltborn: Raised on the coast.',
    );
    expect(values['<TRAITS DESCRIPTION|markdown>']).toContain('- **Origin:** Where you come from.\n  - **Saltborn:** Raised on the coast.');
    expect(values['<TRAITS DESCRIPTION|xml>']).toContain('<group>');
    expect(values['<TRAITS DESCRIPTION|xml>']).toContain('<name>Saltborn</name>');
  });

  it('renders the placeholder when no trait is in force', () => {
    const values = chipValues(scene({ traits: [] }));
    expect(values['<TRAITS DESCRIPTION>']).toBe(NONE_PLACEHOLDER);
    expect(values['<TRAITS DESCRIPTION|xml>']).toBe(NONE_PLACEHOLDER);
  });
});

describe('the Persona chip', () => {
  it('renders the three contents from the persona entity', () => {
    const values = chipValues(scene({ persona: libraryPersona }));
    expect(values['<PERSONA>']).toContain('A road-worn traveler with a patched coat.');
    expect(values['<PERSONA|summary>']).toContain('A road-worn, quiet traveler.');
    expect(values['<PERSONA|summary>']).not.toContain('patched coat');
    expect(values['<PERSONA|name>']).toBe('Traveler (they/them)');
    expect(values['<PERSONA|name.xml>']).toBe('Traveler (they/them)');
  });

  it('ends a world persona in the known-person line, and never a library one', () => {
    const world = chipValues(scene({ persona: worldPersona }));
    const library = chipValues(scene({ persona: libraryPersona }));
    expect(world['<PERSONA|markdown>']).toBe(`${library['<PERSONA|markdown>']}${knownPersonaLine('Traveler')}\n`);
    expect(library['<PERSONA>']).not.toContain(knownPersonaLine('Traveler'));
    expect(world['<PERSONA|name>']).toBe('Traveler (they/them)');
  });

  it('renders the placeholder with no persona', () => {
    expect(chipValues(scene())['<PERSONA|summary.markdown>']).toBe(NONE_PLACEHOLDER);
  });
});

describe('the lore blocks', () => {
  it('splits the entries by position: Background before, Foreground after', () => {
    const values = chipValues(scene());
    expect(values['<DICTIONARY|before>']).toBe('The Long Ebb: The season when the wrecks show.');
    expect(values['<DICTIONARY>']).toBe('Salt Glass: Green glass the tide grinds smooth.');
  });

  it('renders the placeholder for an empty block', () => {
    const values = chipValues(scene({ lore: [] }));
    expect(values['<DICTIONARY>']).toBe(NONE_PLACEHOLDER);
    expect(values['<DICTIONARY|before>']).toBe(NONE_PLACEHOLDER);
  });
});

describe('the Notes and Time chips', () => {
  it('carry the notes and the story clock', () => {
    const values = chipValues(scene());
    expect(values['<NOTES>']).toBe('Looking for the map-seller.');
    expect(values['<TIME>']).toBe('Day 2, afternoon');
  });

  it('render the placeholder when absent', () => {
    const values = chipValues(scene({ notes: '', time: null }));
    expect(values['<NOTES>']).toBe(NONE_PLACEHOLDER);
    expect(values['<TIME>']).toBe(NONE_PLACEHOLDER);
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
    const unresolved = Object.entries(values).filter(([, value]) => value.includes(chip)).map(([token]) => token);
    expect(unresolved).toEqual([]);
    expect(values['<ENTITIES|name>']).toBe('Guard of salt');
    expect(values['<NOTES>']).toBe('Notes of salt.');
  });
});
