import { describe, it, expect } from 'vitest';
import { resolveCodeName, type ResolvedCodeName, type ResolverOptions } from './statCodeResolver';
import { STAT_CODE_SURFACE } from './statCodeSurface';

const world: ResolverOptions = { surface: STAT_CODE_SURFACE, selfName: 'Alert Level' };
const owned: ResolverOptions = { surface: STAT_CODE_SURFACE, owner: 'entity', selfName: 'Rage' };
const blueprint: ResolverOptions = { surface: STAT_CODE_SURFACE, owner: 'blueprint', selfName: 'Hunger' };

/** The name under a caret written as `|`. */
function nameAt(doc: string, options: ResolverOptions = world): ResolvedCodeName | null {
  const pos = doc.indexOf('|');
  expect(pos, 'every case marks its caret with |').toBeGreaterThanOrEqual(0);
  return resolveCodeName(doc.replace('|', ''), pos, options);
}

/** The span of the last `written` in the doc once its caret is gone. */
function spanOf(doc: string, written: string) {
  const from = doc.replace('|', '').lastIndexOf(written);
  return { from, to: from + written.length };
}

describe('resolveCodeName: map entries on every route', () => {
  // The span is the key as written: a bracket key's holds its quotes.
  it.each([
    ['return stats.He|alth.value;', 'Health', { kind: 'stat', owner: { route: 'world' }, key: 'Health' }],
    ['return stats["Max |HP"].value;', '"Max HP"', { kind: 'stat', owner: { route: 'world' }, key: 'Max HP' }],
    ['return stats?.["Max |HP"]?.value;', '"Max HP"', { kind: 'stat', owner: { route: 'world' }, key: 'Max HP' }],
    ['return owner.stats.Hun|ger.value;', 'Hunger', { kind: 'stat', owner: { route: 'owner' }, key: 'Hunger' }],
    ["return owner.stats['Old |Grudge'].value;", "'Old Grudge'", { kind: 'stat', owner: { route: 'owner' }, key: 'Old Grudge' }],
    ['return entities.Mara.stats.Tr|ust.value;', 'Trust', { kind: 'stat', owner: { route: 'entity', entity: 'Mara' }, key: 'Trust' }],
    ['return entities["Old Rook"].stats["St|ock"].value;', '"Stock"', { kind: 'stat', owner: { route: 'entity', entity: 'Old Rook' }, key: 'Stock' }],
    ['return persona.stats.Tr|ust.value;', 'Trust', { kind: 'stat', owner: { route: 'persona' }, key: 'Trust' }],
    ['return traits.Br|ave.enabled;', 'Brave', { kind: 'trait', owner: { route: 'world' }, key: 'Brave' }],
    ['return traits["Night |Owl"].enabled;', '"Night Owl"', { kind: 'trait', owner: { route: 'world' }, key: 'Night Owl' }],
    ['return owner.traits.Br|ave.enabled;', 'Brave', { kind: 'trait', owner: { route: 'owner' }, key: 'Brave' }],
    ['return persona.traits["Sc|arred"].enabled;', '"Scarred"', { kind: 'trait', owner: { route: 'persona' }, key: 'Scarred' }],
    ['return entities.Mara.traits.Sc|arred.enabled;', 'Scarred', { kind: 'trait', owner: { route: 'entity', entity: 'Mara' }, key: 'Scarred' }],
    ['return entities.Ma|ra.name;', 'Mara', { kind: 'entity', key: 'Mara' }],
    ['return entities["Old |Rook"].name;', '"Old Rook"', { kind: 'entity', key: 'Old Rook' }],
    ['return dictionaries.Fa|una.name;', 'Fauna', { kind: 'dictionary', key: 'Fauna' }],
    ["return dictionaries['Fa|una'].name;", "'Fauna'", { kind: 'dictionary', key: 'Fauna' }],
  ] as const)('%s', (doc, written, expected) => {
    expect(nameAt(doc)).toEqual({ ...expected, ...spanOf(doc, written) });
  });

  it('names a placeholder by its owner and its path, by dot and by bracket', () => {
    expect(nameAt('return placeholders.Hair.Sh|ade.value;')).toMatchObject({ kind: 'placeholder', owner: { route: 'world' }, key: 'Shade', path: ['Hair', 'Shade'] });
    expect(nameAt('return placeholders["Eye |Color"].value;')).toMatchObject({ kind: 'placeholder', owner: { route: 'world' }, path: ['Eye Color'] });
    expect(nameAt('return entities.Molly.placeholders.Ha|ir.value;'))
      .toMatchObject({ kind: 'placeholder', owner: { route: 'entity', entity: 'Molly' }, path: ['Hair'] });
    expect(nameAt('return persona.placeholders["Ha|ir"].value;')).toMatchObject({ kind: 'placeholder', owner: { route: 'persona' }, path: ['Hair'] });
    expect(nameAt('return owner.placeholders.Ha|ir.value;', owned)).toMatchObject({ kind: 'placeholder', owner: { route: 'owner' }, path: ['Hair'] });
    expect(nameAt('return dictionaries.Weather.placeholders.Wi|nd.value;'))
      .toMatchObject({ kind: 'placeholder', owner: { route: 'dictionary', dictionary: 'Weather' }, path: ['Wind'] });
  });

  it('reads a member every placeholder has as the member, and nothing below it', () => {
    expect(nameAt('return placeholders.Mood.ro|ll();')).toMatchObject({ kind: 'member', key: 'roll', of: { is: 'placeholders', path: ['Mood'] } });
    // At the top level the name is a key: no member hangs off the map itself.
    expect(nameAt('return placeholders.val|ue.value;')).toMatchObject({ kind: 'placeholder', path: ['value'] });
    expect(nameAt('return placeholders.Mood.value.Ha|ir;')).toBeNull();
  });
});

