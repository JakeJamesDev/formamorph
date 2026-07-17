import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findSavesUsingModel } from './modelUsage';
import { getAllSaveRecords } from '@/components/modals/dbUtils';
import type { GameState, SaveRecord } from '@/types';

vi.mock('@/components/modals/dbUtils', () => ({ getAllSaveRecords: vi.fn() }));

/** Only the fields the scan reads; the rest of a snapshot is irrelevant here. */
const state = (playerModelId?: string): GameState =>
  ({ characterData: playerModelId ? { playerModelId } : null }) as unknown as GameState;

const save = (name: string, current?: string, history: (string | undefined)[] = []): SaveRecord =>
  ({ id: name, name, currentState: state(current), stateHistory: history.map(state) }) as unknown as SaveRecord;

// Block body, not a concise one: an arrow returning the mock hands Vitest a *teardown* function, which it
// then calls after each test — invoking the mock and leaving its rejected promise unhandled.
beforeEach(() => {
  vi.mocked(getAllSaveRecords).mockReset();
});

describe('findSavesUsingModel', () => {
  it('names the saves whose character wears the model', async () => {
    vi.mocked(getAllSaveRecords).mockResolvedValue([
      save('Chapter One', 'model-a'),
      save('Chapter Two', 'model-b'),
      save('Chapter Three', 'model-a'),
    ]);
    await expect(findSavesUsingModel('model-a')).resolves.toEqual(['Chapter One', 'Chapter Three']);
  });

  it('matches a model that only an earlier snapshot wears, since a rollback would restore it', async () => {
    vi.mocked(getAllSaveRecords).mockResolvedValue([save('Rolled Back', 'model-b', ['model-a', 'model-b'])]);
    await expect(findSavesUsingModel('model-a')).resolves.toEqual(['Rolled Back']);
  });

  it('returns nothing when no save references the model', async () => {
    vi.mocked(getAllSaveRecords).mockResolvedValue([save('Chapter One', 'model-b')]);
    await expect(findSavesUsingModel('model-a')).resolves.toEqual([]);
  });

  it('ignores saves with no character at all', async () => {
    vi.mocked(getAllSaveRecords).mockResolvedValue([save('Fresh'), save('Wearing', 'model-a')]);
    await expect(findSavesUsingModel('model-a')).resolves.toEqual(['Wearing']);
  });

  it('tolerates a save with no state history', async () => {
    const noHistory = { id: 's', name: 'No History', currentState: state('model-a') } as unknown as SaveRecord;
    vi.mocked(getAllSaveRecords).mockResolvedValue([noHistory]);
    await expect(findSavesUsingModel('model-a')).resolves.toEqual(['No History']);
  });

  it('does not match the default sentinel against a library id', async () => {
    vi.mocked(getAllSaveRecords).mockResolvedValue([save('Default Avatar', 'default')]);
    await expect(findSavesUsingModel('model-a')).resolves.toEqual([]);
  });

  it('reports no usage rather than throwing when the save database cannot be read', async () => {
    // A delete must not be blocked by an unreadable save DB; the warning just loses its detail.
    vi.mocked(getAllSaveRecords).mockRejectedValue(new Error('IndexedDB unavailable'));
    await expect(findSavesUsingModel('model-a')).resolves.toEqual([]);
  });
});
