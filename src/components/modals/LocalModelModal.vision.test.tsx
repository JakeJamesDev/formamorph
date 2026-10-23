// Storage is real (in-memory): SettingsProvider reads it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { LocalModelModal } from './LocalModelModal';
import { LOCAL_MODELS, downloadBytes, formatModelSize, projectorFileName } from '@/lib/localModels';
import type { LocalDownloadOptions, LocalInstalledModel, LocalPartial } from '@/lib/imageGen/desktop';

const VISION = LOCAL_MODELS.find((m) => m.projector && m.tier === 'tier8')!;
const TEXT = LOCAL_MODELS.find((m) => !m.projector && m.tier === 'tier8')!;

const installedRow = (fileName: string, projector: string | null): LocalInstalledModel => ({
  id: fileName, fileName, subpath: '', size: 1000, path: `D:/models/${fileName}`, source: 'root', projector,
});

let downloads: LocalDownloadOptions[] = [];

/** The desktop bridge the manager reads on open: installed models, partials, folders, and the download. */
function stubDesktop({ installed = [], partials = [] }: { installed?: LocalInstalledModel[]; partials?: LocalPartial[] }) {
  window.formamorphDesktop = {
    fetch: () => Promise.resolve({ ok: true, status: 200, body: '' }),
    vramStats: () => Promise.resolve({ gpus: [{ name: 'GPU', totalMB: 8192, usedMB: 0 }], processes: [], selfPid: null }),
    llm: {
      status: () => new Promise(() => {}),
      onStatus: () => () => {},
      listInstalled: () => Promise.resolve(installed),
      listPartials: () => Promise.resolve(partials),
      getLocations: () => Promise.resolve({ modelsDir: 'D:/models', downloadDir: null, defaultDir: 'D:/models', externalDir: null, searchSubfolders: true, lmStudioDir: null }),
      freeSpace: () => Promise.resolve(null),
      download: (opts: LocalDownloadOptions) => { downloads.push(opts); return Promise.resolve({ path: '' }); },
      onDownloadProgress: () => () => {},
      onMoveProgress: () => () => {},
    },
    // Only the bridge members the manager reads; the full bridge type has dozens more.
  } as unknown as Window['formamorphDesktop'];
}

const open = () => render(<SettingsProvider><LocalModelModal open onOpenChange={() => {}} /></SettingsProvider>);

/** A Recommended-tab card, found by its catalog name. */
const card = async (name: string) => (await screen.findByText(name)).closest('div.rounded-md') as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  downloads = [];
  // Live download counts are a network nicety; the catalog's snapshot stands in.
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
});

describe('local model manager: vision models', () => {
  it('marks an installed model that has a projector, and only that one', async () => {
    stubDesktop({ installed: [installedRow('seeing.gguf', 'D:/models/mmproj-seeing.gguf'), installedRow('blind.gguf', null)] });
    open();
    const seeing = (await screen.findByText('seeing')).closest('div.rounded-md') as HTMLElement;
    const blind = screen.getByText('blind').closest('div.rounded-md') as HTMLElement;
    expect(within(seeing).getByText('Vision')).toBeInTheDocument();
    expect(within(blind).queryByText('Vision')).toBeNull();
  });

  it('marks a recommended vision entry and offers the model and projector as one download', async () => {
    stubDesktop({});
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Recommended' }));
    const vision = await card(VISION.name);
    expect(within(vision).getByText('Vision')).toBeInTheDocument();
    expect(within(await card(TEXT.name)).queryByText('Vision')).toBeNull();

    await userEvent.click(within(vision).getByRole('button', { name: `Download (${formatModelSize(downloadBytes(VISION))})` }));
    expect(downloads).toEqual([expect.objectContaining({ url: VISION.url, fileName: VISION.fileName, projector: VISION.projector })]);
  });

  it('offers a resume for a vision model on disk without its projector', async () => {
    const received = 4096;
    stubDesktop({
      installed: [{ ...installedRow(VISION.fileName, null), size: VISION.sizeBytes }],
      partials: [{ fileName: projectorFileName(VISION.fileName), received }],
    });
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Recommended' }));
    const vision = await card(VISION.name);
    const pct = Math.round(((VISION.sizeBytes + received) / downloadBytes(VISION)) * 100);
    await userEvent.click(within(vision).getByRole('button', { name: `Resume (${pct}%)` }));
    expect(downloads).toEqual([expect.objectContaining({ fileName: VISION.fileName, projector: VISION.projector })]);
  });
});
