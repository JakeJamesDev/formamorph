import { describe, it, expect } from 'vitest';
import { parseSlashCommand } from './slashCommands';

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
