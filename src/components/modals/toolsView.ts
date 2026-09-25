import type { Tool } from '@/types';
import { REQUEST_LABELS } from '@/lib/promptGroups';
import { DEFAULT_TOOL_CALL_LIMIT } from '@/contexts/settingsDefaults';

/** Where the Tools tab is: the selected Tool, and the draft open in edit mode. Held by the caller so a
 *  full-screen toggle, which remounts the tab, keeps it. */
export interface ToolsView {
  selectedId: string | null;
  draft: Tool | null;
}

export const EMPTY_TOOLS_VIEW: ToolsView = { selectedId: null, draft: null };

const SOURCE_LABEL = { entities: 'entities', locations: 'locations', dictionary: 'dictionary entries' } as const;

/** What the Tool does, in one line. */
export function toolSummary(tool: Tool): string {
  const h = tool.handler;
  const does = h.kind === 'lookup'
    ? `Looks up ${SOURCE_LABEL[h.source]} by ${h.param || '(no parameter)'} and returns the ${h.returns === 'full' ? 'full description' : 'summary'}`
    : h.kind === 'template' ? 'Returns a template' : 'Runs a script';
  const offered = tool.offeredTo.map((k) => REQUEST_LABELS[k]).join(', ') || 'no prompts';
  const limit = tool.callLimit ?? DEFAULT_TOOL_CALL_LIMIT;
  return `${does} · Offered to ${offered} · ${limit} call${limit === 1 ? '' : 's'} per request`;
}
