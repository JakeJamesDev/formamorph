import { describe, it, expect } from 'vitest';
import type { Entity, Placeholder, PlaceholderGroup, PlaceholderValue, Trait, TraitGroup, TraitLink } from '@/types';
import { encodePlaceholderToken } from './placeholders';
import { detachLink } from './traitLinks';
import { applyOwnedTraitDrop } from './traitTree';
import { copyOf } from './blueprints';
import { copyNeeds, isUntouchedCopy, neededCopies, syncBlueprintCopies, type CopyWorld } from './blueprintCopies';

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `p-${id}` });
const value = (id: string, text: string, extra: Partial<PlaceholderValue> = {}): PlaceholderValue => ({ id, text, ...extra });
const ph = (id: string, name: string, extra: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name, values: [value(`${id}-v`, name)], ...extra });
const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const group = (id: string, extra: Partial<TraitGroup> = {}): TraitGroup => ({ id, name: id, parentId: null, ...extra });
const link = (id: string, originalId: string, kind: 'trait' | 'group' = 'trait', extra: Partial<TraitLink> = {}): TraitLink =>
  ({ id, originalId, kind, originalName: originalId, groupId: null, order: 0, ...extra });
const entity = (id: string, extra: Partial<Entity> = {}): Entity => ({ id, name: id, ...extra });
const copy = (id: string, blueprintId: string, extra: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name: blueprintId, values: [], blueprintId, ...extra });

