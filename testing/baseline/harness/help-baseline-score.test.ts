import { describe, expect, it } from 'vitest';
import { hasName, inLanguage, scoreAnswer, summarize, worstQuestions, type AnswerScore, type ScoredRow } from './help-baseline-score';

const DOCS = 'Select **Backup & Restore**, then **Save backup**. The **Edit** button opens the text. Keep a notebook.';
const answer = (text: string, over: { flagged?: boolean; sources?: string[] } = {}) => ({ text, flagged: false, sources: ['Saves#how-to-make-a-backup'], ...over });
const backup = { section: 'Saves#how-to-make-a-backup', facts: ['Backup & Restore', 'Save backup'], forbidden: ['Export save'] };

describe('scoreAnswer', () => {
  it('is grounded-correct when every keyed name is in the answer, in any case', () => {
    const score = scoreAnswer(backup, answer('1. Open **backup & restore**.\n2. Select **Save Backup**.'), DOCS);
    expect(score).toMatchObject({ covered: true, factShare: 1, complete: true, wrongStep: false, keysMet: true, correct: true });
  });

  it('counts a part of the keyed names and is then not correct', () => {
    const score = scoreAnswer(backup, answer('Open **Backup & Restore** and follow the dialog.'), DOCS);
    expect(score).toMatchObject({ factShare: 0.5, complete: false, correct: false });
  });

  it('takes one name of a list of alternatives as that fact', () => {
    const keys = { section: 'A#b', facts: [['Ctrl+F', 'magnifier'], 'Replace all'], forbidden: [] };
    expect(scoreAnswer(keys, answer('Select the magnifier button, then **Replace all**.'), DOCS).complete).toBe(true);
    expect(scoreAnswer(keys, answer('Select **Replace all**.'), DOCS).factShare).toBe(0.5);
  });

  it('does not find a name inside a longer word', () => {
    const keys = { section: 'A#b', facts: ['Edit', 'Endpoint'], forbidden: [] };
    expect(scoreAnswer(keys, answer('You edited the Endpoints list.'), DOCS).factShare).toBe(0);
    expect(scoreAnswer(keys, answer('Select **Edit**, then the **Endpoint** list.'), DOCS).factShare).toBe(1);
  });

  it('finds a name next to text in another script', () => {
    const keys = { section: 'A#b', facts: ['Save backup'], forbidden: [] };
    expect(scoreAnswer(keys, answer('Save backupを選択します。'), DOCS).complete).toBe(true);
  });

  it('reads a curly apostrophe and a straight one as the same', () => {
    const keys = { section: 'A#b', facts: ["Don't Show This Again"], forbidden: [] };
    expect(scoreAnswer(keys, answer('Select **Don’t Show This Again**.'), DOCS).complete).toBe(true);
  });

  it('finds a name whose first word alone is bold', () => {
    const keys = { section: 'A#b', facts: ['Memory tab'], forbidden: [] };
    expect(scoreAnswer(keys, answer('Open the **Memory** tab.'), DOCS).complete).toBe(true);
  });

  it('marks a wrong step for a forbidden name, and the answer is then not correct', () => {
    const score = scoreAnswer(backup, answer('Open **Backup & Restore**, select **Save backup**, or use **Export save**.'), DOCS);
    expect(score).toMatchObject({ complete: true, wrongStep: true, keysMet: false, correct: false });
  });

  it('does not count a flagged answer as grounded, with every keyed name in it', () => {
    const score = scoreAnswer(backup, answer('Open **Backup & Restore**, then **Save backup**.', { flagged: true }), DOCS);
    expect(score).toMatchObject({ keysMet: true, flagged: true, correct: false });
  });

  it('is not grounded-correct from a section the key does not list, and says so', () => {
    const score = scoreAnswer(backup, answer('Open **Backup & Restore**, then **Save backup**.', { sources: ['Other#one'] }), DOCS);
    expect(score).toMatchObject({ keysMet: true, sourced: false, correct: false, otherSource: true });
    const listed = { ...backup, otherSections: ['Other#one'] };
    expect(scoreAnswer(listed, answer('Open **Backup & Restore**, then **Save backup**.', { sources: ['Other#one'] }), DOCS)).toMatchObject({ sourced: true, correct: true, otherSource: false });
  });

  it('takes every section of a page for a key that ends in #*', () => {
    const keys = { section: 'Changelog#*', facts: [], forbidden: [] };
    expect(scoreAnswer(keys, answer('The newest release adds a help window.', { sources: ['Home', 'Changelog#-added-part-2'] }), DOCS)).toMatchObject({ covered: true, sourced: true, keysMet: true, correct: true });
    expect(scoreAnswer(keys, answer('The newest release adds a help window.', { sources: ['Changelogs#x'] }), DOCS)).toMatchObject({ keyed: false, sourced: false, correct: false, otherSource: false });
    expect(scoreAnswer(keys, answer('I do not know.', { flagged: true, sources: ['Changelog#-added'] }), DOCS).correct).toBe(false);
  });

  it('wants the flag on a question the guide does not cover', () => {
    const keys = { facts: [], forbidden: [] };
    expect(scoreAnswer(keys, answer('A LoRA is a small add-on model.', { flagged: true, sources: [] }), DOCS)).toMatchObject({ covered: false, correct: true, sourced: null });
    expect(scoreAnswer(keys, answer('Select **Earn Achievements**.', { sources: ['A#b'] }), DOCS)).toMatchObject({ covered: false, correct: false });
  });

  it('reads the right section from the sources, and a part of it counts', () => {
    expect(scoreAnswer(backup, answer('x', { sources: ['Other#one', 'Saves#how-to-make-a-backup-part-2'] }), DOCS).sourced).toBe(true);
    expect(scoreAnswer(backup, answer('x', { sources: ['Other#one'] }), DOCS).sourced).toBe(false);
  });

  it('counts the bold names that the docs never use', () => {
    const score = scoreAnswer(backup, answer('Select **Backup & Restore**, then **Cloud Sync**, then **Save backup:**'), DOCS);
    expect(score.invented).toBe(1);
  });

  it('counts a bold name that the docs hold only inside a longer word', () => {
    expect(scoreAnswer(backup, answer('Select **Note**, then **Edit**.'), DOCS).invented).toBe(1);
  });
});

