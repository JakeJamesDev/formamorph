import { describe, expect, it } from 'vitest';
import { hasCodeWords, isCodeTurn } from '@/lib/formaquestion/helpCodeRider';
import { testScript } from '@/lib/formaquestion/helpCodeTestRun';
import type { ScriptTiming } from '@/types';
import { FIXTURE_STAT, FIXTURE_WORLD, fixtureRunner, HELP_CODE_CASES, runnerOf, testsClean, type HelpCodeCase } from './help-code-cases';
import { inBox, passesCase, scoreCodeAnswer, scoreNames } from './help-code-score';

const answer = (code: string) => `Put this in **Before the AI**:\n\n\`\`\`javascript before\n${code}\n\`\`\``;
const passes = async (id: string, code: string) => {
  const c = HELP_CODE_CASES.find((x) => x.id === id);
  if (!c?.names) throw new Error(`no known case ${id}`);
  return passesCase(await scoreCodeAnswer(answer(code), runnerOf(c)), scoreNames(answer(code), c.names));
};

// Each known case's code as the guide writes it, and the code the source session gave for it.
const KNOWN: Record<string, { right: string; given: string }> = {
  'prowler-at-night': {
    right: "traits.Prowler.enabled = clock.daypart === 'night';",
    given: 'if (clock.time >= 20 || clock.time <= 5) {\n  traits.Prowler.enabled = true;\n} else {\n  traits.Prowler.enabled = false;\n}',
  },
  'seasoned-after-two-weeks': {
    right: 'traits.Seasoned.enabled = clock.day > 14;',
    given: 'if (clock.days >= 14) {\n  traits.Seasoned.enabled = true;\n} else {\n  traits.Seasoned.enabled = false;\n}',
  },
  'seasoned-on-persona': {
    right: 'persona.traits.Seasoned.enabled = clock.day > 14;',
    given: 'if (clock.day > 14) {\n  traits.Seasoned.enabled = true;\n}',
  },
  'brave-at-courage': {
    right: 'traits.Brave.enabled = stats.Courage.value >= 50;',
    given: 'if (stats.Courage >= 50) {\n  traits.Brave.enabled = true;\n}',
  },
  'quotes-pin': {
    right: "if (clock.day > 30 && stats.Int.value > 30 && traits.Grumpy.enabled) {\n  placeholders.Quotes.pin('The wind is howling');\n}",
    given: "if (clock.days >= 30 && self.value > 30 && traits.Grumpy.enabled) {\n  placeholders.Quotes.pin('The wind is howling');\n} else {\n  placeholders.Quotes.unpin();\n}",
  },
  // A trait script's `self` is the trait, so a `self.value` read is no stat read.
  'trait-heal-while-on': {
    right: 'stats.Health.value += 5;',
    given: 'self.value += 5;',
  },
  // A world script has no stat as `self`, so a `self.value` read is NaN and the write throws.
  'world-heal-on-stamina': {
    right: 'if (stats.Stamina.value > 30) stats.Health.value += 5;',
    given: 'if (stats.Stamina.value > 30) stats.Health.value = self.value + 5;',
  },
};

describe('the known cases', () => {
  it('are the code cases that carry names', () => {
    expect(HELP_CODE_CASES.filter((c) => c.names).map((c) => c.id)).toEqual(Object.keys(KNOWN));
    expect(HELP_CODE_CASES.filter((c) => c.names).every((c) => c.kind === 'code')).toBe(true);
  });

  it.each(Object.entries(KNOWN))('pass %s on the code the guide writes', async (id, { right }) => {
    expect(await passes(id, right)).toBe(true);
  });

  it.each(Object.entries(KNOWN))('fail %s on the code the source session gave', async (id, { given }) => {
    expect(await passes(id, given)).toBe(false);
  });

  // The request names Health as the open stat, so `self` is not the stat the question names.
  it('fail brave-at-courage on a self.value read', async () => {
    expect(await passes('brave-at-courage', 'traits.Brave.enabled = self.value >= 50;')).toBe(false);
  });

  it('fail quotes-pin on a self.value read', async () => {
    const code = "if (clock.day > 30 && self.value > 30 && traits.Grumpy.enabled) {\n  placeholders.Quotes.pin('The wind is howling');\n}";
    expect(await passes('quotes-pin', code)).toBe(false);
  });

  it('name the fixture stat as the focus of every case on the Code tab', () => {
    const onTab = HELP_CODE_CASES.filter((c) => c.surface && !c.trait && !c.worldScript);
    expect(onTab.length).toBeGreaterThan(0);
    expect(onTab.every((c) => c.focus?.kind === 'stat' && c.focus.name === FIXTURE_STAT.name)).toBe(true);
  });

  it('name the fixture trait as the focus of every case on its Scripts tab', () => {
    const onTab = HELP_CODE_CASES.filter((c) => c.trait);
    expect(onTab.length).toBeGreaterThan(0);
    expect(onTab.every((c) => c.surface && c.focus?.kind === 'trait' && c.focus.name === c.trait)).toBe(true);
    expect(onTab.every((c) => FIXTURE_WORLD.traits.some((t) => t.name === c.trait))).toBe(true);
  });

  it('open the world Scripts tab with no focus on every world case', () => {
    const onTab = HELP_CODE_CASES.filter((c) => c.worldScript);
    expect(onTab.length).toBeGreaterThan(0);
    expect(onTab.every((c) => c.surface?.tabs.join() === 'worldEditor.scripts' && c.focus === undefined)).toBe(true);
  });

  it('pass two weeks read through elapsed hours, and still fail a clock field that is not a count of time', async () => {
    expect(await passes('seasoned-after-two-weeks', 'traits.Seasoned.enabled = clock.elapsedHours > 336;')).toBe(true);
    expect(await passes('seasoned-after-two-weeks', 'traits.Seasoned.enabled = clock.hour > 14;')).toBe(false);
  });

  it('still fail a known case that drops the stat read', async () => {
    expect(await passes('brave-at-courage', 'traits.Brave.enabled = true;')).toBe(false);
    expect(await passes('quotes-pin', "if (clock.day > 30 && traits.Grumpy.enabled) {\n  placeholders.Quotes.pin('The wind is howling');\n}")).toBe(false);
  });
});

