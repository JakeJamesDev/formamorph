/** Parse a numeric `<input>` value, falling back to `min` when it's empty or invalid. Without this a cleared
 *  field yields `Number('') === 0`, which would persist a zero (a 0-token request, a 0px image) to settings. */
export const numInput = (raw: string, min: number): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : min;
};
