/**
 * @vitest-environment jsdom
 * (sessionStorage holds the record.)
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readLensState, writeLensState } from './lensStore';
import { EMPTY_LENS, type LensState } from './lens';

afterEach(() => sessionStorage.clear());

describe('the stored lens World Option picks', () => {
  it('round-trips the picks with the rest of the lens', () => {
    writeLensState('w1', { ...EMPTY_LENS, personaId: 'p', optionValues: { len: 'long', lit: true, heat: 4 } });
    expect(readLensState('w1')).toEqual({ ...EMPTY_LENS, personaId: 'p', optionValues: { len: 'long', lit: true, heat: 4 } });
  });

  it('keeps only values an Option could hold, and none when nothing is left', () => {
    // A hand-edited record, as the store's own sanitizer meets it.
    const edited = (optionValues: unknown) => ({ ...EMPTY_LENS, optionValues } as unknown as LensState);
    writeLensState('w1', edited({ a: true, b: { x: 1 }, c: [1] }));
    expect(readLensState('w1')?.optionValues).toEqual({ a: true });
    writeLensState('w1', edited({ b: null }));
    expect(readLensState('w1')).toEqual(EMPTY_LENS);
  });
});