// The code test's view of the same code: the test arm's answers see these results.
describe('the known cases under the code test', () => {
  const tested = async (id: string, code: string) => {
    const c = HELP_CODE_CASES.find((x) => x.id === id);
    const owner = c?.trait ? { kind: 'trait' as const, name: c.trait }
      : c?.worldScript ? { kind: 'world' as const } : { kind: 'stat' as const, name: FIXTURE_STAT.name };
    return testsClean(await testScript(code, 'before', owner, c?.world ?? FIXTURE_WORLD));
  };

  it.each(Object.entries(KNOWN))('test %s clean on the code the guide writes', async (id, { right }) => {
    expect(await tested(id, right)).toBe(true);
  });

  it.each(Object.entries(KNOWN))('flag %s on the code the source session gave', async (id, { given }) => {
    expect(await tested(id, given)).toBe(false);
  });
});

// Each timing case's code as the guide writes it, in the fence its box needs.
const TIMED: Record<HelpCodeCase['id'], string> = {
  'start-new-game': 'return 50 + Math.floor(Math.random() * 51);',
  'start-worded': 'return self.max;',
  'output-swap': "narration.sentence = narration.sentence.replace('Damn', 'Darn');",
  'switch-brave': "if (trait.name === 'Brave' && trait.enabled) stats.Health.value += 10;",
  'trait-start-stamina': 'stats.Stamina.value = 80;',
  'trait-switch-off': 'if (!trait.enabled) stats.Courage.value -= 10;',
  'world-start-stamina': 'stats.Stamina.value = 80;',
  'world-switch-brave': "if (trait.name === 'Brave' && !trait.enabled) stats.Courage.value -= 10;",
};

describe('the timing cases', () => {
  const timed = HELP_CODE_CASES.filter((c) => c.timing);
  const tagged = (timing: ScriptTiming, code: string) => `Put this in the box:\n\n\`\`\`javascript ${timing}\n${code}\n\`\`\``;

  it('cover the start, output and switch timings, each a code case', () => {
    expect(timed.map((c) => c.id)).toEqual(Object.keys(TIMED));
    expect(new Set(timed.map((c) => c.timing))).toEqual(new Set(['start', 'output', 'switch']));
    expect(timed.every((c) => c.kind === 'code')).toBe(true);
  });

  it.each(Object.entries(TIMED))('run %s on the code the guide writes, in its box', async (id, code) => {
    const c = timed.find((x) => x.id === id)!;
    const timing = c.timing!;
    const answer = tagged(timing, code);
    expect(await scoreCodeAnswer(answer, runnerOf(c))).toMatchObject({ runs: true, tagged: 1 });
    expect(inBox(answer, timing)).toBe(true);
  });

  // The runner adds `narration` and `trait` only in their own timing, as the game does.
  it('fail narration and trait reads outside their timing', async () => {
    expect((await scoreCodeAnswer(tagged('before', TIMED['output-swap']), fixtureRunner)).runs).toBe(false);
    expect((await scoreCodeAnswer(tagged('before', TIMED['switch-brave']), fixtureRunner)).runs).toBe(false);
  });
});

// The set against the real rider trigger: a trigger change that flips a case fails here, not as a silent arm swap.
describe('the help-code question set', () => {
  it('gives each question its own id', () => {
    const ids = HELP_CODE_CASES.map((c) => c.id);
    expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([]);
  });

  it('makes every code case a code turn and no prose case one', () => {
    const wrong = HELP_CODE_CASES.filter((c) => isCodeTurn(c.question, c.surface) !== (c.kind === 'code')).map((c) => c.id);
    expect(wrong).toEqual([]);
  });

  it('fires the rider on an open-Code-tab case through the tab alone', () => {
    const worded = HELP_CODE_CASES.filter((c) => c.surface && hasCodeWords(c.question)).map((c) => c.id);
    expect(worded).toEqual([]);
    expect(HELP_CODE_CASES.some((c) => c.kind === 'code' && c.surface)).toBe(true);
    expect(HELP_CODE_CASES.some((c) => c.kind === 'code' && !c.surface)).toBe(true);
  });
});
