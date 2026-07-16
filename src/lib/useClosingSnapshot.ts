import { useRef } from 'react';

/**
 * Keep the content a presence-controlled dialog showed while it fades out.
 *
 * A dialog opened via `open={!!state}` uses that same `state` for its body (e.g. `state?.name`). Clearing
 * the state closes the dialog AND blanks the body — so during the exit animation, while the dialog is still
 * visible, the content flashes to its empty/default form. Pass the `open` flag and the body-driving value:
 * while open (or uncontrolled — `open` undefined) you get the live value; once `open` is `false` you get the
 * last value seen while open, so the closing dialog keeps its content until it unmounts.
 */
export function useClosingSnapshot<T>(open: boolean | undefined, value: T): T {
  const last = useRef(value);
  if (open !== false) last.current = value;
  return open === false ? last.current : value;
}
