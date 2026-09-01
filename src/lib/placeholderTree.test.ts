import { describe, it, expect } from 'vitest';
import { encodePlaceholderToken } from './placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';
import {
  applyPlaceholderDrop, dropTakesOwnership, holderOf, isOwnedPlaceholder, ownedDescendants,
  placeholderOwnerPath, placeholderRows, placeholderUsedBy, promotePlaceholder,
  qualifiedPlaceholderName, releasePlaceholderOwners, removeChipValueFrom, removeCollapsedPlaceholderRows,
  removePlaceholderCascade, sharedWeightSite, topLevelPlaceholders,
} from './placeholderTree';

// Through the real codec, never a hand-written token: a test that spells the wire format itself keeps
// passing after that format moves.
/** A value that is exactly one chip — the shape that nests its target under the placeholder holding it. */
const chip = (id: string, at = '1') => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}-${at}` });

const P = (id: string, name: string, values: string[] = [], ownerId?: string): Placeholder => ({
  id, name, values: phValues(values), ...(ownerId ? { ownerId } : {}),
});

/** Molly holds two variants; each variant holds Hair. Nothing is owned, so every nested row is shared —
 *  which is exactly how a world authored before ownership existed reads. */
const FLAT: Placeholder[] = [
  P('molly', 'Molly', [chip('northern'), chip('southern')]),
  P('northern', 'Northern', [chip('hair')]),
  P('southern', 'Southern', [chip('hair'), 'dark brown eyes']),
  P('hair', 'Hair', ['brown', 'black']),
  P('town', 'Town', ['Sedge Landing', 'Milbrook']),
];

/** The same world with Molly's variants and their hair taken privately. */
const OWNED: Placeholder[] = [
  P('molly', 'Molly', [chip('northern'), chip('southern')]),
  P('northern', 'Northern', [chip('hair')], 'molly'),
  P('southern', 'Southern', [chip('hair')], 'molly'),
  P('hair', 'Hair', ['brown', 'black'], 'northern'),
  P('town', 'Town', ['Sedge Landing', 'Milbrook']),
];

/** Rows as `depth:name`, so a failure reads as the shape an author would see. */
const shape = (placeholders: Placeholder[]) =>
  placeholderRows(placeholders).map((r) => `${'  '.repeat(r.depth)}${r.placeholder.name}${r.shared ? ' *' : ''}`);

const rowId = (placeholders: Placeholder[], path: string) =>
  placeholderRows(placeholders).find((r) => r.id === path)?.id ?? `MISSING ${path}`;

const named = (placeholders: Placeholder[]) => placeholders.map((p) => p.name);
const ownerOf = (placeholders: Placeholder[], id: string) => placeholders.find((p) => p.id === id)?.ownerId ?? null;

const INDENT = 24;

/**
 * The placeholder list is a tree, and the tree is read off the value lists themselves: a value that is
 * exactly one chip nests what it names. Ownership says whether that nesting is a possession or a reference,
 * which decides where the placeholder is offered and what deleting the holder takes with it.
 */
describe('placeholderTree', () => {
  describe('rows', () => {
    it('nests every chip value under its holder', () => {
      // Nothing is owned, so every original also keeps its own top-level row for anyone else to share.
      expect(shape(FLAT)).toEqual([
        'Molly',
        '  Northern *',
        '    Hair *',
        '  Southern *',
        '    Hair *',
        'Northern',
        '  Hair *',
        'Southern',
        '  Hair *',
        'Hair',
        'Town',
      ]);
    });

    it('reads an unowned nested row as shared and an owned one as its holder’s own', () => {
      expect(shape(OWNED)).toEqual([
        'Molly',
        '  Northern',
        '    Hair',
        '  Southern',
        '    Hair *',
        'Town',
      ]);
    });

    it('keeps an owned placeholder out of the top level and a shared one in it', () => {
      expect(named(topLevelPlaceholders(OWNED))).toEqual(['Molly', 'Town']);
      expect(named(topLevelPlaceholders(FLAT))).toEqual(['Molly', 'Northern', 'Southern', 'Hair', 'Town']);
      expect(isOwnedPlaceholder(OWNED, 'northern')).toBe(true);
      expect(isOwnedPlaceholder(FLAT, 'northern')).toBe(false);
    });

    it('sends an owned placeholder its owner no longer holds back to the top level', () => {
      // A hand-edited file can say "owned by Molly" while Molly holds nothing of the sort. The row has to
      // land somewhere, and the only honest place is the top.
      const orphaned = OWNED.map((p) => (p.id === 'molly' ? P('molly', 'Molly', [chip('southern')]) : p));
      expect(holderOf(orphaned, orphaned.find((p) => p.id === 'northern')!)).toBeNull();
      expect(shape(orphaned)).toContain('Northern');
      expect(named(topLevelPlaceholders(orphaned))).toContain('Northern');
    });

    it('gives one row per holder however many of its values name the same target', () => {
      const twice = [P('variant', 'Variant', [chip('hair'), chip('hair', '2')]), P('hair', 'Hair', ['brown'])];
      expect(shape(twice)).toEqual(['Variant', '  Hair *', 'Hair']);
    });

    it('draws a cycle once rather than recursing forever', () => {
      const loop = [P('a', 'A', [chip('b')]), P('b', 'B', [chip('a')])];
      expect(shape(loop)).toEqual(['A', '  B *', '    A *', 'B', '  A *', '    B *']);
    });

    it('leaves a chip inside a longer value out of the tree', () => {
      const prose = [P('intro', 'Intro', [`A traveler from ${chip('town')} waves.`]), P('town', 'Town', ['Sedge Landing'])];
      expect(shape(prose)).toEqual(['Intro', 'Town']);
    });

    it('drops the rows under a collapsed one', () => {
      const rows = placeholderRows(FLAT);
      expect(removeCollapsedPlaceholderRows(rows, ['molly/northern']).map((r) => r.id)).toEqual([
        'molly', 'molly/northern', 'molly/southern', 'molly/southern/hair',
        'northern', 'northern/hair', 'southern', 'southern/hair', 'hair', 'town',
      ]);
    });
  });

  describe('names away from the owner', () => {
    it('qualifies an owned placeholder with its whole owner chain', () => {
      expect(qualifiedPlaceholderName(OWNED, 'hair')).toBe('Molly › Northern › Hair');
      expect(named(placeholderOwnerPath(OWNED, 'hair'))).toEqual(['Molly', 'Northern']);
    });

    it('leaves a top-level placeholder bare', () => {
      expect(qualifiedPlaceholderName(OWNED, 'town')).toBe('Town');
      expect(placeholderOwnerPath(OWNED, 'town')).toEqual([]);
    });

    it('leaves a shared placeholder bare — it belongs to nobody', () => {
      expect(qualifiedPlaceholderName(FLAT, 'hair')).toBe('Hair');
    });
  });

  describe('the used-by hint', () => {
    it('counts the placeholders holding each one, and says nothing about the rest', () => {
      expect(placeholderUsedBy(FLAT, 'hair')).toEqual({ count: 2, names: ['Northern', 'Southern'] });
      expect(placeholderUsedBy(FLAT, 'northern')).toEqual({ count: 1, names: ['Molly'] });
      expect(placeholderUsedBy(FLAT, 'molly')).toBeNull();
      expect(placeholderUsedBy(FLAT, 'town')).toBeNull();
    });

    it('counts a holder once however many of its values point at the same one', () => {
      const twice = [P('variant', 'Variant', [chip('hair'), chip('hair', '2')]), P('hair', 'Hair', ['brown'])];
      expect(placeholderUsedBy(twice, 'hair')?.count).toBe(1);
    });

    it('ignores a chip that only sits inside a longer value', () => {
      const prose = [P('intro', 'Intro', [`A traveler from ${chip('town')} waves.`]), P('town', 'Town', ['Sedge Landing'])];
      expect(placeholderUsedBy(prose, 'town')).toBeNull();
    });
  });

  describe('the owned-versus-shared decision', () => {
    it('takes a placeholder nothing else reaches', () => {
      expect(dropTakesOwnership(FLAT, 'town', 'molly')).toBe(true);
    });

    it('shares one another placeholder already holds', () => {
      expect(dropTakesOwnership(FLAT, 'hair', 'molly')).toBe(false);
    });

    it('shares one a chip places in world text', () => {
      expect(dropTakesOwnership(FLAT, 'town', 'molly', { placedIds: new Set(['town']) })).toBe(false);
    });

    it('shares one named by a chip composed into a longer value', () => {
      const prose = [...FLAT, P('intro', 'Intro', [`A traveler from ${chip('town')} waves.`])];
      expect(dropTakesOwnership(prose, 'town', 'molly')).toBe(false);
    });

    it('ignores the holder taking it — it is not another holder', () => {
      // Molly already holds Northern. Dropping Northern under Molly must still be able to take it.
      expect(dropTakesOwnership(FLAT, 'northern', 'molly')).toBe(true);
    });
  });

  describe('a drop', () => {
    it('takes a free placeholder and writes the chip value that nests it', () => {
      const next = applyPlaceholderDrop(FLAT, [], 'town', 'molly/northern', INDENT, INDENT);
      expect(ownerOf(next, 'town')).toBe('molly');
      expect(shape(next)).toContain('  Town');
      // The chip value is what resolves; ownership only says whose it is.
      expect(next.find((p) => p.id === 'molly')!.values.map((v) => v.text).some((t) => t.includes('town'))).toBe(true);
    });

    it('shares a placeholder somebody else holds rather than taking it away', () => {
      // Hair sits under both variants. Dropping it under Molly must leave both of them holding it.
      const next = applyPlaceholderDrop(FLAT, [], 'molly/northern/hair', 'molly/northern', 0, INDENT);
      expect(ownerOf(next, 'hair')).toBeNull();
      expect(shape(next)).toContain('  Hair *');
      expect(placeholderUsedBy(next, 'hair')?.count).toBe(3);
    });

    it('releases an owned placeholder dropped at the top level', () => {
      const next = applyPlaceholderDrop(OWNED, [], 'molly/northern', 'town', -INDENT * 2, INDENT);
      expect(ownerOf(next, 'northern')).toBeNull();
      expect(named(topLevelPlaceholders(next))).toContain('Northern');
      // The value holding it stays, so its row stays put — as a shared one.
      expect(shape(next)).toContain('  Northern *');
    });

    it('reorders the top level without touching what is nested', () => {
      const next = applyPlaceholderDrop(FLAT, [], 'town', 'molly', 0, INDENT);
      expect(named(topLevelPlaceholders(next))).toEqual(['Town', 'Molly', 'Northern', 'Southern', 'Hair']);
      expect(shape(next).slice(0, 2)).toEqual(['Town', 'Molly']);
      expect(ownerOf(next, 'town')).toBeNull();
    });

    it('reorders inside a holder without turning a shared row private', () => {
      const next = applyPlaceholderDrop(FLAT, [], 'molly/southern', 'molly/northern', 0, INDENT);
      expect(shape(next).slice(0, 3)).toEqual(['Molly', '  Southern *', '    Hair *']);
      expect(ownerOf(next, 'southern')).toBeNull();
    });

    it('refuses to nest a placeholder inside itself', () => {
      // Hair sits under Northern, which sits under Molly. Dropping Molly under that Hair would make Molly
      // its own ancestor.
      const next = applyPlaceholderDrop(FLAT, [], 'molly', 'molly/northern/hair', INDENT, INDENT);
      expect(next).toBe(FLAT);
    });

    it('refuses when the row it lands under is the same placeholder somewhere else', () => {
      // Northern's own top-level row is dragged onto Molly's copy of it. The drop target is nowhere in the
      // dragged row's subtree, so only the path the target was reached through says this is a cycle.
      const next = applyPlaceholderDrop(FLAT, [], 'northern', 'molly/northern/hair', INDENT * 2, INDENT);
      expect(next).toBe(FLAT);
    });

    it('is a no-op when the drop target is hidden under a collapsed row', () => {
      const next = applyPlaceholderDrop(FLAT, ['molly'], 'town', 'molly/northern', INDENT, INDENT);
      expect(next).toBe(FLAT);
    });

    it('never mutates what it was given', () => {
      const before = JSON.stringify(FLAT);
      applyPlaceholderDrop(FLAT, [], 'town', 'molly/northern', INDENT, INDENT);
      expect(JSON.stringify(FLAT)).toBe(before);
    });
  });

  describe('promoting', () => {
    it('sends an owned placeholder to the top level and leaves its row behind as shared', () => {
      const next = promotePlaceholder(OWNED, 'northern');
      expect(ownerOf(next, 'northern')).toBeNull();
      expect(shape(next)).toContain('  Northern *');
      expect(named(topLevelPlaceholders(next))).toContain('Northern');
    });

    it('leaves a top-level placeholder exactly as it was', () => {
      expect(promotePlaceholder(OWNED, 'town')).toBe(OWNED);
    });
  });

  describe('the release rule', () => {
    it('clears the owner when the holder drops the value that pointed at it', () => {
      const edited = OWNED.map((p) => (p.id === 'molly' ? P('molly', 'Molly', [chip('southern')]) : p));
      const next = releasePlaceholderOwners(edited);
      expect(ownerOf(next, 'northern')).toBeNull();
      expect(ownerOf(next, 'southern')).toBe('molly');
    });

    it('leaves a world whose owners all still hold their own alone', () => {
      expect(releasePlaceholderOwners(OWNED)).toBe(OWNED);
    });

    it('runs to a fixed point', () => {
      // Releasing Northern also un-holds Hair, which the next pass has to catch.
      const edited = OWNED.map((p) => (p.id === 'northern' ? P('northern', 'Northern', [], 'molly') : p));
      let next = releasePlaceholderOwners(edited);
      next = releasePlaceholderOwners(next);
      expect(ownerOf(next, 'hair')).toBeNull();
      expect(releasePlaceholderOwners(next)).toBe(next);
    });
  });

  describe('deleting', () => {
    it('names everything a placeholder owns, however deep', () => {
      expect(named(ownedDescendants(OWNED, 'molly'))).toEqual(['Northern', 'Hair', 'Southern']);
    });

    it('names nothing for a placeholder that only shares', () => {
      expect(ownedDescendants(FLAT, 'molly')).toEqual([]);
    });

    it('takes what it owns with it', () => {
      expect(named(removePlaceholderCascade(OWNED, 'molly'))).toEqual(['Town']);
    });

    it('unhooks a reference by dropping the value that held it, leaving the original alone', () => {
      const next = removeChipValueFrom(FLAT, 'northern', 'hair');
      expect(named(next)).toEqual(['Molly', 'Northern', 'Southern', 'Hair', 'Town']);
      // Northern's row for it is gone; Southern's stays, and so does the original.
      expect(shape(next)).toEqual([
        'Molly', '  Northern *', '  Southern *', '    Hair *',
        'Northern', 'Southern', '  Hair *', 'Hair', 'Town',
      ]);
      expect(placeholderUsedBy(next, 'hair')).toEqual({ count: 1, names: ['Southern'] });
      // And Northern is left holding nothing that points at nothing.
      expect(next.find((p) => p.id === 'northern')!.values).toHaveLength(0);
    });

    it('leaves every other value of the holder where it was', () => {
      const next = removeChipValueFrom(FLAT, 'southern', 'hair');
      expect(next.find((p) => p.id === 'southern')!.values.map((v) => v.text)).toEqual(['dark brown eyes']);
    });

    it('takes the weights that row carried with it, and leaves the others', () => {
      const kept = FLAT.find((p) => p.id === 'molly')!.values[1].id; // Southern, which stays
      const world = FLAT.map((p) => (p.id === 'molly' ? {
        ...p, sharedWeights: { [p.values[0].id]: { w: 0 }, [kept]: { w: 0 } },
      } : p));
      expect(removeChipValueFrom(world, 'molly', 'northern').find((p) => p.id === 'molly')!.sharedWeights)
        .toEqual({ [kept]: { w: 0 } });
    });

    it('leaves a shared original standing and its rows dangling', () => {
      // Southern's Hair is a reference. Deleting Northern must not cascade into it.
      const next = removePlaceholderCascade(OWNED, 'southern');
      expect(named(next)).toEqual(['Molly', 'Northern', 'Hair', 'Town']);
      expect(named(removePlaceholderCascade(FLAT, 'northern'))).toEqual(['Molly', 'Southern', 'Hair', 'Town']);
    });
  });

  it('keys a row by the path that reached it, so one placeholder can sit in two boxes', () => {
    expect(rowId(FLAT, 'molly/northern/hair')).toBe('molly/northern/hair');
    expect(rowId(FLAT, 'molly/southern/hair')).toBe('molly/southern/hair');
  });
});

/**
 * Where a row's draw weights are written. A row nothing shares writes the placeholder's own map; a row under
 * a shared one writes an override on whoever holds that shared row. The rule has to be the one the resolver
 * walks, or the panel and the roll would disagree about which weight applies.
 */
describe('sharedWeightSite', () => {
  /** The value id the holder holds the target through — the first segment of every override key. */
  const via = (placeholders: Placeholder[], holderId: string, targetId: string) =>
    placeholders.find((p) => p.id === holderId)!.values.find((v) => v.text.includes(targetId))!.id;

  it('reports nothing for a top-level row, whose weights are its own', () => {
    expect(sharedWeightSite(FLAT, 'molly')).toBeNull();
  });

  it('reports nothing for an owned row, which is edited directly', () => {
    expect(sharedWeightSite(OWNED, 'molly/northern')).toBeNull();
  });

  it('names the holder and the chip value for a shared row', () => {
    expect(sharedWeightSite(FLAT, 'molly/northern')).toEqual({
      ownerId: 'molly', key: via(FLAT, 'molly', 'northern'),
    });
  });

  it('gives two holders of one original two sites, so a bench in one leaves the other alone', () => {
    expect(sharedWeightSite(FLAT, 'northern/hair')?.ownerId).toBe('northern');
    expect(sharedWeightSite(FLAT, 'southern/hair')?.ownerId).toBe('southern');
  });

  it('extends the outermost shared row key with the ids walked below it', () => {
    expect(sharedWeightSite(FLAT, 'molly/northern/hair')).toEqual({
      ownerId: 'molly', key: `${via(FLAT, 'molly', 'northern')}/hair`,
    });
  });

  it('opens the site at the first shared crossing, walking past the owned ones above it', () => {
    // Northern belongs to Molly, so nothing opens there; its Hair is shared, and that is where it opens.
    const world = [
      P('molly', 'Molly', [chip('northern')]),
      P('northern', 'Northern', [chip('hair')], 'molly'),
      P('hair', 'Hair', ['brown', 'black']),
    ];
    expect(sharedWeightSite(world, 'molly/northern/hair')).toEqual({
      ownerId: 'northern', key: via(world, 'northern', 'hair'),
    });
  });

  it('reports nothing for a row whose path names a placeholder that is gone', () => {
    expect(sharedWeightSite(FLAT, 'molly/ghost')).toBeNull();
  });
});
