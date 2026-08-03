import { describe, it, expect, vi } from 'vitest';
import type { Placeholder, PlaceholderRolls } from '@/types';
import {
  resolvePlaceholders,
  encodePlaceholderToken,
  decodePlaceholderToken,
  hasPlaceholders,
  collectPlaceholderPlacements,
  primeRolls,
  collectUsedPlaceholders,
  remapPlaceholderIds,
  absorbPlaceholders,
  buildPlaceholderPreview,
  describePlaceholders,
  placeholderWeight,
  placeholderChances,
  isWeighted,
} from './placeholders';

const P = (id: string, values: string[]): Placeholder => ({ id, name: id, values });
const tok = (id: string, mode: 'world' | 'unique', pid: string) =>
  encodePlaceholderToken({ id, mode, placementId: pid });

// A setRoll that mutates a rolls object, so intra-pass and cross-call persistence can be asserted.
function collector() {
  const rolls: PlaceholderRolls = {};
  const setRoll = (scope: 'world' | 'unique', key: string, value: string) => {
    (rolls[scope] ??= {})[key] = value;
  };
  return { rolls, setRoll };
}

const first = (v: string[]) => v[0]; // deterministic pick

describe('placeholders token codec', () => {
  it('round-trips a token', () => {
    const t = { id: 'abc', mode: 'unique' as const, placementId: 'p1' };
    expect(decodePlaceholderToken(encodePlaceholderToken(t))).toEqual(t);
  });

  it('rejects non-tokens', () => {
    expect(decodePlaceholderToken('not a token')).toBeNull();
    expect(decodePlaceholderToken('{{ph:abc:sideways:p1}}')).toBeNull(); // bad mode
  });

  it('detects presence', () => {
    expect(hasPlaceholders('plain text')).toBe(false);
    expect(hasPlaceholders(`eyes: ${tok('eye', 'world', 'p1')}`)).toBe(true);
  });
});

