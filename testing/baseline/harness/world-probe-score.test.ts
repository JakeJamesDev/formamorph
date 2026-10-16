import { describe, expect, it } from 'vitest';
import { scoreTurn, summarizeArm, type DumpTurn, type DumpRequest } from './world-probe-score';
import { commonFlags } from './world-probe-worlds';

const system = (content: string) => ({ role: 'system' as const, content });
const user = (content: string) => ({ role: 'user' as const, content });

const narration = (response: string, sent = 'You are the narrator.'): DumpRequest =>
  ({ type: 'narration', messages: [system(sent), user('I look around.')], response });
const choices = (response: string): DumpRequest =>
  ({ type: 'choices', messages: [system('Offer options.'), user('The scene.')], response });
const stats = (response: string, statDiagnostics: DumpRequest['statDiagnostics'] = []): DumpRequest =>
  ({ type: 'statUpdates', messages: [system('Track stats.'), user('The scene.')], response, statDiagnostics });

const CLEAN_CHOICES = 'I step toward the gate.\nI ask the guard about the barrow.\nI turn back down the road.';
const turn = (...requests: DumpRequest[]): DumpTurn => ({ action: 'I look around.', requests });

describe('scoreTurn', () => {
  it('scores a clean turn clean', () => {
    const score = scoreTurn(turn(narration('You stand at the gate.'), choices(CLEAN_CHOICES), stats('{"Player Character":[]}')));
    expect(score).toEqual({
      narration: 'ok', tokenLeaks: [], reasoningLeaks: [], placeholders: [],
      choices: 'ok', choiceCount: 3, stat: 'ok', statProblems: [], flags: [],
    });
  });

  it('reads an authored page one as written and a blank reply as empty', () => {
    expect(scoreTurn(turn(choices(CLEAN_CHOICES))).narration).toBe('written');
    expect(scoreTurn(turn(narration('  \n'))).narration).toBe('empty');
  });

  it('finds chat-template tokens in any reply', () => {
    const score = scoreTurn(turn(
      narration('You stand at the gate.<end_of_turn>\n<start_of_turn>user'),
      choices(`${CLEAN_CHOICES}<|im_end|>`),
    ));
    expect(score.tokenLeaks).toEqual(['<end_of_turn>', '<start_of_turn>', '<|im_end|>']);
  });

  it('names each request type whose reply carries reasoning', () => {
    const score = scoreTurn(turn(
      narration('<think>The player looks.</think>You stand at the gate.'),
      choices(CLEAN_CHOICES),
      stats('The user is asking for stat changes. Health moved'),
    ));
    expect(score.reasoningLeaks).toEqual(['narration', 'statUpdates']);
  });

  it('finds unresolved placeholders and chips in what was sent and what came back', () => {
    const score = scoreTurn(turn(
      narration('Hello, {{user}}.', 'The keep belongs to {{ph:9d06:world:d28a}}.\n<PLAYER ACTION>'),
    ));
    expect(score.placeholders).toEqual(['sent:{{ph:9d06:world:d28a}}', 'sent:<PLAYER ACTION>', 'reply:{{user}}']);
  });

  it('leaves markdown, lowercase tags and plain braces alone', () => {
    const score = scoreTurn(turn(narration('You hear **footsteps** <br> and see a {brace}. The sign reads <i>Inn</i>.')));
    expect(score).toMatchObject({ tokenLeaks: [], reasoningLeaks: [], placeholders: [] });
  });

  it('passes choices only at three to five "I" lines with no lead-in', () => {
    const bad = (raw: string) => scoreTurn(turn(narration('x'), choices(raw)));
    expect(bad('I step forward.\nI wait.')).toMatchObject({ choices: 'bad', choiceCount: 2 });
    expect(bad(Array(6).fill('I wait.').join('\n'))).toMatchObject({ choices: 'bad', choiceCount: 6 });
    expect(bad(`Here are my options:\n${CLEAN_CHOICES}`).choices).toBe('bad');
    expect(bad('You step forward.\nI wait.\nI run.').choices).toBe('bad');
    expect(bad(`- ${CLEAN_CHOICES.split('\n').join('\n2. ')}`)).toMatchObject({ choices: 'ok', choiceCount: 3 });
    expect(scoreTurn(turn(narration('x'))).choices).toBe('absent');
  });

  it('fails the stat pass on a reply the app could not apply, and only then', () => {
    const score = (reply: string, diagnostics: DumpRequest['statDiagnostics']) =>
      scoreTurn(turn(narration('x'), stats(reply, diagnostics)));
    expect(score('Health: lots', [{ name: 'Health: lots', reason: 'invalid' }]))
      .toMatchObject({ stat: 'invalid', statProblems: ['invalid: Health: lots'] });
    expect(score('{"Mana":3}', [{ name: 'Mana', reason: 'unknown' }, { name: 'Gold', reason: 'ambiguous' }]))
      .toMatchObject({ stat: 'invalid', statProblems: ['unknown: Mana', 'ambiguous: Gold'] });
    expect(score('', [])).toMatchObject({ stat: 'invalid', statProblems: ['empty reply'] });
    // A refused schema or a disabled stat is the app's routing, not a bad reply.
    expect(score('Health: -2', [{ name: '', reason: 'textPass' }, { name: 'Rage', reason: 'disabled' }]))
      .toMatchObject({ stat: 'ok', statProblems: [] });
    expect(scoreTurn(turn(narration('x'))).stat).toBe('absent');
  });

  it("reads the world's red flags off the narration only", () => {
    const flags = (text: string) => (/blood/.test(text) ? ['TONE-GORE'] : []);
    expect(scoreTurn(turn(narration('There is blood.')), flags).flags).toEqual(['TONE-GORE']);
    expect(scoreTurn(turn(narration('Calm.'), choices('I wipe the blood.\nI wait.\nI run.')), flags).flags).toEqual([]);
  });
});

describe('commonFlags', () => {
  it('flags narration that never addresses the player or that offers a menu', () => {
    expect(commonFlags('You stand at the gate. Your boots are wet.')).toEqual([]);
    expect(commonFlags('The guard stands at the gate.')).toEqual(['NO-2ND-PERSON']);
    expect(commonFlags('You stand at the gate. What do you do?')).toEqual(['OFFERS-CHOICES']);
  });
});

describe('summarizeArm', () => {
  it('counts each failure once per turn and rates only the turns that sent the request', () => {
    const scores = [
      scoreTurn(turn(narration('You stand.<|im_end|><|im_end|>'), choices(CLEAN_CHOICES), stats('{}'))),
      scoreTurn(turn(narration(''), choices('I wait.'), stats('', []))),
      scoreTurn(turn(narration('You wait.'))),
    ];
    expect(summarizeArm(scores)).toEqual({
      turns: 3, emptyNarration: 1, tokenLeakTurns: 1, reasoningLeakTurns: 0, placeholderTurns: 0,
      choicesOk: 1, choicesSent: 2, statOk: 1, statSent: 2, flaggedTurns: 0,
    });
  });
});
