import { describe, it, expect } from 'vitest';
import type { Tool, ToolParam } from '@/types';
import { TOOL_CATALOG } from './toolCatalog';
import { toolSchema } from './toolSchema';

const param = (name: string, over: Partial<ToolParam> = {}): ToolParam =>
  ({ name, type: 'string', description: '', required: true, options: [], ...over });

const tool = (params: ToolParam[], over: Partial<Tool> = {}): Tool => ({
  id: 't', name: 'peek', description: 'Purpose: look.', params, handler: { kind: 'template', body: 'x' },
  emptyResult: '{}', offeredTo: ['narration'], enabled: true, ...over,
});

describe('toolSchema', () => {
  it('spells each parameter type as JSON Schema and lists the required ones', () => {
    const schema = toolSchema(tool([
      param('name', { description: 'Who.' }),
      param('count', { type: 'number', required: false }),
      param('loud', { type: 'boolean' }),
      param('mood', { type: 'enum', options: ['calm', 'wary'], required: false }),
    ]));

    expect(schema).toEqual({
      type: 'function',
      function: {
        name: 'peek',
        description: 'Purpose: look.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Who.' },
            count: { type: 'number' },
            loud: { type: 'boolean' },
            mood: { type: 'string', enum: ['calm', 'wary'] },
          },
          required: ['name', 'loud'],
          additionalProperties: false,
        },
      },
    });
  });

  it('omits a blank parameter description rather than sending an empty string', () => {
    const getEntity = TOOL_CATALOG.find((t) => t.id === 'get_entity')!;
    const { properties } = toolSchema(getEntity).function.parameters;
    expect(properties.name).toEqual({ type: 'string' });
  });

  it('gives a Tool with no parameters an empty object schema', () => {
    expect(toolSchema(tool([])).function.parameters).toEqual({
      type: 'object', properties: {}, required: [], additionalProperties: false,
    });
  });
});
