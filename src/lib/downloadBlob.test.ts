import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bridge = vi.hoisted(() => ({
  native: false,
  write: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => bridge.native },
  registerPlugin: (name: string) => {
    if (name !== 'FormamorphFileExport') throw new Error(`Unexpected plugin: ${name}`);
    return { save: bridge.save };
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: bridge.write, deleteFile: bridge.remove },
}));
vi.mock('react-toastify', () => ({ toast: { error: bridge.toast } }));

import { downloadBlob } from './downloadBlob';

beforeEach(() => {
  vi.resetAllMocks();
  bridge.native = true;
  bridge.write.mockImplementation(({ path }: { path: string }) => Promise.resolve({ uri: `file:///cache/${path}` }));
  bridge.save.mockResolvedValue(undefined);
  bridge.remove.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const exported = () => vi.waitFor(() => expect(bridge.remove).toHaveBeenCalledOnce());

describe('downloadBlob', () => {
  it('keeps browser downloads on the browser path', () => {
    bridge.native = false;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    downloadBlob(new Blob(['{}']), 'world.json');
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('world.json');
    expect(revoke).toHaveBeenCalledOnce();
    expect(bridge.write).not.toHaveBeenCalled();
    expect(bridge.save).not.toHaveBeenCalled();
  });

  it('passes the filename, MIME type, and unchanged JSON to the native save picker', async () => {
    const json = '{"name":"Sedge Landing"}';
    downloadBlob(new Blob([json], { type: 'application/json' }), 'Sedge Landing.json');
    await exported();
    const write = bridge.write.mock.calls[0][0];
    expect(atob(write.data)).toBe(json);
    expect(write).toMatchObject({ directory: 'CACHE', recursive: true });
    expect(bridge.save).toHaveBeenCalledWith({
      uri: `file:///cache/${write.path}`, filename: 'Sedge Landing.json', mimeType: 'application/json',
    });
    expect(bridge.remove).toHaveBeenCalledWith({ path: write.path, directory: 'CACHE' });
  });

  it('preserves binary exports without UTF-8 conversion', async () => {
    const bytes = [0x52, 0x49, 0, 0xff, 0xfe, 0x01];
    downloadBlob(new Blob([new Uint8Array(bytes)], { type: 'image/webp' }), 'Wren.webp');
    await exported();
    expect([...atob(bridge.write.mock.calls[0][0].data)].map(c => c.charCodeAt(0))).toEqual(bytes);
    expect(bridge.save.mock.calls[0][0].mimeType).toBe('image/webp');
  });

  it('uses a plain filename and a binary MIME fallback', async () => {
    downloadBlob(new Blob(['{}']), 'saves/Deep\\Run.json');
    await exported();
    expect(bridge.save.mock.calls[0][0]).toMatchObject({ filename: 'saves-Deep-Run.json', mimeType: 'application/octet-stream' });
  });

  it('keeps overlapping exports separate and retains bytes until the picker finishes', async () => {
    let finish: () => void = () => {};
    bridge.save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    downloadBlob(new Blob(['first']), 'same.json');
    await vi.waitFor(() => expect(bridge.save).toHaveBeenCalledOnce());
    expect(bridge.remove).not.toHaveBeenCalled();
    bridge.save.mockRejectedValueOnce(new Error('Finish the current file export first'));
    downloadBlob(new Blob(['second']), 'same.json');
    await vi.waitFor(() => expect(bridge.toast).toHaveBeenCalledOnce());
    const [first, second] = bridge.write.mock.calls.map(([options]) => options.path);
    expect(first).not.toBe(second);
    expect(bridge.remove).toHaveBeenCalledWith({ path: second, directory: 'CACHE' });
    expect(bridge.remove).not.toHaveBeenCalledWith({ path: first, directory: 'CACHE' });
    finish();
    await vi.waitFor(() => expect(bridge.remove).toHaveBeenCalledTimes(2));
  });

  it('cleans up quietly when the native picker resolves a cancellation', async () => {
    downloadBlob(new Blob(['{}']), 'world.json');
    await exported();
    expect(bridge.toast).not.toHaveBeenCalled();
  });

  it('reports native write failures and still cleans up', async () => {
    bridge.save.mockRejectedValue(new Error('Provider denied writing'));
    downloadBlob(new Blob(['{}']), 'world.json');
    await vi.waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Could not save world.json.'));
    expect(bridge.remove).toHaveBeenCalledOnce();
  });

  it('reports staging failures without opening the picker', async () => {
    bridge.write.mockRejectedValue(new Error('Disk full'));
    downloadBlob(new Blob(['{}']), 'world.json');
    await vi.waitFor(() => expect(bridge.toast).toHaveBeenCalledOnce());
    expect(bridge.save).not.toHaveBeenCalled();
  });

  it('does not turn a saved file into a failure when cache cleanup fails', async () => {
    bridge.remove.mockRejectedValue(new Error('Cache unavailable'));
    downloadBlob(new Blob(['{}']), 'world.json');
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalledOnce());
    expect(bridge.toast).not.toHaveBeenCalled();
  });

  it('reports unreadable exports before staging them', async () => {
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent('error'));
    });
    downloadBlob(new Blob(['{}']), 'world.json');
    await vi.waitFor(() => expect(bridge.toast).toHaveBeenCalledOnce());
    expect(bridge.write).not.toHaveBeenCalled();
  });
});
