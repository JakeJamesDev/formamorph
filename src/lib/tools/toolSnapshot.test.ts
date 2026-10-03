import { describe, expect, it } from 'vitest';
import { helpTool } from '@/test/helpFixtures';
import { runToolCall } from './toolRunner';
import { emptyToolSnapshot } from './toolSnapshot';

describe('the empty Tool Snapshot', () => {
  it('holds no world, so a lookup returns its empty result', async () => {
    const tool = helpTool();
    expect(await runToolCall(tool, '{"name":"Wren"}', emptyToolSnapshot())).toEqual({ text: tool.emptyResult });
  });

  it('renders a Template’s scene chips as a world with nothing in it does', async () => {
    const template = helpTool({ handler: { kind: 'template', body: 'Notes: <NOTES>' }, params: [] });
    expect((await runToolCall(template, '', emptyToolSnapshot())).text).toBe('Notes: N/A');
  });
});
