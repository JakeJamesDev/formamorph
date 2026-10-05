import { describe, expect, it } from 'vitest';
import { fixtureRunner } from './help-code-cases';
import { inventedNames, readFences, ref, scoreCodeAnswer, scoreNames, summarizeCodeScores } from './help-code-score';

const fence = (info: string, code: string, close = true) => [`\`\`\`${info}`, code, ...(close ? ['```'] : [])].join('\n');

describe('readFences', () => {
  it('reads the language, the slot tag and the code of each fence', () => {
    const answer = ['Put this in **Before the AI**:', fence('javascript before', 'return 5;'), 'And this in **After the AI**:', fence('javascript after', 'self.value -= 1;')].join('\n\n');
    expect(readFences(answer)).toEqual([
      { language: 'javascript', slot: 'before', code: 'return 5;', closed: true },
      { language: 'javascript', slot: 'after', code: 'self.value -= 1;', closed: true },
    ]);
  });

  it('reads a fence with no slot tag, or another word, as untagged', () => {
    expect(readFences([fence('javascript', 'return 1;'), fence('js now', 'return 2;'), fence('', 'return 3;')].join('\n')).map((f) => f.slot)).toEqual([null, null, null]);
  });

  it('reads a fence indented under a list item', () => {
    const answer = ['1. Open the box.', '    ```javascript after', '    return 5;', '    ```', '2. Click **Test Code**.'].join('\n');
    expect(readFences(answer)).toEqual([{ language: 'javascript', slot: 'after', code: 'return 5;', closed: true }]);
  });

  it('reads a fence the answer never closes as open, with the code it has', () => {
    expect(readFences(['Steps:', fence('javascript after', 'const a = 1;\nreturn a', false)].join('\n'))).toEqual([
      { language: 'javascript', slot: 'after', code: 'const a = 1;\nreturn a', closed: false },
    ]);
  });

  it('reads no fence in a prose answer', () => {
    expect(readFences('1. Open **Settings**.\n2. Pick **Theme**.')).toEqual([]);
  });
});

describe('scoreCodeAnswer', () => {
  it('scores a tagged, closed fence that runs on the fixture stat', async () => {
    const score = await scoreCodeAnswer(fence('javascript after', 'if (stats.Stamina.value > 30) return self.value + 5;'), fixtureRunner);
    expect(score).toMatchObject({ fences: 1, fence: true, closed: true, tagged: 1, runs: true, fencesRun: 1, errors: [] });
  });

  it('scores a snippet that writes self and returns nothing as run', async () => {
    const score = await scoreCodeAnswer(fence('javascript after', 'self.value -= 2;'), fixtureRunner);
    expect(score.runs).toBe(true);
  });

  it('scores a throwing snippet as not run, with its error', async () => {
    const score = await scoreCodeAnswer(fence('javascript after', 'return undefinedThing.value;'), fixtureRunner);
    expect(score).toMatchObject({ fence: true, runs: false, fencesRun: 0 });
    expect(score.errors[0]).toMatch(/undefinedThing/);
  });

  it('scores a fence that holds only comments as not run', async () => {
    const score = await scoreCodeAnswer(fence('javascript after', '// Heal 5 if Stamina > 50\n/* your logic here */\n'), fixtureRunner);
    expect(score).toMatchObject({ fence: true, runs: false, errors: ['holds no statement'] });
  });

  it('scores a statement after a comment as code', async () => {
    const score = await scoreCodeAnswer(fence('javascript after', '// Heal\nreturn self.value + 5; // more'), fixtureRunner);
    expect(score.runs).toBe(true);
  });

  it('scores a snippet that returns text as not run', async () => {
    const score = await scoreCodeAnswer(fence('javascript after', "return 'full';"), fixtureRunner);
    expect(score.runs).toBe(false);
  });

  it('scores a snippet that never ends as not run, inside the sandbox timeout', async () => {
    const score = await scoreCodeAnswer(fence('javascript after', 'while (true) {}'), fixtureRunner);
    expect(score.runs).toBe(false);
    expect(score.errors[0]).toMatch(/timed out/i);
  });

  it('scores a fence cut off mid-statement as open and not run', async () => {
    const score = await scoreCodeAnswer(fence('javascript after', 'if (self.value > 50) {\n  return self.', false), fixtureRunner);
    expect(score).toMatchObject({ fence: true, closed: false, runs: false });
  });

  it('runs a two-fence answer only when both fences run, and counts the tags per fence', async () => {
    const answer = [fence('javascript before', 'self.value += 1;'), fence('javascript', 'return nope();')].join('\n');
    expect(await scoreCodeAnswer(answer, fixtureRunner)).toMatchObject({ fences: 2, tagged: 0.5, runs: false, fencesRun: 1 });
  });

  it('scores a prose answer as no fence and not run', async () => {
    expect(await scoreCodeAnswer('1. Open **Settings**.', fixtureRunner)).toEqual({ fences: 0, fence: false, closed: false, tagged: 0, runs: false, fencesRun: 0, errors: [] });
  });
});

