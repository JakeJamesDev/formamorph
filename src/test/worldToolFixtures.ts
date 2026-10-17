import type { Tool, ToolScriptTiming } from '@/types';

/** A Script World Tool holding `code` at `timing`. */
export function scriptWorldTool(id: string, name: string, code: string, timing: ToolScriptTiming = 'after'): Tool {
  return { id, name, description: '', params: [], emptyResult: '{}', offeredTo: [], handler: { kind: 'script', code, timing } };
}
