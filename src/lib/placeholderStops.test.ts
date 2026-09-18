import { describe, it, expect } from 'vitest';
import { allPinRows, type PinEditorWorld } from './placeholderPins';
import { isPinStop, openStopIndex, placeholderStops } from './placeholderStops';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder, Trait, GameLocation } from '@/types';

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow']) };
const ghost: Placeholder = { id: 'ghost', name: 'Ghost', values: [] };
const lord: Placeholder = {
  id: 'lord',
  name: 'Lord',
  values: [{ id: 'v:Ash', text: 'Ash', pins: [
    // Names a listed Town value, so it is that value's stop rather than a stop of its own.
    { placeholderId: 'town', value: 'Marrow', valueId: 'v:Marrow' },
    { placeholderId: 'ghost', value: 'Wisp' },
  ] }],
};
const sworn = { id: 'sworn', name: 'Sworn', placeholderPins: [
  { placeholderId: 'town', value: 'Oathhold' },
  { placeholderId: 'ghost', value: 'Shade' },
  { placeholderId: 'ghost', value: 'Shadow' },
] } as unknown as Trait; // Only the fields the pin rows read.
const fen = { id: 'fen', name: 'Fen', placeholderPins: [{ placeholderId: 'town', value: 'Fenmoor' }] } as unknown as GameLocation;

const WORLD: PinEditorWorld = { placeholders: [town, ghost, lord], traits: [sworn], locations: [fen] };
const stopsOf = (ph: Placeholder) => placeholderStops(ph, allPinRows(WORLD));

describe('placeholderStops', () => {
  it('lists the values in order, then every pin on the placeholder, strongest source kind first', () => {
    expect(stopsOf(town).map((s) => s.text)).toEqual(['Sedge Landing', 'Marrow', 'Fenmoor', 'Oathhold']);
    expect(stopsOf(town).map(isPinStop)).toEqual([false, false, true, true]);
  });

  it('folds a pin that names a listed value into that value\'s stop, so no stop repeats', () => {
    expect(stopsOf(town).filter((s) => s.text === 'Marrow')).toHaveLength(1);
  });

  it('gives a placeholder with no values its pins alone, in authored order within one source', () => {
    expect(stopsOf(ghost).map((s) => s.text)).toEqual(['Shade', 'Shadow', 'Wisp']);
  });

  it('keeps two pins from one source apart by their place on it', () => {
    const [shade, shadow] = stopsOf(ghost);
    expect(shade.key).not.toBe(shadow.key);
  });

  it('names each pin stop by its source, stable across a rewrite of the pin\'s text', () => {
    const rewritten = { ...sworn, placeholderPins: [
      { placeholderId: 'town', value: 'Oathhold' },
      { placeholderId: 'ghost', value: 'A new shade' },
      { placeholderId: 'ghost', value: 'Shadow' },
    ] } as unknown as Trait;
    const before = stopsOf(ghost).map((s) => s.key);
    const after = placeholderStops(ghost, allPinRows({ ...WORLD, traits: [rewritten] })).map((s) => s.key);
    expect(after).toEqual(before);
  });

  it('gives a placeholder nothing pins and nothing fills no stops', () => {
    expect(placeholderStops(ghost, [])).toEqual([]);
  });
});

describe('openStopIndex', () => {
  const townStops = stopsOf(town);
  const ghostStops = stopsOf(ghost);
  const keyOf = (text: string, stops = townStops) => stops.find((s) => s.text === text)!.key;
  const textAt = (index: number, stops = townStops) => stops[index]?.text;

  it('opens on the stop the author stepped to, over anything the draw says', () => {
    const at = openStopIndex(townStops, { valueId: 'v:Marrow', text: 'Marrow', pinned: true }, keyOf('Oathhold'));
    expect(textAt(at.index)).toBe('Oathhold');
    expect(at.drawPinned).toBe(false);
  });

  it("opens on the pin the draw laid, marked as the draw's own", () => {
    const at = openStopIndex(ghostStops, {
      text: 'Wisp', pinned: true, pinSource: { placeholderId: 'lord', valueId: 'v:Ash' },
    }, undefined);
    expect(textAt(at.index, ghostStops)).toBe('Wisp');
    expect(at.drawPinned).toBe(true);
  });

  it("opens a laid pin that names a listed value on that value's stop", () => {
    const at = openStopIndex(townStops, { valueId: 'v:Marrow', text: 'Marrow', pinned: true }, undefined);
    expect(textAt(at.index)).toBe('Marrow');
    expect(at.drawPinned).toBe(true);
  });

  it('opens on the value the draw rolled', () => {
    expect(textAt(openStopIndex(townStops, { valueId: 'v:Marrow', text: 'Marrow' }, undefined).index)).toBe('Marrow');
  });

  it('opens a placeholder with no values on its first pin', () => {
    expect(textAt(openStopIndex(ghostStops, { text: '' }, undefined).index, ghostStops)).toBe('Shade');
  });

  it('falls back to the draw where a stepped-to stop is gone', () => {
    expect(textAt(openStopIndex(townStops, { valueId: 'v:Marrow', text: 'Marrow' }, 'p:gone#0').index)).toBe('Marrow');
  });

  it('opens nothing where there are no stops', () => {
    expect(openStopIndex([], { text: '' }, undefined).index).toBe(-1);
  });
});
