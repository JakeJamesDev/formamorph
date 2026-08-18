/**
 * Format is decided by bytes, not by the label a data-URL happens to carry. The founding case is real: a
 * bundled world ships a JPEG marked image/png, which the label-trusting pipeline flagged as convertible
 * forever — the encoder's grow-guard kept it every run, and the row could never clear.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  dataUrlRealMime,
  isConvertibleImage,
  reencodeKeepsAnimation,
  relabelDataUrl,
  sniffDataUrlMime,
} from './imageBytes';

const dataUrl = (label: string, bytes: number[]): string =>
  `data:${label};base64,${Buffer.from(bytes).toString('base64')}`;

// Real magic numbers, padded to the 12 bytes the sniffer reads.
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const BMP = [0x42, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
const UNKNOWN = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b];

afterEach(() => vi.unstubAllGlobals());

describe('sniffDataUrlMime', () => {
  it('reads every signature the pipeline handles, whatever the label claims', () => {
    expect(sniffDataUrlMime(dataUrl('image/png', JPEG))).toBe('image/jpeg');
    expect(sniffDataUrlMime(dataUrl('image/jpeg', PNG))).toBe('image/png');
    expect(sniffDataUrlMime(dataUrl('image/png', GIF))).toBe('image/gif');
    expect(sniffDataUrlMime(dataUrl('image/png', WEBP))).toBe('image/webp');
    expect(sniffDataUrlMime(dataUrl('image/png', BMP))).toBe('image/bmp');
  });

  it('answers nothing for unrecognized bytes, a non-base64 payload, or a too-short one', () => {
    expect(sniffDataUrlMime(dataUrl('image/png', UNKNOWN))).toBe('');
    expect(sniffDataUrlMime('data:image/svg+xml,<svg/>')).toBe('');
    expect(sniffDataUrlMime('data:image/png;base64,AAAA')).toBe('');
  });
});

describe('dataUrlRealMime', () => {
  it('overrides the label when the bytes disagree', () => {
    expect(dataUrlRealMime(dataUrl('image/png', JPEG))).toBe('image/jpeg');
  });

  it('falls back to the label when the bytes say nothing', () => {
    expect(dataUrlRealMime(dataUrl('image/png', UNKNOWN))).toBe('image/png');
  });
});

describe('isConvertibleImage decides by bytes', () => {
  it('refuses a JPEG hiding under a PNG label — the offer it would earn can never be honored', () => {
    expect(isConvertibleImage(dataUrl('image/png', JPEG))).toBe(false);
  });

  it('rescues a PNG hiding under a JPEG label — it genuinely shrinks', () => {
    expect(isConvertibleImage(dataUrl('image/jpeg', PNG))).toBe(true);
  });
});

describe('reencodeKeepsAnimation decides by bytes', () => {
  it('protects a GIF mislabeled as PNG on a browser with no frame decoder', () => {
    expect('ImageDecoder' in globalThis).toBe(false);
    expect(reencodeKeepsAnimation(dataUrl('image/png', GIF))).toBe(false);
  });

  it('clears the same GIF where frames can be decoded', () => {
    vi.stubGlobal('ImageDecoder', class {});
    expect(reencodeKeepsAnimation(dataUrl('image/png', GIF))).toBe(true);
  });
});

describe('relabelDataUrl', () => {
  it('rewrites a lying label to what the bytes say, leaving the payload alone', () => {
    const lying = dataUrl('image/png', JPEG);
    const honest = relabelDataUrl(lying);
    expect(honest.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(honest.slice(honest.indexOf(','))).toBe(lying.slice(lying.indexOf(',')));
  });

  it('returns the same string for an honest label or unrecognizable bytes', () => {
    const honest = dataUrl('image/png', PNG);
    expect(relabelDataUrl(honest)).toBe(honest);
    const unknown = dataUrl('image/png', UNKNOWN);
    expect(relabelDataUrl(unknown)).toBe(unknown);
  });
});
