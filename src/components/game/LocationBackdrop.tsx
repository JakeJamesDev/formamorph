/**
 * The location image behind the game view.
 *
 * Image and fade sit on two stacked layers instead of one `background-image` shorthand on the view root, and
 * the image layer is promoted to its own compositor layer. That is what keeps typing cheap: sharing a layer
 * with the UI makes every repaint of a translucent surface above it — a caret in the Notes box, streaming
 * narration — re-render the source image. Raster art blits from cache, but vector art re-rasterizes, which
 * measured in the tens of milliseconds per keystroke on a complex SVG.
 *
 * Keeping the fade on its own layer matters for the same reason: folded into the image's background
 * shorthand, moving the overlay slider or toggling Hide UI would invalidate the image raster.
 */
export const LocationBackdrop = ({ image, overlay, overlayHidden }: {
  /** Background image URL; absent paints nothing. */
  image: string | null | undefined;
  /** Alpha of the theme-colored fade over the image; 0 leaves the image untouched. */
  overlay: number;
  /** Drop the fade to reveal the raw image (the Hide UI toggle). */
  overlayHidden: boolean;
}) => {
  if (!image) return null;
  return (
    <>
      <div
        data-testid="location-backdrop-image"
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{
          backgroundImage: `url(${image})`,
          transform: 'translateZ(0)',
          willChange: 'transform',
        }}
      />
      {!overlayHidden && overlay > 0 && (
        <div
          data-testid="location-backdrop-overlay"
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ backgroundColor: `hsl(var(--background) / ${overlay})` }}
        />
      )}
    </>
  );
};
