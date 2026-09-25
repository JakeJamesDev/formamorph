import type { AIRequestType, Tool } from '@/types';
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import { runToolCall } from './toolRunner';
import type { ToolSnapshot } from './toolSnapshot';

/** The enabled Tools `kind` offers, in list order. `tools` is the preset's catalog view, then its own Tools. */
export function toolsOfferedTo(kind: AIRequestType, tools: readonly Tool[]): Tool[] {
  return tools.filter((tool) => tool.enabled && tool.offeredTo.includes(kind));
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
