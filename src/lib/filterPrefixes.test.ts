import { describe, it, expect } from 'vitest';
import { extractFilterPrefixes } from './filterPrefixes';

/**
 * Turning typed `author:`/`tag:`/`status:` tokens into filter chips.
 *
 * The trap this guards is timing: the search box calls this on every keystroke, so a parser that accepted
 * an unfinished token would swallow `tag:h` as a chip the moment the `h` landed and leave the reader
 * unable to type `horror` at all.
 */
describe('extractFilterPrefixes', () => {
  it('leaves a token alone while it is still being typed', () => {
    expect(extractFilterPrefixes('tag:horr')).toEqual({ prefixes: [], rest: 'tag:horr' });
  });

  it('takes the token once a space finishes it', () => {
    const { prefixes, rest } = extractFilterPrefixes('tag:horror ');
    expect(prefixes).toEqual([{ kind: 'tag', value: 'horror' }]);
    expect(rest.trim()).toBe('');
  });

  it('takes the trailing token when Enter commits it', () => {
    expect(extractFilterPrefixes('author:Jake', true).prefixes).toEqual([{ kind: 'author', value: 'Jake' }]);
  });

  it('keeps a quoted value whole', () => {
    const { prefixes } = extractFilterPrefixes('author:"Jake James" ');
    expect(prefixes).toEqual([{ kind: 'author', value: 'Jake James' }]);
  });

  it('does not finish a quoted value at the space inside the quotes', () => {
    // Mid-typing: the closing quote hasn't been typed, so the space is part of the name, not a terminator.
    expect(extractFilterPrefixes('author:"Jake Ja').prefixes).toEqual([]);
  });

  it('leaves the rest of the search text behind', () => {
    const { prefixes, rest } = extractFilterPrefixes('swamp tag:horror boat ');
    expect(prefixes).toEqual([{ kind: 'tag', value: 'horror' }]);
    expect(rest).toBe('swamp boat ');
  });

  it('takes several tokens at once, as a paste would deliver them', () => {
    const { prefixes, rest } = extractFilterPrefixes('tag:horror author:Jake status:liked ');
    expect(prefixes).toEqual([
      { kind: 'tag', value: 'horror' },
      { kind: 'author', value: 'Jake' },
      { kind: 'status', value: 'liked' },
    ]);
    expect(rest.trim()).toBe('');
  });

  it('normalizes a status name but rejects one that is not a facet', () => {
    expect(extractFilterPrefixes('status:LIKED ').prefixes).toEqual([{ kind: 'status', value: 'liked' }]);
    // Left as text rather than becoming a chip that would filter on nothing.
    expect(extractFilterPrefixes('status:beloved ')).toEqual({ prefixes: [], rest: 'status:beloved ' });
  });

  it('ignores a bare prefix with no value', () => {
    expect(extractFilterPrefixes('tag: ').prefixes).toEqual([]);
  });

  it('leaves an unrelated colon alone', () => {
    expect(extractFilterPrefixes('chapter 2: the swamp ').prefixes).toEqual([]);
  });
});
