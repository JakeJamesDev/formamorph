import { describe, expect, it } from 'vitest';
import {
  allPlaceholders, movePlaceholderHome, placeholderHome, placeholderHomeFor, placeholderOwners, scatterPlaceholders,
  withoutPlaceholders, type PlaceholderHomesWorld,
} from './placeholderHomes';
import { blankItem } from './items';
import type { Placeholder } from '@/types';

/** An item is a placeholder home beside entities and books (Q72). */

const ph = (id: string): Placeholder => ({ id, name: id, values: [{ id: `${id}-v`, text: id }] });

const world = (): PlaceholderHomesWorld => ({
  placeholders: [ph('shared')],
  entities: [{ id: 'molly', name: 'Molly', placeholders: [ph('eyes')] }],
  items: [{ ...blankItem('lamp', 'Lamp'), placeholders: [ph('glow')] }],
  dictionaries: [{ id: 'book', name: 'Lore', enabled: true, entries: [], placeholders: [ph('word')] }],
});

describe('the item placeholder home', () => {
  it('joins the combined view after the entities and before the books', () => {
    expect(allPlaceholders(world()).map((p) => p.id)).toEqual(['shared', 'eyes', 'glow', 'word']);
  });

  it('names the item as the owner of its placeholders', () => {
    expect(placeholderOwners(world()).get('glow')).toEqual({ kind: 'item', id: 'lamp', name: 'Lamp' });
    expect(placeholderHome(world(), 'glow')).toEqual({ kind: 'item', ownerId: 'lamp' });
  });

  it('lands a create named for the item on its list, and one for a gone item on the world list', () => {
    expect(placeholderHomeFor(world(), ph('new'), { kind: 'item', ownerId: 'lamp' })).toEqual({ kind: 'item', ownerId: 'lamp' });
    expect(placeholderHomeFor(world(), ph('new'), { kind: 'item', ownerId: 'gone' })).toEqual({ kind: 'world' });
  });

  it('scatters a combined list back to the item that holds each id', () => {
    const w = world();
    const combined = allPlaceholders(w).map((p) => (p.id === 'glow' ? { ...p, name: 'Glow Color' } : p));
    const next = scatterPlaceholders(w, combined);
    expect(next.items[0].placeholders?.map((p) => p.name)).toEqual(['Glow Color']);
    expect(next.entities).toBe(w.entities);
    expect(next.dictionaries).toBe(w.dictionaries);
  });

  it('moves a shared placeholder onto an item, id kept', () => {
    const next = movePlaceholderHome(world(), 'shared', { kind: 'item', ownerId: 'lamp' });
    expect(next.placeholders).toEqual([]);
    expect(next.items[0].placeholders?.map((p) => p.id)).toEqual(['glow', 'shared']);
  });

  it('removes an item placeholder from the item that holds it', () => {
    const next = withoutPlaceholders(world(), new Set(['glow']));
    expect(next.items[0]).not.toHaveProperty('placeholders');
  });
});
