import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { readEnginePin, PIN_PATHS } = require('./enginePin.cjs');

describe('readEnginePin', () => {
  it('reads the tag, asset names, digests and plain release-download URLs from the dev pin', () => {
    const pin = readEnginePin();
    expect(pin.tag).toMatch(/^b\d+$/);
    expect(pin.cuda.assets).toHaveLength(2);
    for (const a of pin.cuda.assets) {
      expect(a.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(a.size).toBeGreaterThan(0);
      expect(a.unpackedSize).toBeGreaterThan(0);
      expect(a.url).toBe(`https://github.com/ggml-org/llama.cpp/releases/download/${pin.tag}/${a.name}`);
    }
  });

  it('prefers the packaged copy beside the bundled builds and falls back to the dev pin', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'enginepin-'));
    try {
      const packaged = path.join(dir, 'llamaServerPin.json');
      await writeFile(packaged, JSON.stringify({ tag: 'b1', cuda: { assets: [{ name: 'a.zip', digest: 'sha256:x' }] } }));
      expect(readEnginePin([packaged, PIN_PATHS[1]]).tag).toBe('b1');
      const dev = JSON.parse(await readFile(PIN_PATHS[1], 'utf8'));
      expect(readEnginePin([path.join(dir, 'missing.json'), PIN_PATHS[1]]).tag).toBe(dev.tag);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
