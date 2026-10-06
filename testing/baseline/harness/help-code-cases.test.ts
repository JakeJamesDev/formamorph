import { describe, expect, it } from 'vitest';
import { hasCodeWords, isCodeTurn } from '@/lib/formaquestion/helpCodeRider';
import { testStatCode } from '@/lib/formaquestion/helpCodeTestRun';
import { FIXTURE_STAT, FIXTURE_WORLD, fixtureRunner, HELP_CODE_CASES, testsClean } from './help-code-cases';
import { passesCase, scoreCodeAnswer, scoreNames } from './help-code-score';

const answer = (code: string) => `Put this in **Before the AI**:\n\n\`\`\`javascript before\n${code}\n\`\`\``;
const passes = async (id: string, code: string) => {
  const names = HELP_CODE_CASES.find((c) => c.id === id)?.names;
  if (!names) throw new Error(`no known case ${id}`);
  return passesCase(await scoreCodeAnswer(answer(code), fixtureRunner), scoreNames(answer(code), names));
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
    const onTab = HELP_CODE_CASES.filter((c) => c.surface);
    expect(onTab.length).toBeGreaterThan(0);
    expect(onTab.every((c) => c.focus?.kind === 'stat' && c.focus.name === FIXTURE_STAT.name)).toBe(true);
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
    return testsClean(await testStatCode(code, 'before', FIXTURE_STAT.name, c?.world ?? FIXTURE_WORLD));
  };

  it.each(Object.entries(KNOWN))('test %s clean on the code the guide writes', async (id, { right }) => {
    expect(await tested(id, right)).toBe(true);
  });

  it.each(Object.entries(KNOWN))('flag %s on the code the source session gave', async (id, { given }) => {
    expect(await tested(id, given)).toBe(false);
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
