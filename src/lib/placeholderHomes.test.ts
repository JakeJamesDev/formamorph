import { describe, it, expect } from 'vitest';
import type { Dictionary, Entity, EntityGroup, Placeholder } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { decodePlaceholderToken, encodePlaceholderToken } from './placeholders';
import {
  allPlaceholders, placeholderHome, placeholderHomeFor, scatterPlaceholders, mapListHolding, withoutPlaceholders,
  remintScopedPlaceholders, duplicateEntityPlaceholders, remapEntityChips, remapBookChips,
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

  it('lands a placeholder nothing holds yet on the world list', () => {
    const fresh = P('fresh', 'Fresh', ['x']);
    const next = scatterPlaceholders(world(), [SHARED, fresh, EYES, HAIR, LORE]);
    expect(next.placeholders.map((p) => p.id)).toEqual(['shared', 'fresh']);
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
