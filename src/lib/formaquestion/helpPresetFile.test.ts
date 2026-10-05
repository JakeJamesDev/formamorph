import { describe, expect, it } from 'vitest';
import { helpTool } from '@/test/helpFixtures';
import type { Tool } from '@/types';
import { DOCS_LOOKUP } from './docsLookup';
import { HELP_ROLL } from './helpRoll';
import { parseHelpPrompt } from './helpChips';
import {
  buildHelpPresetFile, HELP_PRESET_FILE_FIELDS, HELP_PRESET_FILE_VERSION, importHelpPresetFile, parseHelpPresetFile, type HelpPresetFile,
} from './helpPresetFile';
import { DEFAULT_HELP_PROMPTS } from './helpPrompt';
import { activeHelpPreset, DEFAULT_HELP_OPTIONS, DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpOptions, editHelpPrompt } from './helpPresets';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf, type HelpSettings } from './helpSettings';

const script = (patch: Partial<Tool> = {}): Tool => helpTool({ id: 'h-s', name: 'roll_omen', handler: { kind: 'script', code: 'return "omen";' }, ...patch });

/** A device with one custom preset, two Tools, switches set, and device settings the file must not carry. */
function customized(): HelpSettings {
  let presets = duplicateHelpPreset(DEFAULT_HELP_SETTINGS.presets, DEFAULT_HELP_PRESET_ID, 'p-1', 'Chat Buddy');
  presets = editHelpPrompt(presets, 'p-1', 'answer', 'Answer like a pirate. <NOT_IN_GUIDE>');
  presets = editHelpPrompt(presets, 'p-1', 'pick', 'Pick well.');
  presets = editHelpPrompt(presets, 'p-1', 'code', 'Give each box as one block.');
  presets = editHelpOptions(presets, 'p-1', 'answer', { temperature: 0.9, repetitionPenalty: 1.1, maxTokens: 1200 });
  presets = editHelpOptions(presets, 'p-1', 'pick', { temperature: 0.4, repetitionPenalty: 1.04, maxTokens: 90 });
  presets = editHelpOptions(presets, 'p-1', 'lookup', { temperature: 0.6, maxTokens: 1500 });
  return helpSettingsOf({
    presets,
    tools: [helpTool(), helpTool({ id: 'h-2', name: 'find_place' })],
    toolSwitches: { 'h-1': true, 'h-2': false },
    lookup: true,
    lookupCallLimit: 7,
    answerEndpoint: 'endpoint-secret-id',
    pickEndpoint: 'pick-endpoint-id',
    historyLength: 11,
    sources: { semantic: true },
  });
}

const fileOf = (settings: HelpSettings): HelpPresetFile => buildHelpPresetFile(settings, settings.presets.activeId, '9.9.9')!;
const textOf = (file: unknown) => JSON.stringify(file);
let next = 0;
const mint = () => `new-${++next}`;

describe('buildHelpPresetFile', () => {
  it('holds the field list and no other key', () => {
    const file = fileOf(customized());
    expect(Object.keys(file).sort()).toEqual([...HELP_PRESET_FILE_FIELDS].sort());
    expect(Object.keys(file.prompts).sort()).toEqual(['answer', 'code', 'lookup', 'pick']);
    expect(Object.keys(file.options).sort()).toEqual(['answer', 'lookup', 'pick']);
    for (const block of Object.values(file.options)) expect(Object.keys(block).sort()).toEqual(['maxTokens', 'repetitionPenalty', 'temperature']);
    // The face call has no switch and no call limit, so it has no row.
    expect(Object.keys(file.functions)).toEqual([DOCS_LOOKUP.name, HELP_ROLL.name]);
    expect(Object.keys(file.functions[DOCS_LOOKUP.name]).sort()).toEqual(['enabled', 'maxCalls']);
    for (const entry of file.tools) expect(Object.keys(entry).sort()).toEqual(['enabled', 'tool']);
  });

  it('carries no endpoint and no other device setting', () => {
    const text = textOf(fileOf(customized()));
    for (const leak of ['endpoint-secret-id', 'pick-endpoint-id', 'historyLength', 'semantic', 'reveal', 'sources', 'Endpoint']) expect(text).not.toContain(leak);
  });

  it('carries the preset, its Tools with their switches, and the fixed functions with their limits', () => {
    const file = fileOf(customized());
    expect(file).toMatchObject({
      formamorphHelpPreset: HELP_PRESET_FILE_VERSION,
      appVersion: '9.9.9',
      name: 'Chat Buddy',
      prompts: { answer: 'Answer like a pirate. <NOT_IN_GUIDE>', pick: 'Pick well.', code: 'Give each box as one block.' },
      options: {
        answer: { temperature: 0.9, repetitionPenalty: 1.1, maxTokens: 1200 },
        pick: { temperature: 0.4, repetitionPenalty: 1.04, maxTokens: 90 },
        lookup: { temperature: 0.6, repetitionPenalty: 1, maxTokens: 1500 },
      },
      tools: [{ tool: helpTool(), enabled: true }, { tool: helpTool({ id: 'h-2', name: 'find_place' }), enabled: false }],
      functions: { [DOCS_LOOKUP.name]: { enabled: true, maxCalls: 7 } },
    });
  });

  it('builds the Default preset from the code of this build, and refuses an id no preset holds', () => {
    const file = buildHelpPresetFile(customized(), DEFAULT_HELP_PRESET_ID, '9.9.9');
    expect(file).toMatchObject({ name: 'Default', prompts: DEFAULT_HELP_PROMPTS, options: DEFAULT_HELP_OPTIONS });
    expect(buildHelpPresetFile(customized(), 'ghost', '9.9.9')).toBeNull();
  });
});

