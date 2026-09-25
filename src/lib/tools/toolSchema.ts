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

/** The schema the AI receives for `tool`. */
export function toolSchema(tool: Tool): ToolFunctionSchema {
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
