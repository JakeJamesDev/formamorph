import type {
  AIRequestType, Tool, ToolEnabledMap, ToolHandler, ToolLookupSource, ToolParam, ToolParamType, ToolScriptHandler, ToolScriptTiming,
} from '@/types';
import { PROMPT_REQUEST_KINDS } from '@/lib/reasoningEffort';
import { TOOL_CATALOG } from './toolCatalog';
import { migrateUserToolScript } from './toolTextMigration';

/** The longest Tool name endpoints accept. */
export const TOOL_NAME_MAX = 64;

/** The function-name rule endpoints enforce. */
export const TOOL_NAME_PATTERN = new RegExp(`^[A-Za-z0-9_-]{1,${TOOL_NAME_MAX}}$`);

/** Why a Tool name can't be saved: bad characters or length, used by another user Tool, or a catalog name. */
export type ToolNameProblem = 'format' | 'taken' | 'builtin';

/** Whether two Tool names clash, ignoring case. */
export const sameToolName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The catalog Tool named `name`, if any. */
export const catalogToolNamed = (name: string): Tool | undefined => TOOL_CATALOG.find((t) => sameToolName(t.name, name));

/** What a name check leaves out of "taken", and what it counts as built-in. */
export interface ToolNameCheck {
  /** The Tool being renamed, which may keep its own name. */
  selfId?: string;
  /** The caller's fixed function names, which count as built-in. */
  reserved?: readonly string[];
  /** A World Tool, which may take a catalog name and replace that Tool (Q22). */
  world?: boolean;
}

/** The problem with naming a Tool `name` among the other Tools of its list, `tools`, or null. */
export function toolNameProblem(name: string, tools: readonly Tool[], { selfId, reserved = [], world = false }: ToolNameCheck = {}): ToolNameProblem | null {
  if (!TOOL_NAME_PATTERN.test(name)) return 'format';
  if ((!world && catalogToolNamed(name)) || reserved.some((taken) => sameToolName(taken, name))) return 'builtin';
  if (tools.some((t) => t.id !== selfId && sameToolName(t.name, name))) return 'taken';
  return null;
}

type Raw = Record<string, unknown>;
export const isRecord = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const PARAM_TYPES: readonly ToolParamType[] = ['string', 'number', 'boolean', 'enum'];

/** The lookup sources a user Tool can store; `memories` is catalog-only. */
const USER_LOOKUP_SOURCES: readonly ToolLookupSource[] = ['entities', 'locations', 'dictionary'];

/** Whether a user Tool can store `handler`, so a copy of a Tool with it can save. */
export const userCanStore = (handler: ToolHandler) => handler.kind !== 'lookup' || USER_LOOKUP_SOURCES.includes(handler.source);
const REQUEST_KINDS: readonly string[] = PROMPT_REQUEST_KINDS;

/** Known prompt kinds only; a kind from a newer version drops. Null when `raw` isn't a list. */
export function parseOfferedTo(raw: unknown): AIRequestType[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((k): k is AIRequestType => typeof k === 'string' && REQUEST_KINDS.includes(k));
}

/** Whether `raw` is a call limit: a whole number of 1 or more. */
export const isCallLimit = (raw: unknown): raw is number => typeof raw === 'number' && Number.isInteger(raw) && raw >= 1;

function parseParam(raw: unknown): ToolParam | null {
  if (!isRecord(raw)) return null;
  const { name, type, description, required, options } = raw;
  if (typeof name !== 'string' || !name) return null;
  if (typeof type !== 'string' || !(PARAM_TYPES as readonly string[]).includes(type)) return null;
  if (typeof description !== 'string' || typeof required !== 'boolean') return null;
  if (!Array.isArray(options) || !options.every((o) => typeof o === 'string')) return null;
  return { name, type: type as ToolParamType, description, required, options: [...options] };
}

const SCRIPT_TIMINGS: readonly ToolScriptTiming[] = ['call', 'output', 'after'];

/** Whether a Script handler at `timing` arms a trigger rather than running at the call. */
export const armsTrigger = (timing: ToolScriptTiming | undefined): timing is 'output' | 'after' =>
  timing === 'output' || timing === 'after';

