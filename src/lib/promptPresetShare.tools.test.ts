import { describe, it, expect } from 'vitest';
import { buildSharedPreset, serializeSharedJson, serializeSharedCode, parseSharedJson, parseSharedCode } from './promptPresetShare';
import type { PromptValues } from './promptPresets';

const APP = '2.1.0';
const values = { systemPrompt: 'You are the narrator.' } as unknown as PromptValues;
const base = { name: 'Tooled', style: 'markdown' as const, values };

describe('sharing Tool switches with a preset', () => {
  it('round-trips catalog switches through JSON and the share code', () => {
    const shared = buildSharedPreset({ ...base, enabledTools: { get_entity: true } }, APP);
    for (const r of [parseSharedJson(serializeSharedJson(shared), APP), parseSharedCode(serializeSharedCode(shared), APP)]) {
      expect(r.ok).toBe(true);
      expect(r.preset!.enabledTools).toEqual({ get_entity: true });
      expect(r.warnings).toEqual([]);
    }
  });

  it('leaves user Tool ids out of the export, since they name nothing on another machine', () => {
    const shared = buildSharedPreset({ ...base, enabledTools: { get_entity: false, 'u-weather': true } }, APP);
    expect(shared.enabledTools).toEqual({ get_entity: false });
    expect(serializeSharedJson(shared)).not.toContain('u-weather');
  });

  it('keeps only catalog switches on import', () => {
    const raw = { ...buildSharedPreset(base, APP), enabledTools: { get_entity: true, 'u-weather': true, get_future: 'on' } };
    expect(parseSharedJson(JSON.stringify(raw), APP).preset!.enabledTools).toEqual({ get_entity: true });
  });

  it('carries no Tool definitions either way', () => {
    const raw = { ...buildSharedPreset(base, APP), tools: [{ id: 't1', name: 'get_weather' }] };
    expect(parseSharedJson(JSON.stringify(raw), APP).preset).toEqual({ name: 'Tooled', style: 'markdown', values });
  });
});

describe('a preset without Tool switches', () => {
  it('exports with no Tool fields', () => {
    const shared = buildSharedPreset({ ...base, enabledTools: { 'u-weather': true } }, APP);
    expect('enabledTools' in shared).toBe(false);
    expect(serializeSharedJson(shared)).toBe(serializeSharedJson(buildSharedPreset(base, APP)));
  });

  it('imports with no Tool fields and nothing to report', () => {
    const r = parseSharedJson(serializeSharedJson(buildSharedPreset(base, APP)), APP);
    expect(r.ok).toBe(true);
    expect(r.preset).toEqual({ name: 'Tooled', style: 'markdown', values });
    expect(r.warnings).toEqual([]);
  });
});
