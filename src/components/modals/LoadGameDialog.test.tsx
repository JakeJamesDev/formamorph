import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SaveRecord } from '@/types';
import { toastTexts, openLatestDetails } from '@/test/toastText';

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn(), warning: vi.fn() }));
vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));

const db = vi.hoisted(() => ({
  getAllSaveRecords: vi.fn(), deleteSaveRecord: vi.fn(), putSaveRecord: vi.fn(),
  migrateLegacySaves: vi.fn(), getOrder: vi.fn(), setOrder: vi.fn(),
}));
vi.mock('./dbUtils', () => db);

const serializeJsonBlob = vi.hoisted(() => vi.fn());
vi.mock('../../lib/jsonFileWorkerUtils', () => ({ serializeJsonBlob, terminateWorker: vi.fn() }));
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));
const worldMeta = vi.hoisted(() => ({ rows: [] as { id: string; name: string; supporterCopy?: unknown }[] }));
vi.mock('../../services/WorldStorageService', () => ({
  default: { getWorldMetadata: () => Promise.resolve(worldMeta.rows) },
}));

import { LoadGameDialog } from './LoadGameDialog';

const save: SaveRecord = {
  id: 's1', name: 'Harbor Night', worldId: 'w1',
  currentState: { worldName: 'Sedge Landing', timestamp: '2026-10-01T12:00:00Z', gameTime: 0 },
} as unknown as SaveRecord;

beforeEach(() => {
  Object.values(toast).forEach((f) => f.mockClear());
  Object.values(db).forEach((f) => f.mockReset());
  serializeJsonBlob.mockReset();
  db.getAllSaveRecords.mockResolvedValue([save]);
  db.getOrder.mockResolvedValue([]);
  db.migrateLegacySaves.mockResolvedValue(undefined);
  worldMeta.rows = [{ id: 'w1', name: 'Sedge Landing' }];
});

const renderDialog = (onLoad = vi.fn()) => {
  render(<LoadGameDialog open onOpenChange={() => {}} current={{ id: 'w1', name: 'Sedge Landing' }} onLoad={onLoad} />);
  return screen.findByText('Harbor Night');
};

const expectToast = (headline: string, cause: string) => {
  expect(toastTexts(toast.error)).toEqual([`${headline}View Details →`]);
  expect(openLatestDetails(toast.error)?.details).toContain(cause);
};

