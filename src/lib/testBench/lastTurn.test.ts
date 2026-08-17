import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatMessage, GameState, SaveRecord } from '@/types';

const getAllSaveRecords = vi.fn<() => Promise<SaveRecord[]>>();
vi.mock('@/components/modals/dbUtils', () => ({ getAllSaveRecords: () => getAllSaveRecords() }));

const { lastTurnFrom, loadLastTurn, pickLatestSave } = await import('./lastTurn');

/** An assistant turn as the game stores it: narration inside the turn envelope, never bare prose. */
const turn = (narration: string): ChatMessage =>
  ({ role: 'assistant', content: JSON.stringify({ narration, choices: [] }) }) as ChatMessage;
const said = (text: string): ChatMessage => ({ role: 'user', content: text }) as ChatMessage;

const save = (over: Partial<SaveRecord> & { id: string }): SaveRecord => ({
  name: 'Save',
  currentState: { timestamp: '2026-01-01T00:00:00Z', worldName: 'Sedge Landing' } as GameState,
  stateHistory: [],
  version: '2.0.3',
  ...over,
});

// Braced: an arrow returning `mockReset()`'s value hands Vitest the mock itself as a teardown callback,
// which then *calls* it after the test.
beforeEach(() => { getAllSaveRecords.mockReset(); });

describe('pickLatestSave', () => {
  const mine = save({ id: 's1', worldId: 'w1', currentState: { timestamp: '2026-02-01T00:00:00Z' } as GameState });
  const older = save({ id: 's2', worldId: 'w1', currentState: { timestamp: '2026-01-01T00:00:00Z' } as GameState });
  const theirs = save({ id: 's3', worldId: 'w2', currentState: { timestamp: '2026-03-01T00:00:00Z' } as GameState });

  it('takes the newest save of this world and nobody else’s', () => {
    expect(pickLatestSave([older, theirs, mine], 'w1', 'Sedge Landing')?.id).toBe('s1');
  });

  it('falls back to the stored world name for a save written before saves carried an id', () => {
    const legacy = save({ id: 's4', currentState: { timestamp: '2026-01-05T00:00:00Z', worldName: 'Sedge Landing' } as GameState });
    expect(pickLatestSave([legacy], 'w1', 'Sedge Landing')?.id).toBe('s4');
    // Another world's legacy save must not be offered as this world's last turn.
    expect(pickLatestSave([legacy], 'w1', 'Harrowfell')).toBeUndefined();
  });

  it('has nothing to offer when the world has never been played', () => {
    expect(pickLatestSave([theirs], 'w1', 'Sedge Landing')).toBeUndefined();
    expect(pickLatestSave([], 'w1', 'Sedge Landing')).toBeUndefined();
  });
});

describe('lastTurnFrom', () => {
  it('reads the last narration as the scene and the messages before it as history', () => {
    const record = save({
      id: 's1',
      messageHistory: [turn('The tide pulled out.'), said('Walk the pier.'), turn('Maren waits at the rail.')],
    });
    expect(lastTurnFrom(record)).toEqual({
      scene: 'Maren waits at the rail.',
      history: ['The tide pulled out.', 'Walk the pier.'],
    });
  });

  it('reads narration out of the turn envelope, never the stored JSON', () => {
    const record = save({ id: 's1', messageHistory: [turn('Maren waits at the rail.')] });
    expect(lastTurnFrom(record)?.scene).toBe('Maren waits at the rail.');
  });

  it('holds the history to its depth, newest kept', () => {
    const record = save({
      id: 's1',
      messageHistory: [turn('One.'), turn('Two.'), turn('Three.'), turn('Now.')],
    });
    expect(lastTurnFrom(record, 2)?.history).toEqual(['Two.', 'Three.']);
  });

  it('drops anything a user message left behind it — a trailing action is not the turn', () => {
    const record = save({ id: 's1', messageHistory: [turn('Maren waits.'), said('Wave at her.')] });
    expect(lastTurnFrom(record)).toMatchObject({ scene: 'Maren waits.', history: [] });
  });

  it('reads a pre-2.2 save’s history off the snapshot that carried it', () => {
    const record = save({
      id: 's1',
      currentState: { timestamp: '', fullMessageHistory: [turn('One.'), turn('Now.')] } as GameState,
    });
    expect(lastTurnFrom(record)).toMatchObject({ scene: 'Now.', history: ['One.'] });
  });

  it('falls back to the snapshot’s own narration when the messages did not survive', () => {
    const record = save({ id: 's1', currentState: { timestamp: '', gameplayText: 'Maren waits.' } as GameState });
    expect(lastTurnFrom(record)).toMatchObject({ scene: 'Maren waits.', history: [] });
  });

  it('has no turn to offer from a save with no narration at all', () => {
    expect(lastTurnFrom(save({ id: 's1' }))).toBeNull();
    expect(lastTurnFrom(save({ id: 's2', messageHistory: [turn('   ')] }))).toBeNull();
  });
});

describe('loadLastTurn', () => {
  it('reads the world’s newest save', async () => {
    getAllSaveRecords.mockResolvedValue([
      save({ id: 's1', worldId: 'w1', name: 'Old', currentState: { timestamp: '2026-01-01T00:00:00Z' } as GameState, messageHistory: [turn('Old turn.')] }),
      save({ id: 's2', worldId: 'w1', name: 'New', currentState: { timestamp: '2026-05-01T00:00:00Z' } as GameState, messageHistory: [turn('New turn.')] }),
    ]);
    expect(await loadLastTurn('w1', 'Sedge Landing')).toMatchObject({ scene: 'New turn.' });
  });

  it('offers nothing when the world has no save', async () => {
    getAllSaveRecords.mockResolvedValue([]);
    expect(await loadLastTurn('w1', 'Sedge Landing')).toBeNull();
  });

  it('offers nothing rather than throwing when the save database cannot be read', async () => {
    getAllSaveRecords.mockImplementation(async () => { throw new Error('IndexedDB unavailable'); });
    await expect(loadLastTurn('w1', 'Sedge Landing')).resolves.toBeNull();
  });
});
