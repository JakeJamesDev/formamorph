import { describe, expect, it } from 'vitest';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { SANDBOX_GLOBALS } from '@/lib/statCodeSurface';
import { SCRIPT_TIMING_LABEL, SCRIPT_TIMINGS } from '@/lib/scripts';
import {
  CODE_RIDER_LANGUAGE, DEFAULT_CODE_RIDER, hasCodeWords, isCodeTurn, SANDBOX_GLOBAL_NAMES, SCRIPT_TAB, scriptHomeLine, TRAIT_SCRIPT_TAB, withCodeRider, WORLD_SCRIPT_TAB,
} from './helpCodeRider';

const tabs = (...ids: SurfaceId[]) => ({ screen: 'worldEditor' as SurfaceId, dialog: null, tabs: ids });
/** The code names a line puts in backticks, in order. */
const namedIn = (line: string | null | undefined) => [...(line ?? '').matchAll(/`([\w.]+)`/g)].map(([, name]) => name);

describe('the code words of a question', () => {
  it.each([
    'How do I write code that drains Hunger?',
    'Can a script read another stat?',
    'Give me two scripts for this',
    'Is this JavaScript?',
    'What goes in before the AI?',
    'Why does After the AI not run?',
    'How do I read stats.Health from here?',
    'Can I set self.max to 50?',
    'How do I read placeholders["Hair Color"]?',
    'What does clock.deltaHours hold?',
    'Is `return 5` enough?',
    'Can I return -1?',
    'Should it return self.value + 1?',
    'Can I return Math.max of two stats?',
    'Can I return stats',
    'Can I use function(x) here?',
    'Do arrow functions like x => x work?',
    'What can I do At Game Start?',
    'How do I change a word during AI output?',
    'What runs when a trait switches?',
  ])('match a code question: %s', (question) => {
    expect(hasCodeWords(question)).toBe(true);
  });

  it.each([
    'How do I return to the main menu?',
    'What does the lookup function do?',
    'How do I add traits?',
    'Edit my persona.',
    'How do I add entities to a scene?',
    'Where are my dictionaries?',
    'How do the stats work?',
    'How do I change the clock speed?',
    'How do I add a placeholder?',
    'Does the AI remember things from before?',
    'How do I make a decoder ring?',
    'At the start of a new game, which world is picked?',
    'During a long AI reply, can I read the output?',
    'When I click a trait, what switches?',
    'When a trait is on, does it switch the theme?',
  ])('leave an ordinary question alone: %s', (question) => {
    expect(hasCodeWords(question)).toBe(false);
  });

  it('name every global the sandbox injects', () => {
    expect([...SANDBOX_GLOBAL_NAMES].sort()).toEqual(SANDBOX_GLOBALS.map((entry) => entry.name).sort());
  });
});

describe('a code turn', () => {
  it('is any question asked from a stat Code tab, and an ordinary question elsewhere is not', () => {
    expect(isCodeTurn('How do I make this go down?', tabs(SCRIPT_TAB))).toBe(true);
    expect(isCodeTurn('How do I make this go down?', tabs('worldEditorStat.details'))).toBe(false);
    expect(isCodeTurn('How do I make this go down?', null)).toBe(false);
    expect(isCodeTurn('How do I make this go down?', tabs('worldEditorTrait.details'))).toBe(false);
    expect(isCodeTurn('Can I return self.value?', null)).toBe(true);
  });
});

describe('a code turn on a trait', () => {
  it('is any question asked from a trait’s Scripts tab', () => {
    expect(isCodeTurn('How do I make this go down?', tabs(TRAIT_SCRIPT_TAB))).toBe(true);
    expect(isCodeTurn('How do I make this go down?', tabs('worldEditor.traits', TRAIT_SCRIPT_TAB))).toBe(true);
  });
});

describe('a code turn on the world', () => {
  it('is any question asked from the world’s Scripts tab, and no other world tab', () => {
    expect(isCodeTurn('How do I make this go down?', tabs(WORLD_SCRIPT_TAB))).toBe(true);
    expect(isCodeTurn('How do I make this go down?', tabs('worldEditor.stats'))).toBe(false);
  });
});

