import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { useLibraryDownload, type LibraryRecord } from './useLibraryDownload';
import { promptLibraryTarget } from './promptDownload';
import { PRESET_SCRIPT_TOOL_WARNING } from './tools/toolPack';
import * as fetchModule from './fetchCatalogContent';

const SERVER_STAMP = '2026-09-10T00:00:00.000Z';
const listing = (updatedAt = SERVER_STAMP) =>
  ({ _id: 'P1', kind: 'prompt', name: 'Listed', updated_at: updatedAt, author: { id: 'u1', username: 'Uploader' } });

const artifact = (appVersion = '2.0.3') =>
  ({ kind: 'formamorph-prompt-preset', formatVersion: 1, appVersion, name: 'Listed', style: 'markdown', values: { systemPrompt: 'Shared' } });

const copy = (patch: Partial<LibraryRecord> = {}): LibraryRecord =>
  ({ id: 'preset-1', name: 'Listed', sourceId: 'P1', sourceUpdatedAt: SERVER_STAMP, ...patch });

function setup(presets: LibraryRecord[] = [], scriptToolAdded = false) {
  const store = vi.fn().mockReturnValue({ scriptToolAdded });
  const hook = renderHook(() => useLibraryDownload(promptLibraryTarget({ presets, store }, '2.0.3')));
  return { hook, store };
}

beforeEach(() => {
  vi.spyOn(fetchModule, 'fetchCatalogContent').mockResolvedValue(artifact());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('prompt listing download state', () => {
  it('is none with no linked preset', () => {
    expect(setup([copy({ sourceId: undefined })]).hook.result.current.downloadStateFor(listing())).toBe('none');
  });

  it('is refresh when the held copy is current', () => {
    expect(setup([copy()]).hook.result.current.downloadStateFor(listing())).toBe('refresh');
  });

  it('is update when the server copy is newer', () => {
    expect(setup([copy({ sourceUpdatedAt: '2026-09-01T00:00:00.000Z' })]).hook.result.current.downloadStateFor(listing())).toBe('update');
  });

  it('ignores local edits', () => {
    expect(setup([copy({ dirty: true, editedAt: '2026-09-20T00:00:00.000Z' })]).hook.result.current.downloadStateFor(listing())).toBe('refresh');
  });
});

describe('prompt listing download', () => {
  it('stores the parsed preset under the held copy\'s id, with the link', async () => {
    const { hook, store } = setup([copy({ sourceUpdatedAt: '2026-09-01T00:00:00.000Z' })]);
    await act(async () => { hook.result.current.startDownload(listing()); });
    await waitFor(() => expect(store).toHaveBeenCalled());

    const [id, imported, link, name] = store.mock.calls[0];
    expect(id).toBe('preset-1');
    expect(imported.values.systemPrompt).toBe('Shared');
    expect(link).toMatchObject({ sourceId: 'P1', sourceUpdatedAt: SERVER_STAMP, sourceAuthorName: 'Uploader', dirty: false });
    expect(name).toBe('Listed');
  });

  it('asks before replacing an edited copy', async () => {
    const { hook, store } = setup([copy({ dirty: true })]);
    await act(async () => { hook.result.current.startDownload(listing()); });

    expect(store).not.toHaveBeenCalled();
    expect(hook.result.current.dirtyConfirm).not.toBeNull();
  });

  it('does not ask when the copy is clean', async () => {
    const { hook, store } = setup([copy({ dirty: false })]);
    await act(async () => { hook.result.current.startDownload(listing()); });
    await waitFor(() => expect(store).toHaveBeenCalled());

    expect(hook.result.current.dirtyConfirm).toBeNull();
  });

  it('shows the version mismatch warning', async () => {
    const warn = vi.spyOn(toast, 'warning');
    vi.mocked(fetchModule.fetchCatalogContent).mockResolvedValue(artifact('1.9.0'));
    const { hook, store } = setup();
    await act(async () => { hook.result.current.startDownload(listing()); });
    await waitFor(() => expect(store).toHaveBeenCalled());

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('This preset was made for Formamorph 1.9.0 (you have 2.0.3)'));
  });

  it('warns when the download added a Script Tool, and only then', async () => {
    const warn = vi.spyOn(toast, 'warning');
    for (const added of [false, true]) {
      const { hook, store } = setup([], added);
      await act(async () => { hook.result.current.startDownload(listing()); });
      await waitFor(() => expect(store).toHaveBeenCalled());
      expect(warn.mock.calls.flat().includes(PRESET_SCRIPT_TOOL_WARNING)).toBe(added);
    }
  });

  it('stores nothing when the content is not a preset', async () => {
    const error = vi.spyOn(toast, 'error');
    vi.mocked(fetchModule.fetchCatalogContent).mockResolvedValue({ kind: 'something-else' });
    const { hook, store } = setup();
    await act(async () => { hook.result.current.startDownload(listing()); });
    await waitFor(() => expect(error).toHaveBeenCalled());

    expect(store).not.toHaveBeenCalled();
  });
});
