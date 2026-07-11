import { describe, it, expect } from 'vitest';
import { parseChoices, matchChoiceToAction } from './choices';

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

describe('matchChoiceToAction', () => {
  const choices = [
    'You can follow the corridor east',
    'You can knock on the wall',
    'You can search for a hidden switch',
  ];

  it('matches an exact choice', () => {
    expect(matchChoiceToAction('You can knock on the wall', choices)).toBe(1);
  });

  it('matches a lightly reworded action (added/dropped/reordered words)', () => {
    expect(matchChoiceToAction('I knock firmly on the wall', choices)).toBe(1);
    expect(matchChoiceToAction('Search around for a hidden switch, carefully', choices)).toBe(2);
  });

  it('ignores markdown bold and punctuation on the choice', () => {
    expect(matchChoiceToAction('follow the corridor east', ['**Follow** the corridor, east!'])).toBe(0);
  });

  it('returns -1 for a custom action that resembles no choice', () => {
    expect(matchChoiceToAction('I sit down and start singing a song', choices)).toBe(-1);
  });

  it('returns -1 for empty action or empty choices', () => {
    expect(matchChoiceToAction('', choices)).toBe(-1);
    expect(matchChoiceToAction('knock on the wall', [])).toBe(-1);
  });

  it('respects the threshold', () => {
    // A single shared content word is a weak match — below the default 0.5, above a lenient 0.2.
    expect(matchChoiceToAction('I wander east for a while', choices)).toBe(-1);
    expect(matchChoiceToAction('I wander east for a while', choices, 0.2)).toBe(0);
  });
});
