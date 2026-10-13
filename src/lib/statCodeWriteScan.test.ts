import { describe, expect, it } from 'vitest';
import { SELF_WRITABLE_FIELDS } from './statCodeExecutor';
import { SCANNED_STAT_FIELDS, scanStatLookups, scanStatWrites } from './statCodeWriteScan';

describe('scanStatWrites', () => {
  it('reads the fields the sandbox lets code write', () => {
    expect([...SCANNED_STAT_FIELDS].sort()).toEqual([...SELF_WRITABLE_FIELDS].sort());
  });

  it('reads a write to self and to a map entry, by dot and by bracket literal', () => {
    expect(scanStatWrites([
      'self.value = 1;',
      'self["max"] = 2;',
      'stats.Health.value = 3;',
      'stats["Health"].min = 4;',
      "stats.Luck['regen'] = 5;",
      'stats["Dark Pact"]["value"] = 6;',
    ].join('\n'))).toEqual([
      { root: 'self', stat: null, field: 'value' },
      { root: 'self', stat: null, field: 'max' },
      { root: 'stats', stat: 'Health', field: 'value' },
      { root: 'stats', stat: 'Health', field: 'min' },
      { root: 'stats', stat: 'Luck', field: 'regen' },
      { root: 'stats', stat: 'Dark Pact', field: 'value' },
    ]);
  });

  it('counts a compound assignment and a step either side as a write', () => {
    const found = scanStatWrites('stats.Luck.value += 1; stats.Luck.value--; ++self.max; self.min **= 2; self.regen ??= 1;');
    expect(found.map(({ stat, field }) => `${stat}.${field}`)).toEqual(
      ['Luck.value', 'Luck.value', 'null.max', 'null.min', 'null.regen'],
    );
  });

  it('leaves a read, a comparison and a computed name alone', () => {
    expect(scanStatWrites([
      'const a = stats.Health.value;',
      'if (self.value == 3 || self.value === 4 || self.max != 1 || self.min <= 2 || self.regen >= 1) {}',
      'stats[name].value = 1;',
      'stats[`a${i}`].value = 1;',
      'return self.value + 1;',
    ].join('\n'))).toEqual([]);
  });

  it('leaves alone a field the sandbox does not let code write, and a whole-entry replace', () => {
    expect(scanStatWrites('self.delta = 1; stats.Health.previous = 2; stats.Health.name = "x"; stats.Health = 5;')).toEqual([]);
    expect(scanStatWrites('self.delta.ai.value = 1; owner.stats.Health = 1; entities.maren.stats = {};')).toEqual([]);
    expect(scanStatWrites('owner.stats.Health.name = "x"; persona.stats.Health.delta = 1; entities.maren.name = "x";')).toEqual([]);
  });

  it('reads a write through owner, persona and an entity entry, by dot and by bracket literal', () => {
    expect(scanStatWrites([
      'owner.stats.Rage.value = 1;',
      'owner["stats"]["Rage"].max += 2;',
      'persona.stats.Stamina.min = 3;',
      'entities.Bram.stats.Trust.regen = 4;',
      'entities["The Creature"].stats["Rage"].value--;',
    ].join('\n'))).toEqual([
      { root: 'owner', stat: 'Rage', field: 'value' },
      { root: 'owner', stat: 'Rage', field: 'max' },
      { root: 'persona', stat: 'Stamina', field: 'min' },
      { root: 'entities', entity: 'Bram', stat: 'Trust', field: 'regen' },
      { root: 'entities', entity: 'The Creature', stat: 'Rage', field: 'value' },
    ]);
  });

  it('leaves a computed entity name, a read and a member-qualified root alone', () => {
    expect(scanStatWrites([
      'entities[who].stats.Trust.value = 1;',
      'const a = owner.stats.Rage.value;',
      'world.owner.stats.Rage.value = 1;',
      'my.entities.Bram.stats.Trust.value = 1;',
      'owner.traits.Brave.enabled = true;',
    ].join('\n'))).toEqual([]);
  });

  it('leaves a commented-out write alone and still reads one after a string holding slashes', () => {
    expect(scanStatWrites('// self.value = 1\n/* stats.Health.max = 2 */')).toEqual([]);
    expect(scanStatWrites('const url = "http://x";\nself.value = 1;')).toEqual([{ root: 'self', stat: null, field: 'value' }]);
  });

  it('leaves a write form inside a string alone, and still reads a bracket key', () => {
    expect(scanStatWrites([
      'const tip = "stats.Health.value = 1";',
      "console.log('self.max = 2', `stats.Luck.min = 3`);",
      'stats["Health"].max = 4;',
    ].join('\n'))).toEqual([{ root: 'stats', stat: 'Health', field: 'max' }]);
  });

  it('leaves a write form in an array of strings alone, and reads a write in a template’s ${}', () => {
    expect(scanStatWrites('const lines = ["self.value = 1"];')).toEqual([]);
    expect(scanStatWrites('const note = `rolled ${stats.Luck.value += 1}`;')).toEqual([{ root: 'stats', stat: 'Luck', field: 'value' }]);
  });

  it('reads no postfix step across a line break, as JS reads none', () => {
    expect(scanStatWrites('const a = stats.Health.value\n--b;')).toEqual([]);
    expect(scanStatWrites('const a = self.max\n++b;')).toEqual([]);
    expect(scanStatWrites('stats.Health.value\n= 2;')).toEqual([{ root: 'stats', stat: 'Health', field: 'value' }]);
  });

  it('reads a write that follows an opening brace, a semicolon or a line start', () => {
    expect(scanStatWrites('if (a) { self.value = 1 }\nstats.Luck.max = 2')).toEqual([
      { root: 'self', stat: null, field: 'value' },
      { root: 'stats', stat: 'Luck', field: 'max' },
    ]);
  });
});

describe('scanStatLookups', () => {
  it('reads a lookup on every route, by dot, bracket literal and optional chain, reads and writes alike', () => {
    expect(scanStatLookups([
      'stats.Health.value = 1;',
      'const a = stats["Dark Pact"].max;',
      'owner.stats.Rage.value;',
      'owner["stats"][`Rage`];',
      'persona.stats?.Stamina?.value;',
      'entities.Bram?.stats["Trust"].value;',
      'entities["The Creature"].stats.Rage;',
    ].join('\n'))).toEqual([
      { root: 'stats', stat: 'Health' },
      { root: 'stats', stat: 'Dark Pact' },
      { root: 'owner', stat: 'Rage' },
      { root: 'owner', stat: 'Rage' },
      { root: 'persona', stat: 'Stamina' },
      { root: 'entities', entity: 'Bram', stat: 'Trust' },
      { root: 'entities', entity: 'The Creature', stat: 'Rage' },
    ]);
  });

  it('leaves a method call on the map, a computed key, a bare map and a member-qualified root alone', () => {
    expect(scanStatLookups([
      'stats.find((s) => s.name === "Health");',
      'owner.stats.hasOwnProperty("Rage");',
      'Object.keys(persona.stats);',
      'stats[name].value;',
      'entities[who].stats.Rage.value;',
      'stats[`a${i}`].value;',
      'world.stats.Health.value;',
      'owner.traits.Brave.enabled;',
      'entities.Bram.traits.Brave;',
    ].join('\n'))).toEqual([]);
  });

  it('still reads a call on the stat itself, and skips comments and strings', () => {
    expect(scanStatLookups('stats.Health.value.toFixed(1);')).toEqual([{ root: 'stats', stat: 'Health' }]);
    expect(scanStatLookups('// stats.Vigro.value\nconst tip = "owner.stats.Rgae";')).toEqual([]);
  });
});
