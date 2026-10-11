import { describe, expect, it } from 'vitest';
import { SELF_WRITABLE_FIELDS } from './statCodeExecutor';
import { SCANNED_STAT_FIELDS, scanStatWrites } from './statCodeWriteScan';

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
      { stat: null, field: 'value' },
      { stat: null, field: 'max' },
      { stat: 'Health', field: 'value' },
      { stat: 'Health', field: 'min' },
      { stat: 'Luck', field: 'regen' },
      { stat: 'Dark Pact', field: 'value' },
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
    expect(scanStatWrites('self.delta.ai.value = 1; entities.maren.stats.Health.value = 1;')).toEqual([]);
  });

  it('leaves a commented-out write alone and still reads one after a string holding slashes', () => {
    expect(scanStatWrites('// self.value = 1\n/* stats.Health.max = 2 */')).toEqual([]);
    expect(scanStatWrites('const url = "http://x";\nself.value = 1;')).toEqual([{ stat: null, field: 'value' }]);
  });

  it('reads a write that follows an opening brace, a semicolon or a line start', () => {
    expect(scanStatWrites('if (a) { self.value = 1 }\nstats.Luck.max = 2')).toEqual([
      { stat: null, field: 'value' },
      { stat: 'Luck', field: 'max' },
    ]);
  });
});
