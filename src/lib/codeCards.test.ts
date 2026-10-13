import { describe, it, expect } from 'vitest';
import { codeCard, type CodeCard } from './codeCards';
import type { SurfaceAnalysisOptions } from './statCodeAnalysis';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { toolScriptSurface } from './tools/toolScriptSurface';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

const mood: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['calm', 'wary']) };
const world: SurfaceAnalysisOptions = { surface: STAT_CODE_SURFACE, selfName: 'Stamina', placeholders: { list: [mood] } };
const owned: SurfaceAnalysisOptions = { ...world, owner: 'entity', selfName: 'Rage' };

/** The card under a caret written as `|`. */
function cardAt(doc: string, options: SurfaceAnalysisOptions = world): CodeCard | null {
  const pos = doc.indexOf('|');
  expect(pos, 'every case marks its caret with |').toBeGreaterThanOrEqual(0);
  return codeCard(doc.replace('|', ''), pos, options);
}

const line = (card: CodeCard | null) =>
  card && `(${card.signature.kind}) ${card.signature.path}: ${card.signature.type}${card.access ? ` [${card.access}]` : ''}`;

describe('codeCard: globals and their members', () => {
  it.each([
    ['return se|lf.value;', '(global) self: Stat'],
    ['return st|ats.Health.value;', '(global) stats: object'],
    ['return cl|ock.day;', '(global) clock: { day, daypart, deltaHours, elapsedHours, previous } [readOnly]'],
    ['return self.va|lue;', '(property) Stat.value: number [writable]'],
    ['self.re|gen = 0;', '(property) Stat.regen: number [writable]'],
    ['return self.na|me;', '(property) Stat.name: string [readOnly]'],
    ['return self.prev|ious.value;', '(property) Stat.previous: Stat [readOnly]'],
    ['return self.previous.re|gen;', '(property) Stat.previous.regen: number [readOnly]'],
    ['return self.delta.a|i.value;', '(property) Stat.delta.ai: { value, min, max, regen } [readOnly]'],
    ['return self.delta.ai.va|lue;', '(property) Stat.delta.ai.value: number [readOnly]'],
    ['return dictionaries.Lore.na|me;', '(property) Dictionary.name: string [readOnly]'],
    ['return clock.day|part;', '(property) clock.daypart: string [readOnly]'],
    ['return clock.previous.d|ay;', '(property) clock.previous.day: number [readOnly]'],
    ['return traits.Brave.ena|bled;', '(property) Trait.enabled: boolean [afterRun]'],
    ['return traits.Brave.mo|de;', '(property) Trait.mode: string [readOnly]'],
    ['placeholders.Mood.va|lue = "x";', '(property) Placeholder.value: string [afterRun]'],
    ['return placeholders.Mood.ro|ll();', '(method) Placeholder.roll: () => string'],
    ['return entities.Mara.na|me;', '(property) Entity.name: string [readOnly]'],
    ['return entities.Mara.st|ats;', '(property) Entity.stats: object'],
    ['return persona.inSc|ene;', '(property) persona.inScene: boolean [readOnly]'],
    ['return Math.m|in(1, 2);', '(method) Math.min: (...n) => number'],
    ['return Ma|th.PI;', '(global) Math: object'],
  ])('%s', (doc, expected) => {
    expect(line(cardAt(doc))).toBe(expected);
  });

  it('carries the entry’s info as the description, and the name’s span', () => {
    const doc = 'return self.value;';
    expect(codeCard(doc, doc.indexOf('value') + 1, world)).toEqual({
      from: doc.indexOf('value'), to: doc.indexOf('value') + 5,
      signature: { kind: 'property', path: 'Stat.value', type: 'number' },
      access: 'writable',
      description: 'Current value, with this turn’s AI change and regen applied. Writable.',
    });
  });
});

describe('codeCard: value, min, max and regen are writable on every route', () => {
  const routes = ['self', 'stats.Gold', 'stats["Max HP"]', 'owner.stats.Stock', 'entities.Mara.stats.Grit', 'persona.stats.Nerve'];
  it.each(routes)('%s', (route) => {
    for (const field of ['value', 'min', 'max', 'regen']) {
      expect(cardAt(`${route}.${field.slice(0, 1)}|${field.slice(1)} = 1;`, owned)?.access, `${route}.${field}`).toBe('writable');
    }
    expect(cardAt(`return ${route}.ena|bled;`, owned)?.access).toBe('readOnly');
  });
});

