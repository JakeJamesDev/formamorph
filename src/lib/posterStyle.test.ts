import { describe, it, expect } from 'vitest';
import {
  CENTERED_PLACEMENT, DEFAULT_BAND, clampPlacement, colorLuminance, foregroundFor, panPlacement,
  parsePosterColor, parsePosterPlacement, placeArtwork, posterBand,
} from './posterStyle';
import type { PosterPlacement } from '@/types';

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
      placement: null,
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

/**
 * Where the organizer put the artwork.
 *
 * The whole point of the encoding is that one stored value survives every shape the band is rendered
 * at, so most of these assert the same picture twice — once in a wide frame, once in a tall one.
 */

const SOURCE = { width: 1000, height: 500 };
const WIDE = { width: 800, height: 200 };
const TALL = { width: 400, height: 600 };

/** How far the chosen focal point lands from the frame's center. Zero is the promise this all makes. */
const focalDrift = (placement: PosterPlacement, source: typeof SOURCE, frame: typeof WIDE) => {
  const placed = placeArtwork(placement, source, frame)!;

  return {
    x: placed.left + placement.x * placed.width - frame.width / 2,
    y: placed.top + placement.y * placed.height - frame.height / 2,
  };
};

describe('reading a stored placement', () => {
  it('takes the shape the form writes', () => {
    expect(parsePosterPlacement({ zoom: 2, x: 0.25, y: 0.75 })).toEqual({ zoom: 2, x: 0.25, y: 0.75 });
  });

  it('refuses anything that would render as a band hanging off its own artwork', () => {
    // The column is written through an API, so a hand-crafted row has to be refused somewhere — and here
    // it degrades to the centered cover rather than positioning the artwork off its frame.
    for (const value of [
      null, undefined, 'centered', 42, {},
      { zoom: 1, x: 0.5 },
      { zoom: Number.NaN, x: 0.5, y: 0.5 },
      { zoom: Number.POSITIVE_INFINITY, x: 0.5, y: 0.5 },
      { zoom: 0.5, x: 0.5, y: 0.5 },
      { zoom: 8, x: 0.5, y: 0.5 },
      { zoom: 1, x: -0.1, y: 0.5 },
      { zoom: 1, x: 0.5, y: 1.4 },
      { zoom: 1, x: '0.5', y: 0.5 },
    ]) {
      expect(parsePosterPlacement(value)).toBeNull();
    }
  });

  it('takes both ends of each range, which are choices an organizer can really make', () => {
    expect(parsePosterPlacement({ zoom: 1, x: 0, y: 0 })).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(parsePosterPlacement({ zoom: 4, x: 1, y: 1 })).toEqual({ zoom: 4, x: 1, y: 1 });
  });
});

describe('positioning artwork from a placement', () => {
  it('centers the chosen point of the source, whatever shape the band is', () => {
    const placement = { zoom: 2, x: 0.3, y: 0.6 };

    expect(focalDrift(placement, SOURCE, WIDE).x).toBeCloseTo(0);
    expect(focalDrift(placement, SOURCE, WIDE).y).toBeCloseTo(0);
    expect(focalDrift(placement, SOURCE, TALL).x).toBeCloseTo(0);
    expect(focalDrift(placement, SOURCE, TALL).y).toBeCloseTo(0);
  });

  it('covers the band at every zoom, so blank space can never show', () => {
    for (const frame of [WIDE, TALL, { width: 500, height: 500 }]) {
      for (const placement of [CENTERED_PLACEMENT, { zoom: 1, x: 0, y: 1 }, { zoom: 3.5, x: 1, y: 0 }]) {
        const placed = placeArtwork(placement, SOURCE, frame)!;

        expect(placed.width).toBeGreaterThanOrEqual(frame.width - 1e-9);
        expect(placed.height).toBeGreaterThanOrEqual(frame.height - 1e-9);
        expect(placed.left).toBeLessThanOrEqual(1e-9);
        expect(placed.top).toBeLessThanOrEqual(1e-9);
        expect(placed.left + placed.width).toBeGreaterThanOrEqual(frame.width - 1e-9);
        expect(placed.top + placed.height).toBeGreaterThanOrEqual(frame.height - 1e-9);
      }
    }
  });

  it('reproduces the centered cover for the centered placement', () => {
    // What `background-size: cover; background-position: center` already draws — the value an event with
    // no chosen placement has to keep rendering as.
    const placed = placeArtwork(CENTERED_PLACEMENT, SOURCE, WIDE)!;

    expect(placed).toEqual({ width: 800, height: 400, left: 0, top: -100 });
  });

  it('says nothing until both the source and the band have been measured', () => {
    // The band is measured once it mounts and the source once it decodes; until then there is no answer
    // to give, and guessing one would place the artwork and then move it.
    expect(placeArtwork(CENTERED_PLACEMENT, { width: 0, height: 0 }, WIDE)).toBeNull();
    expect(placeArtwork(CENTERED_PLACEMENT, SOURCE, { width: 0, height: 0 })).toBeNull();
  });
});