describe('the rider', () => {
  it('goes after the user message, and an empty rider changes nothing', () => {
    expect(withCodeRider('Question: x', 'Rider.')).toBe('Question: x\n\nRider.');
    expect(withCodeRider('Question: x', '')).toBe('Question: x');
    expect(withCodeRider('Question: x', ' \n ')).toBe('Question: x');
  });

  it('names each of the five boxes, and ends one line with each fence opener, its timing first after the language', () => {
    const lines = DEFAULT_CODE_RIDER.split('\n');
    expect(SCRIPT_TIMINGS).toHaveLength(5);
    for (const timing of SCRIPT_TIMINGS) {
      expect(DEFAULT_CODE_RIDER).toContain(`**${SCRIPT_TIMING_LABEL[timing]}**`);
      expect(lines.filter((line) => line.endsWith(`\`\`\`${CODE_RIDER_LANGUAGE} ${timing}`)), timing).toHaveLength(1);
    }
    expect(DEFAULT_CODE_RIDER.match(/```/g)).toHaveLength(SCRIPT_TIMINGS.length);
  });

  it('says, above the fence lines, that the app reads the word after the language to pick each box', () => {
    const lines = DEFAULT_CODE_RIDER.split('\n');
    const purpose = lines.findIndex((l) => l.includes(`reads the word after \`${CODE_RIDER_LANGUAGE}\` on the opening line`));
    expect(purpose).toBeGreaterThanOrEqual(0);
    for (const timing of SCRIPT_TIMINGS) {
      expect(lines[purpose], timing).toContain(`\`${timing}\` for **${SCRIPT_TIMING_LABEL[timing]}**`);
      expect(lines.findIndex((l) => l.endsWith(`\`\`\`${CODE_RIDER_LANGUAGE} ${timing}`)), timing).toBeGreaterThan(purpose);
    }
  });

  it('carries no example code', () => {
    expect(DEFAULT_CODE_RIDER).not.toMatch(/[=;(){}[\]]|\breturn\b|\bfunction\b/);
  });

  it('says when each box runs, every box with its own run time, before it asks for the box name', () => {
    const line = DEFAULT_CODE_RIDER.split('\n').find((l) => l.includes('Pick the box by when it runs: **')) ?? '';
    const runTimes = SCRIPT_TIMINGS.map((timing) => new RegExp(`\\*\\*${SCRIPT_TIMING_LABEL[timing]}\\*\\* ([a-z][^,*.]+)`).exec(line)?.[1]);
    expect(runTimes.every(Boolean), String(runTimes)).toBe(true);
    expect(new Set(runTimes).size).toBe(SCRIPT_TIMINGS.length);
    expect(line.indexOf('Name the box in one sentence.')).toBeGreaterThan(line.lastIndexOf('**'));
  });

  // Scripts Leftovers Q10 leaves `entities` and `persona` out of this line. Q10 keeps `self`, in words every home shares.
  it('names self, stats, traits, placeholders and clock on the reads line, and no stat or owner', () => {
    const line = DEFAULT_CODE_RIDER.split('\n').find((l) => l.startsWith('- Read the script\'s home'));
    expect(line).toBeDefined();
    const named = namedIn(line);
    expect(named).toEqual(['self', 'stats', 'traits', 'placeholders', 'clock']);
    for (const name of named) expect(SANDBOX_GLOBAL_NAMES, name).toContain(name);
    expect(line).toContain('the world\'s stats through `stats`');
    expect(DEFAULT_CODE_RIDER).not.toMatch(/\bstat whose code\b|\bowner\b/);
  });

  it('names each sandbox object it names alone, never with a member', () => {
    const named = [...DEFAULT_CODE_RIDER.matchAll(new RegExp(`\`(${SANDBOX_GLOBAL_NAMES.join('|')})([^\`]*)\``, 'g'))];
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter(([, , rest]) => rest !== '').map(([code]) => code)).toEqual([]);
  });
});

describe('the home line', () => {
  it('on a stat Code tab says self is the stat and owner.stats reads its entity', () => {
    const line = scriptHomeLine(tabs(SCRIPT_TAB));
    expect(line).toMatch(/^- /);
    expect(namedIn(line)).toEqual(['self', 'owner.stats']);
  });

  it('on a trait Scripts tab says self is the trait, and names what the owner reads and when the script runs', () => {
    const line = scriptHomeLine(tabs(TRAIT_SCRIPT_TAB));
    expect(line).toMatch(/^- /);
    expect(line).toMatch(/\btrait's script\b/);
    expect(line).toMatch(/only while the trait is on/);
    expect(namedIn(line)).toEqual(['self', 'owner.stats']);
    expect(line).not.toBe(scriptHomeLine(tabs(SCRIPT_TAB)));
  });

  it('on the world Scripts tab says a world script has no owner and no self, and never offers owner.stats', () => {
    const line = scriptHomeLine(tabs(WORLD_SCRIPT_TAB));
    expect(line).toMatch(/^- /);
    expect(line).toMatch(/world script/);
    expect(line).toMatch(/no owner/);
    expect(namedIn(line)).not.toContain('owner.stats');
    expect(line).not.toBe(scriptHomeLine(tabs(SCRIPT_TAB)));
    expect(line).not.toBe(scriptHomeLine(tabs(TRAIT_SCRIPT_TAB)));
  });

  it('is none off a script home', () => {
    expect(scriptHomeLine(tabs('worldEditorStat.details'))).toBeNull();
    expect(scriptHomeLine(tabs('worldEditorTrait.details'))).toBeNull();
    expect(scriptHomeLine(null)).toBeNull();
    expect(scriptHomeLine(undefined)).toBeNull();
  });

  it('carries no example code', () => {
    for (const tab of [SCRIPT_TAB, TRAIT_SCRIPT_TAB, WORLD_SCRIPT_TAB]) expect(scriptHomeLine(tabs(tab)), tab).not.toMatch(/[=;(){}[\]]|\breturn\b|\bfunction\b/);
  });
});
