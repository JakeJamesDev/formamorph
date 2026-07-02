import { describe, it, expect } from 'vitest';
import { parseChoices } from './choices';

describe('parseChoices', () => {
  it('splits lines, trims, and drops empties', () => {
    expect(parseChoices('I wave.\n\n  I run.  \n')).toEqual(['I wave.', 'I run.']);
  });

  it('strips a leading dash / asterisk / bullet marker', () => {
    expect(parseChoices('- I wave.\n* I run.\n• I hide.')).toEqual(['I wave.', 'I run.', 'I hide.']);
  });

  it('strips a leading numbered marker (1. and 1))', () => {
    expect(parseChoices('1. I wave.\n2) I run.')).toEqual(['I wave.', 'I run.']);
  });

  it('caps the list at max', () => {
    expect(parseChoices('a\nb\nc\nd\ne\nf\ng', 3)).toEqual(['a', 'b', 'c']);
  });

  it('leaves colon lines and duplicates untouched (no over-filtering of custom prompts)', () => {
    expect(parseChoices('I could:\nI wave.\nI wave.')).toEqual(['I could:', 'I wave.', 'I wave.']);
  });

  it('returns an empty list for blank input', () => {
    expect(parseChoices('')).toEqual([]);
    expect(parseChoices('   \n  ')).toEqual([]);
  });
});
