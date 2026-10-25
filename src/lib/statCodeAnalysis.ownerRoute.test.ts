import { describe, it, expect } from 'vitest';
import { statCodeCompletions, statCodeDiagnostics, type AnalysisOptions } from './statCodeAnalysis';
import { DELTA_MEMBERS, ENTITY_FIELDS, PREVIOUS_FIELDS, STAT_FIELDS, TRAIT_ENTRY_FIELDS } from './statCodeSurface';

/** Completions for a caret written as `|` in the doc. */
function labels(doc: string, options?: AnalysisOptions) {
  const pos = doc.indexOf('|');
  expect(pos, 'every completion case marks its caret with |').toBeGreaterThanOrEqual(0);
  return (statCodeCompletions(doc.replace('|', ''), pos, options)?.options ?? []).map((option) => option.label);
}

const messages = (code: string, options?: AnalysisOptions) =>
  statCodeDiagnostics(code, options).map((diagnostic) => diagnostic.message);

const WORLD = ['Destruction', 'Alert Level', 'Rage'];
const traits = [{ id: 'calm', name: 'Calm', path: [] }];
const entities = [
  { id: 'creature', name: 'Creature', persona: false, traits, stats: ['Rage', 'Hunger'] },
  { id: 'mira', name: 'Mira', persona: true, traits, stats: ['Trust'] },
];

/** The Creature's Rage: `owner.stats` holds the Creature's stats, and `stats` holds the world's. */
const owned: AnalysisOptions = { statNames: WORLD, owner: 'entity', ownerStatNames: ['Rage', 'Hunger'], selfName: 'Rage', entities };
/** Alert Level, a world stat: `owner` is the empty entry. */
const world: AnalysisOptions = { statNames: WORLD, ownerStatNames: [], selfName: 'Alert Level', entities };
/** A Blueprint stat: `owner` is an owner of the Blueprint, and the group lists only its own stats. */
const blueprint: AnalysisOptions = { statNames: WORLD, owner: 'blueprint', ownerStatNames: ['Hunger'], selfName: 'Hunger', entities };

const FIELDS = STAT_FIELDS.map((field) => field.name);

describe('completion on the owner route', () => {
  it('lists the entry fields after owner., in an owned box and in a world box', () => {
    for (const options of [owned, world, blueprint]) {
      expect(labels('return owner.|', options)).toEqual(ENTITY_FIELDS.map((field) => field.name));
    }
  });

  it('lists the owner’s stats after owner.stats., and the stat fields below an entry', () => {
    expect(labels('return owner.stats.|', owned)).toEqual(['Rage', 'Hunger']);
    expect(labels('return owner.stats.Rage.|', owned)).toEqual(FIELDS);
    expect(labels('return owner.stats["Hunger"].previous.|', owned)).toEqual(PREVIOUS_FIELDS.map((field) => field.name));
    expect(labels('return owner.stats.Rage.delta.|', owned)).toEqual(DELTA_MEMBERS.map((field) => field.name));
    expect(labels('return owner.stats?.|', owned)).toEqual(['Rage', 'Hunger']);
  });

  it('lists a Blueprint group’s stats after owner.stats., and no stat in a world box', () => {
    expect(labels('return owner.stats.|', blueprint)).toEqual(['Hunger']);
    expect(labels('return owner.stats.|', world)).toEqual([]);
  });

  it('lists the owner’s stats inside owner.stats[""], and not the world’s', () => {
    expect(labels('return owner.stats["|"];', owned)).toEqual(['Rage', 'Hunger']);
    expect(labels('return owner.stats[|', owned).slice(0, 2)).toEqual(['"Rage"', '"Hunger"']);
  });

  it('lists the world stats after stats. in every box, an owned box included', () => {
    // A name with a space needs brackets, so a dot leaves it out.
    for (const options of [owned, world, blueprint]) expect(labels('return stats.|', options)).toEqual(['Destruction', 'Rage']);
    expect(labels('return stats["|"];', owned)).toEqual(WORLD);
    expect(labels('return stats[|', owned).slice(0, 3)).toEqual(['"Destruction"', '"Alert Level"', '"Rage"']);
  });

  it('lists the entity’s own stats, and not the world’s, after entities.Name.stats[', () => {
    expect(labels('return entities.Creature.stats[|', owned).slice(0, 2)).toEqual(['"Rage"', '"Hunger"']);
    expect(labels('return persona.stats[|', owned).slice(0, 1)).toEqual(['"Trust"']);
  });

  it('lists the owner’s stats inside a string anywhere in an owner.stats[…] key', () => {
    expect(labels('return owner.stats["|" + suffix];', owned)).toEqual(['Rage', 'Hunger']);
  });

  it('offers owner among the globals', () => {
    expect(labels('return |', owned)).toContain('owner');
  });

  it('lists a trait’s fields after an owner trait, and no world trait names inside owner.traits[""]', () => {
    const withTraits = { ...owned, traits: ['Brave'] };
    expect(labels('return owner.traits.Calm.|', withTraits)).toEqual(TRAIT_ENTRY_FIELDS.map((field) => field.name));
    expect(labels('return owner.traits["|"];', withTraits)).toEqual([]);
  });
});

