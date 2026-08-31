import { describe, it, expect } from 'vitest';
import type { Placeholder } from '@/types';
import { promptVocabulary, placeholderVocabulary } from './chipVocabulary';
import { encodePlaceholderToken, decodePlaceholderToken } from './placeholders';
import type { PlaceholderSegment } from './placeholders';

const P = (id: string, values: string[]): Placeholder => ({ id, name: `name-${id}`, values });
const tok = (id: string, mode: 'world' | 'unique', pid = 'p1') => encodePlaceholderToken({ id, mode, placementId: pid });

describe('promptVocabulary (regression — the existing prompt family still works)', () => {
  const v = promptVocabulary([]);
  it('recognizes a registry token and reports its label/color', () => {
    expect(v.isKnown('<WORLD DESCRIPTION>')).toBe(true);
    expect(v.label('<WORLD DESCRIPTION>')).toBe('World');
    expect(v.color('<WORLD DESCRIPTION>')).toBeTruthy();
  });
  it('changes a variant axis via setAxis', () => {
    // Location has a content axis; switching it to summary appends the variant suffix.
    const next = v.setAxis('<LOCATION>', 'content', 'summary');
    expect(next).toBe('<LOCATION|summary>');
    expect(v.variantLabel(next)).toContain('Summary');
  });
  it('parses tokens out of text', () => {
    const segs = v.parse('a <WORLD DESCRIPTION> b');
    expect(segs).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'variable', token: '<WORLD DESCRIPTION>' },
      { type: 'text', value: ' b' },
    ]);
  });
});

describe('placeholderVocabulary', () => {
  const placeholders = [P('eye', ['Red', 'Blue', 'Green']), P('king', ['Aldric'])];
  const v = placeholderVocabulary(placeholders);

  it('parses placeholder tokens out of text', () => {
    const t = tok('eye', 'world');
    expect(v.parse(`eyes: ${t}.`)).toEqual([
      { type: 'text', value: 'eyes: ' },
      { type: 'variable', token: t },
      { type: 'text', value: '.' },
    ]);
  });

  it('labels a chip by the placeholder name, and marks a deleted one', () => {
    expect(v.label(tok('eye', 'world'))).toBe('name-eye');
    expect(v.label(tok('ghost', 'world'))).toBe('(missing)');
  });

  // The chip stays one word wide however long the value list is; what it becomes goes in the tooltip.
  it('hints what a chip will become, without widening the chip', () => {
    expect(v.hint?.(tok('eye', 'world'))).toBe('Red|Blue|Green');
    expect(v.hint?.(tok('king', 'world'))).toBe('Aldric');
    expect(v.hint?.(tok('ghost', 'world'))).toBeUndefined(); // nothing to say about a deleted one
    expect(placeholderVocabulary([P('blank', [])]).hint?.(tok('blank', 'world'))).toBe('no values');
  });

  it('shows the World/Unique axis only for a Wildcard (2+ values)', () => {
    expect(v.axes(tok('eye', 'world'))).toHaveLength(1); // 3 values → Wildcard
    expect(v.axes(tok('king', 'world'))).toHaveLength(0); // 1 value → Variable, no axis
    expect(v.axes(tok('ghost', 'world'))).toHaveLength(0); // missing → none
  });

  it('reflects and flips the mode', () => {
    expect(v.variantLabel(tok('eye', 'world'))).toBeNull(); // World is the default, not shown
    expect(v.variantLabel(tok('eye', 'unique'))).toBe('Unique');
    expect(v.selection(tok('eye', 'unique'))).toEqual({ mode: 'unique' });

    const flipped = v.setAxis(tok('eye', 'world', 'p9'), 'mode', 'unique');
    expect(decodePlaceholderToken(flipped)).toEqual({ id: 'eye', mode: 'unique', placementId: 'p9' });
    const back = v.setAxis(flipped, 'mode', null);
    expect(decodePlaceholderToken(back)).toEqual({ id: 'eye', mode: 'world', placementId: 'p9' });
  });

  it('offers each placeholder in the palette', () => {
    const items = v.palette();
    expect(items.map((i) => i.label)).toEqual(['name-eye', 'name-king']);
    expect(items.every((i) => decodePlaceholderToken(i.token))).toBe(true);
  });

  it('re-mints a fresh placement id on insert (so two Unique chips roll independently)', () => {
    const paletteToken = v.palette()[0].token;
    const a = decodePlaceholderToken(v.freshInsertToken(paletteToken))!;
    const b = decodePlaceholderToken(v.freshInsertToken(paletteToken))!;
    expect(a.placementId).not.toBe('palette');
    expect(a.placementId).not.toBe(b.placementId);
    expect(a.id).toBe('eye');
  });
});

