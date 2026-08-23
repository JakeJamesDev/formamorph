/**
 * How an organizer's chosen color and artwork become the poster band's look.
 *
 * Pure, and the only place the rules live: the poster, the rules dialog and the event form's preview all
 * read the same answer, so a band composed in the admin form is the band players are shown. An event
 * from a server without the styling fields resolves to the default look here rather than at each reader.
 */

import { MAX_ZOOM, MIN_ZOOM, clampCrop, clampZoom, coverScale } from '@/lib/avatarCrop';
import type { PosterPlacement } from '@/types';

/** What the band renders as, once the color, the artwork and their absence have all been accounted for. */
export interface PosterBand {
  /** The band's fill, or null when the app's default band applies. */
  color: string | null;
  /** Text and icon color over that fill, or null alongside a null color. */
  foreground: string | null;
  /** Artwork covering the band, or null. */
  imageUrl: string | null;
  /** The wash over that artwork that keeps the title readable, or null when there is no artwork. */
  scrim: string | null;
  /** Fill for the date pill: the foreground at a fraction, or null when the default band applies. */
  pill: string | null;
  /** How the organizer framed the artwork, or null for the centered cover. */
  placement: PosterPlacement | null;
}

/** The band with nothing chosen: the app's own info blue, in both themes. */
export const DEFAULT_BAND: PosterBand = {
  color: null, foreground: null, imageUrl: null, scrim: null, pill: null, placement: null,
};

/** Light and dark text, picked by luminance rather than by theme — the band's fill is the same in both. */
const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#1c1917';

/** How much of the artwork the wash covers. Enough for white text on a bright photo, not a flat panel. */
const SCRIM_ALPHA = 0.55;

/** The wash over artwork the organizer chose no color for. */
const NEUTRAL_SCRIM = `rgba(0, 0, 0, ${SCRIM_ALPHA})`;

/** How far the date pill lifts off the band it sits on. */
const PILL_ALPHA = 0.15;

/**
 * A color the band can be painted with, or null.
 *
 * Hex only, which is what the picker emits. The column is free-form text, so a value typed in by hand or
 * left behind by an older tool has to be refused somewhere — refusing it here means the band falls back
 * to its default rather than handing an unusable string to CSS, where it would silently paint nothing.
 *
 * @param value - Whatever the event carries
 * @returns The color as lowercase `#rrggbb`, or null when it is not one
 */
export function parsePosterColor(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;

  // Shorthand expands rather than being refused: `#0af` is a color a person can reasonably have typed.
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed.slice(1).split('').map((digit) => digit + digit).join('')}`;
  }

  return null;
}

/** The three channels of a parsed color, 0–255. */
function channels(color: string): [number, number, number] {
  return [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16)) as [number, number, number];
}

/**
 * The WCAG relative luminance of a parsed color, 0 (black) to 1 (white).
 *
 * @param color - A `#rrggbb` string, as `parsePosterColor` returns
 */
