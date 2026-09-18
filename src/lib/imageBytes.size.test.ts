/**
 * The size comes from the header bytes alone, so a scene image can hold its box before the browser decodes
 * it. Fixtures are real encoder output (sharp), not hand-built headers.
 */
import { describe, it, expect } from 'vitest';
import { dataUrlImageSize } from './imageBytes';

const PNG_7x3 = 'iVBORw0KGgoAAAANSUhEUgAAAAcAAAADCAIAAADQoYKSAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGM4YWSEiRhIEAUAONkYnWEsh+MAAAAASUVORK5CYII=';
const JPEG_5x9 = '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAJAAUDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCTABKs/9k=';
// EXIF and ICC segments come first, so the frame header sits past the first kilobyte.
const JPEG_EXIF_6x4 = '/9j/4QH2RXhpZgAASUkqAAgAAAAHABIBAwABAAAAAQAAABoBBQABAAAAYgAAABsBBQABAAAAagAAACgBAwABAAAAAgAAABMCAwABAAAAAQAAAJiCAgAtAQAAcgAAAGmHBAABAAAAoAEAAAAAAAA4YwAA6AMAADhjAADoAwAAeHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4AAAGAACQBwAEAAAAMDIxMAGRBwAEAAAAAQIDAACgBwAEAAAAMDEwMAGgAwABAAAA//8AAAKgBAABAAAABgAAAAOgBAABAAAABAAAAAAAAAD/4gHwSUNDX1BST0ZJTEUAAQEAAAHgbGNtcwQgAABtbnRyUkdCIFhZWiAH4gADABQACQAOAB1hY3NwTVNGVAAAAABzYXdzY3RybAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWhhbmR56b9WWj4BtoMjhVVG90+qAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApkZXNjAAAA/AAAACRjcHJ0AAABIAAAACJ3dHB0AAABRAAAABRjaGFkAAABWAAAACxyWFlaAAABhAAAABRnWFlaAAABmAAAABRiWFlaAAABrAAAABRyVFJDAAABwAAAACBnVFJDAAABwAAAACBiVFJDAAABwAAAACBtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAYAAAAcAEMAQwAwAABYWVogAAAAAAAA9tYAAQAAAADTLXNmMzIAAAAAAAEMPwAABd3///MmAAAHkAAA/ZL///uh///9ogAAA9wAAMBxWFlaIAAAAAAAAG+gAAA48gAAA49YWVogAAAAAAAAYpYAALeJAAAY2lhZWiAAAAAAAAAkoAAAD4UAALbEcGFyYQAAAAAAAwAAAAJmaQAA8qcAAA1ZAAAT0AAAClv/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAYDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCTABKs/9k=';
// Progressive: the frame header is SOF2, not SOF0.
const JPEG_PROGRESSIVE_11x2 = '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wgARCAACAAsDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAVAQEBAAAAAAAAAAAAAAAAAAAEBv/aAAwDAQACEAMQAAABkgFX/8QAFBABAAAAAAAAAAAAAAAAAAAAEP/aAAgBAQABBQI//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAEP/aAAgBAQAGPwI//8QAFBABAAAAAAAAAAAAAAAAAAAAEP/aAAgBAQABPyE//9oADAMBAAIAAwAAABAL/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAEP/aAAgBAQABPxA//9k=';
const WEBP_LOSSY_9x5 = 'UklGRjoAAABXRUJQVlA4IC4AAACwAQCdASoJAAUAAUAmJaACdLoABDAAAP7vUS/xbSOhTIf/cHH/YOP+wcfumAAA';
const WEBP_LOSSLESS_4x13 = 'UklGRh4AAABXRUJQVlA4TBEAAAAvAwADAAdQmSJXpv+BiOh/AAA=';
const WEBP_ALPHA_8x6 = 'UklGRmQAAABXRUJQVlA4WAoAAAAQAAAABwAABQAAQUxQSA8AAAABB1DAiAgABOF/20RE/0MAVlA4IC4AAACwAQCdASoIAAYAAUAmJaACdLoABDAAAP7vUS/xbSOhTIf/cHH/YOP+wcfumAAA';

const url = (mime: string, b64: string) => `data:${mime};base64,${b64}`;

describe('dataUrlImageSize', () => {
  it('reads a PNG size from its IHDR chunk', () => {
    expect(dataUrlImageSize(url('image/png', PNG_7x3))).toEqual({ width: 7, height: 3 });
  });

  it('reads a baseline JPEG size from its frame header', () => {
    expect(dataUrlImageSize(url('image/jpeg', JPEG_5x9))).toEqual({ width: 5, height: 9 });
  });

  it('walks past EXIF and ICC segments to the JPEG frame header', () => {
    expect(dataUrlImageSize(url('image/jpeg', JPEG_EXIF_6x4))).toEqual({ width: 6, height: 4 });
  });

  it('reads a progressive JPEG size', () => {
    expect(dataUrlImageSize(url('image/jpeg', JPEG_PROGRESSIVE_11x2))).toEqual({ width: 11, height: 2 });
  });

  it('reads each WebP flavor: lossy, lossless, and extended', () => {
    expect(dataUrlImageSize(url('image/webp', WEBP_LOSSY_9x5))).toEqual({ width: 9, height: 5 });
    expect(dataUrlImageSize(url('image/webp', WEBP_LOSSLESS_4x13))).toEqual({ width: 4, height: 13 });
    expect(dataUrlImageSize(url('image/webp', WEBP_ALPHA_8x6))).toEqual({ width: 8, height: 6 });
  });

  it('trusts the bytes over a wrong label', () => {
    expect(dataUrlImageSize(url('image/png', JPEG_5x9))).toEqual({ width: 5, height: 9 });
  });

  it('returns null for a remote URL, a truncated header, or bytes it does not know', () => {
    expect(dataUrlImageSize('https://example.com/scene.png')).toBeNull();
    expect(dataUrlImageSize(url('image/png', PNG_7x3.slice(0, 20)))).toBeNull();
    expect(dataUrlImageSize(url('image/jpeg', JPEG_5x9.slice(0, 160)))).toBeNull();
    expect(dataUrlImageSize(url('image/gif', 'R0lGODlhAQABAAAAACw='))).toBeNull();
    expect(dataUrlImageSize('data:image/png,not-base64')).toBeNull();
  });
});
