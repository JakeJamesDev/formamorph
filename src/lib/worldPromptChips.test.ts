import { describe, it, expect } from 'vitest';
import { resolveWorldPrompt, worldPromptChipValues, worldPromptTexts, type WorldPromptKind } from './worldPrompt';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import { TURN_PASSES, choicesSystemPrompt, statUpdatesSystemPrompt } from './turnPipeline/turnPasses';
import { emptyTurnMaterial } from './turnPipeline/turnPlan';
import { TEST_PROMPTS, testInput } from './turnPipeline/turnTestInputs';
import { collectPins } from './placeholderPins';
import { encodePlaceholderToken, resolvePlaceholders } from './placeholders';
import { runsTile } from './requestAnatomy';
import type { Placeholder, Trait, WorldOverview } from '@/types';

// A world custom prompt holds placeholder chips in its own text. Play resolves them with the rolls and pins
// of the playthrough; the player's preset is never resolved.

const TONE: Placeholder = { id: 'ph-tone', name: 'tone', values: [{ id: 'v-mid', text: 'Keep a medium pace.' }] };
const MOOD: Placeholder = {
  id: 'ph-mood', name: 'mood',
  values: [{ id: 'v-calm', text: 'calm' }, { id: 'v-tense', text: 'tense' }], roll: true,
};
const PLACEHOLDERS = [TONE, MOOD];
const SLOW: Trait = {
  id: 't-slow', name: 'Slow', statChanges: [],
  placeholderPins: [{ placeholderId: TONE.id, value: 'Let the scene move slowly.' }],
} as Trait;

const TONE_CHIP = encodePlaceholderToken({ id: TONE.id, mode: 'world', placementId: 'p-tone' });
const MOOD_CHIP = encodePlaceholderToken({ id: MOOD.id, mode: 'unique', placementId: 'p-mood' });

const overview = (promptOverrides: WorldOverview['promptOverrides']): WorldOverview => ({
  name: 'W', description: '', author: '', thumbnail: null, bgm: null,
  systemPrompt: '', use3DModel: false, tags: [], promptOverrides,
});

const WORLD = overview({
  systemPrompt: `NARRATE <WORLD DESCRIPTION>\n${TONE_CHIP} The mood is ${MOOD_CHIP}.`,
  choicesPrompt: `CHOICES <WORLD DESCRIPTION> ${TONE_CHIP}`,
  statUpdatesPrompt: `STATS <WORLD DESCRIPTION> ${TONE_CHIP}`,
});

const PRESETS: Record<WorldPromptKind, string> = {
  narration: 'PRESET NARRATE <WORLD DESCRIPTION>',
  choices: 'CHOICES <WORLD DESCRIPTION>',
  statUpdates: 'STATS <WORLD DESCRIPTION>',
};

/** Play's resolver: the active traits' pins over the rolls of the playthrough. */
const resolver = (active: Trait[]) => {
  const pins = collectPins({ traits: active, disabledTraitIds: [], placeholders: PLACEHOLDERS });
  const rolls = { world: {}, unique: { 'p-mood': 'tense' } };
  return (text: string) => resolvePlaceholders(text, { placeholders: PLACEHOLDERS, rolls, pins });
};

const CTX = { '<WORLD DESCRIPTION>': 'A salt marsh.' };
const turnCtx = (optedOut: boolean, active: Trait[] = []) =>
  ({ ...CTX, ...worldPromptChipValues(WORLD, optedOut, resolver(active)) });

const narration = (optedOut: boolean, active: Trait[] = [], preset = PRESETS.narration) => buildNarrationPrompt({
  template: resolveWorldPrompt(WORLD, 'narration', preset, optedOut),
  ctx: turnCtx(optedOut, active),
  action: 'look around',
  history: [],
  dictionary: [],
  actionVec: null,
  semanticLore: false,
  embedVectors: new Map(),
  language: 'English',
  paragraphLimit: 'none',
  maxTokens: 512,
  markdownOutput: true,
  sectionStyle: 'markdown',
  resolvePH: resolver(active),
});

const passRequest = (id: 'choices' | 'statUpdates', optedOut: boolean, active: Trait[] = []) => {
  const record = TURN_PASSES.find((p) => p.id === id)!;
  const prompts = {
    ...TEST_PROMPTS,
    choices: resolveWorldPrompt(WORLD, 'choices', PRESETS.choices, optedOut),
    statUpdates: resolveWorldPrompt(WORLD, 'statUpdates', PRESETS.statUpdates, optedOut),
  };
  const material = {
    ...emptyTurnMaterial({ action: 'look', effectiveAction: 'look', turnId: 't1', baseCtx: CTX, destinations: [] }),
    ctx: turnCtx(optedOut, active),
    narration: 'The reeds move.',
  };
  return record.buildRequest(testInput({ prompts }), material);
};

