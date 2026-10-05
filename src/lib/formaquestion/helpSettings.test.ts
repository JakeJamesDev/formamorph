import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Tool } from '@/types';
import { chatChrome, DEFAULT_HELP_SETTINGS, HELP_HISTORY_MAX, HELP_CALL_LIMIT_MAX, SAME_AS_ANSWER, helpSettingsCodec, helpSettingsOf } from './helpSettings';
import { DEFAULT_HELP_REVEAL } from './helpReveal';
import { duplicateHelpPreset, EMPTY_HELP_PRESET_STORE } from './helpPresets';
import { DEFAULT_MASCOT_RIG } from './mascot';
import { activeMascotRig, EMPTY_MASCOT_PRESET_STORE } from './mascotPresets';
import { mascotStoreOf } from '@/test/helpFixtures';

describe('the default help settings', () => {
  it('equal the values the help session had as constants when the bar run measured it', () => {
    expect(DEFAULT_HELP_SETTINGS).toEqual({
      sources: { keyword: true, aiPicks: true, semantic: false },
      answerEndpoint: null,
      pickEndpoint: SAME_AS_ANSWER,
      lookup: false,
      lookupCallLimit: 3,
      roll: false,
      rollCallLimit: 4,
      openScreen: true,
      historyLength: 4,
      reasoning: { enabled: false, level: 'global' },
      reasoningBudget: 75,
      sourcesOpen: true,
      thinkingOpen: false,
      reveal: DEFAULT_HELP_REVEAL,
      presets: EMPTY_HELP_PRESET_STORE,
      // No Tool and no switch, so the request bodies of the bar run are unchanged.
      tools: [],
      toolSwitches: {},
      mascot: true,
      mascotPresets: EMPTY_MASCOT_PRESET_STORE,
      chatStyle: 'auto',
      scrimOpacity: 60,
    });
  });
});

describe('the help session', () => {
  const source = readFileSync(resolve(__dirname, 'helpSession.ts'), 'utf8');

  it('takes the settings module as a type alone, so every value it reads comes from the question', () => {
    const imports = [...source.matchAll(/^import (type )?\{[^}]*\} from '\.\/helpSettings';$/gm)];
    expect(imports.map((match) => match[1])).toEqual(['type ']);
    expect(source).not.toContain('DEFAULT_HELP_SETTINGS');
  });

  it('declares no source, lookup, history or cap constant of its own', () => {
    expect(source).not.toMatch(/HELP_(LOOKUP_MODE|KEYWORD_SOURCE|AI_PICKS_SOURCE|SEMANTIC_SOURCE|HISTORY_EXCHANGES|MAX_TOKENS)\b/);
  });
});