describe('codeCard: entries of the world’s maps', () => {
  it.each([
    ['return stats.Fat|igue.value;', '(stat) stats.Fatigue: Stat'],
    ['return stats["Max |HP"].value;', '(stat) stats["Max HP"]: Stat'],
    ['return owner.stats.Sto|ck.value;', '(stat) owner.stats.Stock: Stat'],
    ['return entities["Old Rook"].stats.Gr|it.value;', '(stat) entities["Old Rook"].stats.Grit: Stat'],
    ['return persona.stats.Ner|ve.value;', '(stat) persona.stats.Nerve: Stat'],
    ['return traits.Br|ave.enabled;', '(trait) traits.Brave: Trait'],
    ['return entities.Mara.traits["Night |Owl"].enabled;', '(trait) entities.Mara.traits["Night Owl"]: Trait'],
    ['return placeholders.Mo|od.value;', '(placeholder) placeholders.Mood: Placeholder'],
    ['return dictionaries.Lore.placeholders.Hair.Sh|ade.value;', '(placeholder) dictionaries.Lore.placeholders.Hair.Shade: Placeholder'],
    ['return entities.Ma|ra.name;', '(entity) entities.Mara: Entity'],
    ['return dictionaries.Fa|una.name;', '(dictionary) dictionaries.Fauna: Dictionary'],
  ])('%s', (doc, expected) => {
    expect(line(cardAt(doc, owned))).toBe(expected);
  });
});

describe('codeCard: no card', () => {
  it('for a member the resolved entry doesn’t have, though the resolver reads the variable as a stat', () => {
    expect(cardAt('const n = stats.HP.value;\nreturn n.toFi|xed(1);')).toBeNull();
    // The same variable still reads as a stat where the member is one.
    expect(line(cardAt('const n = stats.HP;\nreturn n.va|lue;'))).toBe('(property) Stat.value: number [writable]');
  });

  describe('for a name its map doesn’t hold, where the box knows the names', () => {
    const named: SurfaceAnalysisOptions = {
      ...owned,
      statNames: ['Health'],
      ownerStatNames: ['Stock'],
      traits: ['Brave'],
      entities: [{ id: 'mara', name: 'Mara', traits: [], stats: ['Grit'], persona: false }],
    };
    it.each([
      ['return stats.He|lth.value;', 'return stats.Hea|lth.value;'],
      ['return owner.stats.Sto|k.value;', 'return owner.stats.Sto|ck.value;'],
      ['return entities.Mara.stats.Gr|t.value;', 'return entities.Mara.stats.Gr|it.value;'],
      ['return traits.Bra|v.enabled;', 'return traits.Bra|ve.enabled;'],
      ['return entities.Mar|y.name;', 'return entities.Ma|ra.name;'],
      ['return placeholders.Mo|d.value;', 'return placeholders.Mo|od.value;'],
    ])('%s', (unknown, known) => {
      expect(cardAt(unknown, named)).toBeNull();
      expect(cardAt(known, named)).not.toBeNull();
    });

    it('still cards a name where the box knows none', () => {
      expect(line(cardAt('return stats.He|lth.value;', owned))).toBe('(stat) stats.Helth: Stat');
    });
  });

  it.each([
    ['a string that is no map key', 'const x = "Health";\nreturn x === "Hea|lth" ? 1 : 0;'],
    ['an unknown global', 'return Stat|z.Health;'],
    ['a member of nothing the sandbox lists', 'const o = {};\nreturn o.fi|eld;'],
    ['a keyword', 'ret|urn 1;'],
    ['a number', 'return 4|2;'],
  ])('for %s', (_, doc) => {
    expect(cardAt(doc)).toBeNull();
  });
});

describe('codeCard: a Tool script', () => {
  const tool: SurfaceAnalysisOptions = {
    surface: toolScriptSurface([{ name: 'size', type: 'number', description: 'How big.', required: true, options: [] }], ['Weather']),
  };
  it.each([
    ['return ar|gs.size;', '(global) args: { size } [readOnly]'],
    ['return args.si|ze;', '(property) args.size: number [readOnly]'],
    ['return scene.location.na|me;', '(property) scene.location.name: string [readOnly]'],
    ['return placeholders.Wea|ther;', '(property) placeholders.Weather: string [readOnly]'],
    ['cons|ole.log(1);', '(global) console: object'],
    ['return Math.fl|oor(1);', '(method) Math.floor: (n) => number'],
  ])('%s', (doc, expected) => {
    expect(line(cardAt(doc, tool))).toBe(expected);
  });

  it('reads no stat-code map', () => {
    expect(cardAt('return st|ats.Health;', tool)).toBeNull();
  });
});
