import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GENERIC_ITEM_ICON, ITEM_ICONS, ITEM_ICON_AUTHORS, ITEM_ICON_NONE, deriveItemIcon, itemIconById, itemIconName, resolveItemIcon, searchItemIcons } from './itemIcons';

const IMAGE = 'data:image/png;base64,AAAA';
const icon = (id: string) => ({ kind: 'icon', id });

describe('resolveItemIcon', () => {
  it.each([
    ['Auto with no image', { name: 'Iron Helmet' }, icon('helmet')],
    ['Auto beats the image', { name: 'Iron Helmet', image: IMAGE }, icon('helmet')],
    ['specific with no image', { icon: 'ring', name: 'Iron Helmet' }, icon('ring')],
    ['specific beats the image', { icon: 'ring', name: 'Iron Helmet', image: IMAGE }, icon('ring')],
    ['None shows the image', { icon: ITEM_ICON_NONE, name: 'Iron Helmet', image: IMAGE }, { kind: 'image', src: IMAGE }],
    ['None with no image shows nothing', { icon: ITEM_ICON_NONE, name: 'Iron Helmet' }, { kind: 'nothing' }],
    ['an unknown id reads as Auto', { icon: 'retired-art', name: 'Iron Helmet', image: IMAGE }, icon('helmet')],
  ])('%s', (_label, input, shown) => {
    expect(resolveItemIcon({ slotNames: [], ...input })).toEqual(shown);
  });

  // The name is the unidentified face, so a helmet name here would prove the derivation read the wrong field.
  it.each([
    ['Auto', undefined],
    ['specific', 'crown'],
    ['None', ITEM_ICON_NONE],
    ['an unknown id', 'retired-art'],
  ])('an unidentified copy with %s derives from its unidentified name and shows no image', (_label, authored) => {
    expect(resolveItemIcon({ icon: authored, name: 'Cloudy Vial', slotNames: ['Head'], unidentified: true, image: IMAGE })).toEqual(icon('vial'));
  });

  it.each([
    ['Auto', undefined],
    ['specific', 'crown'],
    ['None', ITEM_ICON_NONE],
  ])('an unidentified copy with %s falls to its slot, then the generic icon', (_label, authored) => {
    expect(resolveItemIcon({ icon: authored, name: 'Odd Thing', slotNames: ['Head'], unidentified: true, image: IMAGE })).toEqual(icon('helmet'));
    expect(resolveItemIcon({ icon: authored, name: 'Odd Thing', slotNames: [], unidentified: true, image: IMAGE })).toEqual(icon(GENERIC_ITEM_ICON));
  });

  it('never treats None as a catalog id', () => {
    expect(itemIconById(ITEM_ICON_NONE)).toBeUndefined();
  });
});

describe('deriveItemIcon', () => {
  it.each([
    // Head noun.
    ['Greatsword of the Ashen Vigil', 'sword'],
    ['Potion of Swords', 'potion'],
    ['Sword Belt', 'belt'],
    ['Swordfish', 'fish'],
    ['Amulet of the Tide', 'necklace'],
    ['Travel-Worn Breeches', 'pants'],
    ['IRON HELMET', 'helmet'],
    ['POTION OF SWORDS', 'potion'],
    ['Thief\'s Lockpicks', 'lockpick'],
    // Plural with no word of its own.
    ['Old Shields', 'shield'],
    // A head with no word reads the tail.
    ['Trinket of Swords', 'sword'],
    // Containers read the contents, then themselves.
    ['Vial of Antidote', 'potion'],
    ['Vial of Poison', 'poison'],
    ['Bottle of Wine', 'wine'],
    ['Pair of Old Boots', 'boots'],
    ['Bundle of Arrows', 'arrows'],
    ['Vial of Water', 'vial'],
    ['Cloudy Vial', 'vial'],
  ])('%s reads as %s', (name, id) => {
    expect(deriveItemIcon(name, [])).toBe(id);
  });

  it('the name beats the slot', () => {
    expect(deriveItemIcon('Silver Ring', ['Head'])).toBe('ring');
  });

  it.each([
    ['Head', 'helmet'],
    ['Neck', 'necklace'],
    ['Left Ring', 'ring'],
    ['Feet', 'boots'],
    ['Foot', 'boots'],
    ['Legs', 'pants'],
    ['Leg', 'pants'],
    ['Rings', 'ring'],
    // A slot named with a catalog word.
    ['Shield Arm', 'shield'],
  ])('a name with no word falls back to the %s slot', (slot, id) => {
    expect(deriveItemIcon('Stormcaller', [slot])).toBe(id);
  });

  it('reads the slots in order, past one with no word', () => {
    expect(deriveItemIcon('Stormcaller', ['Main Hand', 'Neck', 'Head'])).toBe('necklace');
  });

  it('falls back to the generic icon', () => {
    expect(deriveItemIcon('Stormcaller', ['Main Hand'])).toBe(GENERIC_ITEM_ICON);
  });

  it('a non-English name falls through to the slot, then the generic icon', () => {
    expect(deriveItemIcon('Trank der Heilung', ['Ring'])).toBe('ring');
    expect(deriveItemIcon('Schwert des Sturms', [])).toBe(GENERIC_ITEM_ICON);
    expect(deriveItemIcon('魔法の剣', [])).toBe(GENERIC_ITEM_ICON);
  });

  it('an item with no name reads its slot, then the generic icon', () => {
    expect(deriveItemIcon('', ['Feet'])).toBe('boots');
    expect(deriveItemIcon('   ', [])).toBe(GENERIC_ITEM_ICON);
  });

  it('a name or slot that spells an object key reads as no match', () => {
    expect(deriveItemIcon('constructor', ['__proto__'])).toBe(GENERIC_ITEM_ICON);
  });
});

