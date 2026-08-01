import { describe, it, expect } from 'vitest';
import { avatarHue, avatarInitial, avatarSrc } from './avatar';

/**
 * Where a profile image loads from, and what stands in when there is none.
 *
 * The fallback matters as much as the image: most accounts will never set one, so the letter circle is
 * what the catalog and every comment thread are actually made of.
 */

describe('the image URL', () => {
  it('hangs the server’s path off the API origin', () => {
    // The server answers with a root-relative path because it does not know which host reached it —
    // the desktop shell and the web build use different ones.
    expect(avatarSrc('/api/avatars/abc.webp', 'https://example.test/api'))
      .toBe('https://example.test/api/avatars/abc.webp');
  });

  it('does not double the /api segment', () => {
    expect(avatarSrc('/api/avatars/abc.webp', 'https://example.test/api/'))
      .toBe('https://example.test/api/avatars/abc.webp');
  });

  it('leaves an absolute URL alone, in case these ever move to a CDN', () => {
    expect(avatarSrc('https://cdn.test/abc.webp', 'https://example.test/api'))
      .toBe('https://cdn.test/abc.webp');
  });

  it('is null for somebody who has none', () => {
    expect(avatarSrc(null, 'https://example.test/api')).toBeNull();
    expect(avatarSrc(undefined, 'https://example.test/api')).toBeNull();
    expect(avatarSrc('', 'https://example.test/api')).toBeNull();
  });
});

describe('the fallback letter', () => {
  it('is the first character of the name, capitalized', () => {
    expect(avatarInitial('wren_hallow')).toBe('W');
    expect(avatarInitial('Osk')).toBe('O');
  });

  it('ignores leading space rather than showing a blank circle', () => {
    expect(avatarInitial('  bel_marrow')).toBe('B');
  });

  it('has something to show for a nameless account', () => {
    expect(avatarInitial(null)).toBe('?');
    expect(avatarInitial('   ')).toBe('?');
  });
});

describe('the fallback color', () => {
  it('is the same every time for the same person', () => {
    // Derived rather than stored, so two readers of one thread see the same colors with nothing fetched.
    expect(avatarHue('wren_hallow')).toBe(avatarHue('wren_hallow'));
  });

  it('ignores case, so one account is one color', () => {
    expect(avatarHue('Wren_Hallow')).toBe(avatarHue('wren_hallow'));
  });

  it('is a usable hue', () => {
    for (const name of ['a', 'wren_hallow', 'osk_tinder', 'z'.repeat(40), '']) {
      const hue = avatarHue(name);

      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('tells most people apart', () => {
    // Not a guarantee — 360 hues and a hash will collide — but a scan down a thread should not be one color.
    const names = ['wren_hallow', 'osk_tinder', 'bel_marrow', 'juniper_vex', 'cato_reed'];
    const hues = new Set(names.map(avatarHue));

    expect(hues.size).toBe(names.length);
  });
});