describe('importing saves', () => {
  const importSave = async (...files: File[]) => {
    await renderDialog();
    fireEvent.change(document.getElementById('save-upload')!, { target: { files } });
  };

  it('names a file that is not JSON, and keeps the parser text in View Details', async () => {
    await importSave(new File(['{"currentState":'], 'cut.json', { type: 'application/json' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toastTexts(toast.error)).toEqual(["Couldn't import cut.json.This isn't a valid save file.View Details →"]);
    expect(openLatestDetails(toast.error)?.details).toMatch(/JSON/);
    expect(db.putSaveRecord).not.toHaveBeenCalled();
  });

  it('names the file when storage is full', async () => {
    db.putSaveRecord.mockRejectedValue(Object.assign(new Error('Encountered full disk'), { name: 'QuotaExceededError' }));
    await importSave(new File([JSON.stringify(save)], 'harbor.json', { type: 'application/json' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toastTexts(toast.error)).toEqual(["Couldn't import harbor.json.The storage is full.View Details →"]);
    expect(openLatestDetails(toast.error)?.details).toContain('Encountered full disk');
  });

  it('stores a released save’s memory changes as the text edit layer only', async () => {
    db.putSaveRecord.mockResolvedValue(undefined);
    const released = {
      name: 'Harbor Night', version: '3.7.0', stateHistory: [],
      currentState: { worldName: 'Sedge Landing', timestamp: '2026-10-01T12:00:00Z', gameTime: 0 },
      memoryEdits: { t1: { text: 'Rewritten.', source: 'player' } },
      memoryDeleted: ['t2'],
    };
    await importSave(new File([JSON.stringify(released)], 'harbor.json', { type: 'application/json' }));

    await waitFor(() => expect(db.putSaveRecord).toHaveBeenCalledTimes(1));
    const stored = db.putSaveRecord.mock.calls[0][0] as Record<string, unknown>;
    expect(stored.turnTextEdits).toEqual({
      t1: { memory: { text: 'Rewritten.', source: 'player' } },
      t2: { memory: { source: 'player', deleted: true } },
    });
    expect('memoryEdits' in stored).toBe(false);
    expect('memoryDeleted' in stored).toBe(false);
    expect(stored.name).toBe('Harbor Night');
  });
});

describe('saves moved from another device', () => {
  const moved = { ...save, worldId: 'uploaded-other-device' } as SaveRecord;

  it('stores an imported save under the installed world with its name', async () => {
    db.putSaveRecord.mockResolvedValue(undefined);
    await renderDialog();
    const { id: _id, ...file } = moved;
    fireEvent.change(document.getElementById('save-upload')!, {
      target: { files: [new File([JSON.stringify(file)], 'harbor.json', { type: 'application/json' })] },
    });

    await waitFor(() => expect(db.putSaveRecord).toHaveBeenCalledTimes(1));
    expect(db.putSaveRecord.mock.calls[0][0]).toMatchObject({ worldId: 'w1' });
  });

  it('rebinds a stored save to the installed world and cold-loads it there', async () => {
    db.getAllSaveRecords.mockResolvedValue([moved]);
    db.putSaveRecord.mockResolvedValue(undefined);
    const onLoad = vi.fn();
    render(<LoadGameDialog open onOpenChange={() => {}} onLoad={onLoad} />);

    fireEvent.click(await screen.findByText('Sedge Landing'));
    fireEvent.click(await screen.findByText('Harbor Night'));

    await waitFor(() => expect(onLoad).toHaveBeenCalledWith('s1', 'w1'));
    expect(db.putSaveRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', worldId: 'w1' }));
  });
});

describe('save failures', () => {
  it('toasts a failed load and ends the busy state', async () => {
    const onLoad = vi.fn().mockRejectedValue(new Error('save store closed'));
    fireEvent.click(await renderDialog(onLoad));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expectToast("Couldn't load the save. Try again.", 'save store closed');
    await waitFor(() => expect(screen.queryByText('Loading the save…')).toBeNull());
  });

  it('toasts a failed export and ends the busy state', async () => {
    serializeJsonBlob.mockRejectedValue(new Error('worker crashed'));
    await renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Export save “Harbor Night”' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expectToast("Couldn't export the save. Try again.", 'worker crashed');
    await waitFor(() => expect(screen.queryByText(/for export…/)).toBeNull());
  });

  it('toasts a failed delete and keeps the save listed', async () => {
    db.deleteSaveRecord.mockRejectedValue(new Error('quota exceeded'));
    await renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Delete save “Harbor Night”' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expectToast("Couldn't delete the save. Try again.", 'quota exceeded');
    expect(screen.getByText('Harbor Night')).toBeInTheDocument();
  });
});

describe('Supporter Copy saves', () => {
  const exportButton = () => screen.getByRole('button', { name: 'Export save “Harbor Night”' });

  it('exports a save of a plain world', async () => {
    serializeJsonBlob.mockResolvedValue(new Blob(['{}']));
    await renderDialog();
    fireEvent.click(exportButton());
    await waitFor(() => expect(serializeJsonBlob).toHaveBeenCalledTimes(1));
  });

  it('shows Export disabled with the reason for a save of a Supporter Copy', async () => {
    worldMeta.rows = [{ id: 'w1', name: 'Sedge Landing', supporterCopy: { listingId: 'l1', accountId: 'a1', revision: 1 } }];
    await renderDialog();

    await waitFor(() => expect(exportButton()).toHaveAttribute('aria-disabled', 'true'));
    fireEvent.click(exportButton());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(serializeJsonBlob).not.toHaveBeenCalled();
  });

  it('keeps Export disabled for a stamped save after its world is removed', async () => {
    worldMeta.rows = [];
    db.getAllSaveRecords.mockResolvedValue([{ ...save, supporterCopy: { listingId: 'l1', accountId: 'a1', revision: 1 } }]);
    render(<LoadGameDialog open onOpenChange={() => {}} onLoad={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(0));
    const folder = screen.queryByText('Harbor Night') ?? (await screen.findByText(/Sedge Landing/));
    if (!screen.queryByText('Harbor Night')) fireEvent.click(folder);
    await waitFor(() => expect(exportButton()).toHaveAttribute('aria-disabled', 'true'));
    fireEvent.click(exportButton());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(serializeJsonBlob).not.toHaveBeenCalled();
  });
});
