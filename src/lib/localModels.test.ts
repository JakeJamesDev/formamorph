import { describe, it, expect } from 'vitest';
import {
  LOCAL_MODELS, VRAM_TIERS, groupModelsByFit, repoOf, formatReleased, formatDownloads, formatModelSize,
  type VramTier,
} from './localModels';

describe('localModels catalog', () => {
  it('every model fits its tier ceiling', () => {
    const cap = Object.fromEntries(VRAM_TIERS.map((t) => [t.value, t.maxMB]));
    for (const m of LOCAL_MODELS) {
      expect(m.sizeBytes / 1_000_000, m.id).toBeLessThanOrEqual(cap[m.tier]);
    }
  });

  it('every VRAM tier offers at least one model', () => {
    // Each tier is a tab in the desktop model picker, so an empty one ships as a dead tab with nothing to
    // download. Screening cut three of the four ≤4GB entries at once (2026-07-17), which left that tier on a
    // single model — one more removal would empty it. Retire the tier deliberately rather than by attrition.
    for (const tier of VRAM_TIERS) {
      const inTier = LOCAL_MODELS.filter((m) => m.tier === tier.value);
      expect(inTier.length, `tier ${tier.value} (${tier.label}) has no models`).toBeGreaterThan(0);
    }
  });

  it('every model id is unique', () => {
    const ids = LOCAL_MODELS.map((m) => m.id);
    expect(new Set(ids).size, `duplicate id in: ${ids.join(', ')}`).toBe(ids.length);
  });

  it('entries are grouped by tier (contiguous), so the per-tier recommendation is well-defined', () => {
    // The UI recommends a tier's FIRST entry and lists in array order, best-first by screen rank. That only
    // holds if each tier's models are contiguous — an entry dropped into the wrong tier block would silently
    // change which model is recommended. Guards against a tier being split across the array.
    const seen = new Set<string>();
    let prev: string | null = null;
    for (const m of LOCAL_MODELS) {
      if (m.tier !== prev) {
        expect(seen.has(m.tier), `tier '${m.tier}' is split — group all its entries together`).toBe(false);
        seen.add(m.tier);
        prev = m.tier;
      }
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
    // Rounding must pick the unit: these would read '1000.0K' / '999.9K' if the K branch rounded up into 4 digits.
    expect(formatDownloads(999_960)).toBe('1.0M');
    expect(formatDownloads(999_949)).toBe('999.9K');
  });

  it('formatModelSize is GB-aware', () => {
    expect(formatModelSize(4_920_000_000)).toBe('4.9 GB');
    expect(formatModelSize(2_500_000_000)).toBe('2.5 GB');
    expect(formatModelSize(250_000_000)).toBe('250 MB');
    expect(formatModelSize(512_000)).toBe('512 KB');
  });

  it('formatModelSize picks each unit from the rounded value', () => {
    // Both boundaries round up into the next unit; neither may render four digits of the smaller one.
    expect(formatModelSize(999_960_000)).toBe('1.0 GB'); // not '1000 MB'
    expect(formatModelSize(999_499_999)).toBe('999 MB');
    expect(formatModelSize(999_500)).toBe('1 MB'); // not '1000 KB'
    expect(formatModelSize(999_499)).toBe('999 KB');
  });
});

describe('groupModelsByFit', () => {
  const TIERS: VramTier[] = VRAM_TIERS.map((t) => t.value);
  const rank = (t: VramTier) => TIERS.indexOf(t);
  const idsOf = (list: { id: string }[]) => list.map((m) => m.id);
  const tiersOf = (list: { tier: VramTier }[]) => [...new Set(list.map((m) => m.tier))];

  it.each(TIERS)('files every catalog entry into exactly one group for %s', (tier) => {
    // The gate shows all three sections and nothing else, so a model in two groups is a duplicate row and a
    // model in none is silently undownloadable.
    const g = groupModelsByFit(tier);
    const all = idsOf([...g.bestFit, ...g.alsoFits, ...g.tooBig]);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(idsOf(LOCAL_MODELS)));
  });

  it.each(TIERS)('groups %s by fit against the detected tier', (tier) => {
    const g = groupModelsByFit(tier);
    for (const m of g.bestFit) expect(m.tier, m.id).toBe(tier);
    for (const m of g.alsoFits) expect(rank(m.tier), m.id).toBeLessThan(rank(tier));
    for (const m of g.tooBig) expect(rank(m.tier), m.id).toBeGreaterThan(rank(tier));
  });

  it.each(TIERS)('recommends the first catalog entry of the detected tier (%s)', (tier) => {
    // Catalog order is the only quality ranking; the tier's first entry is its top pick.
    const g = groupModelsByFit(tier);
    expect(g.recommended).toBe(g.bestFit[0]);
    expect(g.recommended?.id).toBe(LOCAL_MODELS.find((m) => m.tier === tier)?.id);
  });

  it('lists smaller models nearest tier first, keeping catalog order inside a tier', () => {
    const g = groupModelsByFit('unlimited');
    expect(tiersOf(g.alsoFits)).toEqual(['tier16', 'tier8', 'tier4']);
    expect(idsOf(g.alsoFits.filter((m) => m.tier === 'tier8')))
      .toEqual(idsOf(LOCAL_MODELS.filter((m) => m.tier === 'tier8')));
  });

  it('lists too-big models nearest tier first', () => {
    expect(tiersOf(groupModelsByFit('tier4').tooBig)).toEqual(['tier8', 'tier16', 'unlimited']);
  });

  it('leaves the outer groups empty at the ends of the tier range', () => {
    expect(groupModelsByFit('tier4').alsoFits).toEqual([]);
    expect(groupModelsByFit('unlimited').tooBig).toEqual([]);
  });
});
