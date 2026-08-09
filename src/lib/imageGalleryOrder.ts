/**
 * Where the framed picture ends up once the strip is reordered.
 *
 * The gallery frames a picture by index, so a reorder that moves any picture past it would silently change
 * what is on screen. Following the picture instead keeps the frame on whatever the author was looking at —
 * including when they drag that very picture somewhere else.
 */
export const followReorder = (showing: number, from: number, to: number): number => {
  if (showing === from) return to;
  if (from < showing && to >= showing) return showing - 1;
  if (from > showing && to <= showing) return showing + 1;
  return showing;
};
