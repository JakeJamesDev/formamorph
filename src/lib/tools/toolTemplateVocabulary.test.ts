import { describe, it, expect } from 'vitest';
import type { Tool, ToolParam } from '@/types';
import { runToolCall } from './toolRunner';
import { sampleToolSnapshot } from './toolSnapshot';
import { TEMPLATE_SCENE_VARIABLES, toolTemplateVocabulary } from './toolTemplateVocabulary';

const params: ToolParam[] = [
  { name: 'name', type: 'string', description: 'Who to greet.', required: true, options: [] },
  { name: 'loud', type: 'boolean', description: '', required: false, options: [] },
];
const vocab = toolTemplateVocabulary(params);

describe('the Template chip family', () => {
  it('reads parameters and scene chips as chips', () => {
    const chips = vocab.parse('Hello {{arg:name}} at <LOCATION>.').filter((s) => s.type === 'variable');
    expect(chips.map((s) => s.type === 'variable' && vocab.isKnown(s.token))).toEqual([true, true]);
    expect(vocab.label('{{arg:name}}')).toBe('name');
    expect(vocab.hint?.('{{arg:name}}')).toBe('Who to greet.');
    expect(vocab.hint?.('{{arg:loud}}')).toBe('What the AI passed');
  });

  it('reads a chip for a parameter that is gone as text', () => {
    expect(vocab.isKnown('{{arg:who}}')).toBe(false);
  });

  it('offers the parameters first, then only scene chips', () => {
    const offered = vocab.palette().map((row) => row.label);
    expect(offered.slice(0, 2)).toEqual(['name', 'loud']);
    expect(offered).toContain('Location');
    expect(offered).not.toContain('Player Action');
    expect(offered).not.toContain('Narration');
  });

  it('offers only chips the runner fills', async () => {
    const tool: Tool = {
      id: 't', name: 'greet', description: '', params,
      handler: { kind: 'template', body: vocab.palette().map((row) => row.token).join('\n') },
      emptyResult: '', offeredTo: ['narration'],
    };
    const { text, failure } = await runToolCall(tool, '{"name": "Wren", "loud": true}', sampleToolSnapshot());
    expect(failure).toBeUndefined();
    expect(text).toContain('Wren');
    for (const v of TEMPLATE_SCENE_VARIABLES) expect(text).not.toContain(v.token);
    expect(text).not.toContain('{{arg:');
  });
});
