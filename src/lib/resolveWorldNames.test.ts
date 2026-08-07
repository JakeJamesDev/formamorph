import { describe, it, expect } from 'vitest';
import type { DictionaryEntry, Entity, GameLocation, PlayerStat, Stat, Trait, TraitGroup } from '@/types';
import { encodePlaceholderToken, resolvePlaceholders } from './placeholders';
import {
  resolveEntityNames, resolveLocationNames, resolveStatNames, resolveTraitNames, resolveTraitGroupNames,
  resolveDictionaryEntryNames,
} from './resolveWorldNames';

// Real defs + tokens rather than a stub replacer, so these also pin the codec the editor writes.
const KEEPER = { id: 'ph-keeper', name: 'Keeper', values: ['Vera'] };
const TOWN = { id: 'ph-town', name: 'Town', values: ['Sedge', 'Marrow'] };
const PLACEHOLDERS = [KEEPER, TOWN];

const tok = (id: string, placementId = 'p1', mode: 'world' | 'unique' = 'world') =>
  encodePlaceholderToken({ id, mode, placementId });

/** The gameplay resolver, with Town's world roll frozen the way a save would freeze it. */
const resolve = (text: string) =>
  resolvePlaceholders(text, { placeholders: PLACEHOLDERS, rolls: { world: { [TOWN.id]: 'Sedge' } } });

const entity = (over: Partial<Entity>): Entity =>
  ({ id: 'e1', name: 'x', playerDescription: '', aiDescription: '', ...over }) as Entity;

describe('resolveWorldNames', () => {
  it('resolves an entity name and every alias', () => {
    const [e] = resolveEntityNames(
      [entity({ name: `Keeper ${tok(KEEPER.id)}`, aliases: ['barkeep', `the ${tok(TOWN.id, 'p2')} keeper`] })],
      resolve,
    );
    expect(e.name).toBe('Keeper Vera');
    expect(e.aliases).toEqual(['barkeep', 'the Sedge keeper']);
  });

  it('resolves a location name and its connections, so a tokenized destination stays reachable', () => {
    const here = { id: 'l1', name: 'Road', connections: [`${tok(TOWN.id, 'p3')} Square`] } as GameLocation;
    const there = { id: 'l2', name: `${tok(TOWN.id, 'p4')} Square` } as GameLocation;
    const [a, b] = resolveLocationNames([here, there], resolve);
    expect(b.name).toBe('Sedge Square');
    // The whole point: the connection still names a location that exists after resolution.
    expect(a.connections).toEqual([b.name]);
  });

  it('resolves stat names for both the authored and the save-side shape', () => {
    const authored = [{ id: 's1', name: `${tok(KEEPER.id, 'p5')}'s Favor` }] as Stat[];
    const saved = [{ id: 's1', name: `${tok(KEEPER.id, 'p6')}'s Favor`, value: 3, min: 0, max: 10 }] as PlayerStat[];
    expect(resolveStatNames(authored, resolve)[0].name).toBe("Vera's Favor");
    const [live] = resolveStatNames(saved, resolve);
    expect(live.name).toBe("Vera's Favor");
    // Everything but the name survives — these objects are written straight back into the save.
    expect(live.value).toBe(3);
  });

  it('resolves trait and trait-group names', () => {
    const traits = [{ id: 't1', name: `Friend of ${tok(KEEPER.id, 'p7')}` }] as Trait[];
    const groups = [{ id: 'g1', name: `${tok(TOWN.id, 'p8')} Origins` }] as TraitGroup[];
    expect(resolveTraitNames(traits, () => resolve)[0].name).toBe('Friend of Vera');
    expect(resolveTraitGroupNames(groups, resolve)[0].name).toBe('Sedge Origins');
  });

  it("resolves each trait's name with that trait's own resolver", () => {
    // The self-pin display rule: a Town-pinning trait's name reads its own pin even while the active
    // selection pins Town elsewhere. The per-trait resolver is what carries it.
    const traits = [
      { id: 't-sedge', name: `Native of ${tok(TOWN.id, 'p20')}` },
      { id: 't-marrow', name: `Sworn to ${tok(TOWN.id, 'p21')}` },
    ] as Trait[];
    const pinTo = (value: string) => (text: string) =>
      resolvePlaceholders(text, { placeholders: PLACEHOLDERS, rolls: {}, pins: { [TOWN.id]: value } });
    const out = resolveTraitNames(traits, (t) => pinTo(t.id === 't-sedge' ? 'Sedge' : 'Marrow'));
    expect(out.map((t) => t.name)).toEqual(['Native of Sedge', 'Sworn to Marrow']);
  });

  it('resolves a dictionary entry name and both keyword arrays', () => {
    const entries = [{
      id: 'd1',
      name: `${tok(TOWN.id, 'p9')} Guard`,
      key: [`${tok(TOWN.id, 'p10')} Guard`, 'watchmen'],
      secondaryKeys: [`${tok(KEEPER.id, 'p11')}`],
      value: 'lore',
    }] as DictionaryEntry[];
    const [en] = resolveDictionaryEntryNames(entries, resolve);
    expect(en.name).toBe('Sedge Guard');
    expect(en.key).toEqual(['Sedge Guard', 'watchmen']);
    expect(en.secondaryKeys).toEqual(['Vera']);
  });

  it('resolves a missing placeholder to nothing, matching every other field', () => {
    const [e] = resolveEntityNames([entity({ name: tok('ph-deleted', 'p13') })], resolve);
    expect(e.name).toBe('');
  });

  // The identity contract is what makes it safe to run this over the whole world on every render: a world
  // with no placeholders must come back byte-for-byte the same objects, or every downstream memo re-fires.
  describe('reference identity', () => {
    it('returns the same array and item references when nothing holds a chip', () => {
      const entities = [entity({ name: 'Vera', aliases: ['barkeep'] }), entity({ id: 'e2', name: 'Otto' })];
      const out = resolveEntityNames(entities, resolve);
      expect(out).toBe(entities);
      expect(out[0]).toBe(entities[0]);
    });

    it('replaces only the items that changed', () => {
      const plain = entity({ id: 'e2', name: 'Otto' });
      const chipped = entity({ name: tok(KEEPER.id, 'p14') });
      const out = resolveEntityNames([plain, chipped], resolve);
      expect(out).not.toBe(undefined);
      expect(out[0]).toBe(plain);
      expect(out[1]).not.toBe(chipped);
      expect(out[1].name).toBe('Vera');
    });

    it('keeps identity for locations, stats, traits and dictionaries with no chips', () => {
      const locations = [{ id: 'l1', name: 'Road', connections: ['Square'] }] as GameLocation[];
      const stats = [{ id: 's1', name: 'Health' }] as Stat[];
      const traits = [{ id: 't1', name: 'Brave' }] as Trait[];
      const entries = [{ id: 'd1', name: 'Guard', key: ['guard'], value: '' }] as DictionaryEntry[];
      expect(resolveLocationNames(locations, resolve)).toBe(locations);
      expect(resolveStatNames(stats, resolve)).toBe(stats);
      expect(resolveTraitNames(traits, () => resolve)).toBe(traits);
      expect(resolveDictionaryEntryNames(entries, resolve)).toBe(entries);
    });
  });
});
