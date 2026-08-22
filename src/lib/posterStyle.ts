/**
 * How an organizer's chosen color and artwork become the poster band's look.
 *
 * Pure, and the only place the rules live: the poster, the rules dialog and the event form's preview all
 * read the same answer, so a band composed in the admin form is the band players are shown. An event
 * from a server without the styling fields resolves to the default look here rather than at each reader.
 */

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
}

/** The band with nothing chosen: the app's own info blue, in both themes. */
export const DEFAULT_BAND: PosterBand = {
  color: null, foreground: null, imageUrl: null, scrim: null, pill: null,
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

/** The styling an event carries, in whatever form it reaches this client. */
export interface PosterStyleSource {
  posterColor?: string | null;
  posterImageUrl?: string | null;
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
  };
}
