import type { BlueprintOverride, Script, ScriptTiming } from '@/types';
import { firstScriptAt, type ScriptHome } from '@/lib/scripts';

/** A stat's scripts, one per box given, the before box first. A blank box stays a blank script, so a test of
 *  the runner's skip still reaches the runner. */
export function boxScripts(boxes: { before?: string; after?: string }): Script[] {
  return (['before', 'after'] as const).flatMap((timing) => {
    const code = boxes[timing];
    return code === undefined ? [] : [{ id: timing, timing, code }];
  });
}

/** The code of a home's first script of `timing`; undefined when it has none. */
export const codeAt = (home: ScriptHome | undefined, timing: ScriptTiming = 'after'): string | undefined =>
  home && firstScriptAt(home, timing)?.code;

/** The code a link's scripts override holds for `timing`; undefined when the link overrides none. */
export const overriddenCodeAt = (override: BlueprintOverride<Script[]> | undefined, timing: ScriptTiming = 'after'): string | undefined =>
  override && codeAt({ scripts: override.value }, timing);
