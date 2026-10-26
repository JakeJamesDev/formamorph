/** The lossless test Downscale's trigger reads, from header bytes alone. Fixtures are sharp output unless marked. */
import { describe, it, expect } from 'vitest';
import { isLosslessImage } from './imageBytes';
import { WEBP_ALPHA_8x6, WEBP_ANIMATED_LOSSLESS, WEBP_LOSSLESS_4x13, WEBP_LOSSLESS_ICC, WEBP_LOSSY_9x5 } from '@/test/webpFixtures';

const PNG_4x3 = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGNg5BJpQMYMBAUAtRcHdW5NdIoAAAAASUVORK5CYII=';
// PNG_4x3 with an acTL chunk (valid CRC) spliced in after IHDR: the header an APNG carries.
const APNG_4x3 = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAACGFjVEwAAAACAAAAAPONk3AAAAAJcEhZcwAAA+gAAAPoAbV7UmsAAAARSURBVHicY2DkEmlAxgwEBQC1Fwd1bk10igAAAABJRU5ErkJggg==';
const JPEG_5x9 = '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAJAAUDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCTABKs/9k=';
// Hand-built: a BMP file header and BITMAPINFOHEADER, the bytes the sniff and the test read.
const BMP_1x1 = 'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wA=';
const GIF_1x1 = 'R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=';

const url = (mime: string, b64: string) => `data:${mime};base64,${b64}`;

describe('isLosslessImage', () => {
  it('counts a still PNG and a BMP by format', () => {
    expect(isLosslessImage(url('image/png', PNG_4x3))).toBe(true);
    expect(isLosslessImage(url('image/bmp', BMP_1x1))).toBe(true);
  });

  it('counts a WebP by its VP8L image chunk, simple or extended', () => {
    expect(isLosslessImage(url('image/webp', WEBP_LOSSLESS_4x13))).toBe(true);
    expect(isLosslessImage(url('image/webp', WEBP_LOSSLESS_ICC))).toBe(true);
  });

  it('never counts a lossy WebP, alpha or not, a JPEG, or a GIF', () => {
    expect(isLosslessImage(url('image/webp', WEBP_LOSSY_9x5))).toBe(false);
    expect(isLosslessImage(url('image/webp', WEBP_ALPHA_8x6))).toBe(false);
    expect(isLosslessImage(url('image/jpeg', JPEG_5x9))).toBe(false);
    expect(isLosslessImage(url('image/gif', GIF_1x1))).toBe(false);
  });

  it('never counts an animated image, lossless frames or not', () => {
    expect(isLosslessImage(url('image/webp', WEBP_ANIMATED_LOSSLESS))).toBe(false);
    expect(isLosslessImage(url('image/png', APNG_4x3))).toBe(false);
  });

  it('trusts the bytes over a wrong label', () => {
    expect(isLosslessImage(url('image/png', JPEG_5x9))).toBe(false);
    expect(isLosslessImage(url('image/jpeg', PNG_4x3))).toBe(true);
  });

  it('never counts a remote link', () => {
    expect(isLosslessImage('https://example.com/scene.png')).toBe(false);
  });
});