describe('writes on every stat route', () => {
  const FIELDS_WRITABLE = ['value', 'min', 'max', 'regen'];

  it('raises nothing for a write to a writable field through any route', () => {
    for (const field of FIELDS_WRITABLE) {
      for (const route of [
        'stats.Destruction', 'owner.stats.Hunger', 'entities.Creature.stats.Hunger', 'entities["Creature"].stats["Hunger"]',
        'persona.stats.Trust', 'entities?.Mira?.stats?.Trust',
      ]) {
        expect(messages(`${route}.${field} += 1;`, owned), `${route}.${field}`).toEqual([]);
        // The empty owner of a world box has no stats, so that route is the one a world box flags.
        if (route !== 'owner.stats.Hunger') expect(messages(`${route}.${field} += 1;`, world), `${route}.${field} in a world box`).toEqual([]);
      }
    }
  });

  it('raises nothing for an increment, or for a write through a variable that holds the entry', () => {
    expect(messages('entities.Creature.stats.Hunger.value++;', owned)).toEqual([]);
    expect(messages('const hunger = owner.stats.Hunger;\nhunger.max = 5;', owned)).toEqual([]);
    expect(messages('const hp = persona.stats.Trust;\nhp.regen -= 1;', owned)).toEqual([]);
  });

  it('still names a read-only field on every route, with the path it was reached by', () => {
    expect(messages('entities.Creature.stats.Hunger.name = "x";\nreturn 1;', owned))
      .toEqual(['entities.Creature.stats.Hunger.name can’t be written. Only entities.Creature.stats.Hunger.value, entities.Creature.stats.Hunger.min, entities.Creature.stats.Hunger.max, entities.Creature.stats.Hunger.regen, entities.Creature.stats.Hunger.hidden can.']);
    expect(messages('persona.stats.Trust.previous.value = 1;\nreturn 1;', owned)[0])
      .toBe('persona.stats.Trust.previous can’t be written. Only persona.stats.Trust.value, persona.stats.Trust.min, persona.stats.Trust.max, persona.stats.Trust.regen, persona.stats.Trust.hidden can.');
    expect(messages('stats.Destruction.id = "x";\nreturn 1;', owned)[0]).toMatch(/^stats\.Destruction\.id can’t be written/);
    expect(messages('owner.stats.Hunger.valeu = 1;\nreturn 1;', owned))
      .toEqual(['owner.stats.Hunger has no field “valeu”. Did you mean “value”?']);
  });

  it('warns that a whole entry can’t be replaced, on every route', () => {
    expect(messages('entities.Creature.stats.Hunger = 5;\nreturn 1;', owned)).toEqual(['Write to entities.Creature.stats.Hunger.value instead.']);
    expect(messages('persona.stats.Trust = 5;\nreturn 1;', owned)).toEqual(['Write to persona.stats.Trust.value instead.']);
    expect(messages('owner.stats.Hunger = 5;\nreturn 1;', owned)).toEqual(['Write to owner.stats.Hunger.value instead.']);
  });

  it('still calls a write to a whole stat map read-only, on every route', () => {
    expect(messages('entities.Creature.stats = {};\nreturn 1;', owned)).toEqual(['entities.Creature.stats is read-only.']);
    expect(messages('persona.stats = {};\nreturn 1;', owned)).toEqual(['persona.stats is read-only.']);
    expect(messages('owner.stats = {};\nreturn 1;', owned)).toEqual(['owner.stats is read-only.']);
  });

  it('counts a write through any route as the code doing something', () => {
    for (const code of ['entities.Creature.stats.Hunger.value = 1;', 'persona.stats.Trust.max = 1;', 'owner.stats.Hunger.regen = 1;', 'stats.Destruction.value = 1;']) {
      expect(messages(code, owned), code).toEqual([]);
    }
    expect(messages('const seen = owner.stats.Hunger.value;', owned)).toEqual([expect.stringMatching(/never returns/)]);
  });
});

