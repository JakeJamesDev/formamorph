/** The help-code probe's questions, and the fixture world each answer's code runs against. */
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { SCRIPT_TAB, TRAIT_SCRIPT_TAB, WORLD_SCRIPT_TAB } from '@/lib/formaquestion/helpCodeRider';
import { testScript, type CodeTestOwner } from '@/lib/formaquestion/helpCodeTestRun';
import type { CodeTestResult } from '@/lib/formaquestion/helpCodeTestRun';
import type { HelpFocus } from '@/lib/formaquestion/helpFocus';
import { executeStatCode, type NarrationInput, type SandboxPlaceholderNode, type SandboxTrait, type StatCodeRunOptions, type SwitchedTrait } from '@/lib/statCodeExecutor';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import type { Placeholder, ScriptTiming, Stat, Trait } from '@/types';
import { ref, type CaseNames, type SnippetRunner } from './help-code-score';

/** `code` wants a fenced answer on the rider arm; `prose` is a how-to control that wants none on either arm. */
export type HelpCodeKind = 'code' | 'prose';

export interface HelpCodeCase {
  id: string;
  kind: HelpCodeKind;
  question: string;
  /** What the player has open. A code case with it names no code word, so the open Code tab alone fires the rider. */
  surface?: Surface;
  /** The item the open panel shows. */
  focus?: HelpFocus;
  /** A known case's real names. It passes when its code runs, holds them, and holds no invented one. */
  names?: CaseNames;
  /** The authored world the code test reads. Absent: `FIXTURE_WORLD`. */
  world?: StatCodeWorld;
  /** The box the task needs. A case with it scores `box`: every fence carries this timing's tag. */
  timing?: ScriptTiming;
  /** The fixture trait whose Scripts tab the case asks from. Its snippets run as that trait's script. */
  trait?: string;
  /** True when the case asks from the world's Scripts tab. Its snippets run as a world script. */
  worldScript?: true;
}

const stat = (name: string, min: number, max: number, value: number, regen: number): Stat =>
  ({ id: name.toLowerCase(), name, type: 'number', description: '', min, max, value, regen, descriptors: [] });

/** The stat every snippet belongs to, and its neighbors the questions name. */
export const FIXTURE_STAT = stat('Health', 0, 100, 60, 1);

const statPanel = (...tabs: SurfaceId[]): Surface => ({ screen: 'worldEditor', dialog: null, tabs });
/** The fixture stat's Code tab, open with that stat selected. */
const ON_CODE_TAB = { surface: statPanel(SCRIPT_TAB), focus: { kind: 'stat', id: FIXTURE_STAT.id, name: FIXTURE_STAT.name } } as const;
export const FIXTURE_STATS: readonly Stat[] = [
  FIXTURE_STAT, stat('Stamina', 0, 100, 40, 2), stat('Hunger', 0, 10, 8, 0), stat('Courage', 0, 100, 55, 0), stat('Int', 0, 50, 32, 0),
];

const wildcard = (name: string, values: string[], value: string): SandboxPlaceholderNode => ({
  name, path: [name], entry: { id: name.toLowerCase(), value, values, text: value, roll: () => values[0] },
});
const trait = (name: string, enabled: boolean, acquired: boolean): SandboxTrait =>
  ({ name, enabled, acquired, id: name.toLowerCase(), mode: 'optional', available: true, group: '', playerToggle: true });

/** Each fixture placeholder's values and its current value. */
const PLACEHOLDERS: readonly { name: string; values: string[]; value: string }[] = [
  { name: 'Weather', values: ['sunny', 'rainy', 'stormy'], value: 'rainy' },
  { name: 'Mood', values: ['calm', 'wary'], value: 'calm' },
  { name: 'Quotes', values: ['The sea is calm', 'The wind is howling'], value: 'The sea is calm' },
];

// The persona holds the traits a question says "I have", so either owner's path runs.
export const FIXTURE_OPTIONS: StatCodeRunOptions = {
  placeholders: PLACEHOLDERS.map(({ name, values, value }) => wildcard(name, values, value)),
  traits: [
    trait('Poisoned', true, true), trait('Rested', false, false), trait('Brave', true, true),
    trait('Prowler', false, false), trait('Seasoned', false, false), trait('Grumpy', true, true),
  ],
  persona: { name: 'Wren', traits: [trait('Seasoned', false, false), trait('Brave', false, false), trait('Grumpy', true, true)] },
};

const authoredTrait = (name: string, id = name.toLowerCase()): Trait => ({ id, name, statChanges: [] });
const authoredPlaceholder = (name: string, texts: string[]): Placeholder =>
  ({ id: name.toLowerCase(), name, values: texts.map((text, at) => ({ id: `${name.toLowerCase()}-${at}`, text })) });