describe('resolvePlaceholders', () => {
  it('leaves text without chips untouched (and does no work)', () => {
    const { rolls, setRoll } = collector();
    const spy = vi.fn(setRoll);
    expect(resolvePlaceholders('nothing here', { placeholders: [], rolls, setRoll: spy })).toBe('nothing here');
    expect(spy).not.toHaveBeenCalled();
  });

  it('resolves a Variable (1 value) to its value, with no roll', () => {
    const { rolls, setRoll } = collector();
    const spy = vi.fn(setRoll);
    const out = resolvePlaceholders(`Hi ${tok('name', 'world', 'p1')}.`, {
      placeholders: [P('name', ['Wren'])],
      rolls,
      setRoll: spy,
    });
    expect(out).toBe('Hi Wren.');
    expect(spy).not.toHaveBeenCalled();
  });

  it('resolves a missing placeholder or empty values to ""', () => {
    const { rolls, setRoll } = collector();
    const out = resolvePlaceholders(`[${tok('gone', 'world', 'p1')}][${tok('empty', 'world', 'p2')}]`, {
      placeholders: [P('empty', [])],
      rolls,
      setRoll,
    });
    expect(out).toBe('[][]');
  });

  it('World mode shares one rolled value across every placement of the placeholder', () => {
    const { rolls, setRoll } = collector();
    const text = `${tok('eye', 'world', 'p1')} / ${tok('eye', 'world', 'p2')}`;
    const out = resolvePlaceholders(text, { placeholders: [P('eye', ['Red', 'Blue', 'Green'])], rolls, setRoll, pick: first });
    expect(out).toBe('Red / Red'); // same value in one pass...
    expect(rolls.world?.eye).toBe('Red'); // ...persisted by placeholder id
  });

  it('Unique mode rolls per placement (independent spots)', () => {
    const { rolls, setRoll } = collector();
    // Cycle the pick so the two spots draw different values.
    const picks = ['Red', 'Blue'];
    let i = 0;
    const out = resolvePlaceholders(`${tok('eye', 'unique', 'p1')} / ${tok('eye', 'unique', 'p2')}`, {
      placeholders: [P('eye', ['Red', 'Blue', 'Green'])],
      rolls,
      setRoll,
      pick: () => picks[i++],
    });
    expect(out).toBe('Red / Blue');
    expect(rolls.unique).toEqual({ p1: 'Red', p2: 'Blue' }); // keyed by placement id
  });

  it('reuses a frozen roll instead of re-rolling (playthrough stays consistent)', () => {
    const rolls: PlaceholderRolls = { world: { eye: 'Green' }, unique: { p9: 'Blue' } };
    const setRoll = vi.fn();
    const out = resolvePlaceholders(`${tok('eye', 'world', 'p1')} ${tok('eye', 'unique', 'p9')}`, {
      placeholders: [P('eye', ['Red', 'Blue', 'Green'])],
      rolls,
      setRoll,
      pick: first,
    });
    expect(out).toBe('Green Blue');
    expect(setRoll).not.toHaveBeenCalled(); // nothing new minted
  });

  it('primes and freezes rolls once, then resolution is a pure lookup (no setRoll needed)', () => {
    const placeholders = [P('eye', ['Red', 'Blue', 'Green']), P('king', ['Aldric'])];
    const text = `${tok('eye', 'world', 'p1')} ${tok('eye', 'unique', 'p2')} ${tok('king', 'world', 'p3')}`;

    // collect is value-count-agnostic: both World ids, one Unique placement. primeRolls filters to Wildcards.
    const placements = collectPlaceholderPlacements([text]);
    expect(placements.worldIds).toEqual(new Set(['eye', 'king']));
    expect(placements.unique).toEqual([{ id: 'eye', placementId: 'p2' }]);

    const rolls = primeRolls(placeholders, [text], {}, first);
    expect(rolls.world).toEqual({ eye: 'Red' }); // World eye rolled once
    expect(rolls.unique).toEqual({ p2: 'Red' }); // Unique placement rolled
    // King (1 value) is NOT rolled — it resolves from its single value.
    expect(rolls.world?.king).toBeUndefined();

    // With primed rolls, resolution needs no setRoll and yields the frozen values (+ the Variable).
    const out = resolvePlaceholders(text, { placeholders, rolls });
    expect(out).toBe('Red Red Aldric');
  });

  it('primeRolls keeps existing rolls (a loaded save is not re-rolled)', () => {
    const placeholders = [P('eye', ['Red', 'Blue', 'Green'])];
    const text = tok('eye', 'world', 'p1');
    const rolls = primeRolls(placeholders, [text], { world: { eye: 'Green' } }, first);
    expect(rolls.world?.eye).toBe('Green'); // kept, not overwritten by first()→'Red'
  });

  describe('portability (export bundle / import absorb)', () => {
    it('collectUsedPlaceholders returns only the referenced defs', () => {
      const available = [P('eye', ['Red', 'Blue']), P('king', ['Aldric']), P('unused', ['x'])];
      const texts = [`${tok('eye', 'world', 'p1')}`, `hi ${tok('king', 'unique', 'p2')}`];
      expect(collectUsedPlaceholders(texts, available).map((p) => p.id)).toEqual(['eye', 'king']);
    });

    it('remapPlaceholderIds rewrites the id, keeping mode + placement id; leaves unknown ids alone', () => {
      const text = `${tok('eye', 'unique', 'p1')} ${tok('other', 'world', 'p2')}`;
      const out = remapPlaceholderIds(text, { eye: 'EYE2' });
      expect(out).toBe(`${tok('EYE2', 'unique', 'p1')} ${tok('other', 'world', 'p2')}`);
    });

    it('absorbPlaceholders reuses a perfect (name+values) match and maps its id', () => {
      const world = [P('W1', ['Red', 'Blue'])]; // same name+values as the carried one, different id
      const carried = [{ id: 'C1', name: 'W1', values: ['Red', 'Blue'] }];
      const { toAdd, idMap } = absorbPlaceholders(carried, world);
      expect(toAdd).toEqual([]); // nothing added — perfect match
      expect(idMap).toEqual({ C1: 'W1' }); // token remaps to the existing world id
    });

    it('absorbPlaceholders adds a fresh-id def when there is no perfect match (same name, different values)', () => {
      const world = [P('eye', ['Red', 'Blue'])];
      const carried = [{ id: 'C1', name: 'eye', values: ['Green', 'Gold'] }]; // same name, different values
      const { toAdd, idMap } = absorbPlaceholders(carried, world);
      expect(toAdd).toHaveLength(1);
      expect(toAdd[0]).toMatchObject({ name: 'eye', values: ['Green', 'Gold'] });
      expect(toAdd[0].id).not.toBe('C1'); // fresh id (collision-proof)
      expect(idMap.C1).toBe(toAdd[0].id);
    });

    it('absorbPlaceholders collapses two identical carried defs to one add', () => {
      const carried = [
        { id: 'A', name: 'eye', values: ['Red'] },
        { id: 'B', name: 'eye', values: ['Red'] },
      ];
      const { toAdd, idMap } = absorbPlaceholders(carried, []);
      expect(toAdd).toHaveLength(1); // second matches the first-added one
      expect(idMap.A).toBe(idMap.B);
    });
  });

  describe('buildPlaceholderPreview (author-time preview map)', () => {
    it('maps a Variable token to its single value', () => {
      const t = tok('king', 'world', 'p1');
      expect(buildPlaceholderPreview(t, [P('king', ['Aldric'])], first)).toEqual({ [t]: 'Aldric' });
    });

    it('shares one Wildcard value across World chips of the same placeholder', () => {
      const a = tok('eye', 'world', 'p1');
      const b = tok('eye', 'world', 'p2');
      // Cycle the pick; a shared World roll means both tokens get the SAME (first) draw.
      const picks = ['Red', 'Blue'];
      let i = 0;
      const out = buildPlaceholderPreview(`${a} ${b}`, [P('eye', ['Red', 'Blue'])], () => picks[i++]);
      expect(out[a]).toBe('Red');
      expect(out[b]).toBe('Red');
    });

    it('rolls Unique Wildcard chips independently per placement', () => {
      const a = tok('eye', 'unique', 'p1');
      const b = tok('eye', 'unique', 'p2');
      const picks = ['Red', 'Blue'];
      let i = 0;
      const out = buildPlaceholderPreview(`${a} ${b}`, [P('eye', ['Red', 'Blue'])], () => picks[i++]);
      expect(out[a]).toBe('Red');
      expect(out[b]).toBe('Blue');
    });

    it('maps a missing or empty placeholder to ""', () => {
      const missing = tok('gone', 'world', 'p1');
      const empty = tok('empty', 'world', 'p2');
      const out = buildPlaceholderPreview(`${missing} ${empty}`, [P('empty', [])], first);
      expect(out).toEqual({ [missing]: '', [empty]: '' });
    });

    it('returns an empty map when there are no chips', () => {
      expect(buildPlaceholderPreview('plain text', [P('eye', ['Red'])])).toEqual({});
    });
  });

  describe('describePlaceholders (display-only, no world/rolls)', () => {
    it('shows a Variable as its value', () => {
      expect(describePlaceholders(`A ${tok('king', 'world', 'p1')} rules`, [P('king', ['Aldric'])]))
        .toBe('A Aldric rules');
    });

    it('shows a Wildcard as its options', () => {
      expect(describePlaceholders(tok('eye', 'world', 'p1'), [P('eye', ['Red', 'Blue'])]))
        .toBe('{Red|Blue}');
    });

    it('caps a long Wildcard at three options', () => {
      expect(describePlaceholders(tok('eye', 'world', 'p1'), [P('eye', ['Red', 'Blue', 'Green', 'Gray'])]))
        .toBe('{Red|Blue|Green|…}');
    });

    it('never leaks a raw token for a missing or empty def — the bug this exists to prevent', () => {
      const out = describePlaceholders(
        `[${tok('gone', 'world', 'p1')}][${tok('empty', 'unique', 'p2')}]`,
        [P('empty', [])],
      );
      expect(out).toBe('[][]');
    });

    it('is deterministic — the same text always reads the same', () => {
      const t = tok('eye', 'world', 'p1');
      const defs = [P('eye', ['Red', 'Blue'])];
      expect(describePlaceholders(t, defs)).toBe(describePlaceholders(t, defs));
    });

    it('leaves chipless text and defaults missing defs to none', () => {
      expect(describePlaceholders('plain text')).toBe('plain text');
      expect(describePlaceholders(tok('eye', 'world', 'p1'))).toBe('');
    });
  });

  it('does not expand a chip that appears inside a resolved value (no nesting)', () => {
    const inner = tok('inner', 'world', 'p2');
    const { rolls, setRoll } = collector();
    const out = resolvePlaceholders(tok('outer', 'world', 'p1'), {
      placeholders: [P('outer', [`X ${inner} Y`]), P('inner', ['SHOULD-NOT-APPEAR'])],
      rolls,
      setRoll,
    });
    expect(out).toBe(`X ${inner} Y`); // the inner token is left literal
  });
});

