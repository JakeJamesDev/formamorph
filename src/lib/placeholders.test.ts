import { describe, it, expect, vi } from 'vitest';
import type { Placeholder, PlaceholderRolls } from '@/types';
import type { PlaceholderFinding, PlaceholderSegment } from './placeholders';
import {
  resolvePlaceholders,
  encodePlaceholderToken,
  decodePlaceholderToken,
  encodePlaceholderPath,
  decodePlaceholderPath,
  placeholderIsChoice,
  PLACEHOLDER_DEPTH_CAP,
  hasPlaceholders,
  collectPlaceholderPlacements,
  primeRolls,
  collectUsedPlaceholders,
  collectPlaceholderParts,
  placeholderPathChildren,
  placeholderPathLevel,
  remapPlaceholderIds,
  absorbPlaceholders,
  buildPlaceholderPreview,
  describePlaceholders,
  placeholderValueSummary,
  placeholderValueLine,
  placeholderWeight,
  placeholderChances,
  isWeighted,
  remintPlaceholderPlacements,
  remintPlaceholdersDeep,
  remintPlaceholderDef,
  newPlaceholder,
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

    it('absorbPlaceholders reads a carried or world def that lost its values as an empty one', () => {
      // Imported bundles are hand-editable JSON too; a valueless def absorbs as an empty placeholder.
      const valueless = { id: 'C1', name: 'eye' } as Placeholder;
      const { toAdd, idMap } = absorbPlaceholders([valueless], [{ id: 'W1', name: 'other', values: ['x'] } as Placeholder]);
      expect(toAdd).toHaveLength(1);
      expect(toAdd[0].values).toEqual([]);
      // And an empty carried def matches an empty world def rather than duplicating it.
      const { toAdd: none } = absorbPlaceholders([valueless], [{ id: 'W2', name: 'eye' } as Placeholder]);
      expect(none).toEqual([]);
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

    it('reads a def that lost its values list as an empty one', () => {
      // Hand-edited world JSON can omit `values` outright; the render-time rule pass routes every name
      // through here, so a valueless def has to resolve to nothing rather than throw.
      const valueless = { id: 'hue', name: 'Hue' } as Placeholder;
      expect(describePlaceholders(`[${tok('hue', 'world', 'p1')}]`, [valueless])).toBe('[]');
      expect(placeholderValueSummary(valueless)).toBe('');
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

  describe('placeholderValueLine (one-line form of a value)', () => {
    it('leaves a single-line value alone', () => {
      expect(placeholderValueLine('Emerald green')).toBe('Emerald green');
    });

    it('cuts a multiline value to its first line plus an ellipsis', () => {
      expect(placeholderValueLine('A lighthouse.\n\nIts beam sweeps the bay.')).toBe('A lighthouse. …');
    });

    it('marks a value whose first line is blank rather than showing a leading gap', () => {
      expect(placeholderValueLine('\nA lighthouse.')).toBe('…');
    });

    it('flattens every value a Wildcard summary shows', () => {
      // The tooltip of an in-editor chip, a read-only pill and a library card's blurb all read this —
      // a paragraph value has to arrive as one line on each of them.
      expect(placeholderValueSummary(P('scene', ['Dawn\nover the docks.', 'Dusk'])))
        .toBe('Dawn …|Dusk');
      expect(describePlaceholders(tok('scene', 'world', 'p1'), [P('scene', ['Dawn\nover the docks.', 'Dusk'])]))
        .toBe('{Dawn …|Dusk}');
    });
  });

  it('resolves a def that lost its values list to nothing on every runtime path', () => {
    // Same valueless-def case as the display test above, on the gameplay paths: Enter World primes rolls
    // and resolves through these, so each has to skip the def rather than throw.
    const valueless = { id: 'hue', name: 'Hue' } as Placeholder;
    const text = tok('hue', 'world', 'p1');
    const { rolls, setRoll } = collector();
    expect(resolvePlaceholders(text, { placeholders: [valueless], rolls, setRoll })).toBe('');
    expect(primeRolls([valueless], [text])).toEqual({ world: {}, unique: {} });
    expect(buildPlaceholderPreview(text, [valueless])).toEqual({ [text]: '' });
    expect(isWeighted(valueless)).toBe(false);
    expect(placeholderChances(valueless)).toEqual({});
  });

  it('expands a chip that appears inside a resolved value (values compose)', () => {
    const inner = tok('inner', 'world', 'p2');
    const { rolls, setRoll } = collector();
    const out = resolvePlaceholders(tok('outer', 'world', 'p1'), {
      placeholders: [P('outer', [`X ${inner} Y`]), P('inner', ['deep'])],
      rolls,
      setRoll,
    });
    expect(out).toBe('X deep Y');
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

// --- structured placeholders -------------------------------------------------------------------------

const val = (ref: string): PlaceholderSegment => ({ kind: 'val', ref });
const slot = (name: string): PlaceholderSegment => ({ kind: 'slot', name });

/** An authored chip sitting inside a value. World mode is the editor's default; the placement id is derived
 *  so the fixture world is stable text. */
const chip = (id: string, ...path: PlaceholderSegment[]) =>
  encodePlaceholderToken({
    id,
    mode: 'world',
    placementId: `v-${id}${path.length ? `-${path.map((s) => ('ref' in s ? s.ref : s.name)).join('-')}` : ''}`,
    ...(path.length ? { path } : {}),
  });

/** A chip placed in world text: its path is typed, so pins never move it. */
const placed = (id: string, mode: 'world' | 'unique', pid: string, ...path: PlaceholderSegment[]) =>
  encodePlaceholderToken({ id, mode, placementId: pid, ...(path.length ? { path } : {}) });

// The prototype's demo world, in the shipped shape: values are strings, and a value that is exactly one chip
// is a structural child. The two variants are records, so they carry `roll: false` — without the flag their
// value count would make them choices.
const DEMO: Placeholder[] = [
  {
    id: 'molly', name: 'Molly', roll: true,
    values: [chip('iswhite'), chip('isasian')],
    weights: { [chip('iswhite')]: 7, [chip('isasian')]: 3 },
  },
  { id: 'iswhite', name: 'isWhite', roll: false, values: [chip('hair', val('brown')), chip('eyes'), chip('freckles')] },
  { id: 'isasian', name: 'isAsian', roll: false, values: [chip('hair', val('black')), 'dark brown eyes'] },
  {
    id: 'hair', name: 'Hair', roll: true,
    values: [chip('brown'), chip('blonde'), chip('black'), 'fiery red'],
    weights: { 'fiery red': 0 },
  },
  { id: 'brown', name: 'Brown', roll: true, values: ['chestnut', 'auburn', 'chocolate brown'] },
  { id: 'blonde', name: 'Blonde', roll: true, values: ['golden blonde', 'platinum'] },
  { id: 'black', name: 'Black', values: ['jet black'] },
  { id: 'eyes', name: 'Eyes', roll: true, values: ['green', 'hazel', 'blue'] },
  { id: 'freckles', name: 'Freckles', values: ['light freckles'] },
  { id: 'town', name: 'Town', roll: true, values: ['Sedge Landing', 'Milbrook', 'Harrow Point'] },
  { id: 'intro', name: 'Intro', values: [`A traveler from ${chip('town')} waves you over.`] },
];

/** Resolve against the demo world with a deterministic first-value pick, collecting rolls and findings. */
function demo(text: string, over: Partial<Parameters<typeof resolvePlaceholders>[1]> = {}) {
  const { rolls, setRoll } = collector();
  const findings: PlaceholderFinding[] = [];
  const out = resolvePlaceholders(text, {
    placeholders: DEMO,
    rolls,
    setRoll,
    pick: first,
    onFinding: (f) => findings.push(f),
    ...over,
  });
  return { out, rolls, findings };
}

describe('token codec with drill paths', () => {
  it('round-trips a path token and leaves a pathless one in the shipped form', () => {
    const t = { id: 'molly', mode: 'unique' as const, placementId: 'p1', path: [val('iswhite'), slot('Hair')] };
    const encoded = encodePlaceholderToken(t);
    expect(encoded).toBe('{{ph:molly:unique:p1:viswhite>sHair}}');
    expect(decodePlaceholderToken(encoded)).toEqual(t);
    // A chip with no path encodes exactly as it always has — a never-edited world exports byte-identically.
    expect(encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1' })).toBe('{{ph:molly:world:p1}}');
    expect(encodePlaceholderToken({ id: 'molly', mode: 'world', placementId: 'p1', path: [] })).toBe('{{ph:molly:world:p1}}');
  });

  it('escapes the characters the path grammar owns, so any slot name survives', () => {
    const name = 'a>b:c{d}e%f';
    const encoded = encodePlaceholderPath([slot(name)]);
    expect(encoded).not.toContain('>');
    expect(decodePlaceholderPath(encoded)).toEqual([slot(name)]);
    const token = encodePlaceholderToken({ id: 'x', mode: 'world', placementId: 'p1', path: [slot(name)] });
    expect(decodePlaceholderToken(token)?.path).toEqual([slot(name)]);
    expect(hasPlaceholders(`hi ${token}`)).toBe(true);
  });

  it('rejects a path segment of an unknown kind', () => {
    expect(decodePlaceholderPath('qbrown')).toBeNull();
    expect(decodePlaceholderToken('{{ph:molly:world:p1:qbrown}}')).toBeNull();
  });

  it('parses a chip written before drill paths existed', () => {
    expect(decodePlaceholderToken('{{ph:molly:world:p1}}')).toEqual({ id: 'molly', mode: 'world', placementId: 'p1' });
  });

  it('keeps the path when remapping ids for an import', () => {
    const text = placed('molly', 'world', 'p1', val('iswhite'), slot('Hair'));
    expect(remapPlaceholderIds(text, { molly: 'MOLLY2' }))
      .toBe(placed('MOLLY2', 'world', 'p1', val('iswhite'), slot('Hair')));
  });
});

describe('choice vs record', () => {
  it('infers the shape from the value count when `roll` is absent — exactly today', () => {
    expect(placeholderIsChoice(P('one', ['a']))).toBe(false);
    expect(placeholderIsChoice(P('two', ['a', 'b']))).toBe(true);
    expect(placeholderIsChoice(P('none', []))).toBe(false);
  });

  it('lets `roll` override the inference in both directions', () => {
    expect(placeholderIsChoice({ id: 'r', name: 'r', values: ['a', 'b'], roll: false })).toBe(false);
    expect(placeholderIsChoice({ id: 'c', name: 'c', values: ['a'], roll: true })).toBe(false); // nothing to draw
  });

  it('states the kind on a freshly authored placeholder rather than leaving it to be inferred', () => {
    // Every creation surface builds through this one factory, so no path can quietly leave the kind unsaid.
    expect(newPlaceholder('Hair')).toMatchObject({ name: 'Hair', values: [], roll: true });
    expect(newPlaceholder('Hair', ['brown'])).toMatchObject({ values: ['brown'], roll: true });
    expect(newPlaceholder('a').id).not.toBe(newPlaceholder('a').id);
  });

  it('joins every value of a record with ", " and drops the empty ones', () => {
    const { out } = demo(placed('iswhite', 'world', 'p1'));
    expect(out).toBe('chestnut, green, light freckles');
    const { out: asian } = demo(placed('isasian', 'world', 'p1'));
    expect(asian).toBe('jet black, dark brown eyes');
  });

  it('leaves a record out of the rolls — only choices roll', () => {
    const { rolls } = demo(placed('iswhite', 'world', 'p1'));
    expect(rolls.world?.iswhite).toBeUndefined();
    // Hair is a choice but its value here is the drilled chip {Hair › Brown}: the authored pre-selection
    // names the branch, so Hair spends no roll. Brown and Eyes, reached without a drill, do.
    expect(rolls.world).toEqual({ brown: 'chestnut', eyes: 'green' });
  });
});

describe('prototype walkthroughs', () => {
  it('1 — a chip inside a string value composes, and shares the World roll of a chip beside it', () => {
    const { out, rolls } = demo(`${placed('intro', 'world', 'p1')} Welcome to ${placed('town', 'world', 'p2')}.`);
    expect(out).toBe('A traveler from Sedge Landing waves you over. Welcome to Sedge Landing.');
    expect(rolls.world?.town).toBe('Sedge Landing'); // one roll behind both mentions
  });

  it('2 — a whole character in one chip: the rolled variant joins all its details', () => {
    const { out } = demo(`A woman waves you over: ${placed('molly', 'world', 'p1')}`);
    expect(out).toBe('A woman waves you over: chestnut, green, light freckles');
    // The other variant, forced by a frozen roll rather than a rigged world.
    const { out: asian } = demo(`A woman waves you over: ${placed('molly', 'world', 'p1')}`, {
      rolls: { world: { molly: chip('isasian') } },
    });
    expect(asian).toBe('A woman waves you over: jet black, dark brown eyes');
  });

  it('3 — two slot chips route through the same rolled variant', () => {
    const text = `Her ${placed('molly', 'world', 'p1', slot('Hair'))} hair catches the light. `
      + `Her ${placed('molly', 'world', 'p2', slot('Eyes'))} eyes narrow.`;
    const { out, rolls } = demo(text);
    expect(out).toBe('Her chestnut hair catches the light. Her green eyes narrow.');
    expect(rolls.world?.molly).toBe(chip('iswhite')); // one variant roll behind both chips
  });

  it('3b — a slot the rolled variant cannot satisfy resolves to nothing and reports a miss', () => {
    // isAsian describes its eyes as prose, so `Molly > Eyes` has no child to route to when it rolls.
    const { out, findings } = demo(`Her ${placed('molly', 'world', 'p1', slot('Eyes'))} eyes narrow.`, {
      rolls: { world: { molly: chip('isasian') } },
    });
    expect(out).toBe('Her  eyes narrow.');
    expect(findings).toEqual([{ kind: 'slot-miss', placeholderId: 'isasian', asked: 'Eyes', segment: 'slot' }]);
  });

  it('4 — an authored drill pre-selects a branch while its leaves still roll', () => {
    const { out } = demo(placed('molly', 'world', 'p1', val('iswhite'), slot('Hair')));
    expect(out).toBe('chestnut');
    // Every shade Brown can draw, and nothing from another branch.
    const shades = new Set<string>();
    for (let i = 0; i < 300; i++) {
      shades.add(resolvePlaceholders(placed('molly', 'world', 'p1', val('iswhite'), slot('Hair')), {
        placeholders: DEMO,
        rolls: {},
      }));
    }
    expect([...shades].sort()).toEqual(['auburn', 'chestnut', 'chocolate brown']);
  });

  it('5 — a pin masks the roll, beats an authored drill, and is never written back', () => {
    const rolls: PlaceholderRolls = { world: { molly: chip('iswhite'), hair: chip('brown'), brown: 'chestnut' } };
    const setRoll = vi.fn();
    const text = placed('molly', 'world', 'p1');
    const pinned = resolvePlaceholders(text, {
      placeholders: DEMO,
      rolls,
      setRoll,
      pick: first,
      pins: { molly: chip('isasian'), hair: 'fiery red' },
    });
    // isAsian's hair value drills to Black; the Redhead pin overrides that authored pre-selection.
    expect(pinned).toBe('fiery red, dark brown eyes');
    expect(setRoll).not.toHaveBeenCalled();
    expect(rolls).toEqual({ world: { molly: chip('iswhite'), hair: chip('brown'), brown: 'chestnut' } });
    // Dropping both pins reveals the frozen roll untouched.
    expect(resolvePlaceholders(text, { placeholders: DEMO, rolls, pick: first }))
      .toBe('chestnut, green, light freckles');
  });

  it('5b — a benched value never rolls but is still reachable by a pin', () => {
    for (let i = 0; i < 200; i++) {
      const out = resolvePlaceholders(placed('hair', 'world', 'p1'), { placeholders: DEMO, rolls: {} });
      expect(out).not.toBe('fiery red');
    }
    expect(resolvePlaceholders(placed('hair', 'world', 'p1'), {
      placeholders: DEMO,
      rolls: {},
      pins: { hair: 'fiery red' },
    })).toBe('fiery red');
  });

  it('6 — a slot missing from the pinned variant reports a finding rather than breaking play', () => {
    const { out, findings } = demo(`You notice ${placed('molly', 'world', 'p1', slot('Freckles'))}.`, {
      pins: { molly: chip('isasian') },
    });
    expect(out).toBe('You notice .');
    expect(findings).toEqual([{ kind: 'slot-miss', placeholderId: 'isasian', asked: 'Freckles', segment: 'slot' }]);
    // The same chip is fine on the variant that has the child.
    expect(demo(`You notice ${placed('molly', 'world', 'p1', slot('Freckles'))}.`).out)
      .toBe('You notice light freckles.');
  });

  it('7 — two Unique placements roll their whole subtrees apart', () => {
    const text = `One: ${placed('molly', 'unique', 'u1')} The other: ${placed('molly', 'unique', 'u2')}`;
    const { out, rolls } = demo(text, { rolls: { unique: { u1: chip('iswhite'), u2: chip('isasian') } } });
    expect(out).toBe('One: chestnut, green, light freckles The other: jet black, dark brown eyes');
    // Each placement keys its own subtree under its chain. Both variants came in frozen, so only what they
    // reach mints here — u2 routes to Black and prose, neither of which draws.
    expect(rolls.unique).toEqual({ 'u1/brown': 'chestnut', 'u1/eyes': 'green' });
    expect(rolls.world).toBeUndefined(); // nothing under a Unique placement leaks into the shared World rolls
  });

  it('7c — two Unique placements of the SAME variant still differ leaf by leaf', () => {
    const text = `One: ${placed('molly', 'unique', 'u1', slot('Hair'))} / ${placed('molly', 'unique', 'u2', slot('Hair'))}`;
    const { out } = demo(text, {
      rolls: {
        unique: {
          u1: chip('iswhite'), u2: chip('iswhite'),
          'u1/brown': 'chestnut', 'u2/brown': 'auburn',
        },
      },
    });
    expect(out).toBe('One: chestnut / auburn');
  });

  it('7b — a World placement of the same character keeps its own shared rolls', () => {
    const text = `${placed('molly', 'unique', 'u1')} / ${placed('molly', 'world', 'w1')}`;
    const { rolls } = demo(text);
    expect(rolls.unique?.u1).toBe(chip('iswhite'));
    expect(rolls.world?.molly).toBe(chip('iswhite'));
  });
});

describe('typed paths are pin-immune', () => {
  it('follows the branch the text names even while a pin holds another', () => {
    const { out } = demo(placed('molly', 'world', 'p1', val('iswhite'), slot('Hair')), {
      pins: { molly: chip('isasian') },
    });
    expect(out).toBe('chestnut'); // the pin would have sent this down isAsian to jet black
  });

  it('still honors a pin on a placeholder the typed path lands on', () => {
    const { out } = demo(placed('molly', 'world', 'p1', val('iswhite'), slot('Hair')), {
      pins: { molly: chip('isasian'), hair: 'fiery red' },
    });
    expect(out).toBe('fiery red');
  });
});

describe('structural findings', () => {
  const finding = (text: string, placeholders: Placeholder[]) => {
    const findings: PlaceholderFinding[] = [];
    const out = resolvePlaceholders(text, { placeholders, rolls: {}, pick: first, onFinding: (f) => findings.push(f) });
    return { out, findings };
  };

  it('reports a chip whose placeholder is gone', () => {
    const { out, findings } = finding(placed('ghost', 'world', 'p1'), DEMO);
    expect(out).toBe('');
    expect(findings).toEqual([{ kind: 'dangling', asked: 'ghost' }]);
  });

  it('reports an explicit pick no value satisfies', () => {
    const { out, findings } = finding(placed('molly', 'world', 'p1', val('freckles')), DEMO);
    expect(out).toBe('');
    expect(findings).toEqual([{ kind: 'slot-miss', placeholderId: 'molly', asked: 'freckles', segment: 'val' }]);
  });

  it('resolves a reference cycle to nothing instead of hanging', () => {
    const world: Placeholder[] = [
      { id: 'a', name: 'A', values: [chip('b')] },
      { id: 'b', name: 'B', values: [chip('a')] },
    ];
    const { out, findings } = finding(placed('a', 'world', 'p1'), world);
    expect(out).toBe('');
    expect(findings).toEqual([{ kind: 'cycle', placeholderId: 'a' }]);
  });

  it('stops a chain longer than the depth cap', () => {
    const depth = PLACEHOLDER_DEPTH_CAP + 4;
    const chain: Placeholder[] = Array.from({ length: depth }, (_, i) => ({
      id: `n${i}`,
      name: `N${i}`,
      values: [i === depth - 1 ? 'end' : chip(`n${i + 1}`)],
    }));
    const { out, findings } = finding(placed('n0', 'world', 'p1'), chain);
    expect(out).toBe('');
    expect(findings.map((f) => f.kind)).toContain('depth');
  });

  it('names the placeholder when a hand-edited drill path will not parse', () => {
    // Only hand-edited world JSON gets here: the editor cannot write an unknown segment kind.
    const { out, findings } = finding('{{ph:molly:world:p1:qbrown}}', DEMO);
    expect(out).toBe(''); // never leaks the raw token
    expect(findings).toEqual([{ kind: 'malformed', placeholderId: 'molly' }]);
  });

  it('says nothing when everything resolves', () => {
    const { findings } = finding(placed('molly', 'world', 'p1'), DEMO);
    expect(findings).toEqual([]);
  });
});

describe('legacy parity', () => {
  const legacy: Placeholder[] = [
    { id: 'eye', name: 'Eye', values: ['Red', 'Blue', 'Green'] },
    { id: 'king', name: 'King', values: ['Aldric'] },
    { id: 'empty', name: 'Empty', values: [] },
  ];
  const text = `${tok('eye', 'world', 'p1')} / ${tok('eye', 'unique', 'p9')} / ${tok('king', 'world', 'p3')}`
    + ` / [${tok('empty', 'world', 'p4')}] / [${tok('gone', 'world', 'p5')}]`;

  it('resolves a flat world with legacy rolls byte-identically', () => {
    const rolls: PlaceholderRolls = { world: { eye: 'Green' }, unique: { p9: 'Blue' } };
    const setRoll = vi.fn();
    expect(resolvePlaceholders(text, { placeholders: legacy, rolls, setRoll, pick: first }))
      .toBe('Green / Blue / Aldric / [] / []');
    expect(setRoll).not.toHaveBeenCalled();
  });

  it('mints rolls under the keys a shipped save already uses', () => {
    const c = collector();
    resolvePlaceholders(text, { placeholders: legacy, rolls: c.rolls, setRoll: c.setRoll, pick: first });
    expect(c.rolls).toEqual({ world: { eye: 'Red' }, unique: { p9: 'Red' } });
  });
});

// --- slice 2: priming, Preview, describe, portability ---------------------------------------------------

describe('eager priming through value chips', () => {
  it('primes every key a nested render reads, so resolution stays a pure lookup', () => {
    const text = `A woman waves you over: ${placed('molly', 'world', 'p1')}`;
    const rolls = primeRolls(DEMO, [text], {}, first);
    // Molly's variant, and the choices the drawn variant reaches: Brown (through the authored drill) and Eyes.
    expect(rolls.world).toEqual({ molly: chip('iswhite'), brown: 'chestnut', eyes: 'green' });

    const setRoll = vi.fn();
    expect(resolvePlaceholders(text, { placeholders: DEMO, rolls, setRoll, pick: first }))
      .toBe('A woman waves you over: chestnut, green, light freckles');
    // The guard: a nested key priming missed would be drawn here — a different value on every render.
    expect(setRoll).not.toHaveBeenCalled();
  });

  it('primes a Unique placement whole subtree under its chain', () => {
    const rolls = primeRolls(DEMO, [placed('molly', 'unique', 'u1')], {}, first);
    expect(rolls.unique).toEqual({ u1: chip('iswhite'), 'u1/brown': 'chestnut', 'u1/eyes': 'green' });
    expect(rolls.world).toEqual({});
  });

  it('keeps a resumed save frozen variant and primes only what that variant reaches', () => {
    const rolls = primeRolls(DEMO, [placed('molly', 'world', 'p1')], { world: { molly: chip('isasian') } }, first);
    expect(rolls.world?.molly).toBe(chip('isasian'));
    // isAsian describes its eyes as prose and drills hair to Black, a single-value def — nothing left to roll.
    expect(rolls.world).toEqual({ molly: chip('isasian') });
  });

  it('primes a slot chip through the variant it routes to', () => {
    const rolls = primeRolls(DEMO, [placed('molly', 'world', 'p1', slot('Eyes'))], {}, first);
    expect(rolls.world).toEqual({ molly: chip('iswhite'), eyes: 'green' });
  });
});

describe('portability through value chips', () => {
  const structural = ['molly', 'iswhite', 'isasian', 'hair', 'brown', 'blonde', 'black', 'eyes', 'freckles'];

  it('bundles every def a chip reaches through its values, not just the one it names', () => {
    expect(collectUsedPlaceholders([placed('molly', 'world', 'p1')], DEMO).map((p) => p.id)).toEqual(structural);
  });

  it('leaves a def nothing reaches out of the bundle', () => {
    expect(collectUsedPlaceholders([placed('town', 'world', 'p1')], DEMO).map((p) => p.id)).toEqual(['town']);
  });

  it('terminates on a reference cycle', () => {
    const cyclic: Placeholder[] = [
      { id: 'a', name: 'A', values: [chip('b')] },
      { id: 'b', name: 'B', values: [chip('a')] },
    ];
    expect(collectUsedPlaceholders([placed('a', 'world', 'p1')], cyclic).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('remaps the ids inside a drill path as well as the chip root', () => {
    const text = placed('molly', 'world', 'p1', val('iswhite'), slot('Hair'));
    expect(remapPlaceholderIds(text, { molly: 'M2', iswhite: 'W2' }))
      .toBe(placed('M2', 'world', 'p1', val('W2'), slot('Hair')));
  });

  it('leaves a token no mapping touches byte-identical', () => {
    const text = placed('molly', 'world', 'p1', val('iswhite'), slot('a>b:c{d}e%f'));
    expect(remapPlaceholderIds(text, { other: 'x' })).toBe(text);
  });

  it('re-points a carried structured def at the ids the host gave its parts', () => {
    const carried = DEMO.filter((p) => structural.includes(p.id));
    const { toAdd } = absorbPlaceholders(carried, []);
    expect(toAdd).toHaveLength(carried.length);
    const added = Object.fromEntries(toAdd.map((p) => [p.name, p]));
    // Without the rewrite, Hair's value would still name the exporting world's Brown and dangle on import.
    expect(added.Hair.values).toContain(
      encodePlaceholderToken({ id: added.Brown.id, mode: 'world', placementId: 'v-brown' }),
    );
    // Weights are keyed by value text, so they have to move with the values they weight.
    expect(Object.keys(added.Molly.weights ?? {})).toEqual(added.Molly.values);
    expect(added.Molly.roll).toBe(true);
    expect(added.isWhite.roll).toBe(false);
  });

  it('absorbs a structured bundle once, so re-importing it does not multiply the parts', () => {
    const carried = DEMO.filter((p) => structural.includes(p.id));
    const once = absorbPlaceholders(carried, []);
    const twice = absorbPlaceholders(carried, once.toAdd);
    expect(twice.toAdd).toEqual([]);
    expect(twice.idMap).toEqual(once.idMap);
  });

  it('keeps two defs with the same values but different roll flags apart', () => {
    const host: Placeholder[] = [{ id: 'h', name: 'Parts', values: ['a', 'b'], roll: false }];
    const { toAdd, idMap } = absorbPlaceholders([{ id: 'c', name: 'Parts', values: ['a', 'b'], roll: true }], host);
    expect(toAdd).toHaveLength(1);
    expect(toAdd[0].roll).toBe(true);
    expect(idMap.c).not.toBe('h');
  });

  it('still dedups a written roll flag against the same choice inferred from the value count', () => {
    // Two values with no flag already infer a choice, so `roll: true` says nothing new — matching on the
    // written flag rather than on what it does would add a second copy of a def the world already has.
    const host: Placeholder[] = [{ id: 'h', name: 'Hair', values: ['red', 'black'] }];
    const { toAdd, idMap } = absorbPlaceholders([{ id: 'c', name: 'Hair', values: ['red', 'black'], roll: true }], host);
    expect(toAdd).toEqual([]);
    expect(idMap.c).toBe('h');
  });
});

/**
 * Which placeholders are *parts* of others, and who holds each one. A value that is exactly one chip is the
 * shape that makes a part; the same predicate the resolver addresses a drill path through. This is what the
 * editor list filters and counts by, so what counts as held is asserted here rather than in the UI.
 */
describe('collectPlaceholderParts', () => {
  const parts = () => collectPlaceholderParts(DEMO);

  it('names every placeholder that holds a part', () => {
    expect(parts().get('hair')).toEqual(['iswhite', 'isasian']);
    expect(parts().get('iswhite')).toEqual(['molly']);
    expect(parts().get('freckles')).toEqual(['iswhite']);
  });

  it('leaves a chip inside a longer value out — it composes, it is not held', () => {
    // Intro's only value is prose with a Town chip in it. Town is a root an author places, not Intro's part.
    expect(parts().has('town')).toBe(false);
  });

  it('leaves the roots nothing holds out entirely', () => {
    expect([...parts().keys()].sort()).toEqual(
      ['black', 'blonde', 'brown', 'eyes', 'freckles', 'hair', 'isasian', 'iswhite'],
    );
  });

  it('names a holder once however many of its values point at the same part', () => {
    const world: Placeholder[] = [
      { id: 'variant', name: 'Variant', values: [chip('hair', val('brown')), chip('hair', val('black'))] },
      { id: 'hair', name: 'Hair', values: ['brown', 'black'] },
    ];
    expect(collectPlaceholderParts(world).get('hair')).toEqual(['variant']);
  });

  it('does not make a placeholder its own part', () => {
    const cyclic: Placeholder[] = [{ id: 'a', name: 'A', values: [chip('a'), chip('b')] }];
    expect(collectPlaceholderParts(cyclic).has('a')).toBe(false);
    expect(collectPlaceholderParts(cyclic).get('b')).toEqual(['a']);
  });
});

/**
 * What one level of the `{` typeahead's drill offers: follow the `val` segments a drilled chip already
 * carries, then read the structural children of whatever that lands on. The drill has to agree with the
 * resolver about which value is a child, so the same lone-chip reading decides both.
 */
describe('placeholderPathChildren', () => {
  const at = (id: string, ...path: PlaceholderSegment[]) =>
    placeholderPathChildren({ id, mode: 'world', placementId: 'p1', path }, DEMO).map((p) => p.name);

  it('offers a root placeholder its own parts, in value order', () => {
    expect(at('molly')).toEqual(['isWhite', 'isAsian']);
  });

  it('follows a val segment into the part it picks', () => {
    expect(at('molly', val('iswhite'))).toEqual(['Hair', 'Eyes', 'Freckles']);
  });

  it('goes as deep as the path does', () => {
    expect(at('molly', val('iswhite'), val('hair'))).toEqual(['Brown', 'Blonde', 'Black']);
  });

  it('offers nothing under a placeholder whose values are plain text', () => {
    expect(at('eyes')).toEqual([]);
  });

  it('leaves out a chip that only composes into a longer value', () => {
    // Intro's one value is prose with a Town chip in it: Town is a root an author places, not Intro's part.
    expect(at('intro')).toEqual([]);
  });

  it('offers nothing past a slot, which names no one target until a roll picks it', () => {
    // isWhite does hold something named Hair, so a picker that read the slot as a direct child by name
    // would happily walk on into it — and be wrong wherever the same slot routes through a roll instead.
    expect(at('iswhite', slot('Hair'))).toEqual([]);
    expect(at('molly', slot('Hair'))).toEqual([]);
  });

  it('offers nothing when a val names something the placeholder does not hold', () => {
    expect(at('molly', val('town'))).toEqual([]);
  });

  it('offers nothing for a deleted placeholder', () => {
    expect(at('ghost')).toEqual([]);
  });

  it('names a part once however many values point at it', () => {
    const world: Placeholder[] = [
      { id: 'variant', name: 'Variant', values: [chip('hair', val('brown')), chip('hair', val('black'))] },
      { id: 'hair', name: 'Hair', values: ['brown', 'black'] },
    ];
    const rows = placeholderPathChildren({ id: 'variant', mode: 'world', placementId: 'p1' }, world);
    expect(rows.map((p) => p.name)).toEqual(['Hair']);
  });
});

/**
 * What a picker shows for the placeholder a path lands on: which kind of thing it is, the slot names a roll
 * can route to, and how many of its values no path can address. The slot marker is the point — a name
 * missing from one variant resolves to nothing whenever that variant rolls.
 */
describe('placeholderPathLevel', () => {
  const level = (id: string, ...path: PlaceholderSegment[]) =>
    placeholderPathLevel({ id, mode: 'world', placementId: 'p1', path }, DEMO);
  const slots = (id: string, ...path: PlaceholderSegment[]) =>
    (level(id, ...path)?.slots ?? []).map((s) => `${s.name}${s.partial ? ' ⚠' : ''}`);

  it('names the kind of thing the level is', () => {
    expect(level('molly')?.kind).toBe('Wildcard');
    expect(level('iswhite')?.kind).toBe('Object');
    expect(level('black')?.kind).toBe('Variable');
  });

  it('reads a one-value placeholder as a Variable whichever kind it declares', () => {
    const world: Placeholder[] = [{ id: 'a', name: 'A', roll: false, values: ['only'] }];
    expect(placeholderPathLevel({ id: 'a', mode: 'world', placementId: 'p1' }, world)?.kind).toBe('Variable');
  });

  it('gathers the slot names its variants hold, marking one they do not all hold', () => {
    // isWhite holds Hair, Eyes and Freckles; isAsian holds only Hair. Whichever rolls, Hair is there.
    expect(slots('molly')).toEqual(['Hair', 'Eyes ⚠', 'Freckles ⚠']);
  });

  it('marks a slot partial when a plain value could roll in place of a variant', () => {
    // Both chip values hold Hair, but the third value is prose — the slot misses when it rolls.
    const world: Placeholder[] = [
      { id: 'who', name: 'Who', values: [chip('a'), chip('b'), 'a stranger'] },
      { id: 'a', name: 'A', roll: false, values: [chip('hair')] },
      { id: 'b', name: 'B', roll: false, values: [chip('hair')] },
      { id: 'hair', name: 'Hair', values: ['brown'] },
    ];
    const got = placeholderPathLevel({ id: 'who', mode: 'world', placementId: 'p1' }, world);
    expect(got?.slots).toEqual([{ name: 'Hair', partial: true }]);
  });

  it('offers no slots where nothing rolls, so a name means the part it says', () => {
    expect(slots('iswhite')).toEqual([]); // an Object: all of its values apply
    expect(slots('black')).toEqual([]); // a Variable: one value, and no roll to route through
  });

  it('counts the values no path can address', () => {
    expect(level('isasian')?.plain).toBe(1); // "dark brown eyes" is prose
    expect(level('hair')?.plain).toBe(1); // "fiery red" beside three chips
    expect(level('molly')?.plain).toBe(0);
    expect(level('eyes')?.plain).toBe(3); // every value is prose
  });

  it('follows the path before it reads the level', () => {
    expect(level('molly', val('iswhite'))?.kind).toBe('Object');
    expect(level('molly', val('iswhite'), val('hair'))?.kind).toBe('Wildcard');
  });

  it('reports how far it walked, so a caller can cut the path to it', () => {
    expect(level('molly')?.depth).toBe(0);
    expect(level('molly', val('iswhite'))?.depth).toBe(1);
  });

  it('stops at the deepest step it can follow — the level that offered the one it stopped on', () => {
    // A slot names no one target until a roll picks it, and a val naming nothing held lands nowhere. Both
    // read as Molly, which is where either segment was chosen.
    expect(level('molly', slot('Hair'))).toMatchObject({ kind: 'Wildcard', depth: 0 });
    expect(level('molly', val('town'))).toMatchObject({ kind: 'Wildcard', depth: 0 });
    expect(level('molly', val('iswhite'), slot('Hair'))).toMatchObject({ kind: 'Object', depth: 1 });
  });

  it('reports nothing at all only when the chip names no placeholder', () => {
    expect(level('ghost')).toBeNull();
  });
});

describe('author-time Preview of structured chips', () => {
  it('rolls a structured chip the way play does', () => {
    const t = placed('molly', 'world', 'p1');
    expect(buildPlaceholderPreview(t, DEMO, first)).toEqual({ [t]: 'chestnut, green, light freckles' });
  });

  it('routes two slot chips through one variant, exactly as a turn would', () => {
    const hair = placed('molly', 'world', 'p1', slot('Hair'));
    const eyes = placed('molly', 'world', 'p2', slot('Eyes'));
    expect(buildPlaceholderPreview(`${hair} ${eyes}`, DEMO, first)).toEqual({ [hair]: 'chestnut', [eyes]: 'green' });
  });

  it('keeps Unique placements of one character apart', () => {
    const a = placed('molly', 'unique', 'u1', slot('Hair'));
    const b = placed('molly', 'unique', 'u2', slot('Hair'));
    const shades = ['auburn', 'chestnut'];
    let i = 0;
    // Variant draws take the first value; the two Brown draws differ, which a shared roll would collapse.
    const pick = (values: string[]) => (values[0].startsWith('{{ph') ? values[0] : shades[i++]);
    const out = buildPlaceholderPreview(`${a} ${b}`, DEMO, pick);
    expect(out[a]).toBe('auburn');
    expect(out[b]).toBe('chestnut');
  });

  it('is deterministic under an injected picker', () => {
    const text = `${placed('molly', 'world', 'p1')} ${placed('molly', 'unique', 'u1')} ${placed('town', 'world', 'p2')}`;
    expect(buildPlaceholderPreview(text, DEMO, first)).toEqual(buildPlaceholderPreview(text, DEMO, first));
  });
});

describe('describePlaceholders on structured defs', () => {
  it('joins a record described parts', () => {
    expect(describePlaceholders(placed('isasian', 'world', 'p1'), DEMO)).toBe('jet black, dark brown eyes');
  });

  it('shows a choice as its described options', () => {
    expect(describePlaceholders(placed('eyes', 'world', 'p1'), DEMO)).toBe('{green|hazel|blue}');
  });

  it('flattens a paragraph value in a joined record, the way it already does in a choice', () => {
    // An entity name, a library card and a read-only pill all read this, and each takes one line.
    const record: Placeholder[] = [
      { id: 'scene', name: 'Scene', roll: false, values: ['A lighthouse.\n\nIts beam sweeps the bay.', 'Dusk'] },
    ];
    expect(describePlaceholders(placed('scene', 'world', 'p1'), record)).toBe('A lighthouse. …, Dusk');
  });

  it('reads a slot path as the choice of what the variants offer', () => {
    expect(describePlaceholders(placed('molly', 'world', 'p1', slot('Eyes')), DEMO)).toBe('{green|hazel|blue}');
  });

  it('follows an explicit pick to the branch it names', () => {
    // Each branch reads as its own parts. Hair sits at the depth cap under Molly, so both stop before their
    // shade — the point here is that the two picks describe different content, not the same options list.
    expect(describePlaceholders(placed('molly', 'world', 'p1', val('isasian')), DEMO)).toBe('dark brown eyes');
    expect(describePlaceholders(placed('molly', 'world', 'p1', val('iswhite')), DEMO))
      .toBe('{green|hazel|blue}, light freckles');
  });

  it('shows a pinned variant instead of the options, and still nothing for a def the world lost', () => {
    expect(describePlaceholders(placed('molly', 'world', 'p1'), DEMO, { molly: chip('isasian') }))
      .toBe('dark brown eyes');
    expect(describePlaceholders(placed('gone', 'world', 'p1'), DEMO, { gone: 'x' })).toBe('');
  });

  it('stops at the depth cap rather than unfolding a whole character', () => {
    const chain: Placeholder[] = Array.from({ length: 6 }, (_, i) => ({
      id: `n${i}`, name: `N${i}`, values: [i === 5 ? 'end' : chip(`n${i + 1}`)],
    }));
    expect(describePlaceholders(placed('n0', 'world', 'p1'), chain)).toBe('');
  });

  it('reads a reference cycle as nothing instead of looping', () => {
    const cyclic: Placeholder[] = [
      { id: 'a', name: 'A', values: [chip('b')] },
      { id: 'b', name: 'B', values: [chip('a')] },
    ];
    expect(describePlaceholders(placed('a', 'world', 'p1'), cyclic)).toBe('');
  });

  it('says a self-referencing def once, not once per level the cap allows', () => {
    // The depth cap alone would stop the walk but still print the value at every level it reached.
    const selfRef: Placeholder[] = [{ id: 'a', name: 'A', values: ['scarred', chip('a')] }];
    expect(describePlaceholders(placed('a', 'world', 'p1'), selfRef)).toBe('scarred');
  });

  it('is deterministic, so the same structured text always reads the same', () => {
    const text = placed('molly', 'world', 'p1');
    expect(describePlaceholders(text, DEMO)).toBe(describePlaceholders(text, DEMO));
  });
});

describe('remintPlaceholderPlacements', () => {
  it('replaces the placement id and keeps placeholder id, mode, and path', () => {
    const path: PlaceholderSegment[] = [{ kind: 'slot', name: 'Eyes' }];
    const src = encodePlaceholderToken({ id: 'eye', mode: 'unique', placementId: 'p1', path });
    const out = decodePlaceholderToken(remintPlaceholderPlacements(src))!;
    expect(out.id).toBe('eye');
    expect(out.mode).toBe('unique');
    expect(out.path).toEqual(path);
    expect(out.placementId).not.toBe('p1');
  });

  it('keeps placements shared within one mint map, apart across maps', () => {
    const text = `${tok('eye', 'unique', 'p1')} and ${tok('hair', 'unique', 'p1')} but ${tok('eye', 'unique', 'p2')}`;
    const minted = new Map<string, string>();
    const [a, b, c] = [...remintPlaceholderPlacements(text, minted).matchAll(/\{\{ph:[^:]+:unique:([^:}]+)\}\}/g)]
      .map((m) => m[1]);
    expect(a).toBe(b); // p1 stays one placement within the copy
    expect(a).not.toBe('p1'); // but cut loose from the source
    expect(c).not.toBe(a); // p2 stays its own placement
    const again = decodePlaceholderToken(remintPlaceholderPlacements(tok('eye', 'unique', 'p1')))!;
    expect(again.placementId).not.toBe(a); // a fresh map mints fresh ids
  });

  it('leaves plain text and prompt tokens alone', () => {
    expect(remintPlaceholderPlacements('no chips <STATS> here')).toBe('no chips <STATS> here');
  });
});

describe('remintPlaceholdersDeep', () => {
  it('re-mints strings across nested arrays and objects with one shared map', () => {
    const record = {
      name: tok('name', 'unique', 'p1'),
      aliases: [tok('name', 'unique', 'p1'), 'plain'],
      nested: { aiDescription: `sees ${tok('eye', 'unique', 'p9')}` },
      count: 3,
    };
    const out = remintPlaceholdersDeep(record);
    const pid = (t: string) => decodePlaceholderToken(t)!.placementId;
    expect(pid(out.name)).toBe(pid(out.aliases[0])); // shared placement stays shared in the copy
    expect(pid(out.name)).not.toBe('p1');
    expect(out.aliases[1]).toBe('plain');
    expect(out.nested.aiDescription).not.toContain(':p9}}');
    expect(out.count).toBe(3);
    expect(record.name).toContain(':p1}}'); // pure: the source is untouched
  });
});

describe('remintPlaceholderDef', () => {
  it('re-mints value chips and re-keys weights in step', () => {
    const value = tok('name', 'unique', 'p1');
    const ph: Placeholder = { id: 'char', name: 'Char', values: [value, 'plain'], weights: { [value]: 3, plain: 1 } };
    const out = remintPlaceholderDef(ph);
    expect(out.values[0]).not.toBe(value);
    expect(out.weights).toEqual({ [out.values[0]]: 3, plain: 1 });
    expect(placeholderWeight(out, out.values[0])).toBe(3);
  });

  it('leaves a weightless def without weights', () => {
    expect(remintPlaceholderDef(P('eye', ['Green', 'Gray'])).weights).toBeUndefined();
  });
});
