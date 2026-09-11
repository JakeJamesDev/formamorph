/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { migrateStatLookups } from './statLookupMigration';
import { executeStatCode } from './statCodeExecutor';
import type { Stat } from '@/types';

/** Every rewrite case, input to expected output. */
const REWRITES: Array<[string, string, string]> = [
  ['name, single quotes, no tail', "const h = stats.find(s => s.name === 'Health');", "const h = stats['Health'];"],
  ['name, double quotes', 'const h = stats.find(s => s.name === "Health");', 'const h = stats["Health"];'],
  ['name, `.value` tail', "return stats.find(s => s.name === 'Power').value;", "return stats['Power'].value;"],
  ['name, `?.value` tail with a fallback', "return stats.find(s => s.name === 'Level')?.value ?? 1;", "return stats['Level']?.value ?? 1;"],
  ['name with a space', "return stats.find(s => s.name === 'Weapon Skill')?.max || 100;", "return stats['Weapon Skill']?.max || 100;"],
  ['name with an escaped quote', "return stats.find(s => s.name === 'O\\'Neil').value;", "return stats['O\\'Neil'].value;"],
  ['`==`', "return stats.find(s => s.name == 'Mana').value;", "return stats['Mana'].value;"],
  ['parameter name and parens', "return stats.find((stat) => stat.name === 'Mana').value;", "return stats['Mana'].value;"],
  ['whitespace everywhere', "return stats . find (  ( t )  =>  t . name   ===  'Mana' ) . value;", "return stats['Mana'] . value;"],
  ['no whitespace', "return stats.find(x=>x.name==='Mana').value;", "return stats['Mana'].value;"],
  ['split over lines', "return stats.find(\n  s =>\n    s.name === 'Mana'\n).value;", "return stats['Mana'].value;"],
  ['id, bare', 'const me = stats.find(s => s.id === currentStatId);', 'const me = self;'],
  ['id, `?.value` tail', 'return stats.find(s => s.id === currentStatId)?.value ?? 0;', 'return self?.value ?? 0;'],
  ['id, `==` and a new parameter', 'return stats.find((it) => it.id == currentStatId).max;', 'return self.max;'],
  ['id, `let`', 'let me = stats.find(s => s.id === currentStatId);', 'let me = self;'],
  ['id, `var`', 'var me = stats.find(s => s.id === currentStatId);', 'var me = self;'],
  ['inside a template literal', "return `${stats.find(s => s.name === 'A').value}`;", "return `${stats['A'].value}`;"],
  ['two on one line', "return stats.find(s => s.name === 'A').value + stats.find(s => s.name === 'B').value;", "return stats['A'].value + stats['B'].value;"],
];

/** Code the rewrite must leave byte for byte. */
const UNTOUCHED: Array<[string, string]> = [
  ['`!==`', "return stats.find(s => s.name !== 'A').value;"],
  ['parameter mismatch', "return stats.find(s => x.name === 'A').value;"],
  ['name against a variable', 'return stats.find(s => s.name === target).value;'],
  ['literal on the left', "return stats.find(s => 'A' === s.name).value;"],
  ['id against another id', 'return stats.find(s => s.id === otherId).value;'],
  ['name against currentStatId', 'return stats.find(s => s.name === currentStatId).value;'],
  ['a second condition', "return stats.find(s => s.name === 'A' && s.max > 0).value;"],
  ['a block body', "return stats.find(s => { return s.name === 'A'; }).value;"],
  ['a parenthesized body', "return stats.find(s => (s.name === 'A')).value;"],
  ['a second argument', "return stats.find(s => s.name === 'A', this).value;"],
  ['`stats?.find`', "return stats?.find(s => s.name === 'A').value;"],
  ['another object\'s stats', "return world.stats.find(s => s.name === 'A').value;"],
  ['another list', "return items.find(s => s.name === 'A').value;"],
  ['`findIndex`', "return stats.findIndex(s => s.name === 'A');"],
  ['a comment inside the call', "return stats.find(s => /* A */ s.name === 'A').value;"],
  ['a line comment', "// stats.find(s => s.name === 'A')\nreturn 1;"],
  ['a string', "return \"stats.find(s => s.name === 'A')\".length;"],
  ['a regex literal', "return /stats.find\\(s => s.name === 'A'\\)/.test(x) ? 1 : 0;"],
  ['the map form already', "const me = self;\nreturn stats['A'].value + me.value;"],
];

