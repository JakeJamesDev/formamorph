/** The help-code probe's questions, and the fixture world each answer's code runs against. */
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { STAT_CODE_TAB } from '@/lib/formaquestion/helpCodeRider';
import { executeStatCode, type SandboxPlaceholderNode, type SandboxTrait, type StatCodeRunOptions } from '@/lib/statCodeExecutor';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import type { Stat } from '@/types';
import type { SnippetRunner } from './help-code-score';

/** `code` wants a fenced answer on the rider arm; `prose` is a how-to control that wants none on either arm. */
export type HelpCodeKind = 'code' | 'prose';

export interface HelpCodeCase {
  id: string;
  kind: HelpCodeKind;
  question: string;
  /** What the player has open. A code case with it names no code word, so the open Code tab alone fires the rider. */
  surface?: Surface;
}

const statPanel = (...tabs: SurfaceId[]): Surface => ({ screen: 'worldEditor', dialog: null, tabs });
const CODE_TAB = statPanel(STAT_CODE_TAB);

export const HELP_CODE_CASES: readonly HelpCodeCase[] = [
  { id: 'heal-on-stamina', kind: 'code', question: 'Write code for my Health stat that heals 5 each turn while Stamina is above 50.' },
  { id: 'poison-drain', kind: 'code', question: 'How do I script Health to drop by 3 each turn while the Poisoned trait is on?' },
  { id: 'cap-ai-change', kind: 'code', question: 'In the After the AI box, how do I stop the AI from moving Health by more than 10 in one turn?' },
  { id: 'pin-weather', kind: 'code', question: 'Write JavaScript that pins the Weather placeholder to stormy when Health is below 20.' },
  { id: 'floor-before', kind: 'code', question: 'What do I put in the Before the AI box so Health starts each turn at 10 or more?' },
  { id: 'hunger-drain', kind: 'code', question: 'How do I make this stat go down by 2 every turn when Hunger is above 7?', surface: CODE_TAB },
  { id: 'rested-when-full', kind: 'code', question: 'How do I turn on the Rested trait when this stat is full?', surface: CODE_TAB },
  { id: 'night-regen', kind: 'code', question: 'How can this stat recover 1 point per hour, but only at night?', surface: CODE_TAB },
  { id: 'add-stat', kind: 'prose', question: 'How do I add a new stat to my world?' },
  { id: 'hide-stat', kind: 'prose', question: 'How do I hide a stat from the player?' },
  { id: 'change-theme', kind: 'prose', question: 'How do I change the theme?' },
  { id: 'export-world', kind: 'prose', question: 'How do I export my world?' },
];

const stat = (name: string, min: number, max: number, value: number, regen: number): Stat =>
  ({ id: name.toLowerCase(), name, type: 'number', description: '', min, max, value, regen, descriptors: [] });

/** The stat every snippet belongs to, and its neighbors the questions name. */
export const FIXTURE_STAT = stat('Health', 0, 100, 60, 1);
export const FIXTURE_STATS: readonly Stat[] = [FIXTURE_STAT, stat('Stamina', 0, 100, 40, 2), stat('Hunger', 0, 10, 8, 0)];

const wildcard = (name: string, values: string[], value: string): SandboxPlaceholderNode => ({
  name, path: [name], entry: { id: name.toLowerCase(), value, values, text: value, roll: () => values[0] },
});
const trait = (name: string, enabled: boolean, acquired: boolean): SandboxTrait =>
  ({ name, enabled, acquired, id: name.toLowerCase(), mode: 'optional', available: true, group: '', playerToggle: true });

export const FIXTURE_OPTIONS: StatCodeRunOptions = {
  placeholders: [wildcard('Weather', ['sunny', 'rainy', 'stormy'], 'rainy'), wildcard('Mood', ['calm', 'wary'], 'calm')],
  traits: [trait('Poisoned', true, true), trait('Rested', false, false), trait('Brave', true, true)],
};

/** Runs a snippet as the fixture stat's code, in the real stat-code sandbox and its own interrupt timeout. */
export const fixtureRunner: SnippetRunner = async (code) => {
  const result = await executeStatCode(code, [...FIXTURE_STATS], FIXTURE_STAT, FIXTURE_OPTIONS);
  return { runs: result.error === null, error: result.error };
};
