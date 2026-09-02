import { describe, it, expect } from 'vitest';
import type { Placeholder } from '@/types';
import { promptVocabulary, placeholderVocabulary, chipRowMatches, chipSectionOpens } from './chipVocabulary';
import { encodePlaceholderToken, decodePlaceholderToken } from './placeholders';
import type { PlaceholderSegment } from './placeholders';
import { placementLetters } from './placementLetters';
import type { PlaceholderOwnerRef } from './placeholderHomes';

import { phValues } from '@/test/placeholderValues';
const P = (id: string, values: string[]): Placeholder => ({ id, name: `name-${id}`, values: phValues(values) });
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
    expect(v.hint?.(tok('eye', 'world'))).toBe('World · Red|Blue|Green');
    expect(v.hint?.(tok('king', 'world'))).toBe('World · Aldric');
    expect(v.hint?.(tok('ghost', 'world'))).toBeUndefined(); // nothing to say about a deleted one
    expect(placeholderVocabulary([P('blank', [])]).hint?.(tok('blank', 'world'))).toBe('World · no values');
  });

  it('shows the World/Unique axis only where resolving the chip can draw', () => {
    expect(v.axes(tok('eye', 'world'))).toHaveLength(1); // 3 values → Wildcard
    expect(v.axes(tok('king', 'world'))).toHaveLength(0); // 1 plain value → Variable, no axis
    expect(v.axes(tok('ghost', 'world'))).toHaveLength(0); // missing → none

    // A one-value Variable whose value is a template of wildcards rolls them, so it picks World or Unique.
    // An Object never draws on its own; only a wildcard somewhere under it earns the picker.
    const nested = placeholderVocabulary([
      P('adj', ['Rusty', 'Gilded']),
      P('noun', ['Anchor', 'Lantern']),
      { ...P('tavern', [`The ${tok('adj', 'world')} ${tok('noun', 'world')}`]), roll: false },
      { ...P('menu', ['Ale', 'Stew']), roll: false },
      { ...P('board', [tok('menu', 'world'), 'Bread']), roll: false },
      { ...P('sign', [`Tonight: ${tok('board', 'world')}`, `Today: ${tok('tavern', 'world')}`]), roll: false },
    ]);
    expect(nested.axes(tok('tavern', 'world'))).toHaveLength(1); // template of two wildcards
    expect(nested.axes(tok('menu', 'world'))).toHaveLength(0); // two plain values, Object
    expect(nested.axes(tok('board', 'world'))).toHaveLength(0); // nests only an Object
    expect(nested.axes(tok('sign', 'world'))).toHaveLength(1); // reaches a wildcard two levels down
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
    { id: 'molly', name: 'Molly', values: phValues([chip('white'), chip('asian')]) },
    { id: 'white', name: 'isWhite', roll: false, values: phValues([chip('hair'), chip('eyes')]) },
    { id: 'asian', name: 'isAsian', roll: false, values: phValues([chip('hair')]) },
    { id: 'hair', name: 'Hair', values: phValues(['brown', 'black']) },
    { id: 'eyes', name: 'Eyes', values: phValues(['green']) },
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

  it('hints what the part a path names will become, not what the root holds', () => {
    const step = v.drill?.(tok('molly', 'world'))?.[0].token as string;
    const deeper = v.drill?.(step)?.[0].token as string;
    // Molly's own pool is the two variants; this chip stands for isWhite's Hair, so that is what it previews.
    expect(v.hint?.(deeper)).toBe('World · {brown|black}');
  });

  it('reads a value that holds a chip as what that chip becomes, never as the token behind it', () => {
    const hint = v.hint?.(tok('molly', 'world')) ?? '';
    expect(hint).not.toContain('{{ph:');
    expect(hint).toContain('brown');
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
    { id: 'molly', name: 'Molly', values: phValues([chip('white'), chip('asian')]) },
    { id: 'white', name: 'isWhite', roll: false, values: phValues([chip('hair'), chip('eyes')]) },
    { id: 'asian', name: 'isAsian', roll: false, values: phValues([chip('hair')]) },
    { id: 'hair', name: 'Hair', values: phValues(['brown', 'black']) },
    { id: 'eyes', name: 'Eyes', values: phValues(['green']) },
  ];
  const v = placeholderVocabulary(WORLD);

  it('heads the section of what it holds with what the level is', () => {
    expect(v.structure?.(tok('molly', 'world'))?.holdsLabel).toBe('Wildcard Variants');
    expect(v.structure?.(tok('white', 'world'))?.holdsLabel).toBe('Object Values');
    expect(v.structure?.(tok('asian', 'world'))?.holdsLabel).toBe('Variable Value');
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
    expect(described?.holdsLabel).toBe('Wildcard Variants');
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

/**
 * Ownership decides which surfaces offer a placeholder and how it reads away from its owner. All three are
 * the vocabulary's job: the palette and the `{` menu root read `palette`, a picker that has to find a name
 * reads `allRows`, and every chip label reads the owner chain.
 */
describe('placeholderVocabulary — ownership', () => {
  const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });
  // Molly owns Northern; Hair is shared, so it stays public.
  const WORLD: Placeholder[] = [
    { id: 'molly', name: 'Molly', values: phValues([chip('northern')]) },
    { id: 'northern', name: 'Northern', ownerId: 'molly', values: phValues([chip('hair')]) },
    { id: 'hair', name: 'Hair', values: phValues(['brown', 'black']) },
    { id: 'town', name: 'Town', values: phValues(['Sedge Landing']) },
  ];
  const v = placeholderVocabulary(WORLD);

  it('leaves an owned placeholder out of the palette', () => {
    expect(v.palette().map((r) => r.label)).toEqual(['Molly', 'Hair', 'Town']);
  });

  it('still offers it one level down, under its owner', () => {
    expect(v.drill?.(tok('molly', 'world')).map((r) => r.label)).toEqual(['Northern']);
  });

  it('lists it for a picker that has to find it by name, flagged and qualified', () => {
    const northern = v.allRows?.().find((r) => r.label === 'Molly › Northern');
    expect(northern?.owned).toBe(true);
    expect(v.allRows?.().find((r) => r.label === 'Hair')?.owned).toBe(false);
  });

  it('qualifies an owned placeholder wherever its chip appears away from its owner', () => {
    expect(v.label(tok('northern', 'world'))).toBe('Molly › Northern');
    expect(v.label(tok('hair', 'world'))).toBe('Hair');
  });

  it('reads it bare inside its owner’s own panel, where the chain is already given', () => {
    const inMolly = placeholderVocabulary(WORLD, { ownerId: 'molly' });
    expect(inMolly.label(tok('northern', 'world'))).toBe('Northern');
  });

  it('mints a placeholder created from a value field owned by the placeholder it belongs to', () => {
    const made: Placeholder[] = [];
    const inMolly = placeholderVocabulary(WORLD, { onCreate: (p) => made.push(p), ownerId: 'molly' });
    inMolly.create?.('Southern');
    expect(made[0].ownerId).toBe('molly');
    expect(inMolly.createLabel?.('Southern')).toBe('New Placeholder "Southern" in Molly');
  });

  it('mints a top-level placeholder anywhere else, and says so', () => {
    const made: Placeholder[] = [];
    const anywhere = placeholderVocabulary(WORLD, { onCreate: (p) => made.push(p) });
    anywhere.create?.('Southern');
    expect(made[0].ownerId).toBeUndefined();
    expect(anywhere.createLabel?.('Southern')).toBe('New Placeholder "Southern"');
  });

  it('promotes by the token a picker was refused on', () => {
    const promoted: string[] = [];
    const authored = placeholderVocabulary(WORLD, { onPromote: (id) => promoted.push(id) });
    const row = authored.allRows?.().find((r) => r.owned);
    authored.promote?.(row!.token);
    expect(promoted).toEqual(['northern']);
  });

  it('offers neither hook where nothing is bound to write to', () => {
    expect(v.promote).toBeUndefined();
    expect(promptVocabulary([]).allRows).toBeUndefined();
  });
});

describe('placeholder vocabulary — what a chip reads as', () => {
  const placeholders = [P('eye', ['blue', 'green'])];
  const first = tok('eye', 'unique', 'p1');
  const second = tok('eye', 'unique', 'p2');
  const letters = placementLetters([first, second]);
  const v = placeholderVocabulary(placeholders, { letters });

  it('shows a World chip by name and a Unique chip with its letter, keeping the bare label for rename', () => {
    expect(v.display?.(tok('eye', 'world'))).toBe('name-eye');
    expect(v.display?.(second)).toBe('name-eye (B)');
    expect(v.label(second)).toBe('name-eye');
  });

  it('reads Name (Unique) where no index letters the placement', () => {
    expect(placeholderVocabulary(placeholders).display?.(first)).toBe('name-eye (Unique)');
    expect(v.display?.(tok('eye', 'unique', 'elsewhere'))).toBe('name-eye (Unique)');
  });

  it('shows the author label over the default, and keeps it beside a missing mark', () => {
    const labeled = v.setPlacementLabel!(second, 'Left');
    expect(v.display?.(labeled)).toBe('Left');
    expect(v.display?.(v.setPlacementLabel!(tok('ghost', 'unique'), 'Rival'))).toBe('(missing) Rival');
    expect(v.display?.(tok('ghost', 'unique'))).toBe('(missing)');
  });

  it('puts the mode, then the values, in the hint', () => {
    expect(v.hint?.(tok('eye', 'world'))).toBe('World · blue|green');
    expect(v.hint?.(second)).toBe('Unique · blue|green');
    expect(placeholderVocabulary([P('empty', [])]).hint?.(tok('empty', 'world'))).toBe('World · no values');
  });
});

describe('placeholder vocabulary — placement labels', () => {
  const v = placeholderVocabulary([P('eye', ['blue', 'green'])]);

  it('offers a label only on a Unique chip', () => {
    expect(v.placementLabel?.(tok('eye', 'world'))).toBeNull();
    expect(v.placementLabel?.(tok('eye', 'unique'))).toBe('');
    expect(v.placementLabel?.('<STATS>')).toBeNull();
  });

  it('writes the label into the token and clears it on empty', () => {
    const labeled = v.setPlacementLabel!(tok('eye', 'unique'), 'Left');
    expect(decodePlaceholderToken(labeled)?.label).toBe('Left');
    expect(v.placementLabel?.(labeled)).toBe('Left');
    expect(decodePlaceholderToken(v.setPlacementLabel!(labeled, ''))).toEqual({ id: 'eye', mode: 'unique', placementId: 'p1' });
  });

  it('keeps the label in the token across Unique → World → Unique', () => {
    const labeled = v.setPlacementLabel!(tok('eye', 'unique'), 'Left');
    const world = v.setAxis(labeled, 'mode', null);
    expect(v.placementLabel?.(world)).toBeNull();
    expect(decodePlaceholderToken(world)?.label).toBe('Left');
    expect(v.placementLabel?.(v.setAxis(world, 'mode', 'unique'))).toBe('Left');
  });

  it('keeps the label when the chip is re-aimed', () => {
    const two = placeholderVocabulary([P('eye', ['blue', 'green']), P('hair', ['red', 'black'])]);
    const labeled = two.setPlacementLabel!(tok('eye', 'unique', 'p7'), 'Left');
    const moved = two.repoint!(labeled, tok('hair', 'world', 'palette'));
    expect(decodePlaceholderToken(moved)).toEqual({ id: 'hair', mode: 'unique', placementId: 'p7', label: 'Left' });
  });
});

describe('placeholderVocabulary — scoped placeholders', () => {
  // Town is shared; Eyes and Iris are Molly's; Mane is Tam's. The combined list reads shared first.
  const WORLD: Placeholder[] = [
    { id: 'town', name: 'Town', values: phValues(['Sedge']) },
    { id: 'eyes', name: 'Eyes', values: phValues(['amber']) },
    { id: 'iris', name: 'Iris', values: phValues(['dark']) },
    { id: 'mane', name: 'Mane', values: phValues(['red']) },
  ];
  const owners = new Map([
    ['eyes', { kind: 'entity' as const, id: 'molly', name: 'Molly' }],
    ['iris', { kind: 'entity' as const, id: 'molly', name: 'Molly' }],
    ['mane', { kind: 'dictionary' as const, id: 'fen', name: 'Fen' }],
  ]);

  it('labels a scoped chip Owner.Name outside its owner and bare inside', () => {
    const outside = placeholderVocabulary(WORLD, { owners });
    expect(outside.label(tok('eyes', 'world'))).toBe('Molly › Eyes');
    expect(outside.display?.(tok('eyes', 'unique'))).toBe('Molly › Eyes (Unique)');
    expect(outside.label(tok('town', 'world'))).toBe('Town');
    const molly = { kind: 'entity' as const, id: 'molly', name: 'Molly' };
    const inside = placeholderVocabulary(WORLD, { owners, ownerId: 'molly', scope: molly });
    expect(inside.label(tok('eyes', 'world'))).toBe('Eyes');
    expect(inside.label(tok('mane', 'world'))).toBe('Fen › Mane');
    // A field of one of Molly's own placeholders is inside Molly too.
    expect(placeholderVocabulary(WORLD, { owners, ownerId: 'iris' }).label(tok('eyes', 'world'))).toBe('Eyes');
  });

  it('sections the palette: loose rows first, then each folder in tree order, then each owner', () => {
    const groups = [
      { id: 'body', name: 'Body', parentId: null }, { id: 'face', name: 'Face', parentId: 'body' }, { id: 'gear', name: 'Gear', parentId: null },
    ];
    const world: Placeholder[] = [
      { ...P('skin', ['pale']), groupId: 'face' },
      P('town', ['Sedge']),
      { ...P('sword', ['iron']), groupId: 'gear' },
      { ...P('hair', ['red']), groupId: 'body' },
      // A folder that is gone reads as loose.
      { ...P('lost', ['x']), groupId: 'gone' },
      P('eyes', ['gray']),
    ];
    const molly = { kind: 'entity' as const, id: 'molly', name: 'Molly' };
    const sectioned = new Map([['eyes', molly]]);
    expect(placeholderVocabulary(world, { owners: sectioned, groups }).palette().map((r) => [r.label, r.heading])).toEqual([
      ['name-town', undefined], ['name-lost', undefined],
      ['name-hair', 'Body'], ['name-skin', 'Body › Face'], ['name-sword', 'Gear'],
      ['name-eyes', 'Molly'],
    ]);
    // Inside Molly's fields her own section leads, still under her name.
    const inside = placeholderVocabulary(world, { owners: sectioned, groups, ownerId: 'molly', scope: molly }).palette();
    expect(inside.map((r) => r.label)).toEqual(['name-eyes', 'name-town', 'name-lost', 'name-hair', 'name-skin', 'name-sword']);
    expect(inside[0].heading).toBe('Molly');
    // With no folders bound, nothing is headed and the order is the list's own.
    expect(placeholderVocabulary(world).palette().every((r) => r.heading === undefined)).toBe(true);
  });

  it('says what each heading names, so a folder draws as text and an owner as its own chip', () => {
    const groups = [{ id: 'gear', name: 'Gear', parentId: null }];
    const world: Placeholder[] = [{ ...P('sword', ['iron']), groupId: 'gear' }, P('eyes', ['gray']), P('mane', ['red'])];
    // An owner named with a chip reaches the heading whole, so the surface can render the chip nested.
    const keeper = { kind: 'entity' as const, id: 'keeper', name: 'Keeper {{ph:town:world:p1}}' };
    const fen = { kind: 'dictionary' as const, id: 'fen', name: 'Fen' };
    const rows = placeholderVocabulary(world, {
      owners: new Map<string, PlaceholderOwnerRef>([['eyes', keeper], ['mane', fen]]),
      groups,
    }).palette();
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    expect(byLabel.get('name-sword')).toMatchObject({ heading: 'Gear', headingKind: 'folder' });
    expect(byLabel.get('name-sword')?.ownerId).toBeUndefined();
    expect(byLabel.get('name-eyes')).toMatchObject({
      headingKind: 'owner', ownerKind: 'entity', ownerId: 'keeper', ownerName: 'Keeper {{ph:town:world:p1}}',
    });
    expect(byLabel.get('name-mane')).toMatchObject({ headingKind: 'owner', ownerKind: 'dictionary', ownerId: 'fen', ownerName: 'Fen' });
  });

  it('parts two owners that share a name, since their rows read bare under the heading', () => {
    const world: Placeholder[] = [P('mood', ['sour']), P('tone', ['flat'])];
    const rows = placeholderVocabulary(world, {
      owners: new Map<string, PlaceholderOwnerRef>([
        ['mood', { kind: 'entity', id: 'k1', name: 'Keeper' }],
        ['tone', { kind: 'entity', id: 'k2', name: 'Keeper' }],
      ]),
    }).palette();
    expect(rows.map((r) => [r.label, r.heading, r.ownerId])).toEqual([
      ['name-mood', 'Keeper', 'k1'], ['name-tone', 'Keeper', 'k2'],
    ]);
    // Both sections open, so the second Keeper's rows are not drawn under the first one's heading.
    expect([chipSectionOpens(rows, 0), chipSectionOpens(rows, 1)]).toEqual([true, true]);
  });

  it('matches a query that spells the separator with a dot, a space, or a chevron', () => {
    const world: Placeholder[] = [{ id: 'mood', name: 'Mood', values: phValues(['sour']) }];
    const [row] = placeholderVocabulary(world, {
      owners: new Map([['mood', { kind: 'entity' as const, id: 'keeper', name: 'Keeper' }]]),
    }).palette();
    // The row reads bare under its owner, and still answers to the whole path however it is typed.
    expect(row.label).toBe('Mood');
    for (const query of ['keeper.mood', 'keeper mood', 'keeper>mood', 'keeper › mood', 'Keeper › Mood', 'mood']) {
      expect(chipRowMatches(row, query), query).toBe(true);
    }
    for (const query of ['keeper.eyes', 'keepermood', 'fen › mood']) {
      expect(chipRowMatches(row, query), query).toBe(false);
    }
    // A loose row has no owner to fold in, so the separator query finds nothing.
    const [loose] = placeholderVocabulary(world).palette();
    expect(chipRowMatches(loose, 'keeper › mood')).toBe(false);
    expect(chipRowMatches(loose, 'mood')).toBe(true);
  });

  it('lists the field owner’s scoped placeholders first, then the shared ones, then the rest as Owner.Name', () => {
    const molly = { kind: 'entity' as const, id: 'molly', name: 'Molly' };
    const fen = { kind: 'dictionary' as const, id: 'fen', name: 'Fen' };
    expect(placeholderVocabulary(WORLD, { owners }).palette().map((r) => r.label)).toEqual(['Town', 'Eyes', 'Iris', 'Mane']);
    expect(placeholderVocabulary(WORLD, { owners, ownerId: 'molly', scope: molly }).palette().map((r) => r.label)).toEqual(['Eyes', 'Iris', 'Town', 'Mane']);
    // A picker's own root list comes sectioned the same way, so the drill picker heads its rows like
    // every other surface: Fen's own first, then the loose ones, then Molly's, each bare under its heading.
    expect(placeholderVocabulary(WORLD, { owners, ownerId: 'fen', scope: fen }).allRows?.().map((r) => [r.label, r.heading]))
      .toEqual([['Mane', 'Fen'], ['Town', undefined], ['Eyes', 'Molly'], ['Iris', 'Molly']]);
  });

  it('creates a placeholder inside an owner’s fields in that owner’s list, named for it', () => {
    const made: [Placeholder, unknown][] = [];
    const molly = { kind: 'entity' as const, id: 'molly', name: 'Molly' };
    const v = placeholderVocabulary(WORLD, { owners, ownerId: 'molly', scope: molly, onCreate: (p, home) => made.push([p, home]) });
    expect(v.createLabel?.('Freckles')).toBe('New Placeholder "Freckles" in Molly');
    v.create?.('Freckles');
    expect(made[0][0]).not.toHaveProperty('ownerId');
    expect(made[0][1]).toEqual({ kind: 'entity', ownerId: 'molly' });
    // Outside any owner, and for a placeholder's own value field, the create lands where it always has.
    const shared: [Placeholder, unknown][] = [];
    placeholderVocabulary(WORLD, { owners, onCreate: (p, home) => shared.push([p, home]) }).create?.('Loose');
    expect(shared[0][1]).toBeUndefined();
  });

  it('scopes a create to an owner that owns nothing yet, since the owner index cannot name it', () => {
    const made: [Placeholder, unknown][] = [];
    const tam = { kind: 'entity' as const, id: 'tam', name: 'Tam' };
    const v = placeholderVocabulary(WORLD, { owners, ownerId: 'tam', scope: tam, onCreate: (p, home) => made.push([p, home]) });
    expect(v.createLabel?.('Scar')).toBe('New Placeholder "Scar" in Tam');
    v.create?.('Scar');
    expect(made[0][1]).toEqual({ kind: 'entity', ownerId: 'tam' });
    expect(v.palette().map((r) => r.label)).toEqual(['Town', 'Eyes', 'Iris', 'Mane']);
  });
});
