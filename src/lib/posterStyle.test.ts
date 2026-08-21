import { describe, it, expect } from 'vitest';
import { colorLuminance, foregroundFor, parsePosterColor, posterBand, DEFAULT_BAND } from './posterStyle';

describe('the color an organizer picked', () => {
  it('takes the six-digit hex the picker emits', () => {
    expect(parsePosterColor('#1E3A8A')).toBe('#1e3a8a');
  });

  it('expands the shorthand somebody typed by hand', () => {
    expect(parsePosterColor('#0af')).toBe('#00aaff');
  });

  it('refuses anything CSS would paint nothing for', () => {
    // The column is free-form text: a value from an older tool, or a half-typed one, must not reach CSS.
    for (const value of ['rebeccapurple', 'rgb(1,2,3)', '#12345', 'red;', '', '  ', null, undefined]) {
      expect(parsePosterColor(value)).toBeNull();
    }
  });
});

describe('the text over a band', () => {
  it('goes dark on a color that would swallow white', () => {
    expect(foregroundFor('#fef08a')).toBe('#1c1917'); // pale yellow — the white-on-white case
    expect(foregroundFor('#ffffff')).toBe('#1c1917');
  });

  it('goes light on a color that would swallow black', () => {
    expect(foregroundFor('#1e3a8a')).toBe('#ffffff');
    expect(foregroundFor('#000000')).toBe('#ffffff');
  });

  it('reads luminance the way the eye does — green weighs more than blue', () => {
    expect(colorLuminance('#00ff00')).toBeGreaterThan(colorLuminance('#0000ff'));
    expect(colorLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(colorLuminance('#000000')).toBeCloseTo(0, 5);
  });
});

describe('composing a band', () => {
  it('falls back to the default when nothing was styled', () => {
    expect(posterBand({})).toEqual(DEFAULT_BAND);
    expect(posterBand(null)).toEqual(DEFAULT_BAND);
  });

  it('falls back to the default on a server that has no styling fields at all', () => {
    // A client ahead of its server: the fields are absent, not empty, and the band must still render.
    expect(posterBand({ posterColor: undefined, posterImageUrl: undefined })).toEqual(DEFAULT_BAND);
  });

  it('falls back to the default when the stored color is not one', () => {
    expect(posterBand({ posterColor: 'octarine' })).toEqual(DEFAULT_BAND);
  });

  it('paints the chosen color with text that holds against it', () => {
    expect(posterBand({ posterColor: '#fef08a' })).toEqual({
      color: '#fef08a',
      foreground: '#1c1917',
      imageUrl: null,
      scrim: null,
      pill: 'rgba(28, 25, 23, 0.15)',
    });
  });

  it('washes artwork with the chosen color so the title stays readable', () => {
    const band = posterBand({ posterColor: '#1e3a8a', posterImageUrl: '/api/event-posters/a.webp' });

    expect(band.imageUrl).toBe('/api/event-posters/a.webp');
    expect(band.scrim).toBe('rgba(30, 58, 138, 0.55)');
    expect(band.foreground).toBe('#ffffff');
    // The pill lifts off the band in the text's own color, so it reads on a dark and a pale pick alike.
    expect(band.pill).toBe('rgba(255, 255, 255, 0.15)');
  });

  it('washes artwork chosen without a color in neutral dark', () => {
    const band = posterBand({ posterImageUrl: '/api/event-posters/a.webp' });

    expect(band.scrim).toBe('rgba(0, 0, 0, 0.55)');
    expect(band.foreground).toBe('#ffffff');
    expect(band.color).toBeNull();
  });

  it('resolves the artwork path through the caller, since only it knows the host', () => {
    const band = posterBand(
      { posterImageUrl: '/api/event-posters/a.webp' },
      (path) => `https://workshop.example.com${path}`,
    );

    expect(band.imageUrl).toBe('https://workshop.example.com/api/event-posters/a.webp');
  });

  it('keeps the default when the resolver cannot place the artwork', () => {
    // No host to load it from is the same as no artwork; a broken `img` in the band is worse than none.
    expect(posterBand({ posterImageUrl: '/api/event-posters/a.webp' }, () => null)).toEqual(DEFAULT_BAND);
  });
});
