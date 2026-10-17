/** A world's own Tools (`World.tools`): reading them off an untrusted world and naming the Tool one replaces. */
import type { ScriptTiming, Tool, ToolScriptTiming } from '@/types';
import { catalogToolNamed, isRecord, parseTool, sameToolName } from './toolValidation';

/** The script timing a Script World Tool runs on: On Call is the Before the AI box's turn state (Q40). */
export const SCRIPT_TIMING_OF_TOOL = { call: 'before', output: 'output', after: 'after' } as const satisfies Record<ToolScriptTiming, ScriptTiming>;

/** The timing of a Tool's handler: a Script's own, else On Call, which a Lookup and a Template share. */
export const toolTimingOf = ({ handler }: Pick<Tool, 'handler'>): ToolScriptTiming => (handler.kind === 'script' ? handler.timing ?? 'call' : 'call');

/** `tools` with each Script Tool that `codeById` names holding its new code; every other field and Tool stays. */
export const withToolCode = (tools: readonly Tool[], codeById: Readonly<Record<string, string>>): Tool[] =>
  tools.map((tool) => (tool.handler.kind === 'script' && tool.id in codeById
    ? { ...tool, handler: { ...tool.handler, code: codeById[tool.id] } }
    : tool));

/** A World Tool that `readWorldTools` dropped: its name when it has one, and why. */
export interface DroppedWorldTool {
  name: string | null;
  reason: string;
}

/** The well-formed Tools of `raw`, in order, and the ones dropped. An unreadable Tool drops, and so does one
 *  that repeats an earlier Tool's name or id. */
export function readWorldTools(raw: unknown): { tools: Tool[]; dropped: DroppedWorldTool[] } {
  const tools: Tool[] = [];
  const dropped: DroppedWorldTool[] = [];
  if (!Array.isArray(raw)) return { tools, dropped };
  for (const entry of raw) {
    const result = parseTool(entry, { world: true });
    if (!('tool' in result)) {
      dropped.push({ name: isRecord(entry) && typeof entry.name === 'string' && entry.name ? entry.name : null, reason: result.error });
      continue;
    }
    const { tool } = result;
    const repeat = tools.find((kept) => kept.id === tool.id || sameToolName(kept.name, tool.name));
    if (repeat) {
      dropped.push({ name: tool.name, reason: sameToolName(repeat.name, tool.name) ? 'another World Tool has its name' : 'another World Tool has its id' });
      continue;
    }
    tools.push(tool);
  }
  return { tools, dropped };
}

/** The well-formed Tools of `raw`, in order. */
export const parseWorldTools = (raw: unknown): Tool[] => readWorldTools(raw).tools;

/** An imported `world` with its malformed and duplicate World Tools dropped (Q34), and the warning that names
 *  them; the same world and a null warning when none dropped. */
export function withImportedWorldTools<W extends { tools?: Tool[] }>(world: W): { world: W; warning: string | null } {
  const { tools, dropped } = readWorldTools(world.tools);
  if (!dropped.length) return { world, warning: null };
  const each = dropped.map(({ name, reason }) => `${name === null ? 'a Tool' : `"${name}"`}: ${reason}`);
  return {
    world: { ...world, tools },
    warning: `Dropped ${dropped.length} World ${dropped.length === 1 ? 'Tool' : 'Tools'}. ${each.join('; ')}.`,
  };
}

/** `tools` with the Tool `activeId` moved to the place of `overId`; the same list when either is missing. */
export function reorderTools(tools: readonly Tool[], activeId: string, overId: string): readonly Tool[] {
  const from = tools.findIndex((t) => t.id === activeId);
  const to = tools.findIndex((t) => t.id === overId);
  if (from < 0 || to < 0 || from === to) return tools;
  const next = [...tools];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/** The catalog or user Tool a World Tool replaces in its world (Q7). */
export interface WorldToolClash {
  kind: 'catalog' | 'user';
  name: string;
}

/** The Tool `tool` replaces: a catalog Tool first, else one of `userTools`. */
export function worldToolClash(tool: Tool, userTools: readonly Tool[]): WorldToolClash | null {
  const catalog = catalogToolNamed(tool.name);
  if (catalog) return { kind: 'catalog', name: catalog.name };
  const user = userTools.find((t) => sameToolName(t.name, tool.name));
  return user ? { kind: 'user', name: user.name } : null;
}