describe('export then import on a clean profile', () => {
  it('gives the same texts, option blocks, Tools and switches', () => {
    const source = customized();
    const parsed = parseHelpPresetFile(textOf(fileOf(source)));
    const { change } = importHelpPresetFile(DEFAULT_HELP_SETTINGS, parsed, mint);
    const result = helpSettingsOf(change);
    const was = activeHelpPreset(source.presets);
    const now = activeHelpPreset(result.presets);
    expect(now.name).toBe(was.name);
    expect(now.prompts).toEqual(was.prompts);
    expect(now.options).toEqual(was.options);
    expect(result.tools.map(({ id: _, ...tool }) => tool)).toEqual(source.tools.map(({ id: _, ...tool }) => tool));
    const switchesByName = (s: HelpSettings) => Object.fromEntries(s.tools.map((t) => [t.name, s.toolSwitches[t.id] === true]));
    expect(switchesByName(result)).toEqual(switchesByName(source));
    expect({ lookup: result.lookup, limit: result.lookupCallLimit }).toEqual({ lookup: true, limit: 7 });
  });

  it('leaves every device setting the file does not hold', () => {
    const device = helpSettingsOf({ answerEndpoint: 'mine', historyLength: 2 });
    const { change } = importHelpPresetFile(device, parseHelpPresetFile(textOf(fileOf(customized()))), mint);
    expect(Object.keys(change).sort()).toEqual(['lookup', 'lookupCallLimit', 'presets', 'roll', 'rollCallLimit', 'toolSwitches', 'tools']);
  });
});

describe('importHelpPresetFile', () => {
  const file = (patch: Partial<HelpPresetFile> = {}): HelpPresetFile => ({ ...fileOf(customized()), ...patch });

  it('adds the preset under a fresh id and makes it active', () => {
    const { change } = importHelpPresetFile(DEFAULT_HELP_SETTINGS, file(), () => 'fresh');
    expect(change.presets).toMatchObject({ activeId: 'fresh', presets: [{ id: 'fresh', name: 'Chat Buddy' }] });
  });

  it('suffixes a preset name the list already holds, in any case, and keeps the stored preset', () => {
    const device = customized();
    const { change, presetName } = importHelpPresetFile(device, file({ name: 'CHAT BUDDY' }), mint);
    expect(presetName).toBe('CHAT BUDDY (2)');
    expect(change.presets?.presets.slice(0, 1)).toEqual(device.presets.presets);
    const again = importHelpPresetFile(helpSettingsOf(change, device), file(), mint);
    expect(again.presetName).toBe('Chat Buddy (3)');
  });

  it('suffixes the Default preset’s name', () => {
    expect(importHelpPresetFile(DEFAULT_HELP_SETTINGS, file({ name: 'Default' }), mint).presetName).toBe('Default (2)');
  });

  it('skips a Tool whose name the list holds, names it, and keeps the stored Tool and its switch', () => {
    const device = helpSettingsOf({ tools: [helpTool({ id: 'mine', description: 'My own.' })], toolSwitches: { mine: false } });
    const { change, skipped } = importHelpPresetFile(device, file(), mint);
    expect(skipped).toEqual(['find_person']);
    const result = helpSettingsOf(change, device);
    expect(result.tools.find((t) => t.name === 'find_person')).toEqual(helpTool({ id: 'mine', description: 'My own.' }));
    expect(result.toolSwitches.mine).toBe(false);
    expect(result.tools.map((t) => t.name)).toEqual(['find_person', 'find_place']);
  });

  it('skips a Tool that takes a fixed function’s name, and a second Tool of one name', () => {
    const tools = [{ tool: helpTool({ name: DOCS_LOOKUP.name }), enabled: true }, { tool: helpTool({ id: 'a' }), enabled: true }, { tool: helpTool({ id: 'b', name: 'FIND_PERSON' }), enabled: false }];
    const { change, skipped } = importHelpPresetFile(DEFAULT_HELP_SETTINGS, file({ tools }), mint);
    expect(skipped).toEqual([DOCS_LOOKUP.name, 'FIND_PERSON']);
    const result = helpSettingsOf(change);
    expect(result.tools.map((t) => t.name)).toEqual(['find_person']);
    expect(result.toolSwitches[result.tools[0].id]).toBe(true);
  });

  it('applies the switch of each added Tool and of the fixed functions only', () => {
    const device = helpSettingsOf({ tools: [helpTool({ id: 'other', name: 'other_tool' })], toolSwitches: { other: true } });
    const functions = { [DOCS_LOOKUP.name]: { enabled: false, maxCalls: 2 }, [HELP_ROLL.name]: { enabled: true, maxCalls: 7 } };
    const { change } = importHelpPresetFile(device, file({ functions }), mint);
    const result = helpSettingsOf(change, device);
    expect(result.toolSwitches.other).toBe(true);
    expect(result).toMatchObject({ lookup: false, lookupCallLimit: 2, roll: true, rollCallLimit: 7 });
  });

  it('reports an added Script Tool that the file turns on', () => {
    expect(importHelpPresetFile(DEFAULT_HELP_SETTINGS, file({ tools: [{ tool: script(), enabled: true }] }), mint).scriptOn).toBe(true);
    expect(importHelpPresetFile(DEFAULT_HELP_SETTINGS, file({ tools: [{ tool: script(), enabled: false }] }), mint).scriptOn).toBe(false);
  });
});

