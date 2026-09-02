import { describe, it, expect } from 'vitest';
import type { Dictionary, Entity, EntityGroup, Placeholder } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { decodePlaceholderToken, encodePlaceholderToken } from './placeholders';
import {
  allPlaceholders, placeholderHome, placeholderHomeFor, scatterPlaceholders, mapListHolding, withoutPlaceholders,
  remintScopedPlaceholders, duplicateEntityPlaceholders, remapEntityChips, remapBookChips,
  placeholderOwners, sameOwners, placeholderList, movePlaceholderHome, adoptEntityPlaceholders,
  adoptBookPlaceholders, carriedPlaceholders,
} from './placeholderHomes';

const P = (id: string, name: string, values: string[] = [], extra: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name, values: phValues(values), ...extra });
const chip = (id: string, placementId = 'pl1') => encodePlaceholderToken({ id, mode: 'world', placementId });

const SHARED = P('shared', 'Weather', ['rain', 'sun']);
const EYES = P('eyes', 'Eyes', ['amber']);
const HAIR = P('hair', 'Hair', ['red', 'black']);
const LORE = P('lore', 'Lore', ['the Fen']);

const molly = (extra: Partial<Entity> = {}): Entity => ({ id: 'molly', name: 'Molly', placeholders: [EYES], ...extra });
const tam = (extra: Partial<Entity> = {}): Entity => ({ id: 'tam', name: 'Tam', placeholders: [HAIR], ...extra });
const book = (extra: Partial<Dictionary> = {}): Dictionary => ({ id: 'book', name: 'Fen', entries: [], placeholders: [LORE], ...extra });

describe('allPlaceholders', () => {
  it('lists the world list, then each entity in tree order, then each book in book order', () => {
    // Tam is first in the array, but the tree puts Molly first by `order`.
    const groups: EntityGroup[] = [];
    const world = {
      placeholders: [SHARED],
      entities: [tam({ order: 1 }), molly({ order: 0 })],
      entityGroups: groups,
      dictionaries: [book()],
    };
    expect(allPlaceholders(world).map((p) => p.id)).toEqual(['shared', 'eyes', 'hair', 'lore']);
  });

  it('follows the entity tree through groups, so a grouped entity keeps its place', () => {
    const groups: EntityGroup[] = [{ id: 'g', name: 'Folk', parentId: null, order: 0 }];
    const world = {
      placeholders: [],
      entities: [tam({ order: 1 }), molly({ groupId: 'g', order: 0 })],
      entityGroups: groups,
    };
    expect(allPlaceholders(world).map((p) => p.id)).toEqual(['eyes', 'hair']);
  });

  it('returns the same array for an unchanged world', () => {
    const world = { placeholders: [SHARED], entities: [molly()], dictionaries: [book()] };
    expect(allPlaceholders(world)).toBe(allPlaceholders(world));
  });

  it('hands back the world list itself when nothing else carries a placeholder', () => {
    const list = [SHARED];
    const world = { placeholders: list, entities: [{ id: 'e', name: 'Plain' }], dictionaries: [{ id: 'b', name: 'B', entries: [] }] };
    expect(allPlaceholders(world)).toBe(list);
  });

  it('reads an absent world list as empty', () => {
    expect(allPlaceholders({ entities: [molly()] }).map((p) => p.id)).toEqual(['eyes']);
    expect(allPlaceholders({})).toEqual([]);
  });
});

describe('placeholderHome', () => {
  const world = { placeholders: [SHARED], entities: [molly()], dictionaries: [book()] };

  it('names the list a placeholder lives in', () => {
    expect(placeholderHome(world, 'shared')).toEqual({ kind: 'world' });
    expect(placeholderHome(world, 'eyes')).toEqual({ kind: 'entity', ownerId: 'molly' });
    expect(placeholderHome(world, 'lore')).toEqual({ kind: 'dictionary', ownerId: 'book' });
  });

  it('answers null for an id nothing holds', () => {
    expect(placeholderHome(world, 'gone')).toBeNull();
  });
});

