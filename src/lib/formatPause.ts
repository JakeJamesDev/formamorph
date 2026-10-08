/** A pause in seconds as the slider reads it: `30 s`, `1 min`, `1 min 30 s`. */
export function formatPause(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}
