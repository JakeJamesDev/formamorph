/**
 * The edit-mode rules for a user Tool: what blocks Save, how a parameter rename carries the lookup, the
 * handler each kind starts from, and the arguments Try It sends. React-free.
 */
import type { Tool, ToolHandler, ToolParam } from '@/types';
import { toolNameProblem, type ToolNameProblem } from './toolValidation';

/** What blocks saving a draft: the name's problem, one entry per parameter, and the handler's. */
export interface DraftProblems {
  name: ToolNameProblem | null;
  params: (string | null)[];
  handler: string | null;
}

const listOptions = (param: ToolParam) => param.options.map((o) => o.trim()).filter(Boolean);

function paramProblem(param: ToolParam, params: readonly ToolParam[]): string | null {
  if (!param.name.trim()) return 'Name the parameter';
  if (params.filter((p) => p.name === param.name).length > 1) return 'Another parameter uses this name';
  if (param.type === 'enum' && listOptions(param).length === 0) return 'Add at least one option';
  return null;
}

/** Every problem with `draft` among the preset's own `tools`. */
export function draftProblems(draft: Tool, tools: readonly Tool[]): DraftProblems {
  const { handler, params } = draft;
  return {
    name: toolNameProblem(draft.name, tools, draft.id),
    params: params.map((p) => paramProblem(p, params)),
    handler: handler.kind === 'lookup' && !params.some((p) => p.name === handler.param)
      ? 'Choose the parameter to search by'
      : null,
  };
}

export const hasDraftProblems = (problems: DraftProblems): boolean =>
  problems.name !== null || problems.handler !== null || problems.params.some((p) => p !== null);

/** Rename parameter `index`. A lookup searching by it follows, unless another parameter held the old name. */
export function renameParam(draft: Tool, index: number, name: string): Tool {
  const old = draft.params[index].name;
  const params = draft.params.map((p, i) => (i === index ? { ...p, name } : p));
  const { handler } = draft;
  const follows = handler.kind === 'lookup' && handler.param === old
    && draft.params.filter((p) => p.name === old).length === 1;
  return { ...draft, params, handler: follows ? { ...handler, param: name } : handler };
}

/** `draft` with a fresh handler of `kind`. A lookup starts on the first parameter. */
export function withHandlerKind(draft: Tool, kind: ToolHandler['kind']): Tool {
  if (draft.handler.kind === kind) return draft;
  const handler: ToolHandler = kind === 'lookup'
    ? { kind, source: 'entities', param: draft.params[0]?.name ?? '', returns: 'full' }
    : kind === 'template' ? { kind, body: '' } : { kind, code: '' };
  return { ...draft, handler };
}

/** The draft as saved: each list's options trimmed with the blanks dropped, and no options off a list. */
export function finishDraft(draft: Tool): Tool {
  return { ...draft, params: draft.params.map((p) => ({ ...p, options: p.type === 'enum' ? listOptions(p) : [] })) };
}

/** Try It's inputs as the argument string a model would send. A blank input is left out, and a number
 *  input that doesn't read as one goes as text, so the runner answers as it would answer the model. */
export function tryItArguments(params: readonly ToolParam[], inputs: Readonly<Record<string, string>>): string {
  // No prototype, so a parameter named `__proto__` is a plain key.
  const args: Record<string, string | number | boolean> = Object.create(null);
  for (const param of params) {
    const raw = inputs[param.name];
    if (raw === undefined || raw.trim() === '') continue;
    if (param.type === 'number') args[param.name] = Number.isFinite(Number(raw)) ? Number(raw) : raw;
    else if (param.type === 'boolean') args[param.name] = raw === 'true';
    else args[param.name] = raw;
  }
  return JSON.stringify(args);
}
