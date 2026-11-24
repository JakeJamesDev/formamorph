import { describe, expect, it } from 'vitest';
import { changes } from '@/test/memoryChanges';
import {
  addNamedWrites, findNamed, playerEdit, pruneNamedMemories, restoreAll, restoreMemory, withNamedWrites, type NamedWrite,
} from './namedMemories';
import { activeNotes, type MemoryNote } from './memoryOverrides';
import { pruneScriptPins, withScriptPins } from './scriptPins';
import { notesAfter } from './memoryWrites';
import { buildMemoryLedger, scriptMemories } from './memoryView';
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
    addNamedWrites(notes, [], turnId, [{ name, text }], (turns.indexOf(turnId) + 1) * 2), start);
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
    const once = withNamedWrites([], [], 't1', [{ name: 'Nursery', text: 'Ash.' }, { name: 'Stable', text: 'Dot.' }], 2);
    const again = withNamedWrites(once, [], 't1', [{ name: 'Nursery', text: 'Ash, again.' }], 2);
    expect(again.map(({ name, text }) => ({ name, text }))).toEqual([{ name: 'Nursery', text: 'Ash, again.' }]);
  });

  it('leaves unnamed script pins and player notes to their own rules', () => {
    const pinned = withScriptPins([playerNote], 't2', ['The bridge is out.'], 4);
    const notes = addNamedWrites(pinned, [], 't2', [{ name: 'Nursery', text: 'Ash.' }], 4);
    expect(pruneNamedMemories(notes, historyOf('t1'))).toEqual(pinned);
    expect(rewound(notes, historyOf('t1'))).toEqual([playerNote]);
  });

  it('makes a fresh memory when the name’s holder is deleted', () => {
    const notes = played([['t1', 'Nursery', 'Ash.']]);
    const fresh = addNamedWrites(notes, [notes[0].id], 't2', [{ name: 'Nursery', text: 'Bree.' }], 4);
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

  /** What scripts and the Memory Manager read of `notes`, against `history`. */
  const readBy = (notes: MemoryNote[], history: ChatMessage[], deleted: string[] = []) => {
    const ledger = buildMemoryLedger({ history, overrides: changes({ notes, deleted }), pins: {}, selection: null, verbatimFloor: 1 });
    return { scripts: scriptMemories(ledger, history), rows: ledger.rows.filter((row) => row.isNote) };
  };
  const write = (notes: MemoryNote[], turnId: string, writes: NamedWrite[], anchor: number, deleted: string[] = []) =>
    addNamedWrites(notes, deleted, turnId, writes, anchor);
  const texts = (notes: MemoryNote[]) => activeNotes({ notes }).map((note) => note.text);

  describe('script edit and remove (Q11, Q20)', () => {
    it('rewinds an edit of a named memory to the text before it', () => {
      const notes = write(played([['t1', 'Nursery', 'Ash.']]), 't2', [{ name: 'nursery', text: 'Ash, Bree.' }], 4);
      expect(notes[0].text).toBe('Ash, Bree.');
      expect(rewound(notes, historyOf('t1'))[0]).toMatchObject({ text: 'Ash.', anchorTurn: 2 });
    });

    it('keeps an edit of an unnamed memory through a rewind, as today', () => {
      const pinned = withScriptPins([], 't1', ['The bridge is out.'], 2);
      const edited = notesAfter(pinned, [{ id: pinned[0].id, kind: 'edit', text: 'The bridge is fixed.', custom: true }]);
      expect(rewound(edited, historyOf('t1'))[0].text).toBe('The bridge is fixed.');
    });

    it('hides a removed memory, then brings it back when the remove’s turn is rewound', () => {
      const notes = write(played([['t1', 'Nursery', 'Ash.']]), 't2', [{ name: 'Nursery', remove: true }], 4);
      expect(texts(notes)).toEqual([]);
      expect(readBy(notes, historyOf('t1', 't2')).scripts).toEqual([]);
      expect(readBy(notes, historyOf('t1', 't2')).rows[0]).toMatchObject({ text: 'Ash.', deleted: true });
      expect(texts(rewound(notes, historyOf('t1')))).toEqual(['Ash.']);
    });

    it('revives a removed memory under its same id on a later pin', () => {
      const removed = write(played([['t1', 'Nursery', 'Ash.']]), 't2', [{ name: 'Nursery', remove: true }], 4);
      const revived = write(removed, 't3', [{ name: 'Nursery', text: 'Bree.' }], 6);
      expect(revived).toHaveLength(1);
      expect(revived[0]).toMatchObject({ id: removed[0].id, text: 'Bree.' });
      expect(texts(revived)).toEqual(['Bree.']);
    });

    it('ignores a removal of a name no memory holds', () => {
      const notes = played([['t1', 'Nursery', 'Ash.']]);
      expect(write(notes, 't2', [{ name: 'Stable', remove: true }], 4)).toBe(notes);
    });

    it('applies a turn’s pin, edit and remove in call order', () => {
      const notes = write([], 't1', [{ name: 'Nursery', text: 'Ash.' }, { name: 'Nursery', text: 'Ash, Bree.' }, { name: 'Nursery', remove: true }], 2);
      expect(texts(notes)).toEqual([]);
      expect(notes[0].text).toBe('Ash, Bree.');
    });
  });

  describe('player edits (Q8, Q23)', () => {
    it('shows the player’s edit to scripts, and again when the next script write is rewound', () => {
      const edited = playerEdit(played([['t1', 'Nursery', 'Ash.']]), 'named:t1:nursery', 'Ash, my favorite.');
      expect(readBy(edited, historyOf('t1')).scripts[0].text).toBe('Ash, my favorite.');
      const pinned = write(edited, 't2', [{ name: 'Nursery', text: 'Ash, my favorite. Bree.' }], 4);
      expect(pinned[0].text).toBe('Ash, my favorite. Bree.');
      expect(rewound(pinned, historyOf('t1'))[0]).toMatchObject({ text: 'Ash, my favorite.', anchorTurn: 2 });
    });

    it('keeps the player’s edit through a rewind of an earlier script write', () => {
      const notes = playerEdit(played([['t1', 'Nursery', 'Ash.'], ['t2', 'Nursery', 'Ash, Bree.']]), 'named:t1:nursery', 'Mine.');
      expect(rewound(notes, historyOf('t1'))[0]).toMatchObject({ text: 'Mine.', anchorTurn: 2 });
    });

    it('keeps the anchor of the newest script write', () => {
      const notes = played([['t1', 'Nursery', 'Ash.'], ['t2', 'Nursery', 'Ash, Bree.']]);
      expect(playerEdit(notes, notes[0].id, 'Mine.')[0].anchorTurn).toBe(4);
    });

    it('lets a re-landed turn replace the player’s edit', () => {
      const edited = playerEdit(played([['t1', 'Nursery', 'Ash.']]), 'named:t1:nursery', 'Mine.');
      const relanded = withNamedWrites(edited, [], 't1', [{ name: 'Nursery', text: 'Ash, again.' }], 2);
      expect(relanded.map(({ id, text }) => ({ id, text }))).toEqual([{ id: 'named:t1:nursery', text: 'Ash, again.' }]);
      expect(withNamedWrites(relanded, [], 't2', [], 4)).toBe(relanded);
    });

    it('rewrites an unnamed memory’s text in place', () => {
      expect(playerEdit([playerNote], 'n1', 'Changed.')).toEqual([{ ...playerNote, text: 'Changed.' }]);
    });
  });

  describe('player delete and restore (Q7, Q21, Q22)', () => {
    it('frees the name: the lookup misses and the next pin makes a new memory', () => {
      const notes = played([['t1', 'Nursery', 'Ash.']]);
      const deleted = [notes[0].id];
      expect(findNamed(notes, deleted, 'Nursery')).toBeUndefined();
      expect(readBy(notes, historyOf('t1'), deleted).scripts).toEqual([]);
      const fresh = write(notes, 't2', [{ name: 'Nursery', text: 'Bree.' }], 4, deleted);
      expect(findNamed(fresh, deleted, 'Nursery')).toMatchObject({ text: 'Bree.' });
      expect(findNamed(fresh, deleted, 'Nursery')?.id).not.toBe(notes[0].id);
    });

    it('restores a deleted memory unnamed while another holds its name', () => {
      const first = played([['t1', 'Nursery', 'Ash.']]);
      const deleted = [first[0].id];
      const notes = write(first, 't2', [{ name: 'Nursery', text: 'Bree.' }], 4, deleted);
      const back = restoreMemory(notes, deleted, first[0].id);
      expect(back.deleted).toEqual([]);
      expect(back.notes[0]).toEqual({ id: first[0].id, text: 'Ash.', anchorTurn: 2 });
      expect(findNamed(back.notes, back.deleted, 'Nursery')).toMatchObject({ text: 'Bree.' });
      expect(rewound(back.notes, [])).toEqual([back.notes[0]]);
    });

    it('restores a deleted memory named when nothing holds its name', () => {
      const notes = played([['t1', 'Nursery', 'Ash.']]);
      const back = restoreMemory(notes, [notes[0].id], notes[0].id);
      expect(back.notes).toEqual(notes);
      expect(findNamed(back.notes, back.deleted, 'Nursery')).toBe(notes[0]);
    });

    it('restores a script-removed memory through a player revision no rewind takes', () => {
      const removed = write(played([['t1', 'Nursery', 'Ash.']]), 't2', [{ name: 'Nursery', remove: true }], 4);
      const back = restoreMemory(removed, [], removed[0].id);
      expect(texts(back.notes)).toEqual(['Ash.']);
      const later = write(back.notes, 't3', [{ name: 'Nursery', remove: true }], 6);
      expect(texts(later)).toEqual([]);
      expect(texts(rewound(later, historyOf('t1', 't2')))).toEqual(['Ash.']);
    });

    it('gives a re-landed turn’s new memory a fresh id while a deleted, pruned one keeps the old id in deletions', () => {
      const notes = played([['t1', 'Nursery', 'Ash.']]);
      const deleted = [notes[0].id];
      const relanded = withNamedWrites(rewound(notes, []), deleted, 't1', [{ name: 'Nursery', text: 'Bree.' }], 2);
      expect(texts(relanded.filter((note) => !deleted.includes(note.id)))).toEqual(['Bree.']);
    });

    it('restores every deleted memory and every script removal on Reset All, one name holder each', () => {
      const first = played([['t1', 'Nursery', 'Ash.']]);
      const second = write(first, 't2', [{ name: 'Nursery', text: 'Bree.' }, { name: 'Stable', text: 'Dot.' }], 4, [first[0].id]);
      const removed = write(second, 't3', [{ name: 'Stable', remove: true }], 6, [first[0].id]);
      const reset = restoreAll(removed, [first[0].id]);
      expect(reset.deleted).toEqual([]);
      expect(texts(reset.notes).sort()).toEqual(['Ash.', 'Bree.', 'Dot.']);
      expect(reset.notes.filter((note) => note.name === 'Nursery').map((note) => note.text)).toEqual(['Bree.']);
    });

    it('restores an unnamed memory by clearing its tombstone only', () => {
      expect(restoreMemory([playerNote], ['n1'], 'n1')).toEqual({ notes: [playerNote], deleted: [] });
    });
  });
});
