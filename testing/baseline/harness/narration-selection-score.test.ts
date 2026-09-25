import { expect, it } from 'vitest';
import { normalizedFirstResponse, scoreSelectionTrial, summarizeArm, type ScoredTrial } from './narration-selection-score';
import type { ProbeExchange, ProbeTrialEvidence } from './narration-tool-call-probe';

const exchange = (reasoning: number, prompt: number, message: Record<string, unknown> = { content: 'x' }, finish = 'stop'): ProbeExchange => ({
  request: { model: 'm', messages: [], tools: [], tool_choice: 'auto', max_tokens: 1024, stream: false },
  response: { choices: [{ finish_reason: finish, message }], usage: { prompt_tokens: prompt, completion_tokens: reasoning + 10, completion_tokens_details: { reasoning_tokens: reasoning } } },
  durationMs: 1,
});
const match = (name: string) => ({ id: `ent-${name.toLowerCase()}`, name, description: `${name} entry` });
const labels = { arm: 'kept', scenario: 'greeting', seed: 424243, firstResponseMatchesPair: true };
const trial = (overrides: Partial<ProbeTrialEvidence>): ProbeTrialEvidence => ({
  caseId: 'c', action: 'a', sourceRevision: 's', initialRequest: exchange(0, 0).request, status: 'succeeded', narration: 'prose',
  requestCount: 1, lookupCount: 0, requests: [exchange(100, 800)], toolResults: [], usage: null, durationMs: 1, ...overrides,
});

it('scores involved coverage from lookup matches, so an alias lookup counts for its entity', () => {
  const scored = scoreSelectionTrial(trial({
    lookupCount: 3, requestCount: 2,
    requests: [exchange(150, 800, { content: null, tool_calls: [] }, 'tool_calls'), exchange(40, 1100)],
    toolResults: [
      { callId: '1', term: 'ferryman', result: { matches: [match('Bram')] } },
      { callId: '2', term: 'Nessa', result: { matches: [match('Nessa')] } },
      { callId: '3', term: 'the watchman', result: { matches: [] } },
    ],
  }), ['Bram', 'Odette'], labels);
  expect(scored).toMatchObject({ ...labels, completed: true, involvedFetched: 1, involvedTotal: 2, unneeded: 1, unmatched: 1, duplicates: 0,
    rounds: 2, firstRoundReasoning: 150, laterReasoning: 40, finishReason: 'stop' });
});

it('counts a repeated fetch of the same entity as a duplicate, not as extra coverage', () => {
  const scored = scoreSelectionTrial(trial({
    status: 'failed', failure: { kind: 'lookup_budget_exhausted', message: '' }, narration: null, lookupCount: 2,
    requests: [exchange(90, 800, { content: null, tool_calls: [] }, 'tool_calls'), exchange(20, 900, { content: null, tool_calls: [] }, 'tool_calls')],
    toolResults: [
      { callId: '1', term: 'Mara', result: { matches: [match('Mara')] } },
      { callId: '2', term: 'mara', result: { matches: [match('Mara')] } },
    ],
  }), ['Mara'], labels);
  expect(scored).toMatchObject({ completed: false, involvedFetched: 1, involvedTotal: 1, unneeded: 0, duplicates: 1, finishReason: 'tool_calls', failure: 'lookup_budget_exhausted' });
});

it('sums an arm and reports how many paired first responses matched', () => {
  const scored: ScoredTrial[] = [
    { arm: 'kept', scenario: 'a', seed: 1, completed: true, involvedFetched: 2, involvedTotal: 2, unneeded: 0, unmatched: 0, duplicates: 0, rounds: 2, firstRoundReasoning: 100, laterReasoning: 50, promptTokens: [800, 1000], finishReason: 'stop', firstResponseMatchesPair: true },
    { arm: 'kept', scenario: 'b', seed: 1, completed: false, involvedFetched: 0, involvedTotal: 1, unneeded: 1, unmatched: 1, duplicates: 0, rounds: 3, firstRoundReasoning: 200, laterReasoning: 300, promptTokens: [800, 1000, 1200], finishReason: 'length', firstResponseMatchesPair: false, failure: 'incomplete_narration' },
  ];
  expect(summarizeArm(scored)).toEqual({ trials: 2, completed: 1, involvedFetched: 2, involvedTotal: 3, unneeded: 1, unmatched: 1, duplicates: 0,
    firstRoundReasoning: 300, laterReasoning: 350, firstResponseMatchesPair: 1, failures: { incomplete_narration: 1 } });
});

it('normalizes a first response so server-issued call ids do not break the pairing check', () => {
  const call = (id: string) => [{ id, type: 'function', function: { name: 'get_entity', arguments: '{"name":"Iven"}' } }];
  const a = exchange(1, 1, { content: '', reasoning_content: 'plan', tool_calls: call('call_1') }, 'tool_calls');
  const b = exchange(1, 1, { content: '', reasoning_content: 'plan', tool_calls: call('call_9') }, 'tool_calls');
  expect(normalizedFirstResponse(trial({ requests: [a] }))).toEqual(normalizedFirstResponse(trial({ requests: [b] })));
  const c = exchange(1, 1, { content: '', reasoning_content: 'other plan', tool_calls: call('call_9') }, 'tool_calls');
  expect(normalizedFirstResponse(trial({ requests: [c] }))).not.toEqual(normalizedFirstResponse(trial({ requests: [a] })));
});