export function colorLuminance(color: string): number {
  const [r, g, b] = channels(color).map((channel) => {
    const ratio = channel / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Text that stays readable on a given fill.
 *
 * The threshold is where white and near-black are equally legible by WCAG contrast, so an organizer who
 * picks pale yellow gets dark text instead of the white-on-white the fixed band would have given them.
 *
 * @param color - A `#rrggbb` string
 */
export function foregroundFor(color: string): string {
  return colorLuminance(color) > 0.45 ? DARK_TEXT : LIGHT_TEXT;
}

/** A parsed color at a given opacity. */
function translucent(color: string, alpha: number): string {
  const [r, g, b] = channels(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Nothing framed: the whole picture's middle at the band's middle, at the scale that just covers it. */
export const CENTERED_PLACEMENT: PosterPlacement = { zoom: 1, x: 0.5, y: 0.5 };

/** A width and a height in pixels — a decoded source, or a measured band. */
export interface Size {
  width: number;
  height: number;
}

/** Where the artwork is drawn inside a band, in that band's own pixels. */
export interface PlacedArtwork extends Size {
  /** Offset of the artwork's left edge from the band's, negative wherever it overhangs. */
  left: number;
  top: number;
}

/** Whether a number is one, and inside a range. */
const within = (value: unknown, low: number, high: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;

/**
 * Read a stored placement.
 *
 * Refused rather than repaired, and refused to null, which is the centered cover: the column is written
 * through an API, so a row from a hand-crafted request or an older tool has to be caught somewhere, and
 * a band that quietly renders as it always did beats one hanging off the edge of its own artwork.
 *
 * @param value - Whatever the event carries
 * @returns The placement, or null when it is not one
 */
export function parsePosterPlacement(value: unknown): PosterPlacement | null {
  if (!value || typeof value !== 'object') return null;

  const { zoom, x, y } = value as Record<string, unknown>;
  if (!within(zoom, MIN_ZOOM, MAX_ZOOM) || !within(x, 0, 1) || !within(y, 0, 1)) return null;

  return { zoom, x, y };
}

/**
 * The artwork's size and offset once a placement is applied to a particular band.
 *
 * Scale is the cover scale times the zoom, and the chosen point of the source is put at the band's
 * center — which is what makes one stored value frame the same subject in a wide band and a tall one.
 * The placement is held inside its own artwork on the way through, so a value that predates a resize
 * still cannot expose blank space.
 *
 * @param placement - The organizer's chosen framing
 * @param source - The decoded artwork's natural size
 * @param frame - The band being filled
 * @returns Where to draw the artwork, or null while either size is still unknown
 */
export function placeArtwork(placement: PosterPlacement, source: Size, frame: Size): PlacedArtwork | null {
  if (!source.width || !source.height || !frame.width || !frame.height) return null;

  const held = clampPlacement(placement, source, frame);
  const scale = coverScale(source.width, source.height, frame.width, frame.height) * held.zoom;
  const width = source.width * scale;
  const height = source.height * scale;

  return { width, height, left: frame.width / 2 - held.x * width, top: frame.height / 2 - held.y * height };
}

/**
 * A placement brought inside what its artwork can actually cover.
 *
 * Expressed as the pan the avatar's crop already clamps: a focal point is the same choice as an offset
 * from center, so the rule about not dragging a picture off its frame is written once.
 *
 * @param placement - The chosen framing
 * @param source - The decoded artwork's natural size
 * @param frame - The band being filled
 * @returns The framing, with its zoom and focal point inside their ranges
 */
export function clampPlacement(placement: PosterPlacement, source: Size, frame: Size): PosterPlacement {
  const zoom = clampZoom(placement.zoom);
  const drawn = drawnSize(zoom, source, frame);
  if (!drawn.width || !drawn.height) return { ...CENTERED_PLACEMENT, zoom };

  const held = clampCrop(
    { zoom, offsetX: drawn.width * (0.5 - placement.x), offsetY: drawn.height * (0.5 - placement.y) },
    source.width, source.height, frame.width, frame.height,
  );

  return { zoom, x: 0.5 - held.offsetX / drawn.width, y: 0.5 - held.offsetY / drawn.height };
}

/**
 * The framing after the artwork is dragged by a distance on screen.
 *
 * The focal point moves against the pointer, because dragging the picture left is what brings the right
 * of it into view.
 *
 * @param placement - The framing being dragged from
 * @param move - How far the pointer travelled, in the band's pixels
 * @param source - The decoded artwork's natural size
 * @param frame - The band being filled
 * @returns The framing at the new position, clamped
 */
export function panPlacement(
  placement: PosterPlacement,
  move: { x: number; y: number },
  source: Size,
  frame: Size,
): PosterPlacement {
  const drawn = drawnSize(clampZoom(placement.zoom), source, frame);
  if (!drawn.width || !drawn.height) return clampPlacement(placement, source, frame);

  return clampPlacement(
    { ...placement, x: placement.x - move.x / drawn.width, y: placement.y - move.y / drawn.height },
    source, frame,
  );
}

/** How large the artwork is drawn in a band at a given zoom. */
function drawnSize(zoom: number, source: Size, frame: Size): Size {
  const scale = coverScale(source.width, source.height, frame.width, frame.height) * zoom;

  return { width: source.width * scale, height: source.height * scale };
}

/** The styling an event carries, in whatever form it reaches this client. */
export interface PosterStyleSource {
  posterColor?: string | null;
  posterImageUrl?: string | null;
  posterPlacement?: PosterPlacement | null;
}

/**
 * Compose an event's band.
 *
 * Artwork and color are independent choices: either alone is a complete band, together the color tints
 * the wash over the artwork, and neither leaves the default. The text color follows the fill in every
 * case, so contrast holds for any pick.
 *
 * @param event - The event, or its styling fields
 * @param imageSrc - Resolves the server's root-relative image path to something an `img` can load;
 *                   omitting it leaves the path as it came
 */
export function posterBand(
  event: PosterStyleSource | null | undefined,
  imageSrc: (path: string) => string | null = (path) => path,
): PosterBand {
  if (!event) return DEFAULT_BAND;

  const color = parsePosterColor(event.posterColor);
  const imageUrl = event.posterImageUrl ? imageSrc(event.posterImageUrl) : null;

  if (!color && !imageUrl) return DEFAULT_BAND;

  return {
    color,
    // With artwork the text sits over the wash, which is the color at partial opacity — still the color's
    // own decision, since a pale wash over a photo is what makes white text unreadable.
    foreground: color ? foregroundFor(color) : LIGHT_TEXT,
    imageUrl,
    scrim: imageUrl ? (color ? translucent(color, SCRIM_ALPHA) : NEUTRAL_SCRIM) : null,
    pill: translucent(color ? foregroundFor(color) : LIGHT_TEXT, PILL_ALPHA),
    // Only alongside artwork: a framing left behind by a picture that was removed has nothing to frame.
    placement: imageUrl ? parsePosterPlacement(event.posterPlacement) : null,
  };
}
