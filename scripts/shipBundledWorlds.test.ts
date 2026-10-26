import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { shippedWorldText } from '@/lib/shippedWorld';
import { shipBundledWorlds } from './shipBundledWorlds.mjs';

const root = process.cwd();
const rampage = path.join(root, 'src/defaultworlds/rampage.json').replaceAll('\\', '/');
const context = { addWatchFile: () => {} };

type Hook = (this: typeof context, id: string) => Promise<string | null>;
const load = (plugin: Plugin, id: string) => (plugin.load as Hook).call(context, id);
const end = (plugin: Plugin) => (plugin.buildEnd as () => Promise<void>)();

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('shipBundledWorlds', () => {
  it('runs in production builds only, so the dev server serves the source files', () => {
    expect(shipBundledWorlds(root).apply).toBe('build');
  });

  it('bundles the shipped copy of a bundled world', async () => {
    const plugin = shipBundledWorlds(root);
    try {
      const shipped = await shippedWorldText(readFileSync(rampage, 'utf8'));
      expect(shipped).not.toBe(readFileSync(rampage, 'utf8'));
      expect(await load(plugin, `${rampage}?raw`)).toBe(`export default ${JSON.stringify(shipped)}`);
    } finally {
      await end(plugin);
    }
  }, 30_000);

  it('leaves the source file to Vite with FORMAMORPH_LOSSLESS_WORLDS=1', async () => {
    vi.stubEnv('FORMAMORPH_LOSSLESS_WORLDS', '1');
    expect(await load(shipBundledWorlds(root), `${rampage}?raw`)).toBeNull();
  });

  it('leaves every other module alone', async () => {
    const plugin = shipBundledWorlds(root);
    expect(await load(plugin, rampage)).toBeNull();
    expect(await load(plugin, path.join(root, 'src/lib/bundledFingerprints.json?raw'))).toBeNull();
  });
});