describe('the stored help settings', () => {
  const stored = (value: unknown) => helpSettingsCodec.parse(JSON.stringify(value));

  it('read back what was written', () => {
    const changed = helpSettingsOf({ sources: { keyword: false, aiPicks: false }, openScreen: false, historyLength: 0 });
    expect(helpSettingsCodec.parse(helpSettingsCodec.serialize(changed))).toEqual(changed);
  });

  it('take the default for each field that is missing or bad, and keep the good ones', () => {
    expect(stored({ sources: { keyword: 'yes', aiPicks: false }, openScreen: 0, historyLength: 2.5 }))
      .toEqual(helpSettingsOf({ sources: { aiPicks: false } }));
    expect(stored({ historyLength: HELP_HISTORY_MAX + 1 }).historyLength).toBe(DEFAULT_HELP_SETTINGS.historyLength);
    expect(stored({ historyLength: HELP_HISTORY_MAX }).historyLength).toBe(HELP_HISTORY_MAX);
    expect(stored({ sourcesOpen: 'no' }).sourcesOpen).toBe(true);
    expect(stored({ sourcesOpen: false }).sourcesOpen).toBe(false);
    expect(stored({ sources: null })).toEqual(DEFAULT_HELP_SETTINGS);
    expect(stored({})).toEqual(DEFAULT_HELP_SETTINGS);
  });

  it.each(['lookupCallLimit', 'rollCallLimit'] as const)('keep a %s from 1 to the most the field takes, and take the default for anything else', (field) => {
    expect(stored({ [field]: 1 })[field]).toBe(1);
    expect(stored({ [field]: HELP_CALL_LIMIT_MAX })[field]).toBe(HELP_CALL_LIMIT_MAX);
    for (const bad of [0, HELP_CALL_LIMIT_MAX + 1, 2.5, '2', null]) {
      expect(stored({ [field]: bad })[field]).toBe(DEFAULT_HELP_SETTINGS[field]);
    }
  });

  it('keep the roll switch, and take off for anything else', () => {
    expect(stored({ roll: true }).roll).toBe(true);
    expect(stored({ roll: 'yes' }).roll).toBe(false);
  });

  it('keep a preset id or Follow Active for each route, and take the default for anything else', () => {
    expect(stored({ answerEndpoint: 'p1', pickEndpoint: null })).toMatchObject({ answerEndpoint: 'p1', pickEndpoint: null });
    expect(stored({ answerEndpoint: 4, pickEndpoint: '' })).toMatchObject({ answerEndpoint: null, pickEndpoint: SAME_AS_ANSWER });
    expect(stored({ answerEndpoint: SAME_AS_ANSWER }).answerEndpoint).toBeNull();
  });

  it('keep the Formaquestion Tools and their switches, and drop a switch of a Tool that is gone', () => {
    const tool: Tool = {
      id: 'h-1', name: 'find_person', description: '', params: [], handler: { kind: 'template', body: 'hi' }, emptyResult: '', offeredTo: [],
    };
    const settings = helpSettingsOf({ tools: [tool], toolSwitches: { 'h-1': true } });
    expect(helpSettingsCodec.parse(helpSettingsCodec.serialize(settings))).toEqual(settings);
    expect(stored({ tools: [tool], toolSwitches: { 'h-1': true, gone: true } })).toEqual(settings);
    expect(stored({ tools: [{ id: 'bad' }], toolSwitches: { bad: true } })).toEqual(DEFAULT_HELP_SETTINGS);
    expect(stored({ tools: 'mine', toolSwitches: 'on' })).toEqual(DEFAULT_HELP_SETTINGS);
  });

  it('refuse text that is not a settings object, so the defaults stand', () => {
    for (const raw of ['not json', '[]', 'null', '4']) expect(() => helpSettingsCodec.parse(raw)).toThrow();
  });
});

describe('the help presets', () => {
  it('survive the codec, and a bad value reads as no custom preset', () => {
    const presets = duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, 'default', 'mine', 'Mine');
    const settings = helpSettingsOf({ presets, historyLength: 2 });
    expect(helpSettingsCodec.parse(helpSettingsCodec.serialize(settings))).toEqual(settings);
    expect(helpSettingsCodec.parse(JSON.stringify({ presets: 'mine', historyLength: 2 }))).toEqual(helpSettingsOf({ historyLength: 2 }));
  });
});

describe('the reveal values', () => {
  it('change only the values a change names', () => {
    const blurred = helpSettingsOf({ reveal: { blur: true } });
    expect(helpSettingsOf({ reveal: { easing: 'linear' } }, blurred).reveal).toEqual({ ...DEFAULT_HELP_REVEAL, blur: true, easing: 'linear' });
  });

  it('survive the codec, and a value that is not an object takes the defaults', () => {
    const settings = helpSettingsOf({ reveal: { fade: false, minStagger: 90 } });
    expect(helpSettingsCodec.parse(helpSettingsCodec.serialize(settings)).reveal).toEqual(settings.reveal);
    expect(helpSettingsCodec.parse(JSON.stringify({ reveal: 'fade' })).reveal).toEqual(DEFAULT_HELP_REVEAL);
    expect(helpSettingsCodec.parse(JSON.stringify({ reveal: { blur: 3 } })).reveal).toEqual(DEFAULT_HELP_REVEAL);
  });
});

