import { describe, expect, it } from 'vitest';
import { DEFAULT_CODE_RIDER } from './helpCodeRider';
import { DEFAULT_HELP_PROMPTS } from './helpPrompt';
import {
  activeHelpOptions, activeHelpPreset, activeHelpPrompts, DEFAULT_HELP_OPTIONS, DEFAULT_HELP_PRESET_ID, deleteHelpPreset, duplicateHelpPreset, editHelpOptions, editHelpPrompt, EMPTY_HELP_PRESET_STORE,
  isDefaultHelpPresetActive, isHelpPromptEdited, parseHelpPresetStore, renameHelpPreset, resetHelpPreset, resetHelpPrompt, selectHelpPreset, type HelpPresetStore,
} from './helpPresets';

const custom = (store: HelpPresetStore, id = 'mine') => duplicateHelpPreset(store, DEFAULT_HELP_PRESET_ID, id, 'Mine');

describe('the help preset store', () => {
  it('starts on the Default preset, whose texts are the default prompts of this build', () => {
    expect(isDefaultHelpPresetActive(EMPTY_HELP_PRESET_STORE)).toBe(true);
    expect(activeHelpPreset(EMPTY_HELP_PRESET_STORE)).toEqual({ id: DEFAULT_HELP_PRESET_ID, name: 'Default', prompts: DEFAULT_HELP_PROMPTS, options: DEFAULT_HELP_OPTIONS });
    expect(activeHelpPrompts(EMPTY_HELP_PRESET_STORE)).toBe(DEFAULT_HELP_PROMPTS);
  });

  it('refuses an edit, a rename and a delete of the Default preset', () => {
    const store = EMPTY_HELP_PRESET_STORE;
    expect(editHelpPrompt(store, DEFAULT_HELP_PRESET_ID, 'answer', 'Mine.')).toBe(store);
    expect(renameHelpPreset(store, DEFAULT_HELP_PRESET_ID, 'Renamed')).toBe(store);
    expect(deleteHelpPreset(store, DEFAULT_HELP_PRESET_ID)).toBe(store);
    expect(editHelpOptions(store, DEFAULT_HELP_PRESET_ID, 'pick', { temperature: 1 })).toBe(store);
    expect(activeHelpOptions(store)).toBe(DEFAULT_HELP_OPTIONS);
    expect(resetHelpPrompt(store, DEFAULT_HELP_PRESET_ID, 'answer')).toBe(store);
    expect(activeHelpPrompts(store)).toBe(DEFAULT_HELP_PROMPTS);
  });

  it('duplicates a preset into a custom copy of its texts and selects it', () => {
    const store = custom(EMPTY_HELP_PRESET_STORE);
    expect(store.activeId).toBe('mine');
    expect(isDefaultHelpPresetActive(store)).toBe(false);
    expect(activeHelpPreset(store)).toEqual({ id: 'mine', name: 'Mine', prompts: DEFAULT_HELP_PROMPTS, options: DEFAULT_HELP_OPTIONS });

    const edited = editHelpPrompt(store, 'mine', 'pick', 'Pick well.');
    const copy = duplicateHelpPreset(edited, 'mine', 'copy', 'Copy');
    expect(activeHelpPrompts(copy).pick).toBe('Pick well.');
    expect(copy.presets.map((preset) => preset.id)).toEqual(['mine', 'copy']);
  });

  it('edits one option block of a custom preset, copies the blocks on duplicate, and leaves the Default options', () => {
    const store = editHelpOptions(custom(EMPTY_HELP_PRESET_STORE), 'mine', 'pick', { temperature: 0.9, maxTokens: 400 });
    expect(activeHelpOptions(store)).toEqual({ ...DEFAULT_HELP_OPTIONS, pick: { ...DEFAULT_HELP_OPTIONS.pick, temperature: 0.9, maxTokens: 400 } });
    const copy = duplicateHelpPreset(store, 'mine', 'copy', 'Copy');
    expect(activeHelpOptions(copy)).toEqual(activeHelpOptions(store));
    // The copy owns its blocks: an edit to it leaves the source.
    const editedCopy = editHelpOptions(copy, 'copy', 'answer', { temperature: 1.5 });
    expect(activeHelpOptions(selectHelpPreset(editedCopy, 'mine')).answer).toEqual(DEFAULT_HELP_OPTIONS.answer);
  });

  it('holds the Default options at the values each request sent before presets had blocks', () => {
    expect(DEFAULT_HELP_OPTIONS).toEqual({
      answer: { temperature: 0.2, repetitionPenalty: 1, maxTokens: 800 },
      pick: { temperature: 0.2, repetitionPenalty: 1, maxTokens: 150 },
      lookup: { temperature: 0.2, repetitionPenalty: 1, maxTokens: 800 },
    });
  });

  it('edits one prompt of a custom preset and leaves the other two', () => {
    const store = editHelpPrompt(custom(EMPTY_HELP_PRESET_STORE), 'mine', 'answer', 'Answer briefly.');
    expect(activeHelpPrompts(store)).toEqual({ ...DEFAULT_HELP_PROMPTS, answer: 'Answer briefly.' });
    expect(isHelpPromptEdited(activeHelpPrompts(store), 'answer')).toBe(true);
    expect(isHelpPromptEdited(activeHelpPrompts(store), 'pick')).toBe(false);
    expect(DEFAULT_HELP_PROMPTS.answer).not.toBe('Answer briefly.');
  });

  it('resets one prompt to the default text', () => {
    const edited = editHelpPrompt(custom(EMPTY_HELP_PRESET_STORE), 'mine', 'lookup', 'Look it up.');
    const reset = resetHelpPrompt(edited, 'mine', 'lookup');
    expect(activeHelpPrompts(reset).lookup).toBe(DEFAULT_HELP_PROMPTS.lookup);
    expect(isHelpPromptEdited(activeHelpPrompts(reset), 'lookup')).toBe(false);
  });

  it('edits and resets the Code rider on its own, and the Default rider follows the code of this build', () => {
    expect(activeHelpPrompts(EMPTY_HELP_PRESET_STORE).code).toBe(DEFAULT_CODE_RIDER);
    const edited = editHelpPrompt(custom(EMPTY_HELP_PRESET_STORE), 'mine', 'code', 'One block per box.');
    expect(activeHelpPrompts(edited)).toEqual({ ...DEFAULT_HELP_PROMPTS, code: 'One block per box.' });
    expect(isHelpPromptEdited(activeHelpPrompts(edited), 'code')).toBe(true);
    expect(activeHelpPrompts(resetHelpPrompt(edited, 'mine', 'code')).code).toBe(DEFAULT_CODE_RIDER);
  });

  it('resets every text and the options of a custom preset, and leaves the others', () => {
    let edited = editHelpPrompt(custom(EMPTY_HELP_PRESET_STORE), 'mine', 'answer', 'Answer briefly.');
    edited = editHelpPrompt(edited, 'mine', 'code', 'One block per box.');
    edited = editHelpPrompt(edited, 'mine', 'pick', 'Pick well.');
    edited = editHelpOptions(edited, 'mine', 'lookup', { temperature: 1.1, maxTokens: 300 });
    const other = editHelpPrompt(duplicateHelpPreset(edited, 'mine', 'other', 'Other'), 'other', 'answer', 'Other text.');
    const reset = resetHelpPreset(other, 'mine');
    const mine = reset.presets.find((preset) => preset.id === 'mine');
    expect(mine?.prompts).toEqual(DEFAULT_HELP_PROMPTS);
    expect(mine?.options).toEqual(DEFAULT_HELP_OPTIONS);
    expect(mine?.name).toBe('Mine');
    expect(reset.presets.find((preset) => preset.id === 'other')?.prompts.answer).toBe('Other text.');
    expect(reset.activeId).toBe('other');
    expect(resetHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID)).toBe(EMPTY_HELP_PRESET_STORE);
  });

  it('renames a custom preset and keeps the selection', () => {
    const store = renameHelpPreset(custom(EMPTY_HELP_PRESET_STORE), 'mine', 'Terse');
    expect(activeHelpPreset(store).name).toBe('Terse');
    expect(store.activeId).toBe('mine');
  });

  it('deletes a custom preset; the active one selects Default, another leaves the selection', () => {
    const two = custom(custom(EMPTY_HELP_PRESET_STORE), 'other');
    expect(two.activeId).toBe('other');
    const gone = deleteHelpPreset(two, 'other');
    expect(gone.activeId).toBe(DEFAULT_HELP_PRESET_ID);
    expect(gone.presets.map((preset) => preset.id)).toEqual(['mine']);
    const kept = deleteHelpPreset(selectHelpPreset(two, 'other'), 'mine');
    expect(kept.activeId).toBe('other');
  });

  it('selects by id, and an id no preset holds selects Default', () => {
    const store = selectHelpPreset(custom(EMPTY_HELP_PRESET_STORE), DEFAULT_HELP_PRESET_ID);
    expect(isDefaultHelpPresetActive(store)).toBe(true);
    expect(selectHelpPreset(store, 'mine').activeId).toBe('mine');
    expect(selectHelpPreset(store, 'ghost').activeId).toBe(DEFAULT_HELP_PRESET_ID);
  });
});

