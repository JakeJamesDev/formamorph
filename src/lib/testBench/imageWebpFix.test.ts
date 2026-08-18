/**
 * The Fix's relabel pass: a data-URL whose label lies about its bytes is corrected to the truth, counted,
 * and written back — so the mislabeled JPEG that kept its row alive forever clears in one press.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const reencodeImageDataUrl = vi.fn<(url: string) => Promise<string>>();
vi.mock('@/lib/imageOptim', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/imageOptim')>()),
  reencodeImageDataUrl: (url: string) => reencodeImageDataUrl(url),
}));

const { convertWorldImagesToWebp, describeWebpFixRun } = await import('./imageWebpFix');
import type { RuleWorld } from './rules';

const dataUrl = (label: string, bytes: number[]): string =>
  `data:${label};base64,${Buffer.from(bytes).toString('base64')}`;

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];

const worldWithThumbnail = (thumbnail: string): RuleWorld => ({
  worldOverview: { thumbnail },
  entities: [],
  locations: [],
} as unknown as RuleWorld);

beforeEach(() => {
  vi.clearAllMocks();
  reencodeImageDataUrl.mockResolvedValue('data:image/webp;base64,encoded');
});

describe('convertWorldImagesToWebp — correcting a lying format label', () => {
  it('relabels a JPEG marked image/png and writes the world back, without encoding anything', async () => {
    const run = await convertWorldImagesToWebp(worldWithThumbnail(dataUrl('image/png', JPEG)));
    expect(run.world.worldOverview?.thumbnail?.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(run).toMatchObject({ relabeled: 1, converted: 0, kept: 0 });
    expect(reencodeImageDataUrl).not.toHaveBeenCalled();
  });

  it('relabels and still converts an image whose bytes are genuinely convertible', async () => {
    const run = await convertWorldImagesToWebp(worldWithThumbnail(dataUrl('image/jpeg', PNG)));
    expect(run.world.worldOverview?.thumbnail).toBe('data:image/webp;base64,encoded');
    expect(run).toMatchObject({ relabeled: 1, converted: 1 });
    // The encoder is handed the corrected URL, not the lying one.
    expect(reencodeImageDataUrl).toHaveBeenCalledWith(dataUrl('image/png', PNG));
  });

  it('leaves an honestly labeled world untouched, by reference', async () => {
    const world = worldWithThumbnail(dataUrl('image/jpeg', JPEG));
    const run = await convertWorldImagesToWebp(world);
    expect(run.world).toBe(world);
    expect(run.relabeled).toBe(0);
  });
});

describe('describeWebpFixRun — saying what a relabel-only run did', () => {
  it('explains a run that only corrected labels, so a row vanishing without a conversion reads as done', () => {
    expect(describeWebpFixRun({ world: {} as RuleWorld, converted: 0, kept: 0, skippedAnimated: 0, relabeled: 2 }))
      .toBe('Corrected 2 images whose format labels didn’t match their bytes.');
  });

  it('stays silent when nothing was relabeled and everything offered converted', () => {
    expect(describeWebpFixRun({ world: {} as RuleWorld, converted: 3, kept: 0, skippedAnimated: 0, relabeled: 0 }))
      .toBe('');
  });
});
