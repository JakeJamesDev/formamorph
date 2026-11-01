import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SaveRecord } from '@/types';
import { toastTexts, openLatestDetails } from '@/test/toastText';

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() }));
vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));

const db = vi.hoisted(() => ({
  getAllSaveRecords: vi.fn(), deleteSaveRecord: vi.fn(), putSaveRecord: vi.fn(),
  migrateLegacySaves: vi.fn(), getOrder: vi.fn(), setOrder: vi.fn(),
}));
vi.mock('./dbUtils', () => db);

const serializeJsonBlob = vi.hoisted(() => vi.fn());
vi.mock('../../lib/jsonFileWorkerUtils', () => ({ serializeJsonBlob, terminateWorker: vi.fn() }));
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));
vi.mock('../../services/WorldStorageService', () => ({
  default: { getWorldMetadata: () => Promise.resolve([{ id: 'w1', name: 'Sedge Landing' }]) },
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
});

const renderDialog = (onLoad = vi.fn()) => {
  render(<LoadGameDialog open onOpenChange={() => {}} current={{ id: 'w1', name: 'Sedge Landing' }} onLoad={onLoad} />);
  return screen.findByText('Harbor Night');
};

const expectToast = (headline: string, cause: string) => {
  expect(toastTexts(toast.error)).toEqual([`${headline}View Details →`]);
  expect(openLatestDetails(toast.error)?.details).toContain(cause);
};

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
