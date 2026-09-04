import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stand-in for the Capacitor bridge. `native` flips the platform; the arrays record what the app asked
// the device to do. Plain recorders, because a `vi.hoisted` body cannot reference `vi`.
const bridge = vi.hoisted(() => ({
  native: false,
  writes: [] as { path: string; data: string; directory: string }[],
  attempts: [] as { title?: string; files?: string[] }[],
  shares: [] as { title?: string; files?: string[] }[],
  toasts: [] as string[],
  shareError: null as string | null,
  reset() {
    bridge.native = false;
    bridge.writes = [];
    bridge.attempts = [];
    bridge.shares = [];
    bridge.toasts = [];
    bridge.shareError = null;
  },
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => bridge.native } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: (options: { path: string; data: string; directory: string }) => {
      bridge.writes.push(options);
      return Promise.resolve({ uri: `file:///data/user/0/ai.formamorph.app/cache/${options.path}` });
    },
  },
}));
vi.mock('@capacitor/share', () => ({
  Share: {
    share: (options: { title?: string; files?: string[] }) => {
      bridge.attempts.push(options);
      if (bridge.shareError) return Promise.reject(new Error(bridge.shareError));
      bridge.shares.push(options);
      return Promise.resolve({ activityType: 'com.google.android.documentsui' });
    },
  },
}));
vi.mock('react-toastify', () => ({ toast: { error: (message: string) => bridge.toasts.push(message) } }));

import { downloadBlob } from './downloadBlob';

/** Bytes of a base64 payload, so a test can compare what reached the device with what it exported. */
const decode = (base64: string) => [...atob(base64)].map((character) => character.charCodeAt(0));

/** Resolves after the pending microtasks, so a rejection handler has run before a test asserts silence. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const clicks: { href: string; download: string }[] = [];

beforeEach(() => {
  bridge.reset();
  clicks.length = 0;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    clicks.push({ href: this.href, download: this.download });
  });
});

afterEach(() => vi.restoreAllMocks());

describe('downloadBlob', () => {
  it('saves through an anchor when there is no bridge', () => {
    downloadBlob(new Blob(['{"name":"Sedge Landing"}'], { type: 'application/json' }), 'Sedge Landing.json');

    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe('Sedge Landing.json');
    expect(clicks[0].href).toMatch(/^blob:/);
    expect(bridge.writes).toEqual([]);
    expect(bridge.shares).toEqual([]);
  });

  it('opens the share sheet with the exported file when the bridge is there', async () => {
    bridge.native = true;

    downloadBlob(new Blob(['{"name":"Sedge Landing"}'], { type: 'application/json' }), 'Sedge Landing.json');

    await vi.waitFor(() => expect(bridge.shares).toHaveLength(1));
    expect(bridge.writes).toHaveLength(1);
    expect(bridge.writes[0].directory).toBe('CACHE');
    expect(bridge.writes[0].path).toBe('Sedge Landing.json');
    expect(bridge.shares[0].files).toEqual(['file:///data/user/0/ai.formamorph.app/cache/Sedge Landing.json']);
    expect(clicks).toEqual([]);
  });

  it('hands the share sheet the bytes it was given', async () => {
    bridge.native = true;
    // A character card is a WebP, so the payload is binary and not valid UTF-8.
    const card = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0xff, 0xfe, 0x01]);

    downloadBlob(new Blob([card], { type: 'image/webp' }), 'Wren.webp');

    await vi.waitFor(() => expect(bridge.shares).toHaveLength(1));
    expect(decode(bridge.writes[0].data)).toEqual([...card]);
  });

  it('writes one cache file for a name that reads like a path', async () => {
    bridge.native = true;

    downloadBlob(new Blob(['{}'], { type: 'application/json' }), 'saves/Deep Run 1.json');

    await vi.waitFor(() => expect(bridge.shares).toHaveLength(1));
    expect(bridge.writes[0].path).toBe('saves-Deep Run 1.json');
    expect(bridge.shares[0].files).toEqual([
      'file:///data/user/0/ai.formamorph.app/cache/saves-Deep Run 1.json',
    ]);
  });

  it('reports a share that fails in its own words', async () => {
    bridge.native = true;
    // The plugin's rejections name its internals, so none of this text should reach the player.
    bridge.shareError = "Can't share while sharing is in progress";
    vi.spyOn(console, 'error').mockImplementation(() => {});

    downloadBlob(new Blob(['{}'], { type: 'application/json' }), 'Sedge Landing.json');

    await vi.waitFor(() => expect(bridge.toasts).toHaveLength(1));
    expect(bridge.toasts[0]).toBe('Could not share Sedge Landing.json.');
  });

  it('stays quiet when the player dismisses the share sheet', async () => {
    bridge.native = true;
    // Android rejects a dismissed chooser the same way it rejects a failure.
    bridge.shareError = 'Share canceled';

    downloadBlob(new Blob(['{}'], { type: 'application/json' }), 'Sedge Landing.json');

    await vi.waitFor(() => expect(bridge.attempts).toHaveLength(1));
    await settle();
    expect(bridge.toasts).toEqual([]);
  });
});
