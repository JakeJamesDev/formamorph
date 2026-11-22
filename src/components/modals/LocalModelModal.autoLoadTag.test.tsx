// Storage is real (in-memory): SettingsProvider reads it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { saveInstalledOrder } from '@/lib/installedModelOrder';
import type { LocalInstalledModel } from '@/lib/imageGen/desktop';
import { LocalModelModal } from './LocalModelModal';

const model = (fileName: string): LocalInstalledModel => ({
  id: fileName, fileName, subpath: '', size: 1000, path: `D:/models/${fileName}`, source: 'root', projector: null,
});
const installed = [model('first.gguf'), model('second.gguf'), model('third.gguf')];

/** The desktop bridge the manager reads on open. */
function stubDesktop() {
  window.formamorphDesktop = {
    fetch: () => Promise.resolve({ ok: true, status: 200, body: '' }),
    vramStats: () => Promise.resolve({ gpus: [{ name: 'GPU', totalMB: 8192, usedMB: 0 }], processes: [], selfPid: null }),
    llm: {
      status: () => new Promise(() => {}),
      onStatus: () => () => {},
      listInstalled: () => Promise.resolve(installed),
      listPartials: () => Promise.resolve([]),
      getLocations: () => Promise.resolve({ modelsDir: 'D:/models', downloadDir: null, defaultDir: 'D:/models', externalDir: null, searchSubfolders: true, lmStudioDir: null }),
      freeSpace: () => Promise.resolve(null),
      onDownloadProgress: () => () => {},
      onMoveProgress: () => () => {},
    },
    // Only the bridge members the manager reads; the full bridge type has dozens more.
  } as unknown as Window['formamorphDesktop'];
}

const open = () => render(<SettingsProvider><LocalModelModal open onOpenChange={() => {}} /></SettingsProvider>);
const row = async (name: string) => (await screen.findByText(name)).closest('div.rounded-md') as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
  stubDesktop();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
});

describe('the Auto-Load tag on the Installed list', () => {
  it('marks only the top model of the saved order', async () => {
    saveInstalledOrder([installed[2], installed[0], installed[1]]);
    open();
    expect(within(await row('third')).getByText('Auto-Load')).toBeTruthy();
    expect(within(await row('first')).queryByText('Auto-Load')).toBeNull();
    expect(within(await row('second')).queryByText('Auto-Load')).toBeNull();
  });

  it('marks no model while Auto-Load is off', async () => {
    localStorage.setItem('FORMAMORPH_localAutoLoad', 'false');
    open();
    await row('first');
    expect(screen.queryByText('Auto-Load', { selector: 'span' })).toBeNull();
  });
});
