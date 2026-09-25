import type { Tool } from '@/types';
import { TOOL_NAME_MAX, isRecord, parseTool, toolNameProblem } from './toolValidation';

/**
 * The shared Tool file. `formamorphTools` is the file's own shape version, which import checks; `appVersion`
 * is the build that wrote it, for a person reading the file.
 */
export interface ToolPack {
  formamorphTools: number;
  appVersion: string;
  tools: Tool[];
}

export const TOOL_PACK_VERSION = 1;

/** A pack of the player's own Tools. */
export function buildToolPack(tools: readonly Tool[], appVersion: string): ToolPack {
  return { formamorphTools: TOOL_PACK_VERSION, appVersion, tools: [...tools] };
}

/** Read a pack file. Throws on text that isn't a pack; a malformed Tool drops with a warning. */
export function parseToolPack(json: string): { tools: Tool[]; warnings: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  if (!isRecord(parsed) || typeof parsed.formamorphTools !== 'number' || !Array.isArray(parsed.tools)) {
    throw new Error('That file isn’t a Formamorph Tool pack.');
  }
  const tools: Tool[] = [];
  const warnings: string[] = [];
  if (parsed.formamorphTools > TOOL_PACK_VERSION) warnings.push('This pack was made with a newer format. Anything unrecognized was skipped.');
  for (const raw of parsed.tools) {
    const result = parseTool(raw);
    if ('tool' in result) tools.push(result.tool);
    else warnings.push(`Skipped ${isRecord(raw) && typeof raw.name === 'string' ? `"${raw.name}"` : 'a Tool'}: ${result.error}.`);
  }
  return { tools, warnings };
}

/** Which imported Tools join a preset, each under a fresh id, and which names it already holds. */
export function planToolImport(held: readonly Tool[], imported: readonly Tool[], mintId: () => string): {
  added: Tool[];
  skipped: string[];
  hasScript: boolean;
} {
  const added: Tool[] = [];
  const skipped: string[] = [];
  for (const tool of imported) {
    if (toolNameProblem(tool.name, [...held, ...added])) skipped.push(tool.name);
    else added.push({ ...tool, id: mintId() });
  }
  return { added, skipped, hasScript: added.some((t) => t.handler.kind === 'script') };
}

const COPY_SUFFIX = '_copy';

/** A copy of `tool` as a new user Tool, named `<name>_copy` (numbered when taken) so it saves among `held`. */
export function copyTool(tool: Tool, held: readonly Tool[], id: string): Tool {
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? COPY_SUFFIX : `${COPY_SUFFIX}_${n}`;
    const name = tool.name.slice(0, TOOL_NAME_MAX - suffix.length) + suffix;
    if (!toolNameProblem(name, held)) return { ...structuredClone(tool), id, name };
  }
}
