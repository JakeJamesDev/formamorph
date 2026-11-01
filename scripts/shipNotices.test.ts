import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { shipNotices } from './shipNotices.mjs';

describe('shipNotices', () => {
  it('emits the notices file at the root of a build', () => {
    const plugin = shipNotices('.');
    const emitFile = vi.fn();
    (plugin.generateBundle as unknown as (this: { emitFile: typeof emitFile }) => void).call({ emitFile });
    expect(emitFile).toHaveBeenCalledTimes(1);
    const [asset] = emitFile.mock.calls[0];
    expect(asset.fileName).toBe('THIRD-PARTY-NOTICES.md');
    expect(asset.source === readFileSync('THIRD-PARTY-NOTICES.md', 'utf8')).toBe(true);
    expect(plugin.apply).toBe('build');
  });

  it('is in the app build', () => {
    expect(readFileSync('vite.config.js', 'utf8')).toMatch(/plugins: \[[^\]]*shipNotices\(__dirname\)/);
  });
});
