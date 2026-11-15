import { describe, expect, it } from 'vitest';
import { addNamedPins, findNamed, pruneNamedMemories, withNamedPins } from './namedMemories';
import { activeNotes, type MemoryNote } from './memoryOverrides';
import { pruneScriptPins, withScriptPins } from './scriptPins';
import { buildBandedHistory, parseTurns } from './turnBanding';
import type { ChatMessage } from '@/types';

const turnMessage = (turnId: string): ChatMessage =>
  ({ role: 'assistant', content: JSON.stringify({ narration: `Turn ${turnId}.`, choices: [], stat_changes: [], turnId }) });

/** A history of `ids.length` closed turns. */
const historyOf = (...ids: string[]): ChatMessage[] => ids.flatMap((id) => [{ role: 'user' as const, content: 'go' }, turnMessage(id)]);

const playerNote: MemoryNote = { id: 'n1', text: 'I wrote this.', anchorTurn: 2 };

/** The notes after each turn's commit: `[turnId, name, text]`, anchored after that turn. */
function played(writes: readonly (readonly [string, string, string])[], start: MemoryNote[] = []): MemoryNote[] {
  const turns = [...new Set(writes.map(([turnId]) => turnId))];
  return writes.reduce((notes, [turnId, name, text]) =>
    addNamedPins(notes, [], turnId, [{ name, text }], (turns.indexOf(turnId) + 1) * 2), start);
}

/** The pruning that runs after a rewind, both kinds together as GameViewer runs them. */
const rewound = (notes: MemoryNote[], history: ChatMessage[]) => pruneNamedMemories(pruneScriptPins(notes, history), history);

describe('named memories', () => {
  it('creates a memory under its name, then replaces its text on a later turn', () => {
    const notes = played([['t1', 'Nursery', 'Ash lives at the nursery.'], ['t2', 'nursery ', 'Ash and Bree live at the nursery.']]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ name: 'Nursery', text: 'Ash and Bree live at the nursery.' });
    expect(notes[0].id).toBe(played([['t1', 'Nursery', 'Ash lives at the nursery.']])[0].id);
  });

  it('finds a memory trimmed and case-insensitive, and misses an unknown name', () => {
    const notes = played([['t1', 'Nursery', 'Ash.']]);
    expect(findNamed(notes, [], '  NURSERY ')?.text).toBe('Ash.');
    expect(findNamed(notes, [], 'Stable')).toBeUndefined();
  });

  it('keeps one text per turn: a second pin in the turn replaces the first', () => {
    const notes = played([['t1', 'Nursery', 'Ash.'], ['t2', 'Nursery', 'Ash, Bree.'], ['t2', 'Nursery', 'Ash, Bree, Cole.']]);
    expect(rewound(notes, historyOf('t1'))[0].text).toBe('Ash.');
    expect(notes[0].text).toBe('Ash, Bree, Cole.');
  });

  it('replaces the creating turn’s own text when that turn writes again', () => {
    const notes = played([['t1', 'Nursery', 'Ash.'], ['t1', 'Nursery', 'Ash, again.']]);
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe('Ash, again.');
    expect(rewound(notes, historyOf('t1'))).toEqual(notes);
  });

  it('brings back the earlier text and anchor when a later write’s turn is rewound', () => {
    const notes = played([['t1', 'Nursery', 'Ash.'], ['t2', 'Nursery', 'Ash, Bree.']]);
    expect(notes[0]).toMatchObject({ text: 'Ash, Bree.', anchorTurn: 4 });
    expect(rewound(notes, historyOf('t1'))[0]).toMatchObject({ text: 'Ash.', anchorTurn: 2 });
  });

  it('rewinds several writes back to the surviving one', () => {
    const notes = played([['t1', 'Nursery', 'Ash.'], ['t2', 'Nursery', 'Ash, Bree.'], ['t3', 'Nursery', 'Ash, Bree, Cole.']]);
    expect(rewound(notes, historyOf('t1', 't2'))[0]).toMatchObject({ text: 'Ash, Bree.', anchorTurn: 4 });
    expect(rewound(notes, historyOf('t1'))[0]).toMatchObject({ text: 'Ash.', anchorTurn: 2 });
  });

  it('removes the memory when the turn that created it is rewound', () => {
    const notes = played([['t1', 'Nursery', 'Ash.'], ['t2', 'Nursery', 'Ash, Bree.']], [playerNote]);
    expect(rewound(notes, [])).toEqual([playerNote]);
  });

  it('removes the memory when its turn is regenerated under a new id', () => {
    const notes = played([['t1', 'Nursery', 'Ash.'], ['t2', 'Stable', 'Dot.']]);
    expect(rewound(notes, historyOf('t1', 't2b')).map((note) => note.name)).toEqual(['Nursery']);
  });

  it('keeps the regenerated turn’s text when it wrote before the prune ran', () => {
    const notes = played([['t1', 'Nursery', 'Ash.'], ['t1b', 'Nursery', 'Bree.']]);
    expect(rewound(notes, historyOf('t1b')).map(({ name, text }) => ({ name, text }))).toEqual([{ name: 'Nursery', text: 'Bree.' }]);
  });

  it('keeps the same notes when nothing left the history', () => {
    const notes = played([['t1', 'Nursery', 'Ash.']], [playerNote]);
    expect(rewound(notes, historyOf('t1'))).toBe(notes);
  });

  it('sets a re-landed turn’s writes to its new ones', () => {
    const once = withNamedPins([], [], 't1', [{ name: 'Nursery', text: 'Ash.' }, { name: 'Stable', text: 'Dot.' }], 2);
    const again = withNamedPins(once, [], 't1', [{ name: 'Nursery', text: 'Ash, again.' }], 2);
    expect(again.map(({ name, text }) => ({ name, text }))).toEqual([{ name: 'Nursery', text: 'Ash, again.' }]);
  });

  it('leaves unnamed script pins and player notes to their own rules', () => {
    const pinned = withScriptPins([playerNote], 't2', ['The bridge is out.'], 4);
    const notes = addNamedPins(pinned, [], 't2', [{ name: 'Nursery', text: 'Ash.' }], 4);
    expect(pruneNamedMemories(notes, historyOf('t1'))).toEqual(pinned);
    expect(rewound(notes, historyOf('t1'))).toEqual([playerNote]);
  });

  it('makes a fresh memory when the name’s holder is deleted', () => {
    const notes = played([['t1', 'Nursery', 'Ash.']]);
    const fresh = addNamedPins(notes, [notes[0].id], 't2', [{ name: 'Nursery', text: 'Bree.' }], 4);
    expect(fresh).toHaveLength(2);
    expect(fresh[1].id).not.toBe(notes[0].id);
  });

  it('sends the text with the next request and never the name', () => {
    const notes = played([['t1', 'Nursery Ledger', 'Ash lives at the nursery.']]);
    const built = buildBandedHistory({
      turns: parseTurns(historyOf('t1')), contextWindow: 100_000, promptTokens: 0, maxTokens: 0, verbatimFloor: 1,
      recapPrompt: 'Earlier:', keywords: [], actionEntities: [], rehydrateCap: 0, notes: activeNotes({ notes }),
    });
    const sent = JSON.stringify(built);
    expect(sent).toContain('Ash lives at the nursery.');
    expect(sent).not.toContain('Nursery Ledger');
  });
});
