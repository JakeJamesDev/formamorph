import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { mediaFixtureWorld } from '@/test/mediaFixture';
import { downloadBlob } from '@/lib/downloadBlob';
import { holdUnsavedWorld, unsavedWorldExportBlock } from '@/lib/unsavedWorld';

/** The Supporter Copy rule in the real World Editor: each export and the Media tab's Download. */

const marker = vi.hoisted(() => ({
  value: null as null | { listingId: string; accountId: string; revision: number },
  /** Holds the read unanswered, as a slow store would. */
  pending: false,
}));

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
    getSupporterCopy: vi.fn(() => (marker.pending ? new Promise(() => {}) : Promise.resolve(marker.value))),
  },
}));
vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(async () => new Blob()), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));
vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/views/ModelViewer', () => ({ default: () => <div data-testid="model-viewer" /> }));

const SUPPORTER = { listingId: 'listing-1', accountId: 'me', revision: 1 };

beforeEach(() => {
  marker.pending = false;
  localStorage.clear();
  vi.mocked(downloadBlob).mockClear();
  holdUnsavedWorld(null);
});

/** Mount the editor and let the marker read answer. */
const mount = async (supporter: boolean) => {
  marker.value = supporter ? SUPPORTER : null;
  const bench = renderWorldEditorBench(mediaFixtureWorld(), 'advanced');
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  return bench;
};

/** A blocked row or button: aria-disabled, a click does nothing, and hovering shows the reason. */
const expectBlocked = async (control: HTMLElement, reason: string) => {
  expect(control).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(control);
  await userEvent.hover(control);
  expect(await screen.findByText(reason, { selector: 'div' })).toBeInTheDocument();
};

const libraryMenuItem = (tab: RegExp, row: string, label: string) => {
  openEditorTab(tab);
  fireEvent.click(screen.getByText(row));
  fireEvent.click(screen.getByRole('button', { name: 'More library actions' }));
  return screen.getByRole('button', { name: label });
};

describe('a Supporter Copy in the World Editor', () => {
  it('disables Export World in the Save menu', async () => {
    await mount(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save options' }));
    await expectBlocked(await screen.findByRole('button', { name: 'Export World' }), "You can't export a Supporter world");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('disables an entity’s Export Entity…', async () => {
    await mount(true);
    await expectBlocked(libraryMenuItem(/Entities/, 'Odd Wick', 'Export Entity…'), "You can't export entities from a Supporter world");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('disables a book’s Export Dictionary…', async () => {
    await mount(true);
    await expectBlocked(libraryMenuItem(/Dictionary/, 'Fen Lore', 'Export Dictionary…'), "You can't export dictionaries from a Supporter world");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('disables Download in the Media tab', async () => {
    await mount(true);
    openEditorTab(/Media/);
    fireEvent.click(document.querySelector<HTMLElement>('[data-media-card="sound"]')!);
    const panel = document.querySelector<HTMLElement>('[data-media-panel]')!;
    await expectBlocked(within(panel).getByRole('button', { name: 'Download' }), "You can't download files from a Supporter world");
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('holds the unsaved world for the crash screen with the export blocked', async () => {
    const { ctx } = await mount(true);
    act(() => { ctx().updateWorldOverview({ description: 'Edited.' }); });
    await waitFor(() => expect(unsavedWorldExportBlock()).toEqual({ reason: "You can't export a Supporter world" }));
  });
});

describe('a world whose marker is still being read', () => {
  it('holds Export World until the answer comes', async () => {
    marker.pending = true;
    await mount(false);
    fireEvent.click(screen.getByRole('button', { name: 'Save options' }));
    await expectBlocked(await screen.findByRole('button', { name: 'Export World' }), 'Checking this world');
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('holds the unsaved world for the crash screen with no export', async () => {
    marker.pending = true;
    const { ctx } = await mount(false);
    act(() => { ctx().updateWorldOverview({ description: 'Edited.' }); });
    await waitFor(() => expect(unsavedWorldExportBlock()).toEqual({ reason: null }));
  });
});

describe('a plain world in the World Editor', () => {
  it('keeps every export and Download', async () => {
    const { ctx } = await mount(false);
    fireEvent.click(screen.getByRole('button', { name: 'Save options' }));
    expect(await screen.findByRole('button', { name: 'Export World' })).not.toHaveAttribute('aria-disabled');
    fireEvent.click(screen.getByRole('button', { name: 'Save options' }));

    expect(libraryMenuItem(/Entities/, 'Odd Wick', 'Export Entity…')).not.toHaveAttribute('aria-disabled');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    openEditorTab(/Media/);
    fireEvent.click(document.querySelector<HTMLElement>('[data-media-card="sound"]')!);
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-media-panel]')!).getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));

    act(() => { ctx().updateWorldOverview({ description: 'Edited.' }); });
    await waitFor(() => expect(unsavedWorldExportBlock()).toBeNull());
  });
});