describe('scatterPlaceholders', () => {
  const world = () => ({ placeholders: [SHARED], entities: [molly(), tam()], dictionaries: [book()] });

  it('routes each placeholder back to the list that holds it, in combined order', () => {
    const w = world();
    const renamed = { ...EYES, name: 'Eye Color' };
    const next = scatterPlaceholders(w, [SHARED, renamed, HAIR, LORE]);
    expect(next.placeholders).toBe(w.placeholders); // untouched slice keeps its identity
    expect(next.entities[0].placeholders).toEqual([renamed]);
    expect(next.entities[1]).toBe(w.entities[1]);
    expect(next.dictionaries).toBe(w.dictionaries);
  });

  it('lands a placeholder nothing holds yet beside the record before it, or on the world list at the front', () => {
    const fresh = P('fresh', 'Fresh', ['x']);
    // A duplicate is inserted right after its source, so it belongs where the source lives.
    expect(scatterPlaceholders(world(), [SHARED, fresh, EYES, HAIR, LORE]).placeholders.map((p) => p.id)).toEqual(['shared', 'fresh']);
    const scoped = scatterPlaceholders(world(), [SHARED, EYES, fresh, HAIR, LORE]);
    expect(scoped.placeholders.map((p) => p.id)).toEqual(['shared']);
    expect(scoped.entities[0].placeholders?.map((p) => p.id)).toEqual(['eyes', 'fresh']);
    expect(scatterPlaceholders(world(), [fresh, SHARED, EYES, HAIR, LORE]).placeholders.map((p) => p.id)).toEqual(['fresh', 'shared']);
  });

  it('drops a placeholder the combined list no longer carries', () => {
    const w = world();
    const next = scatterPlaceholders(w, [SHARED, HAIR, LORE]);
    expect(next.entities[0].placeholders).toBeUndefined();
    expect(next.entities[1]).toBe(w.entities[1]);
  });

  it('keeps an owned placeholder beside its holder, whichever list it started in', () => {
    // A drop makes Weather a part of Molly's Eyes: the value points at it, so it belongs to Molly's list.
    const holder = { ...EYES, values: [{ id: 'v:w', text: chip('shared') }] };
    const owned = { ...SHARED, ownerId: 'eyes' };
    const next = scatterPlaceholders(world(), [owned, holder, HAIR, LORE]);
    expect(next.placeholders).toEqual([]);
    expect(next.entities[0].placeholders?.map((p) => p.id)).toEqual(['shared', 'eyes']);
  });

  it('reorders within a list from the combined order', () => {
    const w = { ...world(), placeholders: [SHARED, P('two', 'Two', ['b'])] };
    const next = scatterPlaceholders(w, [w.placeholders[1], EYES, HAIR, LORE, SHARED]);
    expect(next.placeholders.map((p) => p.id)).toEqual(['two', 'shared']);
  });
});

describe('mapListHolding', () => {
  it('applies the change to the one owner that holds the id and leaves every other record alone', () => {
    const owners = [molly(), tam()];
    const next = mapListHolding(owners, 'hair', (list) => list.map((p) => ({ ...p, name: 'Mane' })));
    expect(next[0]).toBe(owners[0]);
    expect(next[1].placeholders?.[0].name).toBe('Mane');
  });

  it('returns the same array when nobody holds the id, or when the change returns the list as it was', () => {
    const owners = [molly()];
    expect(mapListHolding(owners, 'gone', (list) => list)).toBe(owners);
    expect(mapListHolding(owners, 'eyes', (list) => list)).toBe(owners);
  });

  it('drops the field rather than leaving an empty list behind', () => {
    const next = mapListHolding([molly()], 'eyes', () => []);
    expect('placeholders' in next[0]).toBe(false);
  });
});

describe('withoutPlaceholders', () => {
  it('removes ids from every list they live in and keeps untouched slices by identity', () => {
    const w = { placeholders: [SHARED], entities: [molly(), tam()], dictionaries: [book()] };
    const next = withoutPlaceholders(w, new Set(['eyes', 'lore']));
    expect(next.placeholders).toBe(w.placeholders);
    expect(next.entities[0].placeholders).toBeUndefined();
    expect(next.entities[1]).toBe(w.entities[1]);
    expect(next.dictionaries[0].placeholders).toBeUndefined();
  });
});