describe('the catalog', () => {
  it('maps every word to one icon', () => {
    const words = ITEM_ICONS.flatMap((entry) => entry.words);
    expect(words.filter((word, i) => words.indexOf(word) !== i)).toEqual([]);
  });

  it('gives every icon a unique id, an SVG body, an author and at least one word', () => {
    expect(new Set(ITEM_ICONS.map((entry) => entry.id)).size).toBe(ITEM_ICONS.length);
    for (const entry of ITEM_ICONS) {
      expect(entry.body, entry.id).toMatch(/^<path /);
      expect(entry.author, entry.id).toBeTruthy();
      expect(entry.words.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('lists each author once, alphabetically', () => {
    expect(ITEM_ICON_AUTHORS).toEqual([...new Set(ITEM_ICONS.map((entry) => entry.author))].sort((a, b) => a.localeCompare(b, 'en')));
    expect(ITEM_ICON_AUTHORS).toContain('Lorc');
  });

  it('every word derives its own icon', () => {
    for (const entry of ITEM_ICONS) {
      for (const word of entry.words) expect(deriveItemIcon(word, []), word).toBe(entry.id);
    }
  });

  it('holds the generic icon', () => {
    expect(itemIconById(GENERIC_ITEM_ICON)).toBeDefined();
  });
});

describe('searchItemIcons', () => {
  const ids = (search: string) => searchItemIcons(search).map((i) => i.id);

  it('finds an icon by any catalog word, not only its name', () => {
    expect(ids('blade')).toContain('sword');
    expect(ids('BLADE')).toContain('sword');
    expect(ids('dag')).toEqual(['dagger']);
  });

  it('needs every term to match', () => {
    expect(ids('sword dagger')).toEqual([]);
    expect(ids('sword zzz')).toEqual([]);
  });

  it('lists the whole catalog in order for an empty search', () => {
    expect(ids('  ')).toEqual(ITEM_ICONS.map((i) => i.id));
  });

  it('returns nothing for a word no icon has', () => {
    expect(ids('zzzzz')).toEqual([]);
  });
});

describe('itemIconName', () => {
  it('reads the first word in Title Case, also for an id that means nothing to an author', () => {
    const name = (id: string) => itemIconName(itemIconById(id)!);
    expect(name('sword')).toBe('Sword');
    expect(name(GENERIC_ITEM_ICON)).toBe('Bag');
    expect(name('instrument')).toBe('Lute');
  });
});

describe('the Game Icons credit', () => {
  it('stays in THIRD-PARTY-NOTICES.md with the license text', () => {
    const notices = readFileSync('THIRD-PARTY-NOTICES.md', 'utf8');
    // Booleans, so a failure doesn't print the whole file.
    expect(notices.includes('**Game Icons**')).toBe(true);
    expect(notices.includes('Creative Commons Attribution 3.0')).toBe(true);
    expect(notices.includes('game-icons.net')).toBe(true);
  });

  it('names every author in the catalog, and only them', () => {
    const entry = readFileSync('THIRD-PARTY-NOTICES.md', 'utf8').split('\n').find((line) => line.startsWith('- **Game Icons**')) ?? '';
    const named = entry.match(/Icons made by ([^.]+)\./)?.[1] ?? '';
    expect(named.replace(' and ', ' ').split(/,\s*/).map((name) => name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'en'))).toEqual(ITEM_ICON_AUTHORS);
  });
});