describe('parseHelpPresetFile', () => {
  const good = () => JSON.parse(textOf(fileOf(customized()))) as Record<string, unknown>;
  const block = (f: Record<string, unknown>) => f.options as Record<string, unknown>;
  const refused = (value: unknown) => () => parseHelpPresetFile(typeof value === 'string' ? value : textOf(value));

  it('reads an exported file back as it was', () => {
    expect(parseHelpPresetFile(textOf(good()))).toEqual(good());
  });

  it('refuses text that is not JSON or not a preset file', () => {
    expect(refused('{not json')).toThrow(/valid JSON/);
    expect(refused([])).toThrow(/Formaquestion preset/);
    expect(refused({ formamorphTools: 1, tools: [] })).toThrow(/Formaquestion preset/);
  });

  it('refuses a version this build does not know, newer or older', () => {
    expect(refused({ ...good(), formamorphHelpPreset: 2 })).toThrow(/version 2/);
    expect(refused({ ...good(), formamorphHelpPreset: 0 })).toThrow(/version 0/);
  });

  it.each([
    ['a missing name', (f: Record<string, unknown>) => ({ ...f, name: undefined }), 'name'],
    ['a blank name', (f: Record<string, unknown>) => ({ ...f, name: '  ' }), 'name'],
    ['a missing prompt', (f: Record<string, unknown>) => ({ ...f, prompts: { answer: 'a', pick: 'b', code: 'c' } }), 'prompts.lookup'],
    ['a missing Code rider', (f: Record<string, unknown>) => ({ ...f, prompts: { answer: 'a', pick: 'b', lookup: 'l' } }), 'prompts.code'],
    ['options of one block for every request', (f: Record<string, unknown>) => ({ ...f, options: { temperature: 0.2, repetitionPenalty: 1, maxTokens: 800 } }), 'options.answer'],
    ['a missing Lookup block', (f: Record<string, unknown>) => ({ ...f, options: { ...block(f), lookup: undefined } }), 'options.lookup'],
    ['a Pick temperature out of range', (f: Record<string, unknown>) => ({ ...f, options: { ...block(f), pick: { temperature: 3, repetitionPenalty: 1, maxTokens: 150 } } }), 'options.pick.temperature'],
    ['a Lookup penalty out of range', (f: Record<string, unknown>) => ({ ...f, options: { ...block(f), lookup: { temperature: 0.2, repetitionPenalty: 2, maxTokens: 800 } } }), 'options.lookup.repetitionPenalty'],
    ['a text Max Output', (f: Record<string, unknown>) => ({ ...f, options: { ...block(f), answer: { temperature: 0.2, repetitionPenalty: 1, maxTokens: '800' } } }), 'options.answer.maxTokens'],
    ['a malformed Tool', (f: Record<string, unknown>) => ({ ...f, tools: [{ tool: { name: 'x' }, enabled: true }] }), 'a Tool that can’t be read: "x"'],
    ['a Tool without a switch', (f: Record<string, unknown>) => ({ ...f, tools: [{ tool: helpTool() }] }), 'tools.0.enabled'],
    ['a missing fixed function', (f: Record<string, unknown>) => ({ ...f, functions: {} }), `functions.${DOCS_LOOKUP.name}`],
    ['a limit out of range', (f: Record<string, unknown>) => ({ ...f, functions: { [DOCS_LOOKUP.name]: { enabled: true, maxCalls: 0 } } }), `functions.${DOCS_LOOKUP.name}.maxCalls`],
  ])('refuses %s and names the field', (_, broken, field) => {
    expect(refused(broken(good()))).toThrow(field);
  });

  it('keeps a chip this build does not know as plain text', () => {
    const file = parseHelpPresetFile(textOf({ ...good(), prompts: { answer: 'Say <FUTURE_CHIP> now.', pick: 'p', lookup: 'l', code: 'c' } }));
    expect(file.prompts.answer).toBe('Say <FUTURE_CHIP> now.');
    expect(parseHelpPrompt(file.prompts.answer)).toEqual([{ type: 'text', value: 'Say <FUTURE_CHIP> now.' }]);
  });
});