describe('remintScopedPlaceholders', () => {
  it('gives every def a fresh id and re-aims chips, owners and shared-weight keys at the new ids', () => {
    const part = P('part', 'Shade', ['dusk'], { ownerId: 'whole' });
    const whole = P('whole', 'Sky', [], {
      values: [{ id: 'v:p', text: chip('part') }, { id: 'v:s', text: chip('shared', 'pl2') }],
      sharedWeights: { 'v:s': { 'v:rain': 3 }, 'v:p/part': { 'v:dusk': 2 } },
    });
    const { placeholders, idMap } = remintScopedPlaceholders([whole, part]);
    const [whole2, part2] = placeholders;
    expect(whole2.id).not.toBe('whole');
    expect(part2.id).not.toBe('part');
    expect(idMap).toEqual({ whole: whole2.id, part: part2.id });
    expect(part2.ownerId).toBe(whole2.id);
    expect(decodePlaceholderToken(whole2.values[0].text)?.id).toBe(part2.id);
    // A chip at something outside the list is left as written.
    expect(decodePlaceholderToken(whole2.values[1].text)?.id).toBe('shared');
    // Value ids are re-minted with the def, so the shared-weight keys open on the new value ids.
    const keys = Object.keys(whole2.sharedWeights ?? {});
    expect(keys).toHaveLength(2);
    expect(keys.some((k) => k === `${whole2.values[0].id}/${part2.id}`)).toBe(true);
    expect(keys.some((k) => k === whole2.values[1].id)).toBe(true);
  });

  it('leaves an empty list empty', () => {
    expect(remintScopedPlaceholders([])).toEqual({ placeholders: [], idMap: {} });
  });
});

describe('duplicateEntityPlaceholders', () => {
  it('re-mints the copy’s placeholders and points its own chips at the new ids', () => {
    const src = molly({
      name: `${chip('eyes', 'a')} Molly`,
      aliases: [chip('eyes', 'b')],
      playerDescription: `Eyes of ${chip('eyes', 'c')}.`,
      aiDescription: chip('eyes', 'd'),
      aiSummary: chip('eyes', 'e'),
      imageTags: chip('eyes', 'f'),
    });
    const copy = duplicateEntityPlaceholders(src);
    const fresh = copy.placeholders?.[0].id;
    expect(fresh).toBeDefined();
    expect(fresh).not.toBe('eyes');
    for (const text of [copy.name, copy.aliases?.[0], copy.playerDescription, copy.aiDescription, copy.aiSummary, copy.imageTags]) {
      expect(decodePlaceholderToken(text!.match(/\{\{ph:[^}]+\}\}/)![0])?.id).toBe(fresh);
    }
    // The source is untouched.
    expect(src.placeholders?.[0].id).toBe('eyes');
  });

  it('leaves an entity with nothing scoped as it is', () => {
    const plain: Entity = { id: 'e', name: 'Plain' };
    expect(duplicateEntityPlaceholders(plain)).toBe(plain);
  });
});

describe('remapEntityChips / remapBookChips', () => {
  it('rewrites every chip-bearing field of an entity and returns it as is when nothing maps', () => {
    const e = molly({ name: chip('eyes'), playerDescription: chip('eyes', 'x') });
    const moved = remapEntityChips(e, { eyes: 'iris' });
    expect(decodePlaceholderToken(moved.name)?.id).toBe('iris');
    expect(decodePlaceholderToken(moved.playerDescription!)?.id).toBe('iris');
    expect(remapEntityChips(e, { other: 'x' })).toBe(e);
  });

  it('rewrites an entry’s name, keys, secondary keys and value', () => {
    const b = book({ entries: [{ id: 'en', name: chip('lore'), key: [chip('lore', 'k')], secondaryKeys: [chip('lore', 's')], value: chip('lore', 'v') }] });
    const moved = remapBookChips(b, { lore: 'tale' });
    const en = moved.entries[0];
    expect(decodePlaceholderToken(en.name!)?.id).toBe('tale');
    expect(decodePlaceholderToken(en.key![0])?.id).toBe('tale');
    expect(decodePlaceholderToken(en.secondaryKeys![0])?.id).toBe('tale');
    expect(decodePlaceholderToken(en.value!)?.id).toBe('tale');
    expect(remapBookChips(b, { other: 'x' })).toBe(b);
  });
});

describe('placeholderHomeFor', () => {
  const world = { placeholders: [SHARED], entities: [molly()], dictionaries: [book()] };

  it('takes the home the caller names when the world has that owner', () => {
    expect(placeholderHomeFor(world, P('n', 'N'), { kind: 'dictionary', ownerId: 'book' })).toEqual({ kind: 'dictionary', ownerId: 'book' });
  });

  it('puts a placeholder born owned beside its holder', () => {
    expect(placeholderHomeFor(world, P('n', 'N', [], { ownerId: 'eyes' }))).toEqual({ kind: 'entity', ownerId: 'molly' });
  });

  it('falls back to the world list for no home, a gone owner, or a holder nothing has', () => {
    expect(placeholderHomeFor(world, P('n', 'N'))).toEqual({ kind: 'world' });
    expect(placeholderHomeFor(world, P('n', 'N'), { kind: 'entity', ownerId: 'gone' })).toEqual({ kind: 'world' });
    expect(placeholderHomeFor(world, P('n', 'N', [], { ownerId: 'gone' }))).toEqual({ kind: 'world' });
  });
});

