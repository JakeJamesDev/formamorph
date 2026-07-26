import { describe, it, expect } from 'vitest';
import { appendLogEntry, logKind } from './playLog';
import type { LogEntry } from '@/types';

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({ text: 'x', gameTime: 0, repeat: 0, ...over });

describe('logKind', () => {
  it('reads a pre-split entry as a story event', () => {
    expect(logKind(entry())).toBe('world');
  });

  it('honors an explicit kind', () => {
    expect(logKind(entry({ kind: 'system' }))).toBe('system');
    expect(logKind(entry({ kind: 'world' }))).toBe('world');
  });
});

describe('appendLogEntry', () => {
  it('stamps a new entry with the clock it was written at', () => {
    const out = appendLogEntry([], 'Moved to location: The Green', 27, 'world');
    expect(out).toEqual([{ text: 'Moved to location: The Green', gameTime: 27, repeat: 0, kind: 'world' }]);
  });

  it('collapses a consecutive repeat and keeps the FIRST occurrence time', () => {
    let log = appendLogEntry([], "You're starving!", 10, 'world');
    log = appendLogEntry(log, "You're starving!", 11, 'world');
    log = appendLogEntry(log, "You're starving!", 12, 'world');
    expect(log).toHaveLength(1);
    expect(log[0].repeat).toBe(2);
    expect(log[0].gameTime).toBe(10);
  });

  it('does not collapse across the world/system split', () => {
    // Same wording, different feed: one is timestamped and one is not, so merging them would hide the
    // app message inside the story event's count.
    let log = appendLogEntry([], 'Failed to load game', 5, 'world');
    log = appendLogEntry(log, 'Failed to load game', 5, 'system');
    expect(log).toHaveLength(2);
    expect(log.map(logKind)).toEqual(['world', 'system']);
  });

  it('collapses a pre-split entry into a world repeat, since that is how it was rendered', () => {
    const log = appendLogEntry([entry({ text: 'Applied trait: Wary', gameTime: 3 })], 'Applied trait: Wary', 4, 'world');
    expect(log).toHaveLength(1);
    expect(log[0].repeat).toBe(1);
  });

  it('does not collapse a pre-split entry into a system repeat', () => {
    const log = appendLogEntry([entry({ text: 'Game saved', gameTime: 3 })], 'Game saved', 4, 'system');
    expect(log).toHaveLength(2);
  });

  it('never mutates an existing entry, which saved snapshots hold by reference', () => {
    const first = entry({ text: 'Rolled back', kind: 'system' });
    const before = { ...first };
    const log = appendLogEntry([first], 'Rolled back', 9, 'system');
    expect(first).toEqual(before);
    expect(log[0]).not.toBe(first);
  });

  it('only collapses the entry immediately before it', () => {
    let log = appendLogEntry([], 'A', 0, 'world');
    log = appendLogEntry(log, 'B', 1, 'world');
    log = appendLogEntry(log, 'A', 2, 'world');
    expect(log.map((e) => e.text)).toEqual(['A', 'B', 'A']);
    expect(log.every((e) => e.repeat === 0)).toBe(true);
  });
});