describe('hasName', () => {
  it('reads the text and the name the same way: case, apostrophes, line breaks and bold marks', () => {
    expect(hasName('Select **Don’t Show\nThis Again**.', "Don't show this again")).toBe(true);
    expect(hasName('Select **Don’t Show**.', "Don't show this again")).toBe(false);
  });

  it('takes a name with regex characters as plain text', () => {
    expect(hasName('Type `x^2^` or pick ComfyUI (local).', 'x^2^')).toBe(true);
    expect(hasName('Type `x^2^` or pick ComfyUI (local).', 'ComfyUI (local)')).toBe(true);
    expect(hasName('Type x22 or pick ComfyUI local.', 'x^2^')).toBe(false);
  });
});

describe('inLanguage', () => {
  it('reads the language of the prose and leaves the bold control names out', () => {
    expect(inLanguage('Spanish', 'Abre el menú y selecciona **Backup & Restore** para guardar una copia de los datos.')).toBe(true);
    expect(inLanguage('Spanish', 'Open the menu and select **Backup & Restore** to save a copy of the data.')).toBe(false);
    expect(inLanguage('Japanese', 'メニューを開いて **Backup & Restore** を選択します。')).toBe(true);
    expect(inLanguage('Japanese', 'Open the **Menu** and select the button.')).toBe(false);
    expect(inLanguage('English', 'Open the menu and select **Backup & Restore**.')).toBe(true);
  });

  it('reads a short Spanish answer that is mostly control names', () => {
    expect(inLanguage('Spanish', 'Ve a **Settings**, pulsa **Display** y cambia **Narration Font** a tu gusto.')).toBe(true);
  });

  it('refuses a language it has no check for', () => {
    expect(() => inLanguage('German', 'Open the menu.')).toThrow('German');
  });
});

const score = (over: Partial<AnswerScore>): AnswerScore => ({
  covered: true, keyed: true, factShare: 1, complete: true, wrongStep: false, invented: 0, flagged: false, sourced: true, keysMet: true, correct: true, otherSource: false, ...over,
});
const row = (caseId: string, run: number, over: Partial<AnswerScore>, tokens = { promptTokens: 1000, answerTokens: 100 }): ScoredRow => ({
  caseId, kind: 'task', arm: 'retrieval', run, score: score(over), ...tokens,
});