describe('placeholderOwners', () => {
  it('names the entity or book each scoped placeholder belongs to, and nothing for a shared one', () => {
    const owners = placeholderOwners({ placeholders: [SHARED], entities: [molly()], dictionaries: [book()] });
    expect(owners.get('eyes')).toEqual({ kind: 'entity', id: 'molly', name: 'Molly' });
    expect(owners.get('lore')).toEqual({ kind: 'dictionary', id: 'book', name: 'Fen' });
    expect(owners.has('shared')).toBe(false);
  });

  it('answers the same map for an unchanged world, and compares two maps by what they say', () => {
    const world = { placeholders: [SHARED], entities: [molly()], dictionaries: [book()] };
    expect(placeholderOwners(world)).toBe(placeholderOwners(world));
    const renamed = { ...world, entities: [molly({ name: 'Moll' })] };
    expect(sameOwners(placeholderOwners(world), placeholderOwners({ ...world }))).toBe(true);
    expect(sameOwners(placeholderOwners(world), placeholderOwners(renamed))).toBe(false);
    expect(placeholderOwners({ placeholders: [SHARED] }).size).toBe(0);
  });
});

describe('placeholderList', () => {
  const world = { placeholders: [SHARED], entities: [molly()], dictionaries: [book()] };
  it('hands back the list a home names, and an empty one for an owner the world lacks', () => {
    expect(placeholderList(world, { kind: 'world' })).toBe(world.placeholders);
    expect(placeholderList(world, { kind: 'entity', ownerId: 'molly' })).toBe(world.entities[0].placeholders);
    expect(placeholderList(world, { kind: 'dictionary', ownerId: 'book' })).toBe(world.dictionaries[0].placeholders);
    expect(placeholderList(world, { kind: 'entity', ownerId: 'gone' })).toEqual([]);
  });
});

describe('movePlaceholderHome', () => {
  const world = () => ({ placeholders: [SHARED], entities: [molly(), tam()], dictionaries: [book()] });

  it('moves a shared placeholder into an owner list, id kept, and the reverse brings it back', () => {
    const w = world();
    const scoped = movePlaceholderHome(w, 'shared', { kind: 'entity', ownerId: 'molly' });
    expect(scoped.placeholders).toEqual([]);
    expect(scoped.entities[0].placeholders?.map((p) => p.id)).toEqual(['eyes', 'shared']);
    expect(scoped.entities[1]).toBe(w.entities[1]); // untouched slice keeps its identity
    expect(scoped.dictionaries).toBe(w.dictionaries);
    const back = movePlaceholderHome({ ...w, ...scoped }, 'shared', { kind: 'world' });
    expect(back.placeholders.map((p) => p.id)).toEqual(['shared']);
    expect(back.entities[0].placeholders?.map((p) => p.id)).toEqual(['eyes']);
  });

  it('takes what the placeholder owns along with it, and releases the moved one from its own holder', () => {
    // Eyes holds Shade privately; Weather holds Eyes privately. Moving Eyes to the book takes Shade, not Weather.
    const shade = P('shade', 'Shade', ['dusk'], { ownerId: 'eyes' });
    const eyes = P('eyes', 'Eyes', [chip('shade')], { ownerId: 'shared' });
    const weather = P('shared', 'Weather', [chip('eyes')]);
    const w = { placeholders: [weather, eyes, shade], entities: [tam()], dictionaries: [book()] };
    const next = movePlaceholderHome(w, 'eyes', { kind: 'dictionary', ownerId: 'book' });
    expect(next.placeholders.map((p) => p.id)).toEqual(['shared']);
    expect(next.dictionaries[0].placeholders?.map((p) => p.id)).toEqual(['lore', 'eyes', 'shade']);
    const moved = next.dictionaries[0].placeholders?.find((p) => p.id === 'eyes');
    expect(moved).not.toHaveProperty('ownerId');
    expect(next.dictionaries[0].placeholders?.find((p) => p.id === 'shade')?.ownerId).toBe('eyes');
    // The holder keeps its value: the row it drew is now a shared reference to the book's copy.
    expect(next.placeholders[0].values.map((v) => v.text)).toEqual([chip('eyes')]);
  });

  it('changes nothing for a move to the list it already lives in, an unknown id, or a gone owner', () => {
    const w = world();
    const same = movePlaceholderHome(w, 'eyes', { kind: 'entity', ownerId: 'molly' });
    expect(same.entities).toBe(w.entities);
    expect(movePlaceholderHome(w, 'nope', { kind: 'world' }).entities).toBe(w.entities);
    expect(movePlaceholderHome(w, 'shared', { kind: 'entity', ownerId: 'gone' }).placeholders).toBe(w.placeholders);
  });
});