const BLUEPRINTS: PlaceholderGroup = { id: 'bp', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' };
const TRAIT_BLUEPRINTS: TraitGroup = group('tbp', { name: 'Blueprints', system: 'blueprints' });

const garb = ph('garb', 'Class Garb', { groupId: 'bp', values: [value('tabard', 'a tabard'), value('robes', 'blue robes')] });
const heritage = ph('heritage', 'Heritage', { groupId: 'bp' });
// Trim's values reach Heritage, so a bearer of Trim needs Heritage too.
const trim = ph('trim', 'Trim', { groupId: 'bp', values: [value('trim-v', `trim of ${chip('heritage')}`)] });
const eyes = ph('eyes', 'Eyes');

const paladin = trait('paladin', { groupId: 'tbp', placeholderPins: [{ placeholderId: 'garb', value: 'a tabard', valueId: 'tabard' }] });
const tailor = trait('tailor', { groupId: 'tbp', aiDescription: `Wears ${chip('trim')}` });

let seq = 0;
const nextId = () => `id-${++seq}`;

const world = (extra: Partial<CopyWorld> = {}): CopyWorld => ({
  traits: [paladin, tailor],
  traitGroups: [TRAIT_BLUEPRINTS],
  entities: [],
  placeholders: [garb, heritage, trim, eyes],
  placeholderGroups: [BLUEPRINTS],
  ...extra,
});

const sync = (w: CopyWorld) => syncBlueprintCopies(w, nextId);
const copiesOf = (e: Entity | undefined) => (e?.placeholders ?? []).filter((p) => p.blueprintId).map((p) => p.blueprintId!).sort();
const needs = (w: CopyWorld, id: string) => [...(neededCopies(w).get(id) ?? [])].sort();

describe('neededCopies', () => {
  it('needs a copy for each blueprint a linked trait pins, and one for each blueprint an owned trait places', () => {
    const w = world({ entities: [
      entity('a', { traitLinks: [link('l1', 'paladin')] }),
      entity('b', { traits: [trait('own', { playerDescription: chip('garb') })] }),
    ] });
    expect(needs(w, 'a')).toEqual(['garb']);
    expect(needs(w, 'b')).toEqual(['garb']);
  });

  it('follows a blueprint chip through a linked group to every trait below it', () => {
    const w = world({
      traitGroups: [TRAIT_BLUEPRINTS, group('classes', { parentId: 'tbp' })],
      traits: [{ ...paladin, groupId: 'classes' }],
      entities: [entity('a', { traitLinks: [link('l1', 'classes', 'group')] })],
    });
    expect(needs(w, 'a')).toEqual(['garb']);
  });

  it('needs the blueprints a needed blueprint reaches through its values, and what a copy adds of its own', () => {
    const w = world({ entities: [entity('a', { traitLinks: [link('l1', 'tailor')] })] });
    expect(needs(w, 'a')).toEqual(['heritage', 'trim']);
    const own = copy('c-trim', 'trim', { values: [value('mine', `also ${chip('garb')}`)] });
    const reaching = world({ entities: [entity('a', { traitLinks: [link('l1', 'tailor')], placeholders: [own] })] });
    expect(needs(reaching, 'a')).toEqual(['garb', 'heritage', 'trim']);
  });

  it('gives every Persona-marked entity and the Custom Persona entity the root traits’ blueprints, never the cast', () => {
    const w = world({
      traits: [{ ...paladin, groupId: null }],
      entities: [entity('p', { persona: true }), entity('po', { persona: true, personaOnly: true }), entity('cp', { customPersona: true }), entity('cast')],
    });
    expect(needs(w, 'p')).toEqual(['garb']);
    expect(needs(w, 'po')).toEqual(['garb']);
    expect(needs(w, 'cp')).toEqual(['garb']);
    expect(neededCopies(w).has('cast')).toBe(false);
  });

  it('counts a chip in the owner’s own text that names its copy', () => {
    const w = world({ entities: [entity('a', { aiDescription: `sees ${chip('c1')}`, placeholders: [copy('c1', 'garb')] })] });
    expect(needs(w, 'a')).toEqual(['garb']);
  });

  it('counts a pin on an owned trait that names the copy itself', () => {
    const w = world({ entities: [entity('a', {
      traits: [trait('own', { placeholderPins: [{ placeholderId: 'c1', value: 'a tabard', valueId: 'tabard' }] })],
      placeholders: [copy('c1', 'garb')],
    })] });
    expect(needs(w, 'a')).toEqual(['garb']);
  });

  it('ignores chips and pins on placeholders that are not blueprints', () => {
    const w = world({ entities: [entity('a', { traits: [trait('own', { aiDescription: chip('eyes'), placeholderPins: [{ placeholderId: 'eyes', value: 'x' }] })] })] });
    expect(neededCopies(w).has('a')).toBe(false);
  });
});

describe('copyNeeds', () => {
  it('names the trait that needs a copy, and the placeholder whose values reach one, as the bearer reads it', () => {
    const w = world({ entities: [entity('a', { traitLinks: [link('l1', 'tailor')] })] });
    const why = copyNeeds(w).get('a');
    expect(why?.get('trim')).toMatchObject({ kind: 'trait', item: { id: 'tailor' } });
    expect(why?.get('heritage')).toEqual({ kind: 'value', placeholderId: 'trim' });
    const own = world({ entities: [entity('a', { traitLinks: [link('l1', 'tailor')], placeholders: [copy('c-trim', 'trim')] })] });
    expect(copyNeeds(own).get('a')?.get('heritage')).toEqual({ kind: 'value', placeholderId: 'c-trim' });
  });

  it('names the owner’s own text when only a chip there keeps its copy', () => {
    const w = world({ entities: [entity('a', { aiDescription: `sees ${chip('c1')}`, placeholders: [copy('c1', 'garb')] })] });
    expect(copyNeeds(w).get('a')?.get('garb')).toEqual({ kind: 'own' });
  });
});

describe('syncBlueprintCopies: creating', () => {
  it('creates the missing copies, each named after its blueprint with no values of its own', () => {
    const w = world({ entities: [entity('a', { traitLinks: [link('l1', 'tailor')] })] });
    const [a] = sync(w);
    const trimCopy = copyOf(a, 'trim')!;
    expect(trimCopy).toEqual({ id: trimCopy.id, name: 'Trim', values: [], blueprintId: 'trim' });
    expect(copiesOf(a)).toEqual(['heritage', 'trim']);
  });

  it('creates one copy per blueprint per owner and keeps the ones that exist', () => {
    const c1 = copy('c1', 'garb');
    const w = world({ entities: [entity('a', { traitLinks: [link('l1', 'paladin')], placeholders: [c1] })] });
    const out = sync(w);
    expect(out).toBe(w.entities);
    expect(out[0].placeholders).toEqual([c1]);
  });

  it('keeps every other placeholder the entity owns, copies appended after them', () => {
    const w = world({ entities: [entity('a', { traitLinks: [link('l1', 'paladin')], placeholders: [eyes] })] });
    const [a] = sync(w);
    expect(a.placeholders!.map((p) => p.blueprintId ?? p.id)).toEqual(['eyes', 'garb']);
  });

  it('creates copies on marking: a Persona entity gets the root traits’ blueprints', () => {
    const rooted = world({ traits: [{ ...paladin, groupId: null }], entities: [entity('a')] });
    expect(sync(rooted)).toBe(rooted.entities);
    const marked = { ...rooted, entities: [entity('a', { persona: true })] };
    expect(copiesOf(sync(marked)[0])).toEqual(['garb']);
  });

  it('creates copies when a chip or pin joins an original that already has bearers', () => {
    const bare = world({ traits: [trait('paladin', { groupId: 'tbp' })], entities: [entity('a', { traitLinks: [link('l1', 'paladin')] })] });
    expect(sync(bare)).toBe(bare.entities);
    const pinned = { ...bare, traits: [paladin] };
    expect(copiesOf(sync(pinned)[0])).toEqual(['garb']);
    const chipped = { ...bare, traits: [trait('paladin', { groupId: 'tbp', aiDescription: chip('trim') })] };
    expect(copiesOf(sync(chipped)[0])).toEqual(['heritage', 'trim']);
  });

  it('is idempotent: a second pass changes nothing', () => {
    const w = world({ entities: [entity('a', { traitLinks: [link('l1', 'tailor')] }), entity('cp', { customPersona: true })] });
    const once = sync(w);
    expect(sync({ ...w, entities: once })).toBe(once);
  });

  it('returns the same array and the same untouched entities when nothing changes', () => {
    const b = entity('b');
    const w = world({ entities: [entity('a', { traitLinks: [link('l1', 'paladin')] }), b] });
    const out = sync(w);
    expect(out[1]).toBe(b);
    expect(sync({ ...w, entities: out })).toBe(out);
  });
});

describe('syncBlueprintCopies: cleanup', () => {
  const uses = (e: Entity) => world({ entities: [e] });

  it('removes an untouched copy when its last use leaves', () => {
    const w = uses(entity('a', { traitLinks: [link('l1', 'paladin')], placeholders: [copy('c1', 'garb')] }));
    expect(sync(w)).toBe(w.entities);
    const gone = uses(entity('a', { placeholders: [copy('c1', 'garb')] }));
    expect(sync(gone)[0]).not.toHaveProperty('placeholders');
  });

  it('keeps an edited copy: a reworded value, a removed value, or a value of its own', () => {
    const edits: Partial<Placeholder>[] = [
      { valueOverrides: { tabard: { text: { value: 'a red tabard', blueprint: 'a tabard' } } } },
      { valueOverrides: { tabard: { removed: true } } },
      { values: [value('own', 'mine')] },
    ];
    for (const edit of edits) {
      const w = uses(entity('a', { placeholders: [copy('c1', 'garb', edit)] }));
      expect(sync(w), JSON.stringify(edit)).toBe(w.entities);
    }
  });

  it('keeps an untouched copy while a chip in the owner’s own text uses it', () => {
    const w = uses(entity('a', { playerDescription: chip('c1'), placeholders: [copy('c1', 'garb')] }));
    expect(sync(w)).toBe(w.entities);
  });

  it('keeps an untouched copy while an owned placeholder’s value uses it', () => {
    const w = uses(entity('a', { placeholders: [copy('c1', 'garb'), ph('own', 'Own', { values: [value('v', chip('c1'))] })] }));
    expect(sync(w)).toBe(w.entities);
  });

  it('keeps an untouched copy while an edited copy’s reworded value uses it', () => {
    const reworded = copy('c-her', 'heritage', { valueOverrides: { 'heritage-v': { text: { value: `of ${chip('c1')}`, blueprint: 'Heritage' } } } });
    const w = uses(entity('a', { placeholders: [copy('c1', 'garb'), reworded] }));
    expect(sync(w)).toBe(w.entities);
  });

  it('removes a nested copy with the copy that reached it, unless something else still does', () => {
    const w = uses(entity('a', { traitLinks: [link('l1', 'tailor')], placeholders: [copy('c-trim', 'trim'), copy('c-her', 'heritage')] }));
    expect(sync(w)).toBe(w.entities);
    const unlinked = uses(entity('a', { placeholders: [copy('c-trim', 'trim'), copy('c-her', 'heritage')] }));
    expect(sync(unlinked)[0]).not.toHaveProperty('placeholders');
    const held = uses(entity('a', { aiDescription: chip('c-trim'), placeholders: [copy('c-trim', 'trim'), copy('c-her', 'heritage')] }));
    expect(sync(held)).toBe(held.entities);
  });

  it('removes an untouched copy whose blueprint is gone and keeps an edited one', () => {
    const w = world({ placeholders: [eyes], entities: [entity('a', { placeholders: [copy('c1', 'garb'), copy('c2', 'heritage', { values: [value('own', 'mine')] })] })] });
    expect(sync(w)[0].placeholders).toEqual([copy('c2', 'heritage', { values: [value('own', 'mine')] })]);
  });

  it('reads a copy as untouched only with no overrides and no values of its own', () => {
    expect(isUntouchedCopy(copy('c', 'garb'))).toBe(true);
    expect(isUntouchedCopy(copy('c', 'garb', { values: [value('v', 'x')] }))).toBe(false);
    expect(isUntouchedCopy(copy('c', 'garb', { valueOverrides: { tabard: { removed: true } } }))).toBe(false);
    expect(isUntouchedCopy(eyes)).toBe(false);
  });
});

describe('syncBlueprintCopies: rewrites', () => {
  const originals = { traits: [paladin, tailor], traitGroups: [TRAIT_BLUEPRINTS] };

  it('Detach: the owned trait’s chips and pins name the entity’s copies, created where missing', () => {
    const a = entity('a', { traitLinks: [link('l1', 'paladin', 'trait', { overrides: { paladin: { placeholderPins: { value: [{ placeholderId: 'garb', value: 'blue robes', valueId: 'robes' }], blueprint: [] } } } })] });
    const detached = detachLink(originals, a, 'l1')!;
    const [out] = sync(world({ entities: [detached.entity] }));
    const garbCopy = copyOf(out, 'garb')!;
    const owned = out.traits!.find((t) => t.id === detached.newId)!;
    expect(owned.placeholderPins).toEqual([{ placeholderId: garbCopy.id, value: 'blue robes', valueId: 'robes' }]);
  });

  it('Detach of a trait with a blueprint chip: the chip names the copy, and the nested copy exists too', () => {
    const a = entity('a', { traitLinks: [link('l1', 'tailor')] });
    const detached = detachLink(originals, a, 'l1')!;
    const [out] = sync(world({ entities: [detached.entity] }));
    const trimCopy = copyOf(out, 'trim')!;
    const owned = out.traits!.find((t) => t.id === detached.newId)!;
    // The placement id stays the original's: only the chip's target moves.
    expect(owned.aiDescription).toBe(`Wears ${encodePlaceholderToken({ id: trimCopy.id, mode: 'world', placementId: 'p-trim' })}`);
    expect(copiesOf(out)).toEqual(['heritage', 'trim']);
  });

  it('a move between entities: the trait’s chips and pins move from the old owner’s copies to the new owner’s', () => {
    const owned = trait('own', {
      aiDescription: encodePlaceholderToken({ id: 'ca', mode: 'world', placementId: 'p1' }),
      placeholderPins: [{ placeholderId: 'ca', value: 'a tabard', valueId: 'tabard' }],
    });
    const a = entity('a', { traits: [owned], placeholders: [copy('ca', 'garb')] });
    const b = entity('b', { traits: [trait('bob')] });
    // Rows: tbp, paladin, tailor, a, own, b, bob. Own dropped below Bob, inside B.
    const drop = applyOwnedTraitDrop(originals, [a, b], [], 'own', 'bob', 24, 24);
    expect(drop?.kind).toBe('moved');
    const moved = (drop as { entities: Entity[] }).entities;
    const next = [a, b].map((e) => moved.find((m) => m.id === e.id) ?? e);
    const out = sync(world({ entities: next }));
    const bOut = out.find((e) => e.id === 'b')!;
    const cb = copyOf(bOut, 'garb')!;
    expect(cb.id).not.toBe('ca');
    expect(bOut.traits!.find((t) => t.id === 'own')).toMatchObject({
      aiDescription: encodePlaceholderToken({ id: cb.id, mode: 'world', placementId: 'p1' }),
      placeholderPins: [{ placeholderId: cb.id, value: 'a tabard', valueId: 'tabard' }],
    });
    expect(out.find((e) => e.id === 'a')).not.toHaveProperty('placeholders');
  });

  it('a Simple-mode drag of a world trait into an entity moves it in and rewrites it', () => {
    const rooted = { ...originals, traits: [{ ...paladin, groupId: null }, tailor] };
    const a = entity('a', { traits: [trait('own')] });
    // Rows: tbp, tailor, paladin, a, own. Paladin dropped below Own, inside A.
    const drop = applyOwnedTraitDrop(rooted, [a], [], 'paladin', 'own', 24, 24, { createLinks: false });
    expect(drop?.kind).toBe('moved');
    const { world: lists, entities } = drop as { world?: { traits: Trait[]; groups: TraitGroup[] }; entities: Entity[] };
    expect(lists?.traits.map((t) => t.id)).toEqual(['tailor']);
    const [out] = sync(world({ traits: lists!.traits, traitGroups: lists!.groups, entities }));
    const cg = copyOf(out, 'garb')!;
    expect(out.traits!.find((t) => t.id === 'paladin')?.placeholderPins).toEqual([{ placeholderId: cg.id, value: 'a tabard', valueId: 'tabard' }]);
  });

  it('leaves an owned trait’s chips alone when they already name the owner’s copies', () => {
    const owned = trait('own', { aiDescription: chip('ca') });
    const w = world({ entities: [entity('a', { traits: [owned], placeholders: [copy('ca', 'garb')] })] });
    expect(sync(w)).toBe(w.entities);
  });
});
