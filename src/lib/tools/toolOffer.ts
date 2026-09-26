import type { AIRequestType, Tool, ToolEnabledMap } from '@/types';
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import { runToolCall } from './toolRunner';
import type { ToolSnapshot } from './toolSnapshot';

/** The Tools `kind` offers, in list order: those `enabled` (the active preset's map) switches on. `tools` is
 *  the catalog, then the user Tools. `toolsEnabled` is the global Tools switch; off offers none. */
export function toolsOfferedTo(kind: AIRequestType, tools: readonly Tool[], enabled: ToolEnabledMap, toolsEnabled: boolean): Tool[] {
  if (!toolsEnabled) return [];
  return tools.filter((tool) => enabled[tool.id] === true && tool.offeredTo.includes(kind));
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