describe('value weights', () => {
  const W = (values: string[], weights?: Record<string, number>): Placeholder =>
    ({ id: 'p', name: 'p', values, ...(weights ? { weights } : {}) });

  it('defaults every value to weight 1 and treats a negative as benched', () => {
    const ph = W(['a', 'b'], { b: -5 });
    expect(placeholderWeight(ph, 'a')).toBe(1);
    expect(placeholderWeight(ph, 'b')).toBe(0);
  });

  it('only reports weighted once a value carries a non-default weight', () => {
    expect(isWeighted(W(['a', 'b']))).toBe(false);
    expect(isWeighted(W(['a', 'b'], { a: 1 }))).toBe(false);
    expect(isWeighted(W(['a', 'b'], { a: 3 }))).toBe(true);
  });

  it('turns weights into percentages that sum to 100', () => {
    const chances = placeholderChances(W(['a', 'b', 'c'], { a: 2 }));
    expect(chances).toEqual({ a: 50, b: 25, c: 25 });
  });

  it('shows a benched value at 0% while the rest split the pool', () => {
    expect(placeholderChances(W(['a', 'b'], { b: 0 }))).toEqual({ a: 100, b: 0 });
  });

  it('falls back to uniform when every value is benched, matching what the roll does', () => {
    expect(placeholderChances(W(['a', 'b'], { a: 0, b: 0 }))).toEqual({ a: 50, b: 50 });
  });

  it('draws in proportion to the weights', () => {
    const ph = W(['rare', 'common'], { rare: 1, common: 9 });
    const text = tok('p', 'world', 'x');
    let common = 0;
    for (let i = 0; i < 2000; i++) {
      const { rolls, setRoll } = collector();
      if (resolvePlaceholders(text, { placeholders: [ph], rolls, setRoll }) === 'common') common++;
    }
    expect(common / 2000).toBeGreaterThan(0.8);
    expect(common / 2000).toBeLessThan(0.97);
  });

  it('never draws a benched value', () => {
    const ph = W(['never', 'always'], { never: 0 });
    const text = tok('p', 'world', 'x');
    for (let i = 0; i < 200; i++) {
      const { rolls, setRoll } = collector();
      expect(resolvePlaceholders(text, { placeholders: [ph], rolls, setRoll })).toBe('always');
    }
  });

  it('rolls uniformly when everything is benched rather than resolving to nothing', () => {
    const ph = W(['a', 'b'], { a: 0, b: 0 });
    const { rolls, setRoll } = collector();
    expect(['a', 'b']).toContain(resolvePlaceholders(tok('p', 'world', 'x'), { placeholders: [ph], rolls, setRoll }));
  });

  it('keeps differently-weighted defs apart when absorbing an import', () => {
    const host = [{ id: 'h', name: 'Hair', values: ['red', 'brown'], weights: { red: 3 } }];
    const sameWeights = absorbPlaceholders(
      [{ id: 'c', name: 'Hair', values: ['red', 'brown'], weights: { red: 3 } }],
      host,
    );
    expect(sameWeights.toAdd).toEqual([]);
    expect(sameWeights.idMap.c).toBe('h');

    const differentWeights = absorbPlaceholders(
      [{ id: 'c', name: 'Hair', values: ['red', 'brown'], weights: { red: 9 } }],
      host,
    );
    expect(differentWeights.toAdd).toHaveLength(1);
    expect(differentWeights.toAdd[0].weights).toEqual({ red: 9 });
    expect(differentWeights.idMap.c).not.toBe('h');
  });
});