describe('an unknown stat name', () => {
  it('is underlined after stats, in an owned box and in a world box', () => {
    for (const options of [owned, world]) {
      const [problem] = statCodeDiagnostics('return stats.Destruktion.value;', options);
      expect(problem).toMatchObject({ severity: 'error', message: 'No stat is named “Destruktion”. Did you mean “Destruction”?' });
    }
  });

  it('is underlined after owner.stats, against the owner’s list and not the world’s', () => {
    expect(messages('return owner.stats.Hungr.value;', owned)).toEqual(['No stat is named “Hungr”. Did you mean “Hunger”?']);
    // Destruction is a world stat, so it is not one of the Creature's.
    expect(messages('return owner.stats.Destruction.value;', owned)).toEqual(['No stat is named “Destruction”.']);
    expect(messages('owner.stats.Hungr.value = 1;\nreturn 1;', owned)).toEqual(['No stat is named “Hungr”. Did you mean “Hunger”?']);
  });

  it('is underlined after owner.stats in a world box, where owner is empty', () => {
    expect(messages('return owner.stats.Rage.value;', world)).toEqual(['No stat is named “Rage”.']);
  });

  it('is a warning after owner.stats in a Blueprint box, which an owner can hold more stats than', () => {
    const [problem] = statCodeDiagnostics('return owner.stats.Fury.value;', blueprint);
    expect(problem).toMatchObject({ severity: 'warning', message: 'No stat is named “Fury”.' });
    expect(statCodeDiagnostics('return owner.stats.Hunger.value;', blueprint)).toEqual([]);
  });

  it('is a warning after entities.Name.stats and persona.stats, which a library entity can carry', () => {
    const [entity] = statCodeDiagnostics('return entities.Creature.stats.Hungr.value;', owned);
    expect(entity).toMatchObject({ severity: 'warning', message: '“Creature” has no stat named “Hungr”. Did you mean “Hunger”?' });
    const [persona] = statCodeDiagnostics('persona.stats.Trst.value = 1;\nreturn 1;', owned);
    expect(persona).toMatchObject({ severity: 'warning', message: 'Unknown persona stat name “Trst”. A library persona can have it. Did you mean “Trust”?' });
  });

  it('is not flagged where the name list is absent or the key is computed', () => {
    expect(messages('return owner.stats.Anything.value;', { statNames: WORLD })).toEqual([]);
    expect(messages('return owner.stats[self.name].value;', owned)).toEqual([]);
    expect(messages('return entities.Creature.stats[self.name].value;', owned)).toEqual([]);
  });
});

describe('self follows the owner', () => {
  it('reads owner.stats.<own name> as the running stat in an owned box', () => {
    expect(messages('owner.stats.Rage = 5;\nreturn 1;', owned)).toEqual(['Write to self.value instead.']);
    expect(messages('owner.stats["Rage"].name = "x";\nreturn 1;', owned))
      .toEqual(['owner.stats["Rage"].name can’t be written. Only self.value, self.min, self.max, self.regen, self.hidden can.']);
    expect(messages('const me = owner.stats.Rage;\nme.name = "x";\nreturn 1;', owned)[0]).toMatch(/Only self\.value/);
  });

  it('reads stats.<own name> as a world stat in an owned box, with no self hint', () => {
    expect(messages('stats.Rage = 5;\nreturn 1;', owned)).toEqual(['Write to stats.Rage.value instead.']);
    expect(messages('stats.Rage.name = "x";\nreturn 1;', owned)[0]).toMatch(/Only stats\.Rage\.value/);
  });

  it('keeps stats.<own name> as the running stat in a world box, and no other route', () => {
    expect(messages('stats["Alert Level"] = 5;\nreturn 1;', world)).toEqual(['Write to self.value instead.']);
    expect(messages('entities.Creature.stats.Rage = 5;\nreturn 1;', { ...world, selfName: 'Rage' }))
      .toEqual(['Write to entities.Creature.stats.Rage.value instead.']);
  });

  it('counts a write to owner.stats.<own name> as the code doing something, and so a write to a world stat of the same name', () => {
    expect(messages('owner.stats.Rage.value = 5;', owned)).toEqual([]);
    expect(messages('stats.Rage.value = 5;', owned)).toEqual([]);
  });

  it('skips the entry a lookup by someone else’s id finds', () => {
    expect(messages('const other = Object.values(owner.stats).find(s => s.id !== self.id);\nother.value = 1;\nreturn 1;', owned)).toEqual([]);
  });
});

describe('the owner root', () => {
  it('is a known name in every box', () => {
    for (const options of [owned, world, blueprint]) {
      expect(messages('return owner.stats.Rage.value;', { ...options, ownerStatNames: undefined })).toEqual([]);
    }
    expect(messages('return owner.name;', owned)).toEqual([]);
  });

  it('calls a write to an entry field read-only, and a write to a trait entry a trait-entry write', () => {
    expect(messages('owner.name = "x";\nreturn 1;', owned)).toEqual(['owner.name is read-only.']);
    expect(messages('owner.traits.Calm.enabled = true;', owned)).toEqual([]);
    expect(messages('owner.traits.Calm = true;\nreturn 1;', owned)).toEqual(['Write to owner.traits.Calm.enabled instead.']);
    expect(messages('owner.traits.Calm.name = "x";\nreturn 1;', owned)).toEqual(['owner.traits.Calm.name can’t be written. Only owner.traits.Calm.enabled can.']);
  });

  it('counts a write to the owner’s placeholders as the code doing something', () => {
    expect(messages('owner.placeholders.Mood.pin("calm");', owned)).toEqual([]);
  });

  it('reads an owner’s whole stat entry as a number the way it reads stats', () => {
    expect(messages('return owner.stats.Rage > 3 ? 1 : 0;', owned)).toEqual(['owner.stats.Rage is a whole stat, not a number. Use owner.stats.Rage.value.']);
    expect(messages('return persona.stats.Trust + 1;', owned)).toEqual(['persona.stats.Trust is a whole stat, not a number. Use persona.stats.Trust.value.']);
  });
});
