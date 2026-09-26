import { describe, it, expect } from 'vitest';
import type { Tool } from '@/types';
import { buildSharedPreset, serializeSharedJson, serializeSharedCode, parseSharedJson, parseSharedCode } from './promptPresetShare';
import type { PromptValues } from './promptPresets';

const APP = '2.1.0';
const values = { systemPrompt: 'You are the narrator.' } as unknown as PromptValues;
const base = { name: 'Tooled', style: 'markdown' as const, values };
const tool = (patch: Partial<Tool> = {}): Tool => ({
  id: 'u-weather', name: 'get_weather', description: 'Purpose: weather.', params: [],
  handler: { kind: 'template', body: 'Sunny.' }, emptyResult: 'Nothing.', offeredTo: ['narration'], ...patch,
});
const weather = tool();
const dice = tool({ id: 'u-dice', name: 'roll_dice', handler: { kind: 'script', code: 'return 4;' } });

describe('sharing Tool switches with a preset', () => {
  it('round-trips catalog switches through JSON and the share code', () => {
    const shared = buildSharedPreset({ ...base, enabledTools: { get_entity: true } }, APP);
    for (const r of [parseSharedJson(serializeSharedJson(shared), APP), parseSharedCode(serializeSharedCode(shared), APP)]) {
      expect(r.ok).toBe(true);
      expect(r.preset!.enabledTools).toEqual({ get_entity: true });
      expect(r.warnings).toEqual([]);
    }
  });

  it('leaves user Tool ids out of the switches, since they name nothing on another machine', () => {
    const shared = buildSharedPreset({ ...base, enabledTools: { get_entity: false, 'u-weather': true } }, APP);
    expect(shared.enabledTools).toEqual({ get_entity: false });
  });

  it('keeps only catalog switches on import', () => {
    const raw = { ...buildSharedPreset(base, APP), enabledTools: { get_entity: true, 'u-weather': true, get_future: 'on' } };
    expect(parseSharedJson(JSON.stringify(raw), APP).preset!.enabledTools).toEqual({ get_entity: true });
  });
});

describe('embedding user Tools in a shared preset', () => {
  it('embeds a copy of each user Tool the preset switches on, and no other', () => {
    const shared = buildSharedPreset({ ...base, enabledTools: { 'u-weather': true, 'u-dice': false }, tools: [weather, dice] }, APP);
    expect(shared.tools).toEqual([weather]);
  });

  it('embeds nothing for catalog switches', () => {
    const shared = buildSharedPreset({ ...base, enabledTools: { get_entity: true }, tools: [weather] }, APP);
    expect('tools' in shared).toBe(false);
  });

  it('round-trips embedded Tools through JSON and the share code', () => {
    const shared = buildSharedPreset({ ...base, enabledTools: { 'u-weather': true, 'u-dice': true }, tools: [weather, dice] }, APP);
    for (const r of [parseSharedJson(serializeSharedJson(shared), APP), parseSharedCode(serializeSharedCode(shared), APP)]) {
      expect(r.preset!.tools).toEqual([weather, dice]);
      expect(r.warnings).toEqual([]);
    }
  });

  it('drops a malformed embedded Tool with a warning and keeps the rest', () => {
    const raw = { ...buildSharedPreset(base, APP), tools: [{ ...weather, name: 'bad name' }, dice, 'junk'] };
    const r = parseSharedJson(JSON.stringify(raw), APP);
    expect(r.preset!.tools).toEqual([dice]);
    expect(r.warnings).toEqual([
      'Skipped "bad name": its name uses characters other than letters, digits, _ and -, or is over 64 characters.',
      "Skipped a Tool: it isn't a Tool.",
    ]);
  });

  it('switches on the built-in Tool that an embedded Tool’s name matches, in any case, and drops the copy', () => {
    const raw = { ...buildSharedPreset(base, APP), enabledTools: { get_entity: false }, tools: [{ ...weather, name: 'Get_Entity' }, dice] };
    const r = parseSharedJson(JSON.stringify(raw), APP);
    expect(r.preset!.enabledTools).toEqual({ get_entity: true });
    expect(r.preset!.tools).toEqual([dice]);
    expect(r.warnings).toEqual([]);
  });

  it('reads an unreadable Tool list as none', () => {
    const raw = { ...buildSharedPreset(base, APP), tools: { weather } };
    expect(parseSharedJson(JSON.stringify(raw), APP).preset).toEqual({ name: 'Tooled', style: 'markdown', values });
  });
});

describe('a preset without Tool switches', () => {
  it('exports with no Tool fields', () => {
    const shared = buildSharedPreset({ ...base, enabledTools: { 'u-gone': true }, tools: [weather] }, APP);
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
