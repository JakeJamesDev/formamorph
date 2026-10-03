import type { Tool, ToolParam } from '@/types';

/** One parameter as JSON Schema. An enum is a string with its options listed. */
export type ToolParamSchema =
  | { type: 'string' | 'number' | 'boolean'; description?: string }
  | { type: 'string'; enum: string[]; description?: string };

/** A Tool as the chat-completions `tools` array carries it: what the AI receives. */
export interface ToolFunctionSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParamSchema>;
      required: string[];
      additionalProperties: false;
    };
  };
}

function paramSchema(param: ToolParam): ToolParamSchema {
  const description = param.description.trim() ? { description: param.description } : {};
  return param.type === 'enum'
    ? { type: 'string', enum: [...param.options], ...description }
    : { type: param.type, ...description };
}

/** What a request reads of a function it offers. A Tool is one; an app-internal function names only these. */
export type OfferedFunction = Pick<Tool, 'id' | 'name' | 'description' | 'params' | 'callLimit'>;

/** Whether an offered function is a Tool with a handler, not an app-internal function. */
export const isTool = (fn: OfferedFunction): fn is Tool => 'handler' in fn;

/** The schema the AI receives for `tool`. */
export function toolSchema(tool: OfferedFunction): ToolFunctionSchema {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(tool.params.map((p) => [p.name, paramSchema(p)])),
        required: tool.params.filter((p) => p.required).map((p) => p.name),
        additionalProperties: false,
      },
    },
  };
}