/** A Script handler's World Tool fields, or why they can't be read. A user Tool may hold none of them (Q12). */
function parseScriptFields(raw: Raw, world: boolean): Omit<ToolScriptHandler, 'kind' | 'code'> | string {
  const { timing, reply, stack } = raw;
  if (!world) return timing === undefined && reply === undefined && stack === undefined ? {} : 'only a World Tool can have a timing, Reply or Stack Calls';
  if (timing !== undefined && !SCRIPT_TIMINGS.includes(timing as ToolScriptTiming)) return 'its timing is unknown';
  if (reply !== undefined && typeof reply !== 'string') return 'its reply is not text';
  if (stack !== undefined && typeof stack !== 'boolean') return 'its Stack Calls setting is not true or false';
  const at = timing as ToolScriptTiming | undefined;
  if (!armsTrigger(at)) return at ? { timing: at } : {};
  return { timing: at, ...(reply ? { reply } : {}), ...(stack ? { stack } : {}) };
}

function parseHandler(raw: unknown, world: boolean): ToolHandler | string | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'lookup') {
    const { param, returns } = raw;
    const source = USER_LOOKUP_SOURCES.find((s) => s === raw.source);
    if (!source) return null;
    if (typeof param !== 'string' || (returns !== 'full' && returns !== 'summary')) return null;
    return { kind: 'lookup', source, param, returns };
  }
  if (raw.kind === 'template') return typeof raw.body === 'string' ? { kind: 'template', body: raw.body } : null;
  if (raw.kind === 'script') {
    if (typeof raw.code !== 'string') return null;
    const fields = parseScriptFields(raw, world);
    // A world's Tool scripts migrate with the world; a user Tool's migrate here, at every load and import.
    return typeof fields === 'string' ? fields : { kind: 'script', code: world ? raw.code : migrateUserToolScript(raw.code), ...fields };
  }
  return null;
}

/**
 * Validate an untrusted user Tool, such as one in a Tool pack or local storage, or a `world` Tool. Every field must be well-formed or the
 * whole Tool is rejected with a reason; only prompt kinds from a newer version are dropped quietly.
 */
export function parseTool(raw: unknown, { world = false }: { world?: boolean } = {}): { tool: Tool } | { error: string } {
  if (!isRecord(raw)) return { error: "it isn't a Tool" };
  const { id, name, description, emptyResult, callLimit } = raw;
  if (typeof id !== 'string' || !id) return { error: 'it has no id' };
  if (typeof name !== 'string') return { error: 'it has no name' };
  const nameProblem = toolNameProblem(name, [], { world });
  if (nameProblem === 'format') return { error: 'its name uses characters other than letters, digits, _ and -, or is over 64 characters' };
  if (nameProblem === 'builtin') return { error: 'its name is a built-in Tool name' };
  if (typeof description !== 'string') return { error: 'it has no description' };
  if (!Array.isArray(raw.params)) return { error: 'its parameters are unreadable' };
  const params: ToolParam[] = [];
  for (const p of raw.params) {
    const param = parseParam(p);
    if (!param) return { error: 'a parameter is unreadable' };
    if (params.some((q) => q.name === param.name)) return { error: `the parameter "${param.name}" appears twice` };
    params.push(param);
  }
  const handler = parseHandler(raw.handler, world);
  if (!handler) return { error: 'its handler is unreadable' };
  if (typeof handler === 'string') return { error: handler };
  if (typeof emptyResult !== 'string') return { error: 'it has no empty result' };
  const offeredTo = parseOfferedTo(raw.offeredTo);
  if (!offeredTo) return { error: 'its prompt list is unreadable' };
  if (callLimit !== undefined && !isCallLimit(callLimit)) {
    return { error: 'its call limit is not a whole number of 1 or more' };
  }
  return {
    tool: {
      id, name, description, params, handler, emptyResult, offeredTo,
      ...(callLimit !== undefined ? { callLimit } : {}),
    },
  };
}

/** Keep the boolean entries whose id `keep` accepts; undefined when none remain. */
export function parseToolEnabledMap(raw: unknown, keep: (id: string) => boolean = () => true): ToolEnabledMap | undefined {
  if (!isRecord(raw)) return undefined;
  const out: ToolEnabledMap = {};
  for (const [id, on] of Object.entries(raw)) if (typeof on === 'boolean' && keep(id)) out[id] = on;
  return Object.keys(out).length ? out : undefined;
}