describe('resolveCodeName: stats on the owner route', () => {
  it('reads stats.X as the world stat in every box, and owner.stats.X as the owner’s', () => {
    for (const options of [world, owned, blueprint]) {
      expect(nameAt('return stats.Ra|ge.value;', options)).toMatchObject({ kind: 'stat', owner: { route: 'world' }, key: 'Rage' });
    }
    for (const options of [owned, blueprint]) {
      expect(nameAt('return owner.stats.Ra|ge.value;', options)).toMatchObject({ kind: 'stat', owner: { route: 'owner' }, key: 'Rage' });
    }
  });

  it('reads self as the box’s own stat', () => {
    expect(nameAt('return self.va|lue;', world)).toMatchObject({ kind: 'member', key: 'value', of: { is: 'stat', owner: { route: 'world' }, key: 'Alert Level' } });
    expect(nameAt('return self.va|lue;', owned)).toMatchObject({ kind: 'member', of: { is: 'stat', owner: { route: 'owner' }, key: 'Rage' } });
  });
});

describe('resolveCodeName: members, globals and the code’s own names', () => {
  it('names a member with the value it hangs off', () => {
    expect(nameAt('return stats.Health.prev|ious.value;')).toMatchObject({
      kind: 'member', key: 'previous', of: { is: 'stat', owner: { route: 'world' }, key: 'Health' },
    });
    expect(nameAt('return entities.Mara.stats.Trust.delta.a|i.value;')).toMatchObject({
      kind: 'member', key: 'ai', of: { is: 'statDelta', stat: { owner: { route: 'entity', entity: 'Mara' }, key: 'Trust' } },
    });
    expect(nameAt('return clock.previous.day|part;')).toMatchObject({ kind: 'member', key: 'daypart', of: { is: 'clock', path: 'clock.previous' } });
    expect(nameAt('return traits.Brave.ena|bled;')).toMatchObject({ kind: 'member', key: 'enabled', of: { is: 'trait', key: 'Brave' } });
    expect(nameAt('return Math.ro|und(1);')).toMatchObject({ kind: 'member', key: 'round', of: { is: 'listed', path: 'Math' } });
    expect(nameAt('return Object.values(stats).find((s) => s.value > 0).va|lue;'))
      .toMatchObject({ kind: 'member', key: 'value', of: { is: 'stat', owner: { route: 'world' }, key: null } });
  });

  it('names a global, a built-in and a name the code declares', () => {
    expect(nameAt('return se|lf.value;')).toEqual({ kind: 'global', key: 'self', ...spanOf('return self.value;', 'self') });
    expect(nameAt('return Ma|th.PI;')).toMatchObject({ kind: 'global', key: 'Math' });
    const doc = 'const rate = 2;\nreturn ra|te * 2;';
    expect(nameAt(doc)).toEqual({ kind: 'declared', key: 'rate', at: 'const '.length, ...spanOf(doc, 'rate') });
    expect(nameAt('const ra|te = 2;')).toMatchObject({ kind: 'declared', key: 'rate', at: 'const '.length });
    expect(nameAt('const { m|in } = self;')).toMatchObject({ kind: 'declared', key: 'min', at: 'const { '.length });
  });

  it('reads a global the code declares as the author’s own, and nothing below it as the sandbox’s', () => {
    expect(nameAt('const stats = { HP: 1 };\nreturn st|ats.HP;')).toMatchObject({ kind: 'declared', key: 'stats' });
    expect(nameAt('const stats = { HP: 1 };\nreturn stats.H|P;')).toBeNull();
    expect(nameAt('const traits = { Brave: 1 };\nreturn traits.Br|ave;')).toBeNull();
  });

  it('names a template slot by its name', () => {
    const doc = 'return self.value * {{ra|te:number=1}};';
    expect(nameAt(doc, { ...world, slots: true })).toEqual({ kind: 'slot', key: 'rate', ...spanOf(doc, '{{rate:number=1}}') });
  });
});

describe('resolveCodeName: what names nothing', () => {
  it.each([
    'return x === "Hea|lth" ? 1 : 0;',
    'return stats.Health.name === "Hea|lth";',
    'console.log("Hea|lth");',
    'return ["Hea|lth"][0];',
  ])('reads a string that is no map key as nothing: %s', (doc) => {
    expect(nameAt(doc)).toBeNull();
  });

  it('reads nothing at an unknown name, a number or a computed step', () => {
    expect(nameAt('return foo|bar;')).toBeNull();
    expect(nameAt('return 4|2;')).toBeNull();
    expect(nameAt('const k = "Hair";\nreturn placeholders[k].Sha|de;')).toBeNull();
  });

  it('reads no member off something the tree can’t name', () => {
    expect(nameAt('const other = 5;\nreturn other.va|lue;')).toBeNull();
    expect(nameAt('return Object.values(stats).filter((s) => s.value > 0).len|gth;')).toBeNull();
  });
});
