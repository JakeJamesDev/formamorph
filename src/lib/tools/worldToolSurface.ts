/**
 * What a World Tool script reaches in the editor: the script surface of the world's Scripts, so every write is
 * there, plus `args` typed from the Tool's parameters. It describes the sandbox in `statCodeExecutor`; it never
 * widens it. A user Tool's script is `toolScriptSurface`'s, a different sandbox.
 */
import type { ToolParam, ToolScriptTiming } from '@/types';
import type { CodeSurface } from '@/lib/codeSurface';
import { WORLD_TOOL_GUIDE_LINKS } from '@/lib/codeGuideLinks';
import { memberStep } from '@/lib/statCodePaths';
import { scriptSurface, TURN_MEMBERS, WORLD_SCRIPT_SURFACE } from '@/lib/statCodeSurface';
import type { VariableNode } from '@/lib/statCodeVariableTree';
import { SCRIPT_TIMING_OF_TOOL } from './worldTools';
import { namedParams } from './toolDraft';
import { argEntry } from './toolScriptSurface';

const ARGS_INFO = 'The arguments the AI sent, checked against the parameters';

const shapeOf = (names: readonly string[]) => `{ ${names.join(', ')} }`;

/** The surface of a World Tool script for a Tool with `params` and `timing`. */
export function worldToolSurface(params: readonly ToolParam[], timing: ToolScriptTiming): CodeSurface {
  const argEntries = namedParams(params).map(argEntry);
  const surface = scriptSurface(WORLD_SCRIPT_SURFACE, SCRIPT_TIMING_OF_TOOL[timing]);
  return {
    ...surface,
    label: 'a World Tool script',
    globals: [
      { name: 'args', detail: shapeOf(argEntries.map((entry) => entry.name)), info: ARGS_INFO, access: 'readOnly' },
      ...surface.globals,
    ],
    // A Tool's `turn.choices` write drops at every timing (Q21).
    members: new Map([...surface.members, ['turn', TURN_MEMBERS], ['args', argEntries.map((entry) => ({ ...entry, access: 'readOnly' as const }))]]),
    missingReturn: timing === 'call' ? 'This script never returns, so the Tool sends its empty result.' : null,
    guide: WORLD_TOOL_GUIDE_LINKS,
  };
}

/** The Variable menu's Arguments group: one leaf per parameter, inserted as a path off `args`. */
export function worldToolArgsNodes(params: readonly ToolParam[]): VariableNode[] {
  const leaves = namedParams(params).map(argEntry).map((entry): VariableNode => ({
    kind: 'field', label: entry.name, detail: entry.detail, info: entry.info, access: 'readOnly', insert: `args${memberStep(entry.name)}`,
  }));
  return [{
    kind: 'group', label: 'Arguments', info: ARGS_INFO,
    children: leaves.length ? leaves : [{ kind: 'empty', message: 'No parameters in this Tool' }],
  }];
}