describe('carriedPlaceholders', () => {
  it('reads an off-world item’s owned defs followed by the shared ones it carries', () => {
    expect(carriedPlaceholders({ placeholders: [EYES], sharedPlaceholders: [SHARED] }).map((p) => p.id)).toEqual(['eyes', 'shared']);
    const owned = [EYES];
    expect(carriedPlaceholders({ placeholders: owned })).toBe(owned);
    expect(carriedPlaceholders({})).toEqual([]);
  });
});

const chipIds = (text: string) => [...text.matchAll(/\{\{ph:[^}]+\}\}/g)].map((m) => decodePlaceholderToken(m[0])?.id);

describe('adoptEntityPlaceholders', () => {
  it('keeps owned defs with fresh ids, absorbs a shared one by name and values, and drops the carried field', () => {
    const worldShared = [P('w-weather', 'Weather', ['rain', 'sun'])];
    const card: Entity = {
      id: 'card', name: 'Molly',
      aiDescription: `${chip('eyes', 'a')} under ${chip('shared', 'b')}`,
      placeholders: [P('eyes', 'Eyes', ['amber'])],
      sharedPlaceholders: [P('shared', 'Weather', ['rain', 'sun'])],
    };
    const { entity, toAdd } = adoptEntityPlaceholders(card, worldShared);
    expect(toAdd).toEqual([]);
    expect(entity).not.toHaveProperty('sharedPlaceholders');
    const owned = entity.placeholders?.[0];
    expect(owned?.name).toBe('Eyes');
    expect(owned?.id).not.toBe('eyes');
    expect(chipIds(entity.aiDescription!)).toEqual([owned?.id, 'w-weather']);
  });

  it('adds a shared def the world has no match for, and re-aims a chip inside an owned value at it', () => {
    const card: Entity = {
      id: 'card', name: 'Molly',
      placeholders: [P('eyes', 'Eyes', [`${chip('shared', 'v')} eyes`])],
      sharedPlaceholders: [P('shared', 'Weather', ['storm'])],
    };
    const { entity, toAdd } = adoptEntityPlaceholders(card, [P('w-weather', 'Weather', ['rain'])]);
    expect(toAdd).toHaveLength(1);
    expect(toAdd[0].id).not.toBe('shared');
    expect(toAdd[0].name).toBe('Weather');
    expect(chipIds(entity.placeholders?.[0].values[0].text ?? '')).toEqual([toAdd[0].id]);
  });

  it('reads a card written before shared defs were split as all owned, and leaves a plain entity alone', () => {
    const old: Entity = { id: 'old', name: 'Old', placeholders: [P('eyes', 'Eyes', ['amber'])] };
    const { entity, toAdd } = adoptEntityPlaceholders(old, [P('w-eyes', 'Eyes', ['amber'])]);
    expect(toAdd).toEqual([]);
    expect(entity.placeholders?.[0].name).toBe('Eyes');
    expect(entity.placeholders?.[0].id).not.toBe('w-eyes');
    const plain: Entity = { id: 'p', name: 'Plain' };
    expect(adoptEntityPlaceholders(plain, []).entity).toBe(plain);
  });
});

describe('adoptBookPlaceholders', () => {
  it('does for a book what the entity adoption does, over its entries', () => {
    const file: Dictionary = {
      id: 'file', name: 'Fen',
      entries: [{ id: 'en', name: 'Fen', key: ['fen'], value: `${chip('lore', 'a')} ${chip('shared', 'b')}` }],
      placeholders: [P('lore', 'Lore', ['the Fen'])],
      sharedPlaceholders: [P('shared', 'Weather', ['rain'])],
    };
    const { book: adopted, toAdd } = adoptBookPlaceholders(file, [P('w-weather', 'Weather', ['rain'])]);
    expect(toAdd).toEqual([]);
    expect(adopted).not.toHaveProperty('sharedPlaceholders');
    const owned = adopted.placeholders?.[0];
    expect(owned?.id).not.toBe('lore');
    expect(chipIds(adopted.entries[0].value!)).toEqual([owned?.id, 'w-weather']);
  });
});
