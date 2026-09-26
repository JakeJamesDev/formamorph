import { Braces, Cog, FileText, Radio } from 'lucide-react';
import type { Tool, ToolHandler } from '@/types';
import type { PanelTab } from '@/components/ui/panel-tabs';
import { REQUEST_LABELS } from '@/lib/promptGroups';
import { DEFAULT_TOOL_CALL_LIMIT } from '@/contexts/settingsDefaults';
import { RECALL_LIMIT } from '@/lib/tools/toolRecall';

/** Edit mode's tabs, in order. */
export const TOOL_EDIT_TABS = [
  { value: 'definition', label: 'Definition', icon: FileText },
  { value: 'parameters', label: 'Parameters', icon: Braces },
  { value: 'handler', label: 'Handler', icon: Cog },
  { value: 'availability', label: 'Availability', icon: Radio },
] as const satisfies readonly PanelTab[];

export type ToolEditTab = (typeof TOOL_EDIT_TABS)[number]['value'];

/** Where the Tools tab is: the selected Tool, the draft open in edit mode and its tab. Held by the caller so
 *  a full-screen toggle, which remounts the tab, keeps it. */
export interface ToolsView {
  selectedId: string | null;
  draft: Tool | null;
  editTab: ToolEditTab;
}

export const EMPTY_TOOLS_VIEW: ToolsView = { selectedId: null, draft: null, editTab: 'definition' };

const SOURCE_LABEL = { entities: 'entities', locations: 'locations', dictionary: 'dictionary entries' } as const;

function lookupSummary(h: Extract<ToolHandler, { kind: 'lookup' }>): string {
  const by = h.param || '(no parameter)';
  if (h.source === 'memories') return `Searches past turns and diaries by ${by} and returns up to ${RECALL_LIMIT} matches`;
  return `Looks up ${SOURCE_LABEL[h.source]} by ${by} and returns the ${h.returns === 'full' ? 'full description' : 'summary'}`;
}

/** What the Tool does, in one line. */
export function toolSummary(tool: Tool): string {
  const h = tool.handler;
  const does = h.kind === 'lookup' ? lookupSummary(h) : h.kind === 'template' ? 'Returns a template' : 'Runs a script';
  const offered = tool.offeredTo.map((k) => REQUEST_LABELS[k]).join(', ') || 'no prompts';
  const limit = tool.callLimit ?? DEFAULT_TOOL_CALL_LIMIT;
  return `${does} · Offered to ${offered} · ${limit} call${limit === 1 ? '' : 's'} per request`;
}
