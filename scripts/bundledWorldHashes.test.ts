import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { contentHash } from '@/lib/contentHash';
import { bundledWorldHashes } from './bundledWorldHashes.mjs';
import { strippedWorldText } from './stripSeededWorlds.mjs';

const world = path.join(process.cwd(), 'src/defaultworlds/open-chat.json').replaceAll('\\', '/');
const source = readFileSync(world, 'utf8');
const SHIPPED = 'the shipped text';

type Command = 'build' | 'serve';

/** The hash module's source under one Vite command. */
async function hashModule(command: Command, id = `${world}?raw&world-hash`) {
  const plugin = bundledWorldHashes(async () => SHIPPED) as Plugin;
  (plugin.configResolved as unknown as (config: { command: Command }) => void)({ command });
  type Load = (this: { addWatchFile: () => void }, id: string) => Promise<string | null>;
  return (plugin.load as unknown as Load).call({ addWatchFile: () => {} }, id);
}

const moduleOf = (text: string) => `export default ${JSON.stringify(contentHash(text))}`;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('bundledWorldHashes', () => {
  it('hashes the shipped text in a production build', async () => {
    expect(await hashModule('build')).toBe(moduleOf(SHIPPED));
  });

  it('hashes the source file in a lossless build', async () => {
    vi.stubEnv('FORMAMORPH_LOSSLESS_WORLDS', '1');
    expect(await hashModule('build')).toBe(moduleOf(source));
  });

  it('hashes the source file on the dev server', async () => {
    vi.stubEnv('VITEST', '');
    expect(await hashModule('serve')).toBe(moduleOf(source));
  });

  it('hashes the stripped text under vitest', async () => {
    expect(await hashModule('serve')).toBe(moduleOf(strippedWorldText(source)));
  });

  it("leaves a world's text and every other module alone", async () => {
    expect(await hashModule('serve', `${world}?raw`)).toBeNull();
    expect(await hashModule('serve', world)).toBeNull();
  });
});
