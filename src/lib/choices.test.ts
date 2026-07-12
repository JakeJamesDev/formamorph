import { describe, it, expect } from 'vitest';
import { parseChoices, matchChoicesToAction } from './choices';

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

describe('matchChoicesToAction', () => {
  const choices = [
    'You can follow the corridor east',
    'You can knock on the wall',
    'You can search for a hidden switch',
  ];

  it('matches an exact choice', () => {
    expect(matchChoicesToAction('You can knock on the wall', choices)).toEqual([1]);
  });

  it('matches a lightly reworded action (added/dropped/reordered words)', () => {
    expect(matchChoicesToAction('I knock firmly on the wall', choices)).toEqual([1]);
    expect(matchChoicesToAction('Search around for a hidden switch, carefully', choices)).toEqual([2]);
  });

  it('matches every choice a stacked (shift+click) action combined', () => {
    // Two choices joined as separate sentences both resolve, returned ascending.
    expect(matchChoicesToAction('I knock on the wall. I search for a hidden switch.', choices)).toEqual([1, 2]);
  });

  it('resolves a stacked action even when the whole-action match would dilute below threshold', () => {
    expect(matchChoicesToAction('You can follow the corridor east. You can knock on the wall.', choices))
      .toEqual([0, 1]);
  });

  it('dedupes when segments point at the same choice', () => {
    expect(matchChoicesToAction('I knock on the wall. I knock on the wall again.', choices)).toEqual([1]);
  });

  it('ignores markdown bold and punctuation on the choice', () => {
    expect(matchChoicesToAction('follow the corridor east', ['**Follow** the corridor, east!'])).toEqual([0]);
  });

  it('returns [] for a custom action that resembles no choice', () => {
    expect(matchChoicesToAction('I sit down and start singing a song', choices)).toEqual([]);
  });

  it('returns [] for empty action or empty choices', () => {
    expect(matchChoicesToAction('', choices)).toEqual([]);
    expect(matchChoicesToAction('knock on the wall', [])).toEqual([]);
  });

  it('respects the threshold', () => {
    // A single shared content word is a weak match — below the default 0.5, above a lenient 0.2.
    expect(matchChoicesToAction('I wander east for a while', choices)).toEqual([]);
    expect(matchChoicesToAction('I wander east for a while', choices, 0.2)).toEqual([0]);
  });
});