describe('trait pins', () => {
  const ph = P('hair', ['red', 'brown', 'black']);

  it('masks the roll without touching it, for World and Unique chips alike', () => {
    const rolls: PlaceholderRolls = { world: { hair: 'brown' }, unique: { u1: 'black' } };
    const text = `${tok('hair', 'world', 'w1')} / ${tok('hair', 'unique', 'u1')}`;
    expect(resolvePlaceholders(text, { placeholders: [ph], rolls, pins: { hair: 'fiery red' } }))
      .toBe('fiery red / fiery red');
    // The stored rolls are untouched, so dropping the pin reveals them again.
    expect(rolls).toEqual({ world: { hair: 'brown' }, unique: { u1: 'black' } });
    expect(resolvePlaceholders(text, { placeholders: [ph], rolls })).toBe('brown / black');
  });

  it('overrides a single-value Variable too', () => {
    const fixed = P('eye', ['Blue']);
    expect(resolvePlaceholders(tok('eye', 'world', 'w1'), { placeholders: [fixed], rolls: {}, pins: { eye: 'Gold' } }))
      .toBe('Gold');
  });

  it('leaves a chip whose placeholder was deleted resolving to nothing', () => {
    expect(resolvePlaceholders(tok('gone', 'world', 'w1'), { placeholders: [ph], rolls: {}, pins: { gone: 'x' } }))
      .toBe('');
  });
});