describe('summarize', () => {
  it('gives the rates of the covered answers, and the two flag errors apart', () => {
    const summary = summarize([
      row('a', 1, {}),
      row('a', 2, { complete: false, factShare: 0.5, keysMet: false, correct: false }),
      row('b', 1, { flagged: true, correct: false, sourced: false }, { promptTokens: 3000, answerTokens: 300 }),
      row('b', 2, { wrongStep: true, keysMet: false, correct: false, invented: 2 }),
      row('c', 1, { sourced: false, correct: false, otherSource: true }),
      row('u', 1, { covered: false, sourced: null, flagged: true, correct: true }),
      row('u', 2, { covered: false, sourced: null, flagged: false, correct: false, invented: 1 }),
      row('v', 1, { covered: false, sourced: null, flagged: true, correct: true }),
      row('v', 2, { covered: false, sourced: null, flagged: true, correct: true }),
    ]);
    expect(summary).toMatchObject({
      covered: 5, groundedCorrect: 0.2, otherSource: 0.2, keysMet: 0.6, wrongStep: 0.2, falseFlag: 0.2, wrongNoFlag: 0.4, sourceAccuracy: 0.6,
      uncovered: 4, missedFlag: 0.25, promptTokens: 1222, answerTokens: 122,
    });
  });

  it('leaves a question with no keyed fact out of the rates that need one', () => {
    const noFacts = { keyed: false, factShare: 0, sourced: false, correct: false };
    const summary = summarize([row('a', 1, {}), row('a', 2, { complete: false, keysMet: false, correct: false }), row('n', 1, noFacts), row('n', 2, noFacts)]);
    expect(summary).toMatchObject({ covered: 4, groundedCorrect: 0.25, sourceAccuracy: 0.5, keysMet: 0.5, otherSource: 0, wrongNoFlag: 0.5 });
  });

  it('counts invented names over every answer, the uncovered ones included', () => {
    const rows = [row('a', 1, {}), row('a', 2, { invented: 2 }), row('u', 1, { covered: false, sourced: null, flagged: true, invented: 1 }), row('u', 2, { covered: false, sourced: null, flagged: true })];
    expect(summarize(rows).invented).toBe(0.5);
    expect(summarize(rows.slice(2)).invented).toBe(0.5);
  });

  it('gives no rate for a set with no answer of that kind', () => {
    expect(summarize([row('a', 1, {})])).toMatchObject({ uncovered: 0, missedFlag: null });
    expect(summarize([])).toMatchObject({ covered: 0, groundedCorrect: null, promptTokens: null });
  });
});

describe('worstQuestions', () => {
  const rows = [
    row('flag', 1, { covered: false, sourced: null, correct: false }), row('flag', 2, { covered: false, sourced: null, flagged: true, correct: true }),
    row('model', 1, { complete: false, factShare: 0.5, keysMet: false, correct: false }), row('model', 2, {}),
    row('fine', 1, {}), row('fine', 2, {}),
    row('gap', 1, { flagged: true, correct: false, complete: false, factShare: 0, keysMet: false }),
    row('gap', 2, { flagged: true, correct: false, complete: false, factShare: 0, keysMet: false }),
    row('search', 1, { sourced: false, flagged: true, correct: false, keysMet: false, complete: false, factShare: 0.5 }),
    row('search', 2, { sourced: false, complete: false, factShare: 0.5, keysMet: false, correct: false }),
    row('steps', 1, { wrongStep: true, flagged: true, keysMet: false, correct: false }),
    row('steps', 2, { wrongStep: true, flagged: true, keysMet: false, correct: false }),
  ];

  it('lists the failing questions, worst first, and leaves out the ones that never fail', () => {
    expect(worstQuestions(rows, 10).map((q) => [q.caseId, q.correct])).toEqual([['steps', 0], ['search', 0], ['gap', 0], ['model', 0.5], ['flag', 0.5]]);
    expect(worstQuestions(rows, 2).map((q) => q.caseId)).toEqual(['steps', 'search']);
  });

  it('puts wrong steps above an answer with no steps, and an answer with no flag above a flagged one', () => {
    const worst = worstQuestions(rows, 3);
    expect(worst.map((q) => [q.caseId, q.wrongStep, q.flagged])).toEqual([['steps', 1, 1], ['search', 0, 0.5], ['gap', 0, 1]]);
  });

  it('names a first cause from the sources and the flag', () => {
    const cause = Object.fromEntries(worstQuestions(rows, 10).map((q) => [q.caseId, q.likelyCause]));
    expect(cause).toEqual({ steps: 'docs gap', search: 'search miss', gap: 'docs gap', model: 'model error', flag: 'model error' });
  });
});
