/** A world's own Tools (`World.tools`): reading them off an untrusted world and naming the Tool one replaces. */
import type { Tool } from '@/types';
import { catalogToolNamed, parseTool, sameToolName } from './toolValidation';

/** The well-formed Tools of `raw`, in order. An unreadable Tool drops, and so does one that repeats an earlier
 *  Tool's name or id. */
export function parseWorldTools(raw: unknown): Tool[] {
  if (!Array.isArray(raw)) return [];
  const tools: Tool[] = [];
  for (const entry of raw) {
    const result = parseTool(entry, { world: true });
    if (!('tool' in result)) continue;
    const { tool } = result;
    if (tools.some((kept) => kept.id === tool.id || sameToolName(kept.name, tool.name))) continue;
    tools.push(tool);
  }
  return tools;
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