describe('placeholder chips in a world narration prompt', () => {
  it('sends the default value, and the roll of a Unique chip, with no chip left raw', () => {
    const { prompt } = narration(false);
    expect(prompt).toBe('NARRATE A salt marsh.\nKeep a medium pace. The mood is tense.');
  });

  it('sends the value an active trait pins', () => {
    const { prompt } = narration(false, [SLOW]);
    expect(prompt).toBe('NARRATE A salt marsh.\nLet the scene move slowly. The mood is tense.');
  });

  it('labels each resolved value as placeholder output, apart from the authored prose', () => {
    const { prompt, runs } = narration(false, [SLOW]);
    expect(runsTile(prompt, runs)).toBe(true);
    const labeled = runs
      .filter((run) => run.contextLabel === 'placeholder')
      .map((run) => ({ text: prompt.slice(run.start, run.end), source: run.source, chip: run.chip }));
    expect(labeled).toEqual([
      { text: 'Let the scene move slowly.', source: undefined, chip: undefined },
      { text: 'tense', source: undefined, chip: undefined },
    ]);
    // The prose between the two chips stays the author's.
    const prose = runs.find((run) => prompt.slice(run.start, run.end) === ' The mood is ');
    expect(prose).toMatchObject({ source: 'system-template' });
    expect(prose?.contextLabel).toBeUndefined();
  });
});

describe.each(['choices', 'statUpdates'] as const)('placeholder chips in a world %s prompt', (id) => {
  const head = id === 'choices' ? 'CHOICES' : 'STATS';

  it('sends the pinned value in the request', () => {
    expect(passRequest(id, false).systemPrompt).toBe(`${head} A salt marsh. Keep a medium pace.`);
    expect(passRequest(id, false, [SLOW]).systemPrompt).toBe(`${head} A salt marsh. Let the scene move slowly.`);
  });

  it('labels the resolved value as placeholder output', () => {
    const request = passRequest(id, false, [SLOW]);
    const system = request.anatomy!.system;
    expect(runsTile(request.systemPrompt, system)).toBe(true);
    expect(system.filter((run) => run.contextLabel === 'placeholder')
      .map((run) => request.systemPrompt.slice(run.start, run.end))).toEqual(['Let the scene move slowly.']);
  });
});

describe('the standalone re-rolls, which render outside a turn', () => {
  it('send the same resolved prompts a turn sends', () => {
    const ctx = turnCtx(false, [SLOW]);
    expect(choicesSystemPrompt(WORLD.promptOverrides!.choicesPrompt!, 'English', ctx))
      .toBe(passRequest('choices', false, [SLOW]).systemPrompt);
    expect(statUpdatesSystemPrompt(WORLD.promptOverrides!.statUpdatesPrompt!, ctx))
      .toBe('STATS A salt marsh. Let the scene move slowly.');
  });
});

describe('a player who declined the world prompts', () => {
  it('sends the preset, with no world text and nothing resolved into the context', () => {
    expect(worldPromptChipValues(WORLD, true, resolver([SLOW]))).toEqual({});
    expect(narration(true, [SLOW]).prompt).toBe('PRESET NARRATE A salt marsh.');
    expect(passRequest('choices', true, [SLOW]).systemPrompt).toBe('CHOICES A salt marsh.');
    expect(passRequest('statUpdates', true, [SLOW]).systemPrompt).toBe('STATS A salt marsh.');
  });

  it('leaves a chip in a preset as the text it is', () => {
    // A preset is the player's text. Nothing keys its chips, so the render does not touch them.
    const { prompt, runs } = narration(true, [SLOW], `PRESET ${TONE_CHIP}`);
    expect(prompt).toBe(`PRESET ${TONE_CHIP}`);
    expect(runs.some((run) => run.contextLabel === 'placeholder')).toBe(false);
  });
});

describe('which custom prompts give chip values', () => {
  it('skips a kind the author switched off', () => {
    const off = overview({ choicesPrompt: `CHOICES ${TONE_CHIP}`, choicesPromptEnabled: false });
    expect(worldPromptChipValues(off, false, resolver([]))).toEqual({});
  });

  it('keys each chip once, however many prompts place it', () => {
    expect(worldPromptChipValues(WORLD, false, resolver([]))).toEqual({
      [TONE_CHIP]: 'Keep a medium pace.',
      [MOOD_CHIP]: 'tense',
    });
  });
});

describe('the Player Name marker in a custom prompt', () => {
  // The marker reads its sentence position from the text around it, which a per-chip value cannot carry.
  // A prompt names the player with the Persona prompt variable.
  it('is not a chip value, so the prompt keeps it as typed', () => {
    const marked = overview({ systemPrompt: `Address {{user}} directly. ${TONE_CHIP}` });
    expect(worldPromptChipValues(marked, false, resolver([]))).toEqual({ [TONE_CHIP]: 'Keep a medium pace.' });
  });
});

describe('worldPromptTexts', () => {
  it('lists every stored custom prompt, switched on or not', () => {
    const o = overview({ systemPrompt: 'N', choicesPrompt: 'C', choicesPromptEnabled: false });
    expect(worldPromptTexts(o)).toEqual(['N', 'C']);
    expect(worldPromptTexts(null)).toEqual([]);
  });
});
