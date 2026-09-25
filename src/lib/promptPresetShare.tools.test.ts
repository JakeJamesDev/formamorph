import { describe, it, expect } from 'vitest';
import type { Tool } from '@/types';
import { buildSharedPreset, serializeSharedJson, serializeSharedCode, parseSharedJson, parseSharedCode } from './promptPresetShare';
import type { PromptValues } from './promptPresets';

const APP = '2.1.0';
const values = { systemPrompt: 'You are the narrator.' } as unknown as PromptValues;
const tool = (patch: Partial<Tool> = {}): Tool => ({
  id: 't1', name: 'get_weather', description: 'Purpose: weather.',
  params: [{ name: 'place', type: 'string', description: 'Where.', required: true, options: [] }],
  handler: { kind: 'template', body: 'Sunny in {{place}}.' }, emptyResult: 'Nothing.', offeredTo: ['narration'], enabled: true, ...patch,
});
const script = tool({ id: 't2', name: 'roll', handler: { kind: 'script', code: 'return 4;' } });
const overrides = { get_entity: { enabled: true, offeredTo: ['narration' as const] } };
const base = { name: 'Tooled', style: 'markdown' as const, values };

describe('sharing Tools with a preset', () => {
  it('round-trips user Tools and overrides through JSON and the share code', () => {
    const shared = buildSharedPreset({ ...base, tools: [tool(), script], toolOverrides: overrides }, APP);
    for (const r of [parseSharedJson(serializeSharedJson(shared), APP), parseSharedCode(serializeSharedCode(shared), APP)]) {
      expect(r.ok).toBe(true);
      expect(r.preset!.tools).toEqual([tool(), script]);
      expect(r.preset!.toolOverrides).toEqual(overrides);
      expect(r.warnings).toEqual([]);
    }
  });

  it('reports Script Tools, and only when the preset holds one', () => {
    const withScript = parseSharedJson(serializeSharedJson(buildSharedPreset({ ...base, tools: [tool(), script] }, APP)), APP);
    const without = parseSharedJson(serializeSharedJson(buildSharedPreset({ ...base, tools: [tool()] }, APP)), APP);
    expect(withScript.hasScriptTools).toBe(true);
    expect(without.hasScriptTools).toBe(false);
  });

  it('drops a malformed Tool with a reported error and keeps the rest of the preset', () => {
    const shared = buildSharedPreset({ ...base, tools: [tool()], toolOverrides: overrides }, APP);
    const raw = { ...shared, tools: [{ ...tool({ id: 'bad', name: 'bad name' }) }, tool()] };
    const r = parseSharedJson(JSON.stringify(raw), APP);
    expect(r.ok).toBe(true);
    expect(r.preset!.tools).toEqual([tool()]);
    expect(r.preset!.toolOverrides).toEqual(overrides);
    expect(r.preset!.values.systemPrompt).toBe('You are the narrator.');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('bad name');
  });

  it('drops a Tool whose name repeats an earlier one in the file', () => {
    const raw = { ...buildSharedPreset(base, APP), tools: [tool(), tool({ id: 't9', name: 'GET_WEATHER' })] };
    const r = parseSharedJson(JSON.stringify(raw), APP);
    expect(r.preset!.tools).toEqual([tool()]);
    expect(r.warnings).toHaveLength(1);
  });

  it('does not report a script from a Tool it dropped', () => {
    const raw = { ...buildSharedPreset(base, APP), tools: [{ ...script, name: 'get_entity' }] };
    const r = parseSharedJson(JSON.stringify(raw), APP);
    expect(r.preset!.tools).toBeUndefined();
    expect(r.hasScriptTools).toBe(false);
  });

  it('reports an unreadable Tool list', () => {
    const r = parseSharedJson(JSON.stringify({ ...buildSharedPreset(base, APP), tools: 'get_weather' }), APP);
    expect(r.ok).toBe(true);
    expect(r.preset!.tools).toBeUndefined();
    expect(r.warnings).toHaveLength(1);
  });
});

describe('a preset without Tools', () => {
  it('exports with no Tool fields', () => {
    const shared = buildSharedPreset({ ...base, tools: [], toolOverrides: {} }, APP);
    expect('tools' in shared).toBe(false);
    expect('toolOverrides' in shared).toBe(false);
    expect(serializeSharedJson(shared)).toBe(serializeSharedJson(buildSharedPreset(base, APP)));
  });

  it('imports with no Tool fields and nothing to report', () => {
    const r = parseSharedJson(serializeSharedJson(buildSharedPreset(base, APP)), APP);
    expect(r.ok).toBe(true);
    expect(r.preset).toEqual({ name: 'Tooled', style: 'markdown', values });
    expect(r.hasScriptTools).toBe(false);
    expect(r.warnings).toEqual([]);
  });
});
