/**
 * The edit-mode rules for a user Tool: what blocks Save, how a parameter rename carries the lookup, the
 * handler each kind starts from, and the arguments Try It sends. React-free.
 */
import type { AIRequestType, Tool, ToolHandler, ToolParam } from '@/types';
import { toolNameProblem, type ToolNameProblem } from './toolValidation';

/** Why a parameter blocks Save: no name, a name another parameter uses, or a list with no options. */
export type ParamProblem = 'unnamed' | 'repeated' | 'noOptions';

/** Why the handler blocks Save: a lookup searching by a parameter the Tool doesn't have. */
export type HandlerProblem = 'lookupParam';

/** What blocks saving a draft: the name's problem, one entry per parameter, and the handler's. */
export interface DraftProblems {
  name: ToolNameProblem | null;
  params: (ParamProblem | null)[];
  handler: HandlerProblem | null;
}

/** The parameters that have a name. An unnamed one is a draft still being typed. */
export const namedParams = (params: readonly ToolParam[]): ToolParam[] => params.filter((p) => p.name.trim());

/** A list parameter's options, trimmed, without the blank ones. */
export const listOptions = (param: ToolParam): string[] => param.options.map((o) => o.trim()).filter(Boolean);

function paramProblem(param: ToolParam, params: readonly ToolParam[]): ParamProblem | null {
  if (!param.name.trim()) return 'unnamed';
  if (params.filter((p) => p.name === param.name).length > 1) return 'repeated';
  if (param.type === 'enum' && listOptions(param).length === 0) return 'noOptions';
  return null;
}

/** A new Tool: a lookup on entities with no parameters yet, offered to narration, or to no prompt where one request takes every Tool. */
export const blankTool = (id: string, offeredTo: AIRequestType[] = ['narration']): Tool => ({
  id, name: '', description: '', params: [],
  handler: { kind: 'lookup', source: 'entities', param: '', returns: 'full' },
  emptyResult: '{"matches": []}', offeredTo,
});

/** Every problem with `draft` among the user `tools`. `reserved` names are the caller's fixed functions. */
export function draftProblems(draft: Tool, tools: readonly Tool[], reserved: readonly string[] = []): DraftProblems {
  const { handler, params } = draft;
  return {
    name: toolNameProblem(draft.name, tools, { selfId: draft.id, reserved }),
    params: params.map((p) => paramProblem(p, params)),
    handler: handler.kind === 'lookup' && !params.some((p) => p.name === handler.param) ? 'lookupParam' : null,
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

/** The handler each kind last had in this edit, so switching away and back restores it. */
export type KeptHandlers = Partial<Record<ToolHandler['kind'], ToolHandler>>;

/** `draft` switched to a handler of `kind`: the one `kept` holds, else a fresh one. A fresh lookup starts on
 *  the first parameter. The handler switched away from joins `kept`. */
export function withHandlerKind(
  draft: Tool, kind: ToolHandler['kind'], kept: KeptHandlers = {},
): { draft: Tool; kept: KeptHandlers } {
  if (draft.handler.kind === kind) return { draft, kept };
  const handler: ToolHandler = kept[kind] ?? (kind === 'lookup'
    ? { kind, source: 'entities', param: draft.params[0]?.name ?? '', returns: 'full' }
    : kind === 'template' ? { kind, body: '' } : { kind, code: '' });
  return { draft: { ...draft, handler }, kept: { ...kept, [draft.handler.kind]: draft.handler } };
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