/** The fixture as an authored world, for the code test: the same stats, traits, placeholders and persona. */
export const FIXTURE_WORLD: StatCodeWorld = {
  stats: [...FIXTURE_STATS],
  traits: (FIXTURE_OPTIONS.traits ?? []).map((t) => authoredTrait(t.name)),
  placeholders: PLACEHOLDERS.map(({ name, values }) => authoredPlaceholder(name, values)),
  entities: [{
    id: 'wren', name: 'Wren', persona: true,
    traits: (FIXTURE_OPTIONS.persona?.traits ?? []).map((t) => authoredTrait(t.name, `wren-${t.id}`)),
  }],
  traitGroups: [], entityGroups: [], placeholderGroups: [], dictionaries: [],
};

/**
 * The fixture world with Seasoned on the persona alone, so the code test flags a write through the world's
 * `traits`. Scoring runs on `FIXTURE_OPTIONS`, where both paths run; its `absent` names catch that write.
 */
export const PERSONA_SEASONED_WORLD: StatCodeWorld = { ...FIXTURE_WORLD, traits: FIXTURE_WORLD.traits.filter((t) => t.name !== 'Seasoned') };

/** Whether a code test came back with no error and no dropped write. */
export const testsClean = (result: CodeTestResult): boolean => !result.errors.length && !result.run?.error && !result.run?.dropped.length;

/** The sentence a During AI Output fence runs on. */
export const FIXTURE_NARRATION: NarrationInput = { sentence: 'Damn, the wind is howling.', full: 'Damn, the wind is howling.', index: 0, sent: [], buffered: [] };
/** The trait a When a Trait Switches fence runs on: Brave, just switched on, a global trait. */
export const FIXTURE_SWITCHED: SwitchedTrait = { ...trait('Brave', true, true), owner: '' };

/** The name a fence's timing adds to the sandbox, so its code reads `narration` or `trait` as that timing does. */
const TIMING_OPTIONS: Partial<Record<ScriptTiming, StatCodeRunOptions>> = {
  output: { narration: FIXTURE_NARRATION },
  switch: { switchedTrait: FIXTURE_SWITCHED },
};
const timingOptions = (timing: ScriptTiming | null): StatCodeRunOptions => (timing && TIMING_OPTIONS[timing]) || {};

/** Runs a snippet as the fixture stat's code in its fence's timing, in the real sandbox and its own interrupt timeout. */
export const fixtureRunner: SnippetRunner = async (code, timing) => {
  const result = await executeStatCode(code, [...FIXTURE_STATS], FIXTURE_STAT, { ...FIXTURE_OPTIONS, ...timingOptions(timing) });
  return { runs: result.error === null, error: result.error };
};

/** A runner that runs each snippet on `owner`, through the code test's own run. */
function ownerRunner(owner: CodeTestOwner): SnippetRunner {
  return async (code, timing) => {
    const { run } = await testScript(code, timing ?? 'after', owner, FIXTURE_WORLD);
    return { runs: run !== undefined && run.error === null, error: run?.error ?? null };
  };
}

/** Runs a snippet as the script of the fixture trait `name`, through the code test's own run. */
export const traitRunner = (name: string): SnippetRunner => ownerRunner({ kind: 'trait', name });

/** Runs a snippet as a world script, through the code test's own run. */
export const worldRunner: SnippetRunner = ownerRunner({ kind: 'world' });

/** The runner of a case's snippets: the trait's or the world's when the case asks from that Scripts tab, else the fixture stat's. */
export const runnerOf = (c: HelpCodeCase): SnippetRunner => (c.trait ? traitRunner(c.trait) : c.worldScript ? worldRunner : fixtureRunner);

/** The world's Scripts tab: no item is selected, and no entity or stat owns the script. */
const ON_WORLD_TAB = { worldScript: true, surface: statPanel(WORLD_SCRIPT_TAB) } as const;

/** A fixture trait's Scripts tab, open with that trait selected. */
const onTraitTab = (name: string) => (
  { trait: name, surface: statPanel('worldEditor.traits', TRAIT_SCRIPT_TAB), focus: { kind: 'trait', id: name.toLowerCase(), name } } as const
);