describe('holding a placement inside its own artwork', () => {
  it('pulls a focal point that would expose an edge back to where it just covers', () => {
    // 1000x500 in an 800x200 band draws 800x400: nothing spare across, 100 down. A focal point at the
    // very top would hang the band over blank space.
    const held = clampPlacement({ zoom: 1, x: 0, y: 0 }, SOURCE, WIDE);

    expect(held.x).toBeCloseTo(0.5);
    expect(held.y).toBeCloseTo(0.25);
  });

  it('clamps to the opposite edge by the same amount', () => {
    const held = clampPlacement({ zoom: 1, x: 1, y: 1 }, SOURCE, WIDE);

    expect(held.x).toBeCloseTo(0.5);
    expect(held.y).toBeCloseTo(0.75);
  });

  it('leaves a focal point that already covers alone', () => {
    expect(clampPlacement({ zoom: 1, x: 0.5, y: 0.4 }, SOURCE, WIDE).y).toBeCloseTo(0.4);
  });

  it('frees more of the picture the further in the organizer zooms', () => {
    const near = clampPlacement({ zoom: 1, x: 0, y: 0.5 }, SOURCE, TALL).x;
    const far = clampPlacement({ zoom: 2, x: 0, y: 0.5 }, SOURCE, TALL).x;

    expect(far).toBeLessThan(near);
  });

  it('holds the zoom to the range the controls offer', () => {
    expect(clampPlacement({ zoom: 99, x: 0.5, y: 0.5 }, SOURCE, WIDE).zoom).toBe(4);
    expect(clampPlacement({ zoom: 0.1, x: 0.5, y: 0.5 }, SOURCE, WIDE).zoom).toBe(1);
    expect(clampPlacement({ zoom: Number.NaN, x: 0.5, y: 0.5 }, SOURCE, WIDE).zoom).toBe(1);
  });
});

describe('dragging the artwork', () => {
  it('moves the picture the way the pointer went, not against it', () => {
    // Dragging left brings more of the right of the picture into the band, so the focal point moves right.
    const dragged = panPlacement({ zoom: 2, x: 0.5, y: 0.5 }, { x: -100, y: 0 }, SOURCE, WIDE);

    expect(dragged.x).toBeGreaterThan(0.5);
  });

  it('moves it by exactly the distance dragged', () => {
    // 1000x500 at zoom 2 in an 800x200 band draws 1600 wide, so 160px is a tenth of the picture.
    const dragged = panPlacement({ zoom: 2, x: 0.5, y: 0.5 }, { x: -160, y: 0 }, SOURCE, WIDE);

    expect(dragged.x).toBeCloseTo(0.6);
  });

  it('stops at the edge instead of pulling the picture off the band', () => {
    const dragged = panPlacement(CENTERED_PLACEMENT, { x: 0, y: -9999 }, SOURCE, WIDE);

    expect(dragged.y).toBeCloseTo(0.75);
    expect(focalDrift(dragged, SOURCE, WIDE).y).toBeCloseTo(0);
  });

  it('cannot move a picture that only just covers the band', () => {
    expect(panPlacement(CENTERED_PLACEMENT, { x: -500, y: 0 }, SOURCE, WIDE).x).toBeCloseTo(0.5);
  });
});

describe('a band that carries a placement', () => {
  it('hands the chosen framing along with the artwork', () => {
    const band = posterBand({
      posterImageUrl: '/api/event-posters/a.webp',
      posterPlacement: { zoom: 2, x: 0.25, y: 0.75 },
    });

    expect(band.placement).toEqual({ zoom: 2, x: 0.25, y: 0.75 });
  });

  it('carries none for an event nobody framed', () => {
    expect(posterBand({ posterImageUrl: '/api/event-posters/a.webp' }).placement).toBeNull();
  });

  it('carries none where there is no artwork to frame', () => {
    // A placement left behind by artwork that was removed must not reach a band that renders a color.
    const band = posterBand({ posterColor: '#1e3a8a', posterPlacement: { zoom: 2, x: 0.25, y: 0.75 } });

    expect(band.placement).toBeNull();
  });

  it('falls back to the centered cover when the stored framing is not one', () => {
    const band = posterBand({
      posterImageUrl: '/api/event-posters/a.webp',
      posterPlacement: { zoom: 40, x: 0.25, y: 0.75 } as PosterPlacement,
    });

    expect(band.imageUrl).toBe('/api/event-posters/a.webp');
    expect(band.placement).toBeNull();
  });
});
