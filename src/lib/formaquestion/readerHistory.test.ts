import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, INITIAL_HISTORY, canStep, currentEntry, pushEntry, stepTarget, type FullScreenView, type ReaderHistory } from './readerHistory';

const trail = (...ids: (string | null)[]): ReaderHistory => ids.reduce(pushEntry, INITIAL_HISTORY);
/** The full screen with no section on show. */
const FULL: FullScreenView = { shown: null };
const ids = (history: ReaderHistory) => history.entries.map((entry) => entry.sectionId);

describe('reader history', () => {
  it('starts on the conversation with nowhere to go', () => {
    expect(currentEntry(INITIAL_HISTORY).sectionId).toBeNull();
    expect(canStep(INITIAL_HISTORY, -1)).toBe(false);
    expect(canStep(INITIAL_HISTORY, 1)).toBe(false);
  });

  it('pushes each change after the cursor', () => {
    const history = trail('a', 'b');
    expect(ids(history)).toEqual([null, 'a', 'b']);
    expect(history.cursor).toBe(2);
  });

  it('does not push the entry it already sits on', () => {
    expect(ids(trail('a', 'a'))).toEqual([null, 'a']);
  });

  it('steps back and forward without adding entries', () => {
    const history = trail('a', 'b');
    const back = stepTarget(history, -1);
    expect(back).toBe(1);
    const moved = { ...history, cursor: back! };
    expect(stepTarget(moved, 1)).toBe(2);
    expect(ids(moved)).toEqual([null, 'a', 'b']);
  });

  it('disables a direction at either end', () => {
    const history = trail('a');
    expect(canStep(history, 1)).toBe(false);
    expect(canStep(history, -1)).toBe(true);
    expect(stepTarget(history, 1)).toBeNull();
    expect(stepTarget({ ...history, cursor: 0 }, -1)).toBeNull();
  });

  it('drops the forward entries on a new push', () => {
    const history = trail('a', 'b', 'c');
    const back = { ...history, cursor: 1 };
    const next = pushEntry(back, 'd');
    expect(ids(next)).toEqual([null, 'a', 'd']);
    expect(canStep(next, 1)).toBe(false);
  });

  it('keeps at most 50 entries and drops the oldest', () => {
    const history = trail(...Array.from({ length: HISTORY_LIMIT + 10 }, (_, index) => `s${index}`));
    expect(history.entries).toHaveLength(HISTORY_LIMIT);
    expect(history.entries[0].sectionId).toBe('s10');
    expect(currentEntry(history).sectionId).toBe(`s${HISTORY_LIMIT + 9}`);
    expect(history.cursor).toBe(HISTORY_LIMIT - 1);
  });

  it('gives each entry its own id, never reused after a drop', () => {
    const history = trail('a', 'b');
    const back = { ...history, cursor: 1 };
    const next = pushEntry(back, 'c');
    const all = [...history.entries, ...next.entries].map((entry) => entry.id);
    const bId = history.entries[2].id;
    expect(next.entries.map((entry) => entry.id)).not.toContain(bId);
    expect(next.entries.at(-1)!.id).not.toBe(bId);
    expect(new Set(all).size).toBe(4);
  });

  describe('where the full screen skips what it cannot show', () => {
    it('lands on the nearest section entry and moves the cursor past the skipped ones', () => {
      // Wide View trail: conversation, a, conversation, b.
      const history = trail('a', null, 'b');
      expect(stepTarget(history, -1, FULL)).toBe(1);
      expect(stepTarget(history, -1)).toBe(2);
      expect(stepTarget({ ...history, cursor: 1 }, 1, FULL)).toBe(3);
    });

    it('passes over the section already on show, so a step always changes the screen', () => {
      // Wide View trail: conversation, a, conversation. The full screen opens on a.
      const history = trail('a', null);
      expect(stepTarget(history, -1, { shown: 'a' })).toBeNull();
      expect(canStep(history, -1, { shown: 'a' })).toBe(false);
      expect(stepTarget(history, -1, { shown: 'b' })).toBe(1);
      // The same section either side of a conversation entry is still the section on show.
      const around = trail('a', null, 'a');
      expect(stepTarget(around, -1, { shown: 'a' })).toBeNull();
    });

    it('disables a direction when only conversation entries are left that way', () => {
      const history = trail('a');
      // From a, back holds only the opening conversation.
      expect(canStep(history, -1, FULL)).toBe(false);
      expect(canStep(history, -1)).toBe(true);
      const ends = trail('a', null);
      expect(canStep(ends, 1, FULL)).toBe(false);
      expect(canStep({ ...ends, cursor: 1 }, 1, FULL)).toBe(false);
      expect(canStep({ ...ends, cursor: 1 }, 1)).toBe(true);
    });
  });
});
