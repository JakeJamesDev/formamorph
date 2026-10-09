import { describe, it, expect } from 'vitest';
import { applySlashCompletion, parseSlashCommand, slashCompletion, type SlashCommandTree } from './slashCommands';

describe('parseSlashCommand', () => {
  it('parses a command with arguments', () => {
    expect(parseSlashCommand('/markdown test')).toEqual({ command: 'markdown', args: ['test'] });
  });

  it('lowercases the command and keeps multiple args', () => {
    expect(parseSlashCommand('/SET volume 5')).toEqual({ command: 'set', args: ['volume', '5'] });
  });

  it('handles a bare command with no args', () => {
    expect(parseSlashCommand('/help')).toEqual({ command: 'help', args: [] });
  });

  it('tolerates surrounding and internal extra whitespace', () => {
    expect(parseSlashCommand('  /markdown   test  ')).toEqual({ command: 'markdown', args: ['test'] });
  });

  it('returns null for non-commands and a lone slash', () => {
    expect(parseSlashCommand('hello there')).toBeNull();
    expect(parseSlashCommand('/')).toBeNull();
    expect(parseSlashCommand('')).toBeNull();
  });
});

const TREE: SlashCommandTree = {
  choices: { test: { slow: {}, erratic: {} } },
  markdown: { test: { render: {}, slow: {} } },
};
const at = (value: string, caret = value.length) => slashCompletion(value, caret, TREE);

describe('slashCompletion', () => {
  it('offers every command on a lone slash', () => {
    expect(at('/')).toEqual({ start: 1, end: 1, items: ['choices', 'markdown'] });
  });

  it('filters the word under the caret by what is typed', () => {
    expect(at('/ma')?.items).toEqual(['markdown']);
  });

  it("offers each argument's own words, starting at that argument", () => {
    expect(at('/markdown ')).toEqual({ start: 10, end: 10, items: ['test'] });
    expect(at('/choices test ')).toEqual({ start: 14, end: 14, items: ['slow', 'erratic'] });
    expect(at('/choices test er')).toEqual({ start: 14, end: 16, items: ['erratic'] });
  });

  it('completes a word mid-line, spanning the rest of that word', () => {
    expect(at('/chtest', 3)).toEqual({ start: 1, end: 7, items: ['choices'] });
    expect(at('/ch test', 3)).toEqual({ start: 1, end: 3, items: ['choices'] });
  });

  it('closes on a word typed in full, so Enter sends', () => {
    expect(at('/choices test slow')?.items).toEqual([]);
  });

  it('offers nothing outside a command, past an unknown word, or past the last argument', () => {
    expect(at('look /around')).toBeNull();
    expect(at('/nope ')).toBeNull();
    expect(at('/choices test slow ')?.items).toEqual([]);
  });
});

describe('applySlashCompletion', () => {
  it('puts the word in place with a space when it takes arguments', () => {
    const value = '/ch';
    expect(applySlashCompletion(value, at(value)!, 'choices', TREE)).toEqual({ value: '/choices ', caret: 9 });
  });

  it('adds no space after the last argument', () => {
    const value = '/choices test er';
    expect(applySlashCompletion(value, at(value)!, 'erratic', TREE)).toEqual({ value: '/choices test erratic', caret: 21 });
  });

  it('keeps the words after the caret and steps over their space', () => {
    const value = '/ch test';
    expect(applySlashCompletion(value, at(value, 3)!, 'choices', TREE)).toEqual({ value: '/choices test', caret: 9 });
  });
});
