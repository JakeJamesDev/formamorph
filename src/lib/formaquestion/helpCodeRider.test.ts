import { describe, expect, it } from 'vitest';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { SANDBOX_GLOBALS } from '@/lib/statCodeSurface';
import { STAT_CODE_TIMINGS, TIMING_LABEL } from '@/lib/statCodeTiming';
import { CODE_RIDER_LANGUAGE, DEFAULT_CODE_RIDER, hasCodeWords, isCodeTurn, SANDBOX_GLOBAL_NAMES, STAT_CODE_TAB, withCodeRider } from './helpCodeRider';

const tabs = (...ids: SurfaceId[]) => ({ screen: 'worldEditor' as SurfaceId, dialog: null, tabs: ids });

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
  ])('leave an ordinary question alone: %s', (question) => {
    expect(hasCodeWords(question)).toBe(false);
  });

  it('name every global the sandbox injects', () => {
    expect([...SANDBOX_GLOBAL_NAMES].sort()).toEqual(SANDBOX_GLOBALS.map((entry) => entry.name).sort());
  });
});

describe('a code turn', () => {
  it('is any question asked from a stat Code tab, and an ordinary question elsewhere is not', () => {
    expect(isCodeTurn('How do I make this go down?', tabs(STAT_CODE_TAB))).toBe(true);
    expect(isCodeTurn('How do I make this go down?', tabs('worldEditorStat.details'))).toBe(false);
    expect(isCodeTurn('How do I make this go down?', null)).toBe(false);
    expect(isCodeTurn('Can I return self.value?', null)).toBe(true);
  });
});

describe('the rider', () => {
  it('goes after the user message, and an empty rider changes nothing', () => {
    expect(withCodeRider('Question: x', 'Rider.')).toBe('Question: x\n\nRider.');
    expect(withCodeRider('Question: x', '')).toBe('Question: x');
    expect(withCodeRider('Question: x', ' \n ')).toBe('Question: x');
  });

  it('names each box, and ends one line with each fence opener, its slot first after the language', () => {
    const lines = DEFAULT_CODE_RIDER.split('\n');
    for (const slot of STAT_CODE_TIMINGS) {
      expect(DEFAULT_CODE_RIDER).toContain(`**${TIMING_LABEL[slot]}**`);
      expect(lines.filter((line) => line.endsWith(`\`\`\`${CODE_RIDER_LANGUAGE} ${slot}`)), slot).toHaveLength(1);
    }
    expect(DEFAULT_CODE_RIDER.match(/```/g)).toHaveLength(STAT_CODE_TIMINGS.length);
  });

  it('carries no example code', () => {
    expect(DEFAULT_CODE_RIDER).not.toMatch(/[=;(){}[\]]|\breturn\b|\bfunction\b/);
  });

  it('names each sandbox object it names alone, never with a member', () => {
    const named = [...DEFAULT_CODE_RIDER.matchAll(new RegExp(`\`(${SANDBOX_GLOBAL_NAMES.join('|')})([^\`]*)\``, 'g'))];
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter(([, , rest]) => rest !== '').map(([code]) => code)).toEqual([]);
  });
});
