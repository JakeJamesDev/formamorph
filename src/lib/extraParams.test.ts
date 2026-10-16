import { describe, it, expect } from 'vitest';
import { extraParamsOf, readExtraParams } from './extraParams';

describe('extra parameters', () => {
  it('reads one JSON object, and nothing from empty text', () => {
    expect(readExtraParams('{"top_a": 0.1, "chat_template_kwargs": {"enable_thinking": true}}')).toEqual({
      params: { top_a: 0.1, chat_template_kwargs: { enable_thinking: true } },
    });
    expect(readExtraParams('  ')).toEqual({ params: {} });
  });

  it('says why text can not be used, and merges nothing from it', () => {
    expect(readExtraParams('{top_a: 1}')).toMatchObject({ error: expect.stringMatching(/^Not valid JSON/) });
    expect(readExtraParams('[1, 2]')).toMatchObject({ error: expect.stringMatching(/one JSON object/) });
    expect(readExtraParams('{"model": "x", "stream": false}')).toMatchObject({ error: expect.stringMatching(/model, stream/) });
    expect(extraParamsOf('{"model": "x"}')).toEqual({});
  });

  it.each(['tools', 'tool_choice', 'response_format', 'n', 'stop'])('refuses %s, which shapes the reply', (key) => {
    expect(readExtraParams(`{"${key}": null}`)).toMatchObject({ error: expect.stringContaining(key) });
  });
});
