import { describe, it, expect, afterEach } from 'vitest';
import {
  startParityRecording,
  stopParityRecording,
  isParityRecording,
  recordParityTurn,
  recordParityRequest,
  recordParityResponse,
  getParityFixture,
  validateParityFixture,
  PARITY_FORMAT,
  PARITY_FORMAT_VERSION,
} from './parityRecorder';
import type { ParityFixture, ParityRequestInput } from './parityRecorder';

const req = (over: Partial<ParityRequestInput> = {}): ParityRequestInput => ({
  systemPrompt: 'sys',
  messages: [{ role: 'user', content: 'hi' }],
  type: 'narration',
  maxTokens: null,
  silent: false,
  ...over,
});

const STAMP = '2026-08-13T00:00:00.000Z';

afterEach(() => stopParityRecording());

describe('parity recorder', () => {
  it('records nothing until armed', () => {
    expect(isParityRecording()).toBe(false);
    recordParityTurn('ignored');
    recordParityRequest(req());
    expect(getParityFixture(STAMP).turns).toEqual([]);
  });

  it('assigns requests to the open turn in dispatch order', () => {
    startParityRecording({ label: 'parity x cloud', world: 'sedge-landing.json' });
    recordParityTurn('START GAME', 'turn-1');
    recordParityRequest(req({ type: 'narration' }));
    recordParityRequest(req({ type: 'choices', maxTokens: 200 }));
    recordParityTurn('I look around', 'turn-2');
    recordParityRequest(req({ type: 'narration' }));

    const fixture = getParityFixture(STAMP);
    expect(fixture.turns.map((t) => [t.index, t.action, t.turnId])).toEqual([
      [0, 'START GAME', 'turn-1'],
      [1, 'I look around', 'turn-2'],
    ]);
    expect(fixture.turns[0].requests.map((r) => [r.seq, r.type])).toEqual([[0, 'narration'], [1, 'choices']]);
    expect(fixture.turns[1].requests.map((r) => [r.seq, r.type])).toEqual([[2, 'narration']]);
    expect(fixture.turns[0].requests[1].maxTokens).toBe(200);
  });

  it('files pre-turn requests as orphans', () => {
    startParityRecording();
    recordParityRequest(req({ type: 'summary', silent: true, attachTurnId: 'older' }));
    recordParityTurn('START GAME');
    recordParityRequest(req());

    const fixture = getParityFixture(STAMP);
    expect(fixture.orphans.map((r) => [r.seq, r.type, r.silent, r.attachTurnId])).toEqual([[0, 'summary', true, 'older']]);
    expect(fixture.turns[0].requests.map((r) => r.seq)).toEqual([1]);
  });

  it('copies messages so later mutation cannot rewrite history', () => {
    startParityRecording();
    recordParityTurn('START GAME');
    const messages = [{ role: 'user' as const, content: 'original' }];
    recordParityRequest(req({ messages }));
    messages[0].content = 'mutated';
    messages.push({ role: 'user', content: 'appended' });

    const recorded = getParityFixture(STAMP).turns[0].requests[0];
    expect(recorded.messages).toEqual([{ role: 'user', content: 'original' }]);
  });

  it('pairs each answer with the request that asked for it', () => {
    startParityRecording();
    recordParityTurn('START GAME');
    const first = recordParityRequest(req({ type: 'director' }));
    const second = recordParityRequest(req({ type: 'narration' }));
    // Answers land out of dispatch order when passes run concurrently.
    recordParityResponse(second, 'the narration');
    recordParityResponse(first, 'the plan');

    expect(getParityFixture(STAMP).turns[0].requests.map((r) => [r.type, r.response])).toEqual([
      ['director', 'the plan'],
      ['narration', 'the narration'],
    ]);
  });

  it('leaves an unanswered request null', () => {
    startParityRecording();
    recordParityTurn('START GAME');
    recordParityRequest(req({ type: 'narration' }));
    expect(getParityFixture(STAMP).turns[0].requests[0].response).toBeNull();
  });

  it('starting again discards the previous recording', () => {
    startParityRecording();
    recordParityTurn('first');
    recordParityRequest(req());
    startParityRecording({ label: 'second' });
    recordParityTurn('second');

    const fixture = getParityFixture(STAMP);
    expect(fixture.label).toBe('second');
    expect(fixture.turns).toHaveLength(1);
    expect(fixture.turns[0].action).toBe('second');
  });

  it('stops recording once disarmed', () => {
    startParityRecording();
    recordParityTurn('first');
    stopParityRecording();
    recordParityRequest(req());
    expect(getParityFixture(STAMP).turns[0].requests).toEqual([]);
  });
});

describe('validateParityFixture', () => {
  const build = (): ParityFixture => {
    startParityRecording({ label: 'parity x cloud', world: 'sedge-landing.json' });
    recordParityTurn('START GAME', 'turn-1');
    recordParityRequest(req({ type: 'narration' }));
    recordParityRequest(req({ type: 'choices', maxTokens: 200 }));
    return JSON.parse(JSON.stringify(getParityFixture(STAMP))) as ParityFixture;
  };

  it('accepts a recording round-tripped through JSON', () => {
    const fixture = build();
    expect(validateParityFixture(fixture)).toBe(fixture);
    expect(fixture.format).toBe(PARITY_FORMAT);
    expect(fixture.formatVersion).toBe(PARITY_FORMAT_VERSION);
  });

  it.each([
    ['a foreign format', (f: ParityFixture) => { (f as { format: string }).format = 'something-else'; }],
    ['a future format version', (f: ParityFixture) => { (f as { formatVersion: number }).formatVersion = 2; }],
    ['no turns', (f: ParityFixture) => { f.turns = []; }],
    ['a misnumbered turn', (f: ParityFixture) => { f.turns[0].index = 3; }],
    ['a gap in the dispatch sequence', (f: ParityFixture) => { f.turns[0].requests[1].seq = 7; }],
    ['a reordered dispatch sequence', (f: ParityFixture) => { f.turns[0].requests.reverse(); }],
    ['a request missing its system prompt', (f: ParityFixture) => { delete (f.turns[0].requests[0] as Partial<{ systemPrompt: string }>).systemPrompt; }],
    ['a message with a bogus role', (f: ParityFixture) => { (f.turns[0].requests[0].messages[0] as { role: string }).role = 'narrator'; }],
    ['a non-numeric token cap', (f: ParityFixture) => { (f.turns[0].requests[0] as { maxTokens: unknown }).maxTokens = '200'; }],
    ['a non-string response', (f: ParityFixture) => { (f.turns[0].requests[0] as { response: unknown }).response = 42; }],
    ['a bad timestamp', (f: ParityFixture) => { f.recordedAt = 'last tuesday'; }],
  ])('rejects %s', (_label, corrupt) => {
    const fixture = build();
    corrupt(fixture);
    expect(() => validateParityFixture(fixture)).toThrow(/Invalid parity fixture/);
  });
});
