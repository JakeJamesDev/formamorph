import { describe, it, expect } from 'vitest';
import { LOCAL_MODELS, VRAM_TIERS, repoOf, formatReleased, formatDownloads } from './localModels';

describe('localModels catalog', () => {
  it('every model fits its tier ceiling', () => {
    const cap = Object.fromEntries(VRAM_TIERS.map((t) => [t.value, t.maxMB]));
    for (const m of LOCAL_MODELS) {
      expect(m.sizeBytes / 1_000_000, m.id).toBeLessThanOrEqual(cap[m.tier]);
    }
  });

  it('every model has a release month and a download snapshot', () => {
    for (const m of LOCAL_MODELS) {
      expect(m.released, m.id).toMatch(/^\d{4}-\d{2}$/);
      expect(m.downloads, m.id).toBeGreaterThan(0);
    }
  });

  it('repoOf parses the HF repo from the resolve URL', () => {
    expect(repoOf(LOCAL_MODELS[0])).not.toContain('/resolve/');
    expect(repoOf(LOCAL_MODELS[0])).not.toContain('huggingface.co');
    expect(repoOf({ ...LOCAL_MODELS[0], url: 'https://huggingface.co/a/b-GGUF/resolve/main/x.gguf' })).toBe('a/b-GGUF');
  });

  it('formatReleased renders YYYY-MM as Mon YYYY, else passes through', () => {
    expect(formatReleased('2026-04')).toBe('Apr 2026');
    expect(formatReleased('2024-12')).toBe('Dec 2024');
    expect(formatReleased('nonsense')).toBe('nonsense');
  });

  it('formatDownloads is compact', () => {
    expect(formatDownloads(1_244_993)).toBe('1.2M');
    expect(formatDownloads(41_900)).toBe('41.9K');
    expect(formatDownloads(900)).toBe('900');
  });
});
