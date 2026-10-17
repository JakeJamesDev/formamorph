import type { AIRequestType, Tool, ToolEnabledMap } from '@/types';
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import { runToolCall } from './toolRunner';
import type { ToolSnapshot } from './toolSnapshot';
import { sameToolName } from './toolValidation';

/** The Tools `kind` offers, in list order: those `enabled` (the active preset's map) switches on, then every
 *  World Tool. `tools` is the catalog, then the user Tools. A World Tool replaces a same-name Tool for every
 *  prompt (Q20). `toolsEnabled` is the global Tools switch; off offers none. */
export function toolsOfferedTo(
  kind: AIRequestType, tools: readonly Tool[], enabled: ToolEnabledMap, toolsEnabled: boolean, worldTools: readonly Tool[] = [],
): Tool[] {
  if (!toolsEnabled) return [];
  const replaced = (tool: Tool) => worldTools.some((mine) => sameToolName(mine.name, tool.name));
  return [
    ...tools.filter((tool) => enabled[tool.id] === true && tool.offeredTo.includes(kind) && !replaced(tool)),
    ...worldTools.filter((tool) => tool.offeredTo.includes(kind)),
  ];
}

/** An executor that builds its Tool Snapshot at the first call and reads that one snapshot for every later
 *  call, so every request that shares it sees the same world. */
export function snapshotToolExecutor(build: () => ToolSnapshot): ToolExecutor {
  let snapshot: ToolSnapshot | null = null;
  return (tool, argumentsText) => {
    snapshot ??= build();
    return runToolCall(tool, argumentsText, snapshot);
  };
}
