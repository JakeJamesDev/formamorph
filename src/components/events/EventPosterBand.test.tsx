import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Trophy } from 'lucide-react';
import { EventPosterBand } from './EventPosterBand';
import { daysFrom } from '@/test/serverEvents';
import type { PosterPlacement } from '@/types';

/**
 * The artwork layer of the band every poster surface renders through.
 *
 * jsdom neither lays out nor decodes, and both are what the placement is computed from, so each is
 * supplied here as the browser would: a measured band, and a source with natural proportions. What is
 * asserted is the layer that comes out — an event with no chosen framing must still be the centered
 * cover it always was, and one with a framing must be positioned from the band it is actually in.
 */

const ART = '/api/event-posters/a.webp';

/** A decode that answers with fixed proportions, the way a loaded picture does. */
const stubImageDecode = (width: number, height: number) => {
  class StubImage {
    onload: (() => void) | null = null;
    naturalWidth = width;
    naturalHeight = height;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  vi.stubGlobal('Image', StubImage);
};

/** A band that has been laid out at a given size. */
const stubBandSize = (width: number, height: number) => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
};

const renderBand = (placement: PosterPlacement | null) => render(
  <EventPosterBand
    event={{
      posterImageUrl: ART,
      posterPlacement: placement,
      startsAt: daysFrom(-1),
      endsAt: daysFrom(4),
    }}
    icon={Trophy}
    eyebrow="A Contest Has Started"
    title={<div>Autumn Hauntings</div>}
  />,
);

const artwork = () => screen.getByTestId('poster-band-image');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('artwork nobody framed', () => {
  it('is the centered cover the browser draws, with nothing positioned by hand', () => {
    stubImageDecode(1000, 500);
    stubBandSize(800, 200);
    renderBand(null);

    expect(artwork().className).toContain('bg-cover');
    expect(artwork().className).toContain('bg-center');
    expect(artwork().style.backgroundSize).toBe('');
    expect(artwork().style.backgroundPosition).toBe('');
  });
});

describe('artwork an organizer framed', () => {
  it('scales and positions it from the band it is actually in', async () => {
    // A 1000x500 source covering an 800x200 band draws 800x400, and a focal point a quarter down puts
    // the top of the picture at the top of the band.
    stubImageDecode(1000, 500);
    stubBandSize(800, 200);
    renderBand({ zoom: 1, x: 0.5, y: 0.25 });

    await waitFor(() => expect(artwork().style.backgroundSize).toBe('800px 400px'));
    expect(artwork().style.backgroundPosition).toBe('0px 0px');
    // The browser's own cover would fight the size set here.
    expect(artwork().className).not.toContain('bg-cover');
  });

  it('answers differently in a band of a different shape, from the same stored framing', async () => {
    // The same framing in a 400x600 band: the width now decides the cover, so the picture is drawn
    // 1200x600 and the focal point clamps down to what that band can still cover.
    stubImageDecode(1000, 500);
    stubBandSize(400, 600);
    renderBand({ zoom: 1, x: 0.5, y: 0.25 });

    await waitFor(() => expect(artwork().style.backgroundSize).toBe('1200px 600px'));
    expect(artwork().style.backgroundPosition).toBe('-400px 0px');
  });

  it('zooms into the picture rather than the band', async () => {
    stubImageDecode(1000, 500);
    stubBandSize(800, 200);
    renderBand({ zoom: 2, x: 0.5, y: 0.5 });

    await waitFor(() => expect(artwork().style.backgroundSize).toBe('1600px 800px'));
    expect(artwork().style.backgroundPosition).toBe('-400px -300px');
  });

  it('stays the centered cover until the picture has been decoded', () => {
    // The decode is a round trip; positioning from a guessed size would place the artwork and then
    // visibly move it once the real proportions arrived.
    stubBandSize(800, 200);
    renderBand({ zoom: 2, x: 0.5, y: 0.5 });

    expect(artwork().className).toContain('bg-cover');
    expect(artwork().style.backgroundSize).toBe('');
  });
});
