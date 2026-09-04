import { describe, expect, it, afterEach, vi } from 'vitest';
import { updateBridge } from '@/lib/updates/updateBridge';

type Shell = { formamorphDesktop?: unknown; Capacitor?: unknown };

/** Capacitor as the Android app has it: the native side declares the plugin, and registering it in JS has
 *  published the proxy under `Capacitor.Plugins`. */
function plantAndroidPlugin(plugin: unknown): void {
  (window as Shell).Capacitor = {
    isPluginAvailable: (name: string) => name === 'FormamorphUpdate',
    Plugins: { FormamorphUpdate: plugin },
  };
}

afterEach(() => {
  delete (window as Shell).formamorphDesktop;
  delete (window as Shell).Capacitor;
});

describe('the update bridge accessor', () => {
  it('finds nothing in the browser', () => {
    expect(updateBridge()).toBeNull();
  });

  it('finds the desktop shell where it is installed', () => {
    const update = { download: async () => {} };
    (window as Shell).formamorphDesktop = { update };

    expect(updateBridge()).toBe(update);
  });

  it('finds nothing in a shell whose updater is switched off', () => {
    // The bridge is optional inside the shell: a build with no updater exposes everything else without it.
    (window as Shell).formamorphDesktop = {};

    expect(updateBridge()).toBeNull();
  });

  it('finds the Android plugin where no desktop shell exists', () => {
    plantAndroidPlugin({ pending: async () => ({ version: null }) });

    expect(updateBridge()).not.toBeNull();
  });

  it('prefers the desktop shell over the Android plugin', () => {
    // Nothing ships both, but the order is the contract: the shell is the platform's own installer.
    const update = { download: async () => {} };
    (window as Shell).formamorphDesktop = { update };
    plantAndroidPlugin({ pending: async () => ({ version: null }) });

    expect(updateBridge()).toBe(update);
  });

  it('finds nothing in a build whose native side declares no such plugin', () => {
    // What the browser really looks like. Registering the plugin publishes its proxy on every platform,
    // so the proxy being there proves nothing — only the native declaration does, and the browser has
    // none. Trusting the proxy alone would put the update control on the web build.
    (window as Shell).Capacitor = {
      isPluginAvailable: () => false,
      Plugins: { FormamorphUpdate: { pending: async () => ({ version: null }) } },
    };

    expect(updateBridge()).toBeNull();
  });
});

describe('the Android adapter', () => {
  it('reports a staged download as a pending version', async () => {
    plantAndroidPlugin({ pending: async () => ({ version: '2.17.0' }) });

    await expect(updateBridge()?.pending()).resolves.toEqual({ version: '2.17.0' });
  });

  it('reports nothing staged as no pending version', async () => {
    plantAndroidPlugin({ pending: async () => ({ version: null }) });

    await expect(updateBridge()?.pending()).resolves.toBeNull();
  });

  it('hands the plugin the asset, the sidecar and the version', async () => {
    const download = vi.fn(async () => {});
    plantAndroidPlugin({ download });

    await updateBridge()?.download({
      version: 'v2.17.0',
      channel: 'stable',
      url: 'https://example.test/Formamorph-android.apk',
      sha512Url: 'https://example.test/Formamorph-android.apk.sha512',
    });

    expect(download).toHaveBeenCalledWith({
      version: 'v2.17.0',
      url: 'https://example.test/Formamorph-android.apk',
      sha512Url: 'https://example.test/Formamorph-android.apk.sha512',
    });
  });

  it('refuses a release that carries no Android download', async () => {
    const download = vi.fn(async () => {});
    plantAndroidPlugin({ download });

    // A desktop-only release reaches here with no URLs. Refusing surfaces the error state in the footer;
    // calling the plugin with an empty URL would fail later and further from the cause.
    await expect(updateBridge()?.download({ version: 'v2.17.0' })).rejects.toThrow(/no Android download/i);
    expect(download).not.toHaveBeenCalled();
  });

  it('passes the install outcome back', async () => {
    plantAndroidPlugin({ apply: async () => ({ needsPermission: true }) });

    await expect(updateBridge()?.apply()).resolves.toEqual({ needsPermission: true });
  });

  it('subscribes to progress and removes the listener on unsubscribe', async () => {
    const remove = vi.fn(async () => {});
    const addListener = vi.fn(async () => ({ remove }));
    plantAndroidPlugin({ addListener });

    const cb = vi.fn();
    const off = updateBridge()!.onProgress(cb);
    expect(addListener).toHaveBeenCalledWith('downloadProgress', cb);

    off();
    await vi.waitFor(() => expect(remove).toHaveBeenCalled());
  });

  it('subscribes to the finished download and removes the listener on unsubscribe', async () => {
    const remove = vi.fn(async () => {});
    const addListener = vi.fn(async () => ({ remove }));
    plantAndroidPlugin({ addListener });

    const cb = vi.fn();
    const off = updateBridge()!.onDownloaded(cb);
    expect(addListener).toHaveBeenCalledWith('downloaded', cb);

    off();
    await vi.waitFor(() => expect(remove).toHaveBeenCalled());
  });
});