/**
 * The two structural hooks the `{` typeahead drives: one level down from a chip, and minting a placeholder
 * that does not exist yet. Both are optional on the vocabulary, so the static prompt family simply does not
 * offer them and the menu shows neither affordance there.
 */
describe('placeholderVocabulary — drill and inline create', () => {
  const val = (ref: string): PlaceholderSegment => ({ kind: 'val', ref });
  const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });
  const WORLD: Placeholder[] = [
    { id: 'molly', name: 'Molly', values: [chip('white'), chip('asian')] },
    { id: 'white', name: 'isWhite', roll: false, values: [chip('hair'), chip('eyes')] },
    { id: 'asian', name: 'isAsian', roll: false, values: [chip('hair')] },
    { id: 'hair', name: 'Hair', values: ['brown', 'black'] },
    { id: 'eyes', name: 'Eyes', values: ['green'] },
  ];
  const v = placeholderVocabulary(WORLD);

  it('offers a placeholder its parts, named by themselves rather than by the whole path', () => {
    expect(v.drill?.(tok('molly', 'world')).map((r) => r.label)).toEqual(['isWhite', 'isAsian']);
  });

  it('drills one step deeper each time, so the row carries the path it stands for', () => {
    const step = v.drill?.(tok('molly', 'world'))?.[0].token as string;
    expect(decodePlaceholderToken(step)?.path).toEqual([val('white')]);
    const deeper = v.drill?.(step)?.[0].token as string;
    expect(decodePlaceholderToken(deeper)?.path).toEqual([val('white'), val('hair')]);
    // The chip reads as the whole path, which is what keeps Molly's Hair apart from a root Hair.
    expect(v.label(deeper)).toBe('Molly › isWhite › Hair');
  });

  it('keeps the row on the accent of the chip it drills, so a path reads as one chip', () => {
    const row = v.drill?.(tok('molly', 'world'))?.[0];
    expect(row?.color).toBe(v.color(tok('molly', 'world')));
  });

  it('offers nothing to drill into where a placeholder holds no parts', () => {
    expect(v.drill?.(tok('hair', 'world'))).toEqual([]);
    expect(v.drill?.(tok('ghost', 'world'))).toEqual([]);
  });

  it('keeps the mode and placement of the chip being drilled', () => {
    const step = v.drill?.(tok('molly', 'unique', 'p9'))?.[0].token as string;
    const d = decodePlaceholderToken(step)!;
    expect(d.mode).toBe('unique');
    expect(d.placementId).toBe('p9');
  });

  it('mints a born-Wildcard placeholder and hands back a token that names it', () => {
    const made: Placeholder[] = [];
    const authored = placeholderVocabulary(WORLD, { onCreate: (p) => made.push(p) });
    const token = authored.create?.('Freckles') as string;
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ name: 'Freckles', values: [], roll: true });
    expect(decodePlaceholderToken(token)?.id).toBe(made[0].id);
  });

  it('gives each insertion of a new placeholder its own placement id', () => {
    const authored = placeholderVocabulary(WORLD, { onCreate: () => {} });
    const token = authored.create?.('Freckles') as string;
    const a = decodePlaceholderToken(authored.freshInsertToken(token))!;
    const b = decodePlaceholderToken(authored.freshInsertToken(token))!;
    expect(a.placementId).not.toBe(b.placementId);
  });

  it('offers no create at all where nothing is bound to write the placeholder to', () => {
    expect(v.create).toBeUndefined();
  });

  it('offers neither hook on the static prompt family', () => {
    expect(promptVocabulary([]).drill).toBeUndefined();
    expect(promptVocabulary([]).create).toBeUndefined();
  });
});

