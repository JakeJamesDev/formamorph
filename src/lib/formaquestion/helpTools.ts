/**
 * Formaquestion Tools: the player's own Tools for the help answer request. A separate list from the
 * gameplay Tools, switched per device and never scoped to a prompt preset (ADR-0010). The fixed functions
 * of the help request stand beside them, and a Tool cannot take one of their names.
 */
import type { Tool, ToolEnabledMap } from '@/types';
import type { OfferedFunction } from '@/lib/tools/toolSchema';
import { parseTool, parseToolEnabledMap, toolNameProblem } from '@/lib/tools/toolValidation';
import { DOCS_LOOKUP } from './docsLookup';
import { HELP_FACE } from './helpFace';
import { HELP_ROLL } from './helpRoll';

/** The app's own functions of a help request. A Tool cannot take their names. */
export const HELP_FIXED_FUNCTIONS: readonly OfferedFunction[] = [DOCS_LOOKUP, HELP_ROLL, HELP_FACE];

/** The names a Formaquestion Tool cannot take. */
export const HELP_RESERVED_TOOL_NAMES: readonly string[] = HELP_FIXED_FUNCTIONS.map((fn) => fn.name);

/** The list with `tool` saved into it; unchanged when its name is malformed, taken or reserved. */
export function saveHelpTool(tools: readonly Tool[], tool: Tool): Tool[] {
  if (toolNameProblem(tool.name, tools, { selfId: tool.id, reserved: HELP_RESERVED_TOOL_NAMES })) return [...tools];
  return tools.some((t) => t.id === tool.id) ? tools.map((t) => (t.id === tool.id ? tool : t)) : [...tools, tool];
}

/** The list without the Tool `id`. */
export const deleteHelpTool = (tools: readonly Tool[], id: string): Tool[] => tools.filter((t) => t.id !== id);

/** The switches without the Tool `id`. */
export function dropHelpToolSwitch(switches: ToolEnabledMap, id: string): ToolEnabledMap {
  const { [id]: _, ...rest } = switches;
  return rest;
}

/** The stored Tool list read back: a malformed Tool, a repeated id, a taken name or a reserved name drops. */
export function parseHelpTools(raw: unknown): Tool[] {
  if (!Array.isArray(raw)) return [];
  const tools: Tool[] = [];
  for (const entry of raw) {
    const result = parseTool(entry);
    if ('tool' in result && !tools.some((t) => t.id === result.tool.id) && !toolNameProblem(result.tool.name, tools, { reserved: HELP_RESERVED_TOOL_NAMES })) tools.push(result.tool);
  }
  return tools;
}

/** The stored switches read back, kept only for the Tools in `tools`. */
export function parseHelpToolSwitches(raw: unknown, tools: readonly Tool[]): ToolEnabledMap {
  const ids = new Set(tools.map((t) => t.id));
  return parseToolEnabledMap(raw, (id) => ids.has(id)) ?? {};
}

/** The Tools whose switch is on, in list order. */
export const helpToolsOn = (tools: readonly Tool[], switches: ToolEnabledMap): Tool[] => tools.filter((t) => switches[t.id] === true);
