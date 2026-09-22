import { expect, it } from 'vitest';
import { CONTINUATION_EXAMPLE, EXPANDED_CONTINUATION_EXAMPLE, SELECTION_EXAMPLE } from './narration-continuation-example';
import { createSelectionWorld, SELECTION_DESCRIPTIONS, INCLUSION_DESCRIPTION, RETRIEVAL_FIRST_DESCRIPTION, APPEARANCE_DESCRIPTION } from './narration-selection-fixture';
import { prepareNarrationToolCallCase, runNarrationToolCallTrial, type ProbeRequest } from './narration-tool-call-probe';

const input = () => ({ caseId: 'selection', action: 'I ask for help with my boot.', sourceRevision: 'test', world: createSelectionWorld(),
  promptMode: 'experimental' as const, experiment: { roleOnly: true, outputMode: 'text' as const, summaryLabel: true,
    entityDefinition: true, sectionDefinitions: true, entityHeader: true, requestInfoName: 'get_entity' as const, requestInfoParameter: 'name' as const } });

it('renders all seven candidates as summaries and preserves the ferry in contextual information', () => {
  const options = input();
  const system = prepareNarrationToolCallCase(options).request.messages[0].content!;
  for (const name of ['Bram', 'Odette', 'Rope Ferry', 'Mara', 'Iven', 'Nessa', 'Corin']) expect(system).toContain(`**${name}**`);
  expect(system).toContain('a rope ferry is moored at the dock');
  expect(system).toContain('The Ashen River is a slow northern waterway crossed only by rope ferry.');
  expect(options.world.worldOverview.systemPrompt).not.toContain('Ashen River');
  for (const entity of options.world.entities) expect(system).not.toContain(entity.aiDescription);
  const pair = [...Object.values(SELECTION_DESCRIPTIONS), INCLUSION_DESCRIPTION, RETRIEVAL_FIRST_DESCRIPTION, APPEARANCE_DESCRIPTION].map((description) => prepareNarrationToolCallCase({ ...options,
    experiment: { ...options.experiment, requestInfoDescription: description } }).request);
  for (const request of pair.slice(1)) {
    request.tools[0].function.description = pair[0].tools[0].function.description;
    expect(request).toEqual(pair[0]);
  }
});

it('retrieves the added character through the real loop and supplies authored facts for narration', async () => {
  const requests: ProbeRequest[] = [];
  const trial = await runNarrationToolCallTrial({ ...input(), transport: { async send(request) {
    requests.push(structuredClone(request));
    return requests.length === 1
      ? { choices: [{ message: { content: null, tool_calls: [{ id: 'cobbler', type: 'function', function: { name: 'get_entity', arguments: '{"name":"Iven"}' } }] } }] }
      : { choices: [{ finish_reason: 'stop', message: { content: 'You watch the cobbler thread his curved awl.' } }] };
  } } });
  expect(trial.status).toBe('succeeded');
  expect(trial.toolResults[0].result.matches[0].name).toBe('Iven');
  expect(requests[1].messages.at(-1)?.content).toContain('he has no glue');
});

it.each([false, true])('preserves results and evidence while omitting prior reasoning only when enabled: %s', async (omitPriorReasoning) => {
  const options = input();
  const requests: ProbeRequest[] = [];
  const first = { choices: [{ message: { content: '', reasoning_content: 'Select the cobbler.', reasoning: 'Find the repairer.',
    tool_calls: [{ id: 'cobbler', type: 'function', function: { name: 'get_entity', arguments: '{"name":"Iven"}' } }] } }] };
  const trial = await runNarrationToolCallTrial({ ...options, experiment: { ...options.experiment, omitPriorReasoning }, transport: { async send(request) {
    requests.push(structuredClone(request));
    return requests.length === 1 ? first : { choices: [{ finish_reason: 'stop', message: { content: 'You show the cobbler your boot.' } }] };
  } } });
  expect(trial.status).toBe('succeeded');
  const history = requests[1].messages.find(message => message.role === 'assistant');
  expect(history).toEqual({ role: 'assistant', content: '', tool_calls: first.choices[0].message.tool_calls,
    ...(omitPriorReasoning ? {} : { reasoning_content: 'Select the cobbler.', reasoning: 'Find the repairer.' }) });
  if (omitPriorReasoning) {
    expect(history).not.toHaveProperty('reasoning_content');
    expect(history).not.toHaveProperty('reasoning');
  }
  expect(requests[1].messages.at(-1)?.content).toContain('he has no glue');
  expect(trial.requests[0].response).toEqual(first);
  expect(trial.requests[1].request).toEqual(requests[1]);
});

