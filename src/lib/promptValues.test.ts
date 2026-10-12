import { describe, expect, it } from 'vitest';
import { fromMarked, layerValues, mapValues, memoLookup, omitValues, readMarked, readValue } from './promptValues';

describe('readValue', () => {
  it('reads a map and a lookup alike', () => {
    expect(readValue({ '<NOTES>': 'Map' }, '<NOTES>')).toBe('Map');
    expect(readValue((key) => (key === '<NOTES>' ? 'Lookup' : undefined), '<NOTES>')).toBe('Lookup');
    expect(readValue({}, '<NOTES>')).toBeUndefined();
  });
});

describe('memoLookup', () => {
  it('renders each key once, a missing value included', () => {
    const reads: string[] = [];
    const values = memoLookup((key) => {
      reads.push(key);
      return key === '<NOTES>' ? 'Notes' : undefined;
    });
    expect([values('<NOTES>'), values('<NOTES>'), values('<TIME>'), values('<TIME>')]).toEqual(['Notes', 'Notes', undefined, undefined]);
    expect(reads).toEqual(['<NOTES>', '<TIME>']);
  });
});

describe('layerValues', () => {
  it('reads a later layer over an earlier one, as object spread does', () => {
    const bottom = { '<NOTES>': 'Bottom', '<TIME>': 'Noon' };
    const top = (key: string) => (key === '<NOTES>' ? 'Top' : undefined);
    const layered = layerValues(bottom, null, top, undefined);
    expect(layered('<NOTES>')).toBe({ ...bottom, '<NOTES>': 'Top' }['<NOTES>']);
    expect(layered('<TIME>')).toBe('Noon');
    expect(layered('<LOCATION>')).toBeUndefined();
  });

  it('reads a map layer as it stands at the read, so a later write shows', () => {
    const own: Record<string, string> = {};
    const layered = layerValues({ '<NOTES>': 'Before' }, own);
    own['<NOTES>'] = 'After';
    expect(layered('<NOTES>')).toBe('After');
  });
});

describe('omitValues', () => {
  it('leaves the omitted keys without a value and passes the rest through', () => {
    const values = omitValues({ '<NOTES>': 'Notes', '<TIME>': 'Noon' }, (key) => key === '<TIME>');
    expect(values('<NOTES>')).toBe('Notes');
    expect(values('<TIME>')).toBeUndefined();
  });
});

describe('mapValues', () => {
  it('maps each value once with its key, and leaves a missing key missing', () => {
    let calls = 0;
    const values = mapValues({ '<NOTES>': 'notes' }, (value, key) => {
      calls += 1;
      return `${key}=${value.toUpperCase()}`;
    });
    expect(values('<NOTES>')).toBe('<NOTES>=NOTES');
    expect(values('<NOTES>')).toBe('<NOTES>=NOTES');
    expect(values('<TIME>')).toBeUndefined();
    expect(calls).toBe(1);
  });
});

describe('marked runs through the combinators', () => {
  const reporting = fromMarked((key) => (key === '<NOTES>' ? [{ text: 'the ', origins: [] }, { text: 'ferryman', origins: ['content'] }] : undefined));

  it('reads a value as the text of its runs and keeps the runs', () => {
    expect(reporting('<NOTES>')).toBe('the ferryman');
    expect(readMarked(reporting, '<NOTES>')).toEqual([{ text: 'the ', origins: [] }, { text: 'ferryman', origins: ['content'] }]);
    expect(readMarked({ '<NOTES>': 'the ferryman' }, '<NOTES>')).toBeUndefined();
  });

  it('reports the runs of the layer whose value wins, and none under a layer with no report', () => {
    expect(readMarked(layerValues({ '<TIME>': 'Noon' }, reporting), '<NOTES>')).toEqual(readMarked(reporting, '<NOTES>'));
    expect(readMarked(layerValues(reporting, { '<NOTES>': 'Someone else.' }), '<NOTES>')).toBeUndefined();
  });

  it('keeps the runs without a second pass where the map leaves the value alone', () => {
    // A map that draws anew on each call, as a fresh placeholder roll does.
    let draws = 0;
    const values = mapValues(reporting, (value) => (value.includes('{{roll}}') ? value.replace('{{roll}}', String(draws++)) : value));
    expect(values('<NOTES>')).toBe('the ferryman');
    expect(readMarked(values, '<NOTES>')).toBe(readMarked(reporting, '<NOTES>'));
  });

  it('maps each run and omits the omitted keys', () => {
    expect(readMarked(mapValues(reporting, (value) => value.toUpperCase()), '<NOTES>'))
      .toEqual([{ text: 'THE ', origins: [] }, { text: 'FERRYMAN', origins: ['content'] }]);
    expect(readMarked(omitValues(reporting, (key) => key === '<NOTES>'), '<NOTES>')).toBeUndefined();
    expect(readMarked(memoLookup(reporting), '<NOTES>')).toEqual(readMarked(reporting, '<NOTES>'));
  });
});