describe('migrateStatLookups', () => {
  it.each(REWRITES)('rewrites %s', (_label, input, expected) => {
    expect(migrateStatLookups(input)).toBe(expected);
  });

  it.each(UNTOUCHED)('leaves %s untouched', (_label, input) => {
    expect(migrateStatLookups(input)).toBe(input);
  });

  it('leaves the code around a rewrite byte for byte', () => {
    const before = "// Agility, from the body\nconst  stamina=stats.find(s => s.name === 'Stamina').value ;\n\treturn Math.round(stamina*0.7); // tuned\n";
    expect(migrateStatLookups(before))
      .toBe("// Agility, from the body\nconst  stamina=stats['Stamina'].value ;\n\treturn Math.round(stamina*0.7); // tuned\n");
  });

  describe('a `self` declaration', () => {
    it.each(['const', 'let', 'var'])('drops `%s self = …` whole, line included', (keyword) => {
      const before = `${keyword} self = stats.find(s => s.id === currentStatId);\nreturn self.value + 1;\n`;
      expect(migrateStatLookups(before)).toBe('return self.value + 1;\n');
    });

    it('drops an indented declaration inside a block and keeps the lines around it', () => {
      const before = "if (on) {\n  const self = stats.find(s => s.id === currentStatId);\n  return self.value;\n}\nreturn 0;";
      expect(migrateStatLookups(before)).toBe('if (on) {\n  return self.value;\n}\nreturn 0;');
    });

    it('keeps CRLF line endings intact', () => {
      const before = 'const self = stats.find(s => s.id === currentStatId);\r\nreturn self.value;\r\n';
      expect(migrateStatLookups(before)).toBe('return self.value;\r\n');
    });

    it('drops a declaration on the last line along with the break before it', () => {
      expect(migrateStatLookups('return 1;\nconst self = stats.find(s => s.id === currentStatId);'))
        .toBe('return 1;');
    });

    it('drops only the declaration when other code shares its line', () => {
      expect(migrateStatLookups('const self = stats.find(s => s.id === currentStatId); return self.value;'))
        .toBe('return self.value;');
      expect(migrateStatLookups('x += 1; const self = stats.find(s => s.id === currentStatId);\nreturn x;'))
        .toBe('x += 1;\nreturn x;');
    });

    it('drops only the `self` declarator from a list', () => {
      expect(migrateStatLookups('let self = stats.find(s => s.id === currentStatId), b = 2;'))
        .toBe('let b = 2;');
      expect(migrateStatLookups("const a = stats.find(s => s.name === 'A'), self = stats.find(s => s.id === currentStatId);"))
        .toBe("const a = stats['A'];");
    });

    it('drops a declaration inside a switch case', () => {
      expect(migrateStatLookups('switch (x) {\n  case 1:\n    const self = stats.find(s => s.id === currentStatId);\n    return self.value;\n}'))
        .toBe('switch (x) {\n  case 1:\n    return self.value;\n}');
    });

    it('keeps a declaration in a `for` header, where dropping it would break the loop', () => {
      expect(migrateStatLookups('for (let self = stats.find(s => s.id === currentStatId); self; ) break;'))
        .toBe('for (let self = self; self; ) break;');
    });

    it('keeps a `self` declaration whose initializer is more than the lookup', () => {
      // `const self = self?.value;` reads self before its initialization, so it fails at run time.
      expect(migrateStatLookups('const self = stats.find(s => s.id === currentStatId)?.value;'))
        .toBe('const self = self?.value;');
    });
  });

  it('changes nothing on a second run', () => {
    const all = [
      ...REWRITES.map(([, input]) => input),
      'const self = stats.find(s => s.id === currentStatId);\nreturn self.value;',
      "let self = stats.find(s => s.id === currentStatId), b = stats.find(s => s.name === 'B');",
    ];
    for (const code of all) {
      const once = migrateStatLookups(code);
      expect(migrateStatLookups(once)).toBe(once);
    }
  });
});

describe('migrateStatLookups on the bundled worlds', () => {
  const worlds = import.meta.glob<{ default: { stats?: Stat[] } }>('../defaultworlds/*.json', { eager: true });
  /** Each bundled stat's code as the worlds shipped it at 2.14.0, before the map. */
  const BEFORE: Array<[string, string, string]> = [
    ['drone', 'Mobility', `const power = stats.find(s => s.name === 'Power').value;
const health = stats.find(s => s.name === 'Health').value;
let m = Math.round(power * 0.8 + 20);
if (health < 30) m = Math.min(m, 35); // crippled when the core is failing
return m;`],
    ['drone', 'Firepower', `const power = stats.find(s => s.name === 'Power').value;
const charge = stats.find(s => s.name === 'Charge').value;
const health = stats.find(s => s.name === 'Health').value;
let out = Math.round(power * 0.9 + 10);
if (health < 30) out = Math.round(out * 0.5); // damaged core weakens fire
if (charge >= 100) out = Math.min(100, out + 30); // Overdrive burst primed
return out;`],
    ['rampage', 'Alert Level', `const destruction = stats.find(s => s.name === 'Destruction').value;
const rampage = stats.find(s => s.name === 'Rampage').value;
return Math.round(destruction * 0.6 + rampage * 0.4);`],
    ['valentines', 'Agility', `const stamina = stats.find(s => s.name === 'Stamina').value;
const sugar = stats.find(s => s.name === 'Sugar').value;
return Math.round(stamina * 0.7 + 30 - sugar * 0.4);`],
  ];

  it('covers every bundled stat that carries code', () => {
    const coded = Object.entries(worlds).flatMap(([path, world]) =>
      (world.default.stats ?? []).filter((s) => s.code?.trim()).map((s) => `${path.match(/(\w+)\.json$/)?.[1]}/${s.name}`));
    expect(coded.sort()).toEqual(BEFORE.map(([file, name]) => `${file}/${name}`).sort());
  });

  it.each(BEFORE)('%s %s: the migrated code returns what the array form returned', async (file, name, before) => {
    const stats = worlds[`../defaultworlds/${file}.json`].default.stats ?? [];
    const stat = stats.find((s) => s.name === name) as Stat;
    // The array form ran as a plain function over the stat list; these formulas read nothing else.
    const overArray = new Function('stats', 'currentStatId', before)(stats, stat.id) as number;
    const migrated = await executeStatCode(migrateStatLookups(before), stats, stat);
    const shipped = await executeStatCode(stat.code ?? '', stats, stat);
    expect(migrated).toMatchObject({ error: null, value: overArray });
    expect(shipped).toMatchObject({ error: null, value: overArray });
  });
});