it.each([{ label: 'concise', demonstration: CONTINUATION_EXAMPLE }, { label: 'expanded', demonstration: EXPANDED_CONTINUATION_EXAMPLE }])('adds one $label demonstration only to continuations and preserves real tool-result correlations', async ({ demonstration }) => {
  const options = input();
  const requests: ProbeRequest[] = [];
  const trial = await runNarrationToolCallTrial({ ...options, nineCharacterCallIds: true,
    experiment: { ...options.experiment, omitPriorReasoning: true, continuationExample: demonstration },
    transport: { async send(request) {
      requests.push(structuredClone(request));
      const name = requests.length === 1 ? 'Iven' : 'Bram';
      return requests.length < 3
        ? { choices: [{ message: { content: '', reasoning_content: 'Real turn planning.', tool_calls: [{ id: name, type: 'function', function: { name: 'get_entity', arguments: JSON.stringify({ name }) } }] } }] }
        : { choices: [{ finish_reason: 'stop', message: { content: 'You show the cobbler your boot as the ferryman watches.' } }] };
    } } });
  expect(trial.status).toBe('succeeded');
  expect(JSON.stringify(requests[0])).not.toContain('Ysra');
  expect(trial.toolResults.map(result => result.term)).toEqual(['Iven', 'Bram']);
  for (const request of requests.slice(1)) {
    expect(request.messages.filter(message => message.content?.startsWith('Demonstration from'))).toHaveLength(1);
    expect(request.messages.filter(message => message.reasoning_content).map(message => message.reasoning_content))
      .toEqual([demonstration[1].reasoning_content, demonstration[3].reasoning_content]);
    const calls = request.messages.flatMap(message => message.tool_calls ?? []);
    expect(new Set(calls.map(call => call.id)).size).toBe(calls.length);
    for (const message of request.messages.filter(message => message.role === 'tool')) {
      const call = calls.find(call => call.id === message.tool_call_id);
      expect(call).toBeDefined();
      expect(JSON.parse(message.content!).matches[0].name).toBe(JSON.parse(call!.function.arguments).name);
    }
  }
  expect(JSON.stringify(trial.requests[0].response)).toContain('Real turn planning.');
});

it('keeps the example request, tool facts, calls, and narration identical across reasoning styles', () => {
  const withoutReasoning = (messages: typeof CONTINUATION_EXAMPLE) => messages.map(message => {
    const copy = structuredClone(message);
    delete copy.reasoning_content;
    return copy;
  });
  expect(withoutReasoning(EXPANDED_CONTINUATION_EXAMPLE)).toEqual(withoutReasoning(CONTINUATION_EXAMPLE));
  expect(EXPANDED_CONTINUATION_EXAMPLE[1].reasoning_content).not.toBe(CONTINUATION_EXAMPLE[1].reasoning_content);
  expect(EXPANDED_CONTINUATION_EXAMPLE[3].reasoning_content).not.toBe(CONTINUATION_EXAMPLE[3].reasoning_content);
});

it('retains narration across turns while retrieving afresh and showing one selection example on every request', async () => {
  const options = input();
  const storyHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let turn = 0; turn < 2; turn++) {
    let calls = 0;
    const trial = await runNarrationToolCallTrial({ ...options, nineCharacterCallIds: true,
      experiment: { ...options.experiment, omitPriorReasoning: true, exampleFromStart: true, continuationExample: SELECTION_EXAMPLE, storyHistory },
      transport: { async send(request) {
        calls++;
        expect(request.messages.filter(m => m.content?.startsWith('Demonstration from'))).toHaveLength(1);
        expect(request.messages.filter(m => m.role === 'tool')).toHaveLength(calls === 1 ? 2 : 3);
        expect(request.messages.some(m => m.content === 'You show the cobbler your boot.')).toBe(turn === 1);
        expect(JSON.stringify(request)).not.toContain('Real turn planning.');
        const tools = request.messages.flatMap(m => m.tool_calls ?? []);
        for (const result of request.messages.filter(m => m.role === 'tool')) {
          const call = tools.find(t => t.id === result.tool_call_id)!;
          expect(JSON.parse(result.content!).matches[0].name).toBe(JSON.parse(call.function.arguments).name);
        }
        return calls === 1
          ? { choices: [{ message: { content: '', reasoning_content: 'Real turn planning.', tool_calls: [{ id: 'cobbler', type: 'function', function: { name: 'get_entity', arguments: '{"name":"Iven"}' } }] } }] }
          : { choices: [{ finish_reason: 'stop', message: { content: 'You show the cobbler your boot.' } }] };
      } } });
    expect(trial.status).toBe('succeeded');
    expect(trial.initialRequest).toEqual(trial.requests[0].request);
    expect(trial.toolResults.map(r => r.term)).toEqual(['Iven']);
    storyHistory.push({ role: 'user', content: options.action }, { role: 'assistant', content: trial.narration! });
  }
});
