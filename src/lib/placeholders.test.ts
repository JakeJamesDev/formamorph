import { describe, it, expect, vi } from 'vitest';
import type { Placeholder, PlaceholderRolls } from '@/types';
import {
  resolvePlaceholders,
  encodePlaceholderToken,
  decodePlaceholderToken,
  hasPlaceholders,
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