describe('chip affixes in the editor vocabulary (gate 8)', () => {
  const vocab = promptVocabulary([]);

  it('offers affixes only on chips that render an inline value', () => {
    expect(vocab.affixes('<LOCATION|name>')).toEqual({ pre: '', post: '' });
    expect(vocab.affixes('<ENTITIES>')).toEqual({ pre: '', post: '' });
    expect(vocab.affixes('<NOTES>')).toEqual({ pre: '', post: '' });
    // Block-rendering chips get no fields at all.
    expect(vocab.affixes('<WORLD DESCRIPTION>')).toBeNull();
    expect(vocab.affixes('<STATS DESCRIPTION>')).toBeNull();
  });

  it('writes affixes into the token and reads them back', () => {
    const t = vocab.setAffixes('<ENTITIES|name>', ' with ', ' present');
    expect(t).toBe('<ENTITIES|name|pre=" with "|post=" present">');
    expect(vocab.affixes(t)).toEqual({ pre: ' with ', post: ' present' });
  });

  it('removes the part when an affix is set to empty (canonical form)', () => {
    const both = vocab.setAffixes('<ENTITIES|name>', ' with ', ' present');
    expect(vocab.setAffixes(both, '', ' present')).toBe('<ENTITIES|name|post=" present">');
    expect(vocab.setAffixes(both, '', '')).toBe('<ENTITIES|name>');
  });

  it('keeps affixes when a mode is switched — the wording is not lost to a click', () => {
    const t = vocab.setAffixes('<ENTITIES|name>', ' with ', ' present');
    const switched = vocab.setAxis(t, 'scope', 'reachable');
    expect(vocab.affixes(switched)).toEqual({ pre: ' with ', post: ' present' });
    expect(vocab.selection(switched).scope).toBe('reachable');
  });

  it('reports the same variant label affixed or not, so the chip reads the same', () => {
    expect(vocab.variantLabel('<ENTITIES|name|pre=" with ">')).toBe(vocab.variantLabel('<ENTITIES|name>'));
  });

  it('refuses affixes on a chip that does not take them', () => {
    expect(vocab.setAffixes('<WORLD DESCRIPTION>', ' x ', '')).toBe('<WORLD DESCRIPTION>');
  });
});

/**
 * What the drill picker reads: the trail a chip's path took, the slots a roll can route to, and the values
 * no path addresses. The typeahead's own `drill` still supplies the parts — this is only what a picker says
 * about them on top.
 */
