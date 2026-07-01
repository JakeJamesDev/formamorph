import { describe, it, expect } from 'vitest';
import type { AITurnResult, ChatMessage } from '@/types';
import { parseTurnContent, serializeTurnContent, selectDueDigests, applyDigest, selectDueDiaries, pendingDiaryNames, applyDiary, collectCharacterDiary } from './turnDigest';

const user = (content: string): ChatMessage => ({ role: 'user', content });

const assistant = (turn: Partial<AITurnResult> & { game_text?: string }): ChatMessage => ({
  role: 'assistant',
  content: JSON.stringify({ narration: '', choices: [], stat_changes: [], ...turn }),
});

/** A user→assistant pair, the unit `fullMessageHistory` is built from. */
const pair = (action: string, turn: Partial<AITurnResult>): ChatMessage[] => [user(action), assistant(turn)];

describe('parseTurnContent / serializeTurnContent', () => {
  it('round-trips the extended turn shape including turnId and summary', () => {
    const turn: AITurnResult = {
      narration: 'You open the door.',
      choices: ['Go in', 'Leave'],
      stat_changes: [{ courage: 1 }],
      turnId: 'abc-123',
      summary: '[STATE] you opened the door',
    };
    const parsed = parseTurnContent(serializeTurnContent(turn));
    expect(parsed).toEqual(turn);
  });

  it('parses legacy content without turnId/summary', () => {
    const parsed = parseTurnContent(JSON.stringify({ narration: 'hi', choices: [], stat_changes: [] }));
    expect(parsed?.narration).toBe('hi');
    expect(parsed?.turnId).toBeUndefined();
    expect(parsed?.summary).toBeUndefined();
  });

  // Backward compat: legacy v1.2 / pre-release 2.0 saves stored the narration under `game_text`.
  it('normalizes a legacy game_text field to narration on read', () => {
    const parsed = parseTurnContent(JSON.stringify({ game_text: 'hi', choices: [], stat_changes: [] }));
    expect(parsed?.narration).toBe('hi');
    expect((parsed as { game_text?: string }).game_text).toBeUndefined();
  });

  it('returns null on unparseable content', () => {
    expect(parseTurnContent('not json {')).toBeNull();
  });
});

describe('selectDueDigests', () => {
  it('digests every completed turn by default (skipRecent 0), newest-first', () => {
    const history = [
      ...pair('a1', { turnId: 't1' }),
      ...pair('a2', { turnId: 't2' }),
      ...pair('a3', { turnId: 't3' }),
    ];
    expect(selectDueDigests(history)).toEqual(['t3', 't2', 't1']);
  });

  it('skips the most recent `skipRecent` assistant turns', () => {
    const history = [
      ...pair('a1', { turnId: 't1' }),
      ...pair('a2', { turnId: 't2' }),
      ...pair('a3', { turnId: 't3' }),
      ...pair('a4', { turnId: 't4' }),
    ];
    // floor of 2 keeps t4, t3 verbatim; t2, t1 are due (most-recent-first).
    expect(selectDueDigests(history, 2)).toEqual(['t2', 't1']);
  });

  it('does not re-select turns that already have a summary', () => {
    const history = [
      ...pair('a1', { turnId: 't1', summary: 'done' }),
      ...pair('a2', { turnId: 't2' }),
      ...pair('a3', { turnId: 't3' }),
    ];
    expect(selectDueDigests(history, 1)).toEqual(['t2']);
  });

  it('skips pre-digest turns lacking a turnId', () => {
    const history = [
      ...pair('a1', {}), // legacy, no turnId
      ...pair('a2', { turnId: 't2' }),
      ...pair('a3', { turnId: 't3' }),
    ];
    expect(selectDueDigests(history, 1)).toEqual(['t2']);
  });

  it('returns nothing when every turn is within the verbatim floor', () => {
    const history = [...pair('a1', { turnId: 't1' }), ...pair('a2', { turnId: 't2' })];
    expect(selectDueDigests(history, 3)).toEqual([]);
  });
});

describe('applyDigest', () => {
  it('patches the summary onto the matching turn and leaves others untouched', () => {
    const history = [
      ...pair('a1', { turnId: 't1' }),
      ...pair('a2', { turnId: 't2' }),
    ];
    const next = applyDigest(history, 't1', '[STATE] the bridge collapsed');
    expect(next).not.toBeNull();
    expect(parseTurnContent(next![1].content)?.summary).toBe('[STATE] the bridge collapsed');
    // t2 is unchanged.
    expect(parseTurnContent(next![3].content)?.summary).toBeUndefined();
    // The original array is not mutated.
    expect(parseTurnContent(history[1].content)?.summary).toBeUndefined();
  });

  it('returns null when the turnId is gone (rolled back / regenerated)', () => {
    const history = [...pair('a1', { turnId: 't1' })];
    expect(applyDigest(history, 'stale-id', 'orphan digest')).toBeNull();
  });
});