export const HELP_CODE_CASES: readonly HelpCodeCase[] = [
  { id: 'heal-on-stamina', kind: 'code', question: 'Write code for my Health stat that heals 5 each turn while Stamina is above 50.' },
  { id: 'poison-drain', kind: 'code', question: 'How do I script Health to drop by 3 each turn while the Poisoned trait is on?' },
  { id: 'cap-ai-change', kind: 'code', question: 'In the After the AI box, how do I stop the AI from moving Health by more than 10 in one turn?' },
  { id: 'pin-weather', kind: 'code', question: 'Write JavaScript that pins the Weather placeholder to stormy when Health is below 20.' },
  { id: 'floor-before', kind: 'code', question: 'What do I put in the Before the AI box so Health starts each turn at 10 or more?' },
  { id: 'hunger-drain', kind: 'code', question: 'How do I make this stat go down by 2 every turn when Hunger is above 7?', ...ON_CODE_TAB },
  { id: 'rested-when-full', kind: 'code', question: 'How do I turn on the Rested trait when this stat is full?', ...ON_CODE_TAB },
  { id: 'night-regen', kind: 'code', question: 'How can this stat recover 1 point per hour, but only at night?', ...ON_CODE_TAB },
  // Known cases: the tasks of one player session on a stat's Code tab, each asked on its own.
  // A case accepts every answer that is right under the context the request gives. Audit, per case:
  //   prowler-at-night, seasoned-after-two-weeks: the open Code tab; the trait and clock names come from the question.
  //   Both seasoned cases read two weeks from `clock.day` or `clock.elapsedHours`.
  //   seasoned-on-persona: the question says the trait sits on a custom character, so the persona path is required.
  //   brave-at-courage ("my Courage"), quotes-pin ("my Int"): the request names Health as the open stat, so only
  //     the named stat's own path is right.
  //   quotes-pin also reads the persona or world trait path, since "I have the trait" names no owner.
  {
    id: 'prowler-at-night', kind: 'code', ...ON_CODE_TAB,
    question: 'I want a trait called Prowler to activate when it\'s nighttime. Could you write it for me?',
    names: { present: [ref('clock.daypart'), ref('traits.Prowler.enabled')] },
  },
  {
    id: 'seasoned-after-two-weeks', kind: 'code', ...ON_CODE_TAB,
    question: 'What if I want the Seasoned trait to activate after it has been 2 weeks?',
    names: { present: [ref('clock.day', 'clock.elapsedHours'), ref('traits.Seasoned.enabled')] },
  },
  {
    id: 'seasoned-on-persona', kind: 'code', ...ON_CODE_TAB,
    question: 'My Seasoned trait is on a custom character. How do I make it activate after it has been 2 weeks?',
    names: { present: [ref('clock.day', 'clock.elapsedHours'), ref('persona.traits.Seasoned.enabled')], absent: [ref('traits.Seasoned')] },
    world: PERSONA_SEASONED_WORLD,
  },
  {
    id: 'brave-at-courage', kind: 'code', ...ON_CODE_TAB,
    question: 'I want the Brave trait to activate when my Courage is 50 or more.',
    names: { present: [ref('stats.Courage.value'), ref('traits.Brave.enabled', 'persona.traits.Brave.enabled')] },
  },
  {
    id: 'quotes-pin', kind: 'code', ...ON_CODE_TAB,
    question: 'Set the Quotes placeholder to \'The wind is howling\', but only after a month has passed, my Int is over 30, and I have the trait Grumpy.',
    names: {
      present: [
        ref('clock.day'), ref('stats.Int.value'), ref('traits.Grumpy.enabled', 'persona.traits.Grumpy.enabled'),
        ref('placeholders.Quotes.pin', 'placeholders.Quotes.value'),
      ],
    },
  },
  // The start, output and switch timings. The worded cases name the box; start-new-game asks from the Code tab without it.
  { id: 'start-new-game', kind: 'code', timing: 'start', question: 'How do I give this stat a random value between 50 and 100 when a new game begins?', ...ON_CODE_TAB },
  { id: 'start-worded', kind: 'code', timing: 'start', question: 'At Game Start, how do I set Health to its max?' },
  { id: 'output-swap', kind: 'code', timing: 'output', question: 'During AI Output, how do I replace the word "Damn" with "Darn" in each sentence?' },
  { id: 'switch-brave', kind: 'code', timing: 'switch', question: 'When a Trait Switches, how do I raise Health by 10 if the trait that switched is Brave and it turned on?' },
  // A trait's Scripts tab: no code word, so the open tab alone fires the rider. Snippets run as Brave's script.
  // Brave is a global trait, so no `owner.stats` read is right.
  {
    id: 'trait-heal-while-on', kind: 'code', ...onTraitTab('Brave'),
    question: 'How do I raise Health by 5 each turn while this trait is on?',
    names: { present: [ref('stats.Health.value')] },
  },
  { id: 'trait-start-stamina', kind: 'code', timing: 'start', ...onTraitTab('Brave'), question: 'When a new game begins, how do I set Stamina to 80?' },
  { id: 'trait-switch-off', kind: 'code', timing: 'switch', ...onTraitTab('Brave'), question: 'How do I lower Courage by 10 when this trait turns off?' },
  // The world's Scripts tab: a world script has no owner and no self, so a `self` read is wrong.
  {
    id: 'world-heal-on-stamina', kind: 'code', ...ON_WORLD_TAB,
    question: 'How do I raise Health by 5 each turn while Stamina is above 30?',
    names: { present: [ref('stats.Health.value'), ref('stats.Stamina.value')] },
  },
  { id: 'world-start-stamina', kind: 'code', timing: 'start', ...ON_WORLD_TAB, question: 'When a new game begins, how do I set Stamina to 80?' },
  { id: 'world-switch-brave', kind: 'code', timing: 'switch', ...ON_WORLD_TAB, question: 'How do I lower Courage by 10 when the Brave trait turns off?' },
  { id: 'add-stat', kind: 'prose', question: 'How do I add a new stat to my world?' },
  { id: 'hide-stat', kind: 'prose', question: 'How do I hide a stat from the player?' },
  { id: 'change-theme', kind: 'prose', question: 'How do I change the theme?' },
  { id: 'export-world', kind: 'prose', question: 'How do I export my world?' },
];
