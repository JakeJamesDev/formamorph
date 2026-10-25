import { describe, it, expect } from 'vitest';
import { codeCard, completionCard, type CodeCard } from './codeCards';
import { codeCompletions, type SurfaceAnalysisOptions } from './statCodeAnalysis';
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
    ['return cl|ock.day;', '(global) clock: { day, daypart, hour, minute, deltaHours, elapsedHours, previous, advance } [readOnly]'],
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
      description: 'Current value, with this turn’s AI change and regen applied',
    });
  });
});

describe('codeCard: value, min, max, regen and hidden are writable on every route', () => {
  const routes = ['self', 'stats.Gold', 'stats["Max HP"]', 'owner.stats.Stock', 'entities.Mara.stats.Grit', 'persona.stats.Nerve'];
  it.each(routes)('%s', (route) => {
    for (const field of ['value', 'min', 'max', 'regen', 'hidden']) {
      expect(cardAt(`${route}.${field.slice(0, 1)}|${field.slice(1)} = 1;`, owned)?.access, `${route}.${field}`).toBe('writable');
    }
    expect(cardAt(`return ${route}.ena|bled;`, owned)?.access).toBe('readOnly');
    expect(cardAt(`return ${route}.previous.hid|den;`, owned)?.access).toBe('readOnly');
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

describe('codeCard: a name the code declares', () => {
  /** The kind and the link, without an inferred type. */
  const declared = (doc: string) => {
    const card = cardAt(doc);
    return card && { kind: card.signature.kind, path: card.signature.path, type: card.signature.type, links: card.links };
  };

  it.each([
    ['const tired = 1;\nreturn ti|red;', 'const'],
    ['let tired = 1;\nreturn ti|red;', 'let'],
    ['var tired = 1;\nreturn ti|red;', 'var'],
    ['function tired() { return 1; }\nreturn ti|red();', 'function'],
    ['const f = (tired) => ti|red + 1;', 'parameter'],
    ['const f = tired => ti|red + 1;', 'parameter'],
    ['return xs.map(tired => ti|red);', 'parameter'],
    ['class tired {}\nreturn new ti|red();', 'class'],
    ['function f(a, tired) { return ti|red; }', 'parameter'],
    ['try { f(); } catch (tired) { return ti|red; }', 'parameter'],
    ['for (const tired of [1]) { x += ti|red; }', 'const'],
    ['const { tired } = self;\nreturn ti|red;', 'const'],
    ['const [tired] = [1];\nreturn ti|red;', 'const'],
  ])('%s', (doc, kind) => {
    expect(declared(doc)).toMatchObject({ kind, path: 'tired', type: undefined });
  });

  it('links to the line that declares the name, counted from 1', () => {
    expect(declared('const a = 1;\nconst b = 2;\nconst tired = 3;\nreturn ti|red;')?.links).toEqual([
      { id: 'goToLine', at: 'const a = 1;\nconst b = 2;\nconst '.length, line: 3 },
    ]);
  });

  it('links a name a nested block declares to its first declaration', () => {
    expect(declared('let tired = 1;\nif (a) { var tired = 2; }\nreturn ti|red;')?.links).toEqual([
      { id: 'goToLine', at: 'let '.length, line: 1 },
    ]);
  });

  it('has no link on the declaration itself, where the caret already is', () => {
    expect(declared('const ti|red = 1;')).toMatchObject({ kind: 'const', links: undefined });
  });

  it('reads a global the code declares as the author’s own name, not the sandbox’s', () => {
    expect(declared('const stats = {};\nreturn st|ats;')).toMatchObject({ kind: 'const', path: 'stats' });
  });

  it('says which line declares it, carries no access badge, and links to that line', () => {
    expect(cardAt('const a = 0;\nconst tired = 1;\nreturn ti|red;')).toEqual({
      from: 'const a = 0;\nconst tired = 1;\nreturn '.length, to: 'const a = 0;\nconst tired = 1;\nreturn tired'.length,
      signature: { kind: 'const', path: 'tired' },
      description: 'Declared on line 2',
      links: [{ id: 'goToLine', at: 'const a = 0;\nconst '.length, line: 2 }],
    });
  });

  it('says the line on the declaration itself too', () => {
    expect(cardAt('const a = 0;\nconst ti|red = 1;')?.description).toBe('Declared on line 2');
  });
});

describe('codeCard: a template slot', () => {
  const slots: SurfaceAnalysisOptions = { ...world, slots: true };
  const slotCard = (doc: string) => cardAt(doc, slots);

  it('shows its type and default', () => {
    expect(slotCard('return {{am|ount:number=5}};')).toMatchObject({
      signature: { kind: 'slot', path: 'amount', type: 'number' },
      defaultValue: '5',
    });
  });

  it('spans the whole slot', () => {
    const doc = 'return {{amount:number=5}};';
    expect(slotCard(doc.replace('amount', 'am|ount'))).toMatchObject({
      from: doc.indexOf('{{'), to: doc.indexOf('}}') + 2,
    });
  });

  it('reads a slot with no type as text, and shows no default where none is declared', () => {
    const card = slotCard('return {{wo|rd}};');
    expect(card?.signature).toEqual({ kind: 'slot', path: 'word', type: 'text' });
    expect(card?.defaultValue).toBeUndefined();
  });

  it('lists a choice’s options in its type', () => {
    expect(slotCard('return x {{op|erator:choice(>|<)=>}} 3;')?.signature.type).toBe('choice(>|<)');
  });

  it('shows the first declaration’s type and default at a repeat', () => {
    const card = slotCard('{{amount:number=5}} + {{am|ount}}');
    expect(card?.signature.type).toBe('number');
    expect(card?.defaultValue).toBe('5');
  });

  it('gives a card only where the editor reads slots', () => {
    expect(cardAt('return {{am|ount:number=5}};')).toBeNull();
  });
});

describe('codeCard: a Tool script', () => {
  const tool: SurfaceAnalysisOptions = {
    ...world, selfName: '', surface: toolScriptSurface([{ name: 'size', type: 'number', description: 'How big.', required: true, options: [] }]),
  };
  it.each([
    ['return ar|gs.size;', '(global) args: { size } [readOnly]'],
    ['return args.si|ze;', '(property) args.size: number [readOnly]'],
    ['return location.na|me;', '(property) location.name: string [readOnly]'],
    ['return cl|ock.day;', '(global) clock: { day, daypart, hour, minute, deltaHours, elapsedHours, previous } [readOnly]'],
    ['return no|tes;', '(global) notes: string [readOnly]'],
    ['return entities.Mara.loca|tion;', '(property) Entity.location: string [readOnly]'],
    ['return traits.Brave.ena|bled;', '(property) Trait.enabled: boolean [readOnly]'],
    ['return placeholders.Mood.va|lue;', '(property) Placeholder.value: string [readOnly]'],
    ['cons|ole.log(1);', '(global) console: object'],
    ['return Math.fl|oor(1);', '(method) Math.floor: (n) => number'],
  ])('%s', (doc, expected) => {
    expect(line(cardAt(doc, tool))).toBe(expected);
  });

  it.each([
    'location.mo|ve("Dock");', 'memories.ad|d("x");', 'entities.Mara.mo|ve("Dock");', 'entities.Mara.dia|ry("x");',
    'clock.adv|ance(5);', 'placeholders.Mood.pi|n("x");', 'disc|over("Kit");', 'return se|lf;', 'return ow|ner;',
    'return wor|ld.entities;', 'return sce|ne.present;',
  ])('gives no card on %s, which the surface lacks', (doc) => {
    expect(cardAt(doc, tool)).toBeNull();
  });
});

describe('completionCard: the card for an option the list offers', () => {
  const listed: SurfaceAnalysisOptions = { ...world, statNames: ['Health', 'Max HP'] };

  /** The card the option labelled `label` shows, with the caret written as `|`. */
  function optionCard(doc: string, label: string, options: SurfaceAnalysisOptions = listed): CodeCard | null {
    const caret = doc.indexOf('|');
    expect(caret, 'every case marks its caret with |').toBeGreaterThanOrEqual(0);
    const code = doc.replace('|', '');
    const result = codeCompletions(code, caret, options);
    expect(result, 'the list opens here').not.toBeNull();
    return completionCard(code, result!, label, options);
  }

  it.each([
    ['return clo|', 'clock', '(global) clock: { day, daypart, hour, minute, deltaHours, elapsedHours, previous, advance } [readOnly]'],
    ['return self.re|', 'regen', '(property) Stat.regen: number [writable]'],
    ['return stats.He|', 'Health', '(stat) stats.Health: Stat'],
    ['return stats["He|', 'Health', '(stat) stats.Health: Stat'],
    ['return stats[|', '"Max HP"', '(stat) stats["Max HP"]: Stat'],
    ['return Math.m|', 'min', '(method) Math.min: (...n) => number'],
  ])('%s offers %s', (doc, label, expected) => {
    expect(line(optionCard(doc, label))).toBe(expected);
  });

  it('cards a single-quoted key', () => {
    expect(line(optionCard(`return stats['He|`, 'Health'))).toBe('(stat) stats.Health: Stat');
  });

  it('has no card for a stat name offered inside a string that is no map key', () => {
    expect(optionCard('return x === "He|"', 'Health')).toBeNull();
  });

  it('cards an option of one character', () => {
    expect(line(optionCard('return stats.|', 'X', { ...world, statNames: ['X'] }))).toBe('(stat) stats.X: Stat');
  });

  it('cards an option of an owner’s own map', () => {
    const entity: SurfaceAnalysisOptions = { ...owned, ownerStatNames: ['Grit'] };
    expect(line(optionCard('return owner.stats.Gr|', 'Grit', entity))).toBe('(stat) owner.stats.Grit: Stat');
  });

  it('reads the option as taken, not as typed', () => {
    // `Hea` is no stat name; the card is for the option the author would insert over it.
    expect(line(optionCard('return stats.Hea|', 'Health'))).toBe('(stat) stats.Health: Stat');
  });

  it('has no card for a keyword', () => {
    expect(optionCard('return |', 'return')).toBeNull();
  });

  it('cards a name the code declares, with the line that declares it', () => {
    const card = optionCard('const mine = 1; return mi|', 'mine');
    expect(card?.signature).toEqual({ kind: 'const', path: 'mine' });
    expect(card?.description).toBe('Declared on line 1');
  });
});