describe('selectDueDiaries', () => {
  it('selects turns with participants missing any diary entry, newest-first', () => {
    const history = [
      ...pair('a1', { turnId: 't1', entities: ['Mira'] }),
      ...pair('a2', { turnId: 't2', entities: ['Kael', 'Mira'] }),
    ];
    expect(selectDueDiaries(history)).toEqual(['t2', 't1']);
  });

  it('skips turns with no participants', () => {
    const history = [
      ...pair('a1', { turnId: 't1', entities: [] }),
      ...pair('a2', { turnId: 't2' }), // entities undefined
      ...pair('a3', { turnId: 't3', entities: ['Mira'] }),
    ];
    expect(selectDueDiaries(history)).toEqual(['t3']);
  });

  it('does not re-select a fully-covered turn but does one with a new participant', () => {
    const history = [
      ...pair('a1', { turnId: 't1', entities: ['Mira'], diaries: { Mira: 'I waved.' } }),
      ...pair('a2', { turnId: 't2', entities: ['Kael', 'Mira'], diaries: { Kael: 'I watched.' } }),
    ];
    // t1 is covered; t2 still needs Mira.
    expect(selectDueDiaries(history)).toEqual(['t2']);
  });

  it('skips turns lacking a turnId', () => {
    const history = [...pair('a1', { entities: ['Mira'] })];
    expect(selectDueDiaries(history)).toEqual([]);
  });
});

describe('pendingDiaryNames', () => {
  it('returns only the participants still missing an entry', () => {
    const history = [
      ...pair('a1', { turnId: 't1', entities: ['Kael', 'Mira'], diaries: { Kael: 'I watched.' } }),
    ];
    expect(pendingDiaryNames(history, 't1')).toEqual(['Mira']);
  });

  it('returns empty for a fully-covered or unknown turn', () => {
    const history = [
      ...pair('a1', { turnId: 't1', entities: ['Mira'], diaries: { Mira: 'done' } }),
    ];
    expect(pendingDiaryNames(history, 't1')).toEqual([]);
    expect(pendingDiaryNames(history, 'nope')).toEqual([]);
  });
});

describe('applyDiary', () => {
  it('merges one character entry onto the matching turn, preserving others', () => {
    const history = [
      ...pair('a1', { turnId: 't1', entities: ['Kael', 'Mira'], diaries: { Kael: 'I watched.' } }),
      ...pair('a2', { turnId: 't2', entities: ['Mira'] }),
    ];
    const next = applyDiary(history, 't1', 'Mira', 'I waved back.');
    expect(next).not.toBeNull();
    expect(parseTurnContent(next![1].content)?.diaries).toEqual({ Kael: 'I watched.', Mira: 'I waved back.' });
    // t2 untouched; original not mutated.
    expect(parseTurnContent(next![3].content)?.diaries).toBeUndefined();
    expect(parseTurnContent(history[1].content)?.diaries).toEqual({ Kael: 'I watched.' });
  });

  it('returns null when the turnId is gone', () => {
    const history = [...pair('a1', { turnId: 't1', entities: ['Mira'] })];
    expect(applyDiary(history, 'stale', 'Mira', 'orphan')).toBeNull();
  });
});

describe('collectCharacterDiary', () => {
  it('collects one character\'s entries oldest-first, capped to the last max', () => {
    const history = [
      ...pair('a1', { turnId: 't1', diaries: { Mira: 'I waved.', Kael: 'I watched.' } }),
      ...pair('a2', { turnId: 't2', diaries: { Mira: 'I fled.' } }),
      ...pair('a3', { turnId: 't3', diaries: { Mira: 'I hid.' } }),
    ];
    expect(collectCharacterDiary(history, 'Mira', 5)).toEqual(['I waved.', 'I fled.', 'I hid.']);
    expect(collectCharacterDiary(history, 'Mira', 2)).toEqual(['I fled.', 'I hid.']); // last 2
    expect(collectCharacterDiary(history, 'Kael', 5)).toEqual(['I watched.']);
  });

  it('matches the name case-insensitively and skips turns without an entry', () => {
    const history = [
      ...pair('a1', { turnId: 't1', diaries: { Mira: 'I waved.' } }),
      ...pair('a2', { turnId: 't2' }), // no diaries at all
      ...pair('a3', { turnId: 't3', diaries: { Kael: 'I watched.' } }), // different character
    ];
    expect(collectCharacterDiary(history, 'mira', 5)).toEqual(['I waved.']);
  });

  it('skips a "nothing notable" entry (it carries no memory)', () => {
    const history = [
      ...pair('a1', { turnId: 't1', diaries: { Mira: 'nothing notable' } }),
      ...pair('a2', { turnId: 't2', diaries: { Mira: 'I fled.' } }),
    ];
    expect(collectCharacterDiary(history, 'Mira', 5)).toEqual(['I fled.']);
  });

  it('returns empty when the character has no entries', () => {
    const history = [...pair('a1', { turnId: 't1', diaries: { Kael: 'I watched.' } })];
    expect(collectCharacterDiary(history, 'Mira', 5)).toEqual([]);
  });
});