describe('the stored help preset store', () => {
  it('reads back what was stored', () => {
    const store = editHelpPrompt(custom(EMPTY_HELP_PRESET_STORE), 'mine', 'answer', 'Mine.');
    expect(parseHelpPresetStore(JSON.parse(JSON.stringify(store)))).toEqual(store);
  });

  it('reads each bad or missing option as the value of the Default block and keeps the good ones', () => {
    const preset = (options: unknown) => ({ id: 'ok', name: 'Ok', prompts: { answer: 'a', pick: 'b', lookup: 'c', code: 'd' }, options });
    const read = (options: unknown) => activeHelpOptions(parseHelpPresetStore({ activeId: 'ok', presets: [preset(options)] }));
    expect(read(undefined)).toEqual(DEFAULT_HELP_OPTIONS);
    expect(read({ pick: { temperature: 3, repetitionPenalty: '1.2', maxTokens: -1 } })).toEqual(DEFAULT_HELP_OPTIONS);
    expect(read({ lookup: { temperature: -0.1, repetitionPenalty: 0.9, maxTokens: 12.5 } })).toEqual(DEFAULT_HELP_OPTIONS);
    const good = { temperature: 0.7, repetitionPenalty: 1.1, maxTokens: 400 };
    expect(read({ pick: good })).toEqual({ ...DEFAULT_HELP_OPTIONS, pick: good });
    expect(read({ answer: good, pick: 'junk', lookup: { ...good, maxTokens: 0 } })).toEqual({ answer: good, pick: DEFAULT_HELP_OPTIONS.pick, lookup: { ...good, maxTokens: DEFAULT_HELP_OPTIONS.lookup.maxTokens } });
  });

  it('reads a bad value as the empty store, drops a bad preset, and points a ghost active id at Default', () => {
    expect(parseHelpPresetStore('presets')).toEqual(EMPTY_HELP_PRESET_STORE);
    expect(parseHelpPresetStore(null)).toEqual(EMPTY_HELP_PRESET_STORE);
    expect(parseHelpPresetStore({ activeId: 'x', presets: 'none' })).toEqual(EMPTY_HELP_PRESET_STORE);
    const good = { id: 'ok', name: 'Ok', prompts: { answer: 'a', pick: 'b', lookup: 'c', code: 'd' }, options: DEFAULT_HELP_OPTIONS };
    const read = parseHelpPresetStore({ activeId: 'gone', presets: [good, { id: 'bad', name: 'Bad', prompts: { answer: 1 } }, { id: 'ok', name: 'Twin', prompts: good.prompts }, 'junk'] });
    expect(read).toEqual({ activeId: DEFAULT_HELP_PRESET_ID, presets: [good] });
    expect(parseHelpPresetStore({ activeId: 'ok', presets: [good] }).activeId).toBe('ok');
  });

  it('keeps a stored Code rider, and drops a preset whose rider is missing or not text, as for the other texts', () => {
    const read = (prompts: Record<string, unknown>) => parseHelpPresetStore({ activeId: 'ok', presets: [{ id: 'ok', name: 'Ok', prompts }] }).presets;
    expect(read({ answer: 'a', pick: 'b', lookup: 'c', code: 'Mine.' })[0]?.prompts.code).toBe('Mine.');
    expect(read({ answer: 'a', pick: 'b', lookup: 'c' })).toEqual([]);
    expect(read({ answer: 'a', pick: 'b', lookup: 'c', code: 7 })).toEqual([]);
  });
});
