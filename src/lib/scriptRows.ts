/** A script row on screen: how an Add or an Insert finds it, and the script a new row starts with. */

import type { Script, ScriptTiming } from '@/types';
import { randomUUID } from './uuid';

/** The attribute each script's row carries. */
export const SCRIPT_ROW_ATTRIBUTE = 'data-script-id';

/** The row of the script with `id`. */
export const scriptRow = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[${SCRIPT_ROW_ATTRIBUTE}="${id}"]`);

/** What a landing on a script row focuses: nothing, since the row's editor focuses itself once it loads. */
export const noFocus = (): null => null;

/** A new script: blank, Before the AI unless a timing is given. */
export const newScript = (timing: ScriptTiming = 'before', code = ''): Script => ({ id: randomUUID(), timing, code });
