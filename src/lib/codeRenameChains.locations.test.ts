import { describe, expect, it } from 'vitest';
import { locationMoveKeys } from './codeRenameChains';

/** The literal in `location.move("<name>")`, as the rename and Find All Uses read it. */
const names = (code: string) => locationMoveKeys(code).map((key) => [key.name, key.quote, code.slice(key.keyFrom, key.keyTo)]);

describe('locationMoveKeys', () => {
  it('finds a double- and a single-quoted name, each with its own quote', () => {
    expect(names(`location.move("Inn"); location.move('North Gate');`)).toEqual([
      ['Inn', '"', '"Inn"'], ['North Gate', "'", "'North Gate'"],
    ]);
  });

  it('reads only the first argument, and only a plain literal', () => {
    expect(names('location.move(where); location.move(`Inn`); location.move("a" + b); location.move();')).toEqual([]);
    expect(names('location.move("Inn", "Moon");')).toEqual([['Inn', '"', '"Inn"']]);
  });

  it('skips a name an escape hides, as the other map lookups do', () => {
    // A backslash before the n: the code holds an escape sequence, which only a run could evaluate.
    expect(names(`location.move("I${'\\'}nn");`)).toEqual([]);
  });

  it('reads a call through optional chaining but no other object or method', () => {
    expect(names('location?.move("Inn");')).toEqual([['Inn', '"', '"Inn"']]);
    expect(names('entities.Tor.location.move("Inn"); location.name = "Inn"; location.moved("Inn"); other.move("Inn");')).toEqual([]);
  });

  it('reads nothing where the author declares a location of their own', () => {
    expect(names('const location = { move() {} };\nlocation.move("Inn");')).toEqual([]);
  });
});