describe('placeholderVocabulary — structure', () => {
  const val = (ref: string): PlaceholderSegment => ({ kind: 'val', ref });
  const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });
  const WORLD: Placeholder[] = [
    { id: 'molly', name: 'Molly', values: [chip('white'), chip('asian')] },
    { id: 'white', name: 'isWhite', roll: false, values: [chip('hair'), chip('eyes')] },
    { id: 'asian', name: 'isAsian', roll: false, values: [chip('hair')] },
    { id: 'hair', name: 'Hair', values: ['brown', 'black'] },
    { id: 'eyes', name: 'Eyes', values: ['green'] },
  ];
  const v = placeholderVocabulary(WORLD);

  it('heads the parts section with what the level is', () => {
    expect(v.structure?.(tok('molly', 'world'))?.partsLabel).toBe('Wildcard Variants');
    expect(v.structure?.(tok('white', 'world'))?.partsLabel).toBe('Object Parts');
    expect(v.structure?.(tok('asian', 'world'))?.partsLabel).toBe('Variable Part');
  });

  it('offers each slot as the same chip with the name appended to its path', () => {
    const slot = v.structure?.(tok('molly', 'world'))?.slots.find((s) => s.label === 'Hair');
    expect(decodePlaceholderToken(slot?.token ?? '')?.path).toEqual([{ kind: 'slot', name: 'Hair' }]);
  });

  it('marks the slot the other value cannot supply', () => {
    const slots = v.structure?.(tok('molly', 'world'))?.slots ?? [];
    expect(slots.map((s) => [s.label, s.partial])).toEqual([['Hair', false], ['Eyes', true]]);
  });

  it('trails the path it walked, root first, ending where the chip stands', () => {
    const drilled = v.drill?.(tok('molly', 'world'))?.[0].token as string;
    const trail = v.structure?.(drilled)?.trail ?? [];
    expect(trail.map((c) => c.label)).toEqual(['Molly', 'isWhite']);
    // Each crumb is the same chip cut back to that depth, so clicking one walks there. The root crumb
    // carries no path at all, which is the shape a chip placed before paths existed already had.
    expect(decodePlaceholderToken(trail[0].token)?.path).toBeUndefined();
    expect(decodePlaceholderToken(trail[1].token)?.path).toEqual([val('white')]);
  });

  it('keeps the mode and placement of the chip it describes', () => {
    const slot = v.structure?.(tok('molly', 'unique', 'p9'))?.slots[0];
    const d = decodePlaceholderToken(slot?.token ?? '')!;
    expect(d.mode).toBe('unique');
    expect(d.placementId).toBe('p9');
  });

  it('counts the values no path can address', () => {
    expect(v.structure?.(tok('hair', 'world'))?.plain).toBe(2);
    expect(v.structure?.(tok('molly', 'world'))?.plain).toBe(0);
  });

  it('describes nothing for a chip whose placeholder is gone', () => {
    expect(v.structure?.(tok('ghost', 'world'))).toBeNull();
  });

  it('cuts the trail to the level it could walk to, so a slot chip describes where that slot was chosen', () => {
    const slotChip = encodePlaceholderToken({
      id: 'molly', mode: 'world', placementId: 'p1', path: [{ kind: 'slot', name: 'Hair' }],
    });
    const described = v.structure?.(slotChip);
    expect(described?.trail.map((c) => c.label)).toEqual(['Molly']);
    expect(described?.partsLabel).toBe('Wildcard Variants');
    // And the slots it offers hang off that level, not off the segment it could not follow.
    const hair = described?.slots.find((s) => s.label === 'Hair');
    expect(decodePlaceholderToken(hair?.token ?? '')?.path).toEqual([{ kind: 'slot', name: 'Hair' }]);
  });

  it('is absent on the static prompt family, which has no structure to walk', () => {
    expect(promptVocabulary([]).structure).toBeUndefined();
    expect(promptVocabulary([]).repoint).toBeUndefined();
  });
});

/** Re-aiming a placed chip: what it names changes, what the placement itself decided does not. */
describe('placeholderVocabulary — repoint', () => {
  const v = placeholderVocabulary([P('eye', ['Red', 'Blue']), P('king', ['Aldric'])]);

  it('takes the target and the path from the pick', () => {
    const picked = v.drill?.(tok('eye', 'world'))?.[0]?.token;
    const moved = v.repoint?.(tok('king', 'unique', 'p9'), picked ?? tok('eye', 'world', 'other')) as string;
    expect(decodePlaceholderToken(moved)?.id).toBe('eye');
  });

  it('keeps the mode and placement of the chip being moved, not the pick’s', () => {
    const d = decodePlaceholderToken(v.repoint?.(tok('king', 'unique', 'p9'), tok('eye', 'world', 'other')) ?? '')!;
    expect(d.mode).toBe('unique');
    expect(d.placementId).toBe('p9');
  });

  it('leaves the chip alone when either side is not a token of this family', () => {
    expect(v.repoint?.(tok('king', 'world'), '<LOCATION>')).toBe(tok('king', 'world'));
  });
});
