/**
 * The Tool Runner: one call of one Tool, from the model's argument string to the text the model reads back.
 * React-free. It reads only the Tool Snapshot it is given and never throws into the caller.
 */
import type { Tool, ToolHandler, ToolParam } from '@/types';
import { parseTemplateWithPlaceholders, resolvePromptSegments } from '@/lib/promptTemplate';
import { splitToken } from '@/lib/promptVariables';
import { argChipName, splitArgChips } from './argChips';
import { runToolScript } from './toolScript';
import type { ToolSnapshot } from './toolSnapshot';

/** Why a call returned an error result. `arguments` is the model's mistake; the others are the Tool's. */
export type ToolCallFailure = 'arguments' | 'handler' | 'script' | 'timeout';

/** The text the model reads back. `failure` is present exactly when the text is an error result. */
export interface ToolCallResult {
  text: string;
  failure?: ToolCallFailure;
}

/** Validated arguments, by parameter name. An absent optional parameter has no key. */
export type ToolArgs = Readonly<Record<string, string | number | boolean>>;

const failed = (failure: ToolCallFailure, error: string): ToolCallResult =>
  ({ text: JSON.stringify({ error }), failure });

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Why `value` doesn't fit `param`, or null when it does. */
function typeProblem(param: ToolParam, value: unknown): string | null {
  const name = JSON.stringify(param.name);
  switch (param.type) {
    case 'string': return typeof value === 'string' ? null : `Parameter ${name} must be text.`;
    case 'number': return typeof value === 'number' && Number.isFinite(value) ? null : `Parameter ${name} must be a number.`;
    case 'boolean': return typeof value === 'boolean' ? null : `Parameter ${name} must be true or false.`;
    case 'enum': return typeof value === 'string' && param.options.includes(value)
      ? null : `Parameter ${name} must be one of: ${param.options.join(', ')}.`;
  }
}

/** The model's argument string checked against the Tool's parameters. Blank reads as no arguments. */
export function parseToolArgs(params: readonly ToolParam[], argsText: string): { args: ToolArgs } | { error: string } {
  let raw: unknown = {};
  if (argsText.trim()) {
    try {
      raw = JSON.parse(argsText);
    } catch {
      raw = null;
    }
  }
  if (!isRecord(raw)) return { error: 'Arguments must be a JSON object.' };
  const byName = new Map(params.map((p) => [p.name, p]));
  for (const key of Object.keys(raw)) {
    if (!byName.has(key)) {
      const known = params.length ? ` Parameters: ${params.map((p) => p.name).join(', ')}.` : ' This Tool takes no parameters.';
      return { error: `Unknown parameter ${JSON.stringify(key)}.${known}` };
    }
  }
  const args: Record<string, string | number | boolean> = {};
  for (const param of params) {
    const value = Object.hasOwn(raw, param.name) ? raw[param.name] : undefined;
    if (value === undefined || value === null) {
      if (param.required) return { error: `Missing required parameter ${JSON.stringify(param.name)}.` };
      continue;
    }
    const problem = typeProblem(param, value);
    if (problem) return { error: problem };
    args[param.name] = value as string | number | boolean;
  }
  return { args };
}

type Lookup = Extract<ToolHandler, { kind: 'lookup' }>;

function runLookup(tool: Tool, handler: Lookup, args: ToolArgs, { world }: ToolSnapshot): ToolCallResult {
  if (!tool.params.some((p) => p.name === handler.param)) {
    return failed('handler', `The lookup reads parameter ${JSON.stringify(handler.param)}, which this Tool doesn't define.`);
  }
  const needle = String(args[handler.param] ?? '').trim().toLowerCase();
  const same = (text: string) => !!needle && text.trim().toLowerCase() === needle;
  const match = (id: string, name: string, description: string) =>
    (description.trim() ? { id, name, description } : { id, name });
  const pick = (entry: { description: string; summary: string }) =>
    (handler.returns === 'full' ? entry.description : entry.summary);

  const matches = handler.source === 'entities'
    ? world.entities.filter((e) => same(e.name) || e.aliases.some(same)).map((e) => match(e.id, e.name, pick(e)))
    : handler.source === 'locations'
      ? world.locations.filter((l) => same(l.name)).map((l) => match(l.id, l.name, pick(l)))
      : world.dictionary.filter((d) => d.keys.some(same)).map((d) => match(d.id, d.name, d.value));
  return { text: matches.length ? JSON.stringify({ matches }) : tool.emptyResult };
}

const argText = (value: string | number | boolean | undefined) => (value === undefined ? '' : String(value));

/** Render a Template body: scene chips from the snapshot, placeholder chips resolved, parameters bound. */
function runTemplate(tool: Tool, body: string, args: ToolArgs, snapshot: ToolSnapshot): ToolCallResult {
  const segments = parseTemplateWithPlaceholders(body)
    .flatMap((s) => (s.type === 'text' ? splitArgChips(s.value) : [s]));
  const params = new Set(tool.params.map((p) => p.name));
  const values: Record<string, string> = { ...snapshot.chips };
  for (const segment of segments) {
    if (segment.type !== 'variable' || splitToken(segment.token)) continue;
    const name = argChipName(segment.token);
    // Each chip resolves on its own, so an argument's text is never read as a chip.
    if (name === null) values[segment.token] = snapshot.resolve(segment.token);
    else if (params.has(name)) values[segment.token] = argText(args[name]);
  }
  const text = resolvePromptSegments(segments, values).map((part) => part.text).join('');
  return { text: text.trim() ? text : tool.emptyResult };
}

async function runHandler(tool: Tool, args: ToolArgs, snapshot: ToolSnapshot): Promise<ToolCallResult> {
  const { handler } = tool;
  switch (handler.kind) {
    case 'lookup': return runLookup(tool, handler, args, snapshot);
    case 'template': return runTemplate(tool, handler.body, args, snapshot);
    case 'script': {
      const result = await runToolScript(handler.code, args, snapshot);
      if ('error' in result) return failed(result.kind, result.error);
      return { text: result.text === null || !result.text.trim() ? tool.emptyResult : result.text };
    }
  }
}

/** Run one call of `tool` with the model's argument string. Every failure comes back as an error result. */
export async function runToolCall(tool: Tool, argsText: string, snapshot: ToolSnapshot): Promise<ToolCallResult> {
  const parsed = parseToolArgs(tool.params, argsText);
  if ('error' in parsed) return failed('arguments', parsed.error);
  try {
    return await runHandler(tool, parsed.args, snapshot);
  } catch (error) {
    return failed('handler', `The Tool failed: ${(error as Error).message}`);
  }
}
