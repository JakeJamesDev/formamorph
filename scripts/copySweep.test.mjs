import { describe, it, expect } from 'vitest';
import { checkText, sentenceShape } from './copySweep.mjs';
import { sentenceShapeViolation } from '../src/test/copyShape.ts';

const rules = (kind, text) => checkText(kind, text).map((n) => n.rule);

// The pass and fail columns of the help-line test in docs/Writing-Guide.md.
describe('help-line test', () => {
  it.each([
    'Saves every few minutes while you work',
    'Shorter intervals show changes sooner but use more data',
    "You'll be signed out",
    'Sends requests to your model server',
    "Not applied until you switch this one on. Players start on the default opening.",
  ])('passes the guide\'s own example: %s', (text) => {
    expect(rules('line', text)).toEqual([]);
  });

  it.each([
    ['The app saves every few minutes', 'app-subject'],
    ['We save your work', 'app-subject'],
    ['Saved for you. Formamorph sends it on the next turn.', 'app-subject'],
    ['When Auto-Save is on, the app saves the open document', 'on-off-preamble'],
    ['If enabled, saves every few minutes', 'on-off-preamble'],
    ['You will be signed out', 'uncontracted'],
    ['Words that are not in this dictionary get underlined', 'uncontracted'],
    ['You\'ll be signed out.', 'period-shape'],
    ['Saves your work. Runs every few minutes', 'period-shape'],
    ['Saved!', 'exclamation'],
    ['A trigger keyword is a word that activates this entry', 'definition-cadence'],
    ['Points requests at your model server', 'figurative'],
    ['Rides the narration history', 'figurative'],
    ['Simply pick a model', 'filler'],
  ])('flags "%s" as %s', (text, rule) => {
    expect(rules('line', text)).toContain(rule);
  });

  it('lets a help line use contractions and possessives', () => {
    expect(rules('line', "Doesn't change the world's own openings")).toEqual([]);
  });
});

describe('kinds', () => {
  it('keeps the help-line rules off docs prose and changelog leads', () => {
    const prose = 'Formamorph does not send this to the model.';
    expect(rules('prose', prose)).toEqual([]);
    expect(rules('line', prose)).toEqual(expect.arrayContaining(['app-subject', 'uncontracted', 'period-shape']));
  });

  it('holds a popover body to the help-line rules but not the period rule', () => {
    // A ⓘ body runs to several paragraphs, and the copy tests leave its periods alone.
    expect(rules('popover', 'Sets the cutoff for rare words.')).toEqual([]);
    expect(rules('popover', 'The app sets the cutoff.')).toEqual(['app-subject']);
  });

  it('reads an abbreviation as part of its sentence', () => {
    expect(rules('line', 'e.g. Eye Color')).toEqual([]);
  });

  it('reads prose with the shared rules', () => {
    expect(rules('prose', 'The entry fires on a match.')).toContain('figurative');
    expect(rules('prose', 'Pick a character for the scene.')).toContain('term-character');
  });

  it('reads a label for case and asides only', () => {
    expect(rules('label', 'Draw weight')).toEqual(['label-case']);
    expect(rules('label', 'Readme (Gameplay)')).toEqual(['label-parenthetical']);
    expect(rules('label', 'Chances At')).toEqual([]);
  });
});

describe('sentenceShape', () => {
  it.each([
    'Saves every few minutes',
    'Saves every few minutes.',
    'Saves your work. Runs every few minutes.',
    'Saves your work. Runs every few minutes',
    'Asks "Are you sure?" first',
    'e.g. a name',
  ])('agrees with the copy tests on: %s', (text) => {
    expect(sentenceShape(text)).toBe(sentenceShapeViolation(text));
  });

  it('skips a caption built around an interpolation', () => {
    expect(sentenceShape('Not at ${name}, so these openings don\'t come up there.')).toBeNull();
  });
});
