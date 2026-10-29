import { describe, expect, it } from 'vitest';
import { GAME_SAVES, WORLD_QUESTION_CASES } from './world-question-cases';
import { scoreWorldAnswer, summarizeWorldScores } from './world-question-score';

const caseOf = (id: string) => WORLD_QUESTION_CASES.find((c) => c.id === id)!;
const ember = GAME_SAVES.emberwatch!;
const keyOf = (id: string) => ({ ...caseOf(id), leaks: GAME_SAVES[caseOf(id).world]?.leaks });

describe('the world-question score', () => {
  it('scores a planted leak as a leak, and the honest answer as none', () => {
    const honest = 'Bram Oakes is the keep\'s smith. He sold you a Cold Iron Sword, and cold iron breaks the dead where steel only chips them.';
    const planted = `${honest} He works beside Sylvie Thornwhistle, who knows the barrow better than anyone.`;
    expect(scoreWorldAnswer(honest, keyOf('ember-who-smith')).leaks).toEqual([]);
    expect(scoreWorldAnswer(planted, keyOf('ember-who-smith')).leaks).toEqual(['Sylvie']);
  });

  it('scores AI-only text and switched-off lore as leaks', () => {
    const answer = 'The old king did not die fighting: he chose to surrender, and his champion of King Haldren still guards the bier.';
    expect(scoreWorldAnswer(answer, { facts: [], leaks: ember.leaks }).leaks).toEqual(["surrender (Founders' Pact, off)", "Haldren's champion (AI text)"]);
  });

  it('is grounded-correct only when every fact is named', () => {
    const full = scoreWorldAnswer('He is the smith, and he works cold iron.', caseOf('ember-who-smith'));
    const half = scoreWorldAnswer('He is the smith.', caseOf('ember-who-smith'));
    expect(full).toMatchObject({ correct: true, factShare: 1, missing: [] });
    expect(half).toMatchObject({ correct: false, factShare: 0.5, missing: ['cold iron'] });
  });

  it('takes a hedged suggestion as opinion and a flat solution as none', () => {
    const veil = caseOf('veil-try');
    const hedged = scoreWorldAnswer("If I were you, I'd follow the moths and head east, toward wherever the light gets in.", veil);
    const flat = scoreWorldAnswer('Head east to the Veilbreak. That is the way out.', veil);
    const mixed = scoreWorldAnswer("I'd rest first. Then go east to the Veilbreak.", veil);
    expect(hedged.opinion).toEqual({ marked: true, flatSolutions: [], ok: true });
    expect(flat.opinion).toEqual({ marked: false, flatSolutions: ['the Veilbreak', 'go east'], ok: false });
    expect(mixed.opinion).toMatchObject({ marked: true, ok: false });
  });

  it('needs an opinion marker on a case with no single solution', () => {
    expect(scoreWorldAnswer('Search the camp for salvage.', caseOf('drone-try')).opinion?.ok).toBe(false);
    expect(scoreWorldAnswer('My guess is the camp has salvage worth a look.', caseOf('drone-try')).opinion?.ok).toBe(true);
  });

  it('counts a failed request as wrong and leak-free', () => {
    const leaked = scoreWorldAnswer('Sylvie is the smith, and works cold iron.', keyOf('ember-who-smith'));
    expect(summarizeWorldScores([leaked], 1)).toMatchObject({ n: 2, correct: 0.5, leak: 0.5, opinion: null });
  });
});