describe('the mascot', () => {
  const stored = (value: unknown) => helpSettingsCodec.parse(JSON.stringify(value));

  it('reads as on, with the Default active and no custom mascots, when the value has none', () => {
    expect(stored({})).toMatchObject({ mascot: true, mascotPresets: EMPTY_MASCOT_PRESET_STORE });
  });

  it('keeps the switch, and takes on for anything else', () => {
    expect(stored({ mascot: false }).mascot).toBe(false);
    expect(stored({ mascot: 'off' }).mascot).toBe(true);
  });

  it('round-trips the mascot store through the codec', () => {
    const rig = { ...DEFAULT_MASCOT_RIG, voice: 'Terse.', layers: DEFAULT_MASCOT_RIG.layers.slice(0, 2) };
    const settings = helpSettingsOf({ mascot: false, mascotPresets: mascotStoreOf(rig) });
    expect(helpSettingsCodec.parse(helpSettingsCodec.serialize(settings))).toEqual(settings);
  });

  it('reads each rig through the mascot codec, so a bad layer drops and the others stay', () => {
    const [first, second] = DEFAULT_MASCOT_RIG.layers;
    const rig = { ...DEFAULT_MASCOT_RIG, layers: [first, { id: 'broken' }, second] };
    const { mascotPresets } = stored({ mascotPresets: { activeId: 'mine', mascots: [{ id: 'mine', name: 'Mine', rig }] } });
    expect(activeMascotRig(mascotPresets).layers).toEqual([first, second]);
  });

  it('reads the old single-rig shape as nothing: the Default, with no custom mascots', () => {
    const old = stored({ rig: { ...DEFAULT_MASCOT_RIG, voice: 'Gruff.' } });
    expect(old.mascotPresets).toEqual(EMPTY_MASCOT_PRESET_STORE);
    expect(old).not.toHaveProperty('rig');
  });
});

describe('the scrim opacity', () => {
  const stored = (value: unknown) => helpSettingsCodec.parse(JSON.stringify(value));

  it('reads as 60 when the value has none or a bad one', () => {
    expect(stored({}).scrimOpacity).toBe(60);
    for (const bad of [-5, 105, 62, 12.5, '40', null]) expect(stored({ scrimOpacity: bad }).scrimOpacity).toBe(60);
  });

  it('survives the codec at both ends and a step between, 0 included', () => {
    for (const scrimOpacity of [0, 35, 100]) {
      const settings = helpSettingsOf({ scrimOpacity });
      expect(helpSettingsCodec.parse(helpSettingsCodec.serialize(settings)).scrimOpacity).toBe(scrimOpacity);
    }
  });
});

describe('the chat style', () => {
  const stored = (value: unknown) => helpSettingsCodec.parse(JSON.stringify(value));

  it('reads as Auto when the value has none or a bad one', () => {
    expect(stored({}).chatStyle).toBe('auto');
    expect(stored({ chatStyle: 'framed' }).chatStyle).toBe('auto');
  });

  it('survives the codec', () => {
    for (const chatStyle of ['minimal', 'full'] as const) {
      const settings = helpSettingsOf({ chatStyle });
      expect(helpSettingsCodec.parse(helpSettingsCodec.serialize(settings)).chatStyle).toBe(chatStyle);
    }
  });

  it('gives the chrome: Auto follows the Mascot switch, the others pin', () => {
    expect(chatChrome(helpSettingsOf({ chatStyle: 'auto', mascot: true }))).toBe('bubble');
    expect(chatChrome(helpSettingsOf({ chatStyle: 'auto', mascot: false }))).toBe('full');
    expect(chatChrome(helpSettingsOf({ chatStyle: 'bubble', mascot: true }))).toBe('bubble');
    expect(chatChrome(helpSettingsOf({ chatStyle: 'minimal', mascot: false }))).toBe('minimal');
    expect(chatChrome(helpSettingsOf({ chatStyle: 'full', mascot: true }))).toBe('full');
  });

  it('draws Minimal for a pinned Bubble with the Mascot off, since Bubble has no speaker', () => {
    expect(chatChrome(helpSettingsOf({ chatStyle: 'bubble', mascot: false }))).toBe('minimal');
  });

  it('keeps a stored Bubble style', () => {
    expect(helpSettingsCodec.parse(JSON.stringify({ chatStyle: 'bubble' })).chatStyle).toBe('bubble');
  });
});