describe('summarizeCodeScores', () => {
  it('shares each answer metric over every answer, tags and runs per fence over every fence, truncation over fenced answers', async () => {
    const scores = await Promise.all([
      fence('javascript after', 'return 1;'),
      [fence('javascript before', 'return 2;'), fence('javascript', 'return x;')].join('\n'),
      fence('javascript after', 'return self.', false),
      'No code here.',
    ].map((answer) => scoreCodeAnswer(answer, fixtureRunner)));
    expect(summarizeCodeScores(scores, 0)).toEqual({ n: 4, fences: 4, fenced: 3, fence: 0.75, closed: 0.5, tagged: 3 / 4, runs: 0.25, fenceRuns: 2 / 4, truncated: 1 / 3 });
  });

  it('counts a failed request against every share', async () => {
    const scores = [await scoreCodeAnswer(fence('javascript after', 'return 1;'), fixtureRunner)];
    expect(summarizeCodeScores(scores, 1)).toMatchObject({ n: 2, fence: 0.5, runs: 0.5 });
  });
});

describe('ref', () => {
  it('matches a path in dot or bracket form', () => {
    const check = ref('traits.Prowler.enabled');
    expect(['traits.Prowler.enabled = true', 'traits["Prowler"].enabled', "traits['Prowler'] . enabled"].map((code) => check.pattern.test(code))).toEqual([true, true, true]);
  });

  it('matches a path read through optional chaining', () => {
    expect(ref('stats.Int.value').pattern.test('stats.Int?.value > 30')).toBe(true);
  });

  it('matches no longer name and no path under another owner', () => {
    expect(ref('clock.day').pattern.test('clock.daypart')).toBe(false);
    expect(ref('traits.Seasoned').pattern.test('persona.traits.Seasoned.enabled')).toBe(false);
  });

  it('matches any of its paths, and labels itself with them', () => {
    const check = ref('traits.Grumpy.enabled', 'persona.traits.Grumpy.enabled');
    expect(check.pattern.test('persona.traits.Grumpy.enabled')).toBe(true);
    expect(check.label).toBe('traits.Grumpy.enabled | persona.traits.Grumpy.enabled');
  });
});

describe('inventedNames', () => {
  it('names each clock field the sandbox does not have', () => {
    expect(inventedNames('if (clock.time >= 20 || clock.days > 14 || clock.previous.hour < 5) {}')).toEqual(['clock.time', 'clock.days', 'clock.previous.hour']);
  });

  it('names an unknown clock field read in bracket form or through optional chaining', () => {
    expect(inventedNames('if (clock["time"] > 20 || clock?.days > 14 || clock.previous?.["hour"] < 5) {}')).toEqual(['clock.time', 'clock.days', 'clock.previous.hour']);
  });

  it('reads an arrow as no comparison', () => {
    expect(inventedNames('const read = () => self;\nconst list = [1].map((n) => stats.Int);')).toEqual([]);
  });

  it('reads `//` inside a string as text, not a comment', () => {
    expect(inventedNames("placeholders.Quotes.pin('see http://x'); if (clock.time > 2) {}")).toEqual(['clock.time']);
  });

  it('names a whole stat compared, on either side and in bracket form', () => {
    expect(inventedNames('if (stats.Courage >= 50) {}')).toEqual(['stats.Courage >=']);
    expect(inventedNames('if (30 < self && stats["Int"] === 4) {}')).toEqual(['< self', 'stats["Int"] ===']);
  });

  it('names nothing in code that reads the real fields', () => {
    const code = 'if (clock.day > 14 && clock.daypart === "night" && clock.previous.day < clock.day && stats.Int.value > 30 && self.value >= stats["Int"].value) {}';
    expect(inventedNames(code)).toEqual([]);
  });

  it('reads past comments', () => {
    expect(inventedNames('// clock.time is not a field\n/* stats.Int > 3 */\nreturn clock.day;')).toEqual([]);
  });
});

describe('scoreNames', () => {
  const names = { present: [ref('clock.day'), ref('traits.Seasoned.enabled')], absent: [ref('traits.Brave')] };

  it('scores an answer whose fences hold every real name and no invented one as clean', () => {
    const answer = [fence('javascript before', 'const late = clock.day > 14;'), fence('javascript after', 'traits.Seasoned.enabled = late;')].join('\n');
    expect(scoreNames(answer, names)).toEqual({ missing: [], invented: [] });
  });

  it('lists each missing name, each invented one and each one the case rules out', () => {
    const answer = fence('javascript before', 'if (clock.days >= 14) traits.Brave.enabled = true;');
    expect(scoreNames(answer, names)).toEqual({ missing: ['clock.day', 'traits.Seasoned.enabled'], invented: ['clock.days', 'traits.Brave'] });
  });

  it('reads names only inside fences', () => {
    expect(scoreNames('Use `clock.day` and `traits.Seasoned.enabled`.', names).missing).toEqual(['clock.day', 'traits.Seasoned.enabled']);
  });
});
