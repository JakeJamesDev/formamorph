import { describe, expect, it } from 'vitest';
import { addScriptPins, pruneScriptPins, withScriptPins } from './scriptPins';
import { activeNotes, type MemoryNote } from './memoryOverrides';
import { buildBandedHistory, parseTurns } from './turnBanding';
import type { ChatMessage } from '@/types';

const turnMessage = (turnId: string, narration: string): ChatMessage =>
  ({ role: 'assistant', content: JSON.stringify({ narration, choices: [], stat_changes: [], turnId }) });

const history: ChatMessage[] = [
  { role: 'user', content: 'look' }, turnMessage('t1', 'The road is quiet.'),
  { role: 'user', content: 'wait' }, turnMessage('t2', 'Rain starts.'),
];
const playerNote: MemoryNote = { id: 'n1', text: 'I wrote this.', anchorTurn: 2 };

describe('script pins', () => {
  it('adds a turn’s pins as notes anchored after that turn, beside the player’s', () => {
    const notes = withScriptPins([playerNote], 't2', ['The bridge is out.', 'Mira owes a debt.'], 4);
    expect(notes.map(({ text, anchorTurn }) => ({ text, anchorTurn }))).toEqual([
      { text: 'I wrote this.', anchorTurn: 2 },
      { text: 'The bridge is out.', anchorTurn: 4 },
      { text: 'Mira owes a debt.', anchorTurn: 4 },
    ]);
    expect(new Set(notes.map((note) => note.id)).size).toBe(3);
  });

  it('replaces the turn’s own pins when the same turn lands again', () => {
    const once = withScriptPins([], 't2', ['First.'], 4);
    expect(withScriptPins(once, 't2', ['Second.'], 4).map((note) => note.text)).toEqual(['Second.']);
  });

  it('leaves the notes alone when the turn pins nothing', () => {
    const notes = [playerNote];
    expect(withScriptPins(notes, 't2', [], 4)).toBe(notes);
  });

  it('is sent with the next request as a memory', () => {
    const notes = withScriptPins([], 't2', ['The bridge is out.'], 4);
    const built = buildBandedHistory({
      turns: parseTurns(history), contextWindow: 100_000, promptTokens: 0, maxTokens: 0, verbatimFloor: 1,
      recapPrompt: 'Earlier:', keywords: [], actionEntities: [], rehydrateCap: 0, notes: activeNotes({ notes }),
    });
    expect(JSON.stringify(built)).toContain('The bridge is out.');
  });

  it('drops the pins of a turn the history no longer holds, and keeps the player’s notes', () => {
    const notes = withScriptPins(withScriptPins([playerNote], 't1', ['Kept.'], 2), 't2', ['Gone.'], 4);
    expect(pruneScriptPins(notes, history.slice(0, 2)).map((note) => note.text)).toEqual(['I wrote this.', 'Kept.']);
  });

  describe('added between turns', () => {
    it('joins the turn’s pins, after the ones it holds, with ids of their own', () => {
      const committed = withScriptPins([playerNote], 't2', ['The bridge is out.', 'Mira owes a debt.'], 4);
      const notes = addScriptPins(committed, 't2', ['Brave is sworn.'], 4);
      expect(notes.map((note) => note.text)).toEqual(['I wrote this.', 'The bridge is out.', 'Mira owes a debt.', 'Brave is sworn.']);
      expect(new Set(notes.map((note) => note.id)).size).toBe(4);
    });

    it('takes no id a kept pin holds after the player deleted an earlier one', () => {
      const [first, ...kept] = withScriptPins([], 't2', ['First.', 'Second.'], 4);
      const notes = addScriptPins(kept, 't2', ['Third.'], 4);
      expect(first.text).toBe('First.');
      expect(new Set(notes.map((note) => note.id)).size).toBe(2);
    });

    it('leaves with its turn on a rewind past it', () => {
      const notes = addScriptPins(withScriptPins([playerNote], 't1', ['Kept.'], 2), 't2', ['Brave is sworn.'], 4);
      expect(pruneScriptPins(notes, history.slice(0, 2)).map((note) => note.text)).toEqual(['I wrote this.', 'Kept.']);
    });

    it('leaves the notes alone when it adds nothing', () => {
      const notes = [playerNote];
      expect(addScriptPins(notes, 't2', [], 4)).toBe(notes);
    });
  });

  it('keeps the same list when the history holds every pin’s turn', () => {
    const notes = withScriptPins([playerNote], 't2', ['Kept.'], 4);
    expect(pruneScriptPins(notes, history)).toBe(notes);
  });
});
