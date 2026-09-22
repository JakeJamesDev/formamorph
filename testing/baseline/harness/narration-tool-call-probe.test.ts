import { afterEach, describe, expect, it, vi } from 'vitest';
import rawWorld from '../sedge-landing.json';
import { migrateWorld } from '@/lib/version';
import {
  MAIN_ACTION,
  CONTROL_ACTION,
  MINIMAL_TOOL_ACTION,
  EndpointRejectionError,
  PROBE_TOOLS,
  createProbeTransport,
  lookupEntityInfo,
  prepareNarrationToolCallReview,
  prepareNarrationToolCallCase,
  runNarrationToolCallBatch,
  runNarrationToolCallTrial,
  type ProbeRequest,
  type ProbeTransport,
} from './narration-tool-call-probe';

const world = () => migrateWorld(structuredClone(rawWorld));

describe('description experiment controls', () => {
  it('defines populated sections while preserving data and omitting empty sections', () => {
    const input = { caseId: 'section-definitions', action: MAIN_ACTION, sourceRevision: 'test', world: world(),
      promptMode: 'experimental' as const, experiment: { roleOnly: true, summaryLabel: true, entityDefinition: true, thinking: true, outputMode: 'text' as const, knownEntityNames: ['Bram'] } };
    const baseline = prepareNarrationToolCallCase(input).request;
    const variant = prepareNarrationToolCallCase({ ...input, experiment: { ...input.experiment, sectionDefinitions: true } }).request;
    const additions = [
      'The setting, tone, and world-wide facts of this story.',
      "Descriptions of the player character's current stat values.",
      "The player character's active characteristics and conditions.",
      'The place where the player character currently is.',
      'Additional authored information about the world, its concepts, and its terminology.',
    ];
    let system = variant.messages[0].content!;
    for (const text of additions) {
      expect(system).toContain(`${text}\n\n`);
      system = system.replace(`${text}\n\n`, '');
    }
    expect(system).toContain('These summaries identify entities that may appear in the current location.\n');
    expect(system).not.toContain('## Sublocations');
    expect(system).not.toContain('Places contained within the current location.');
    variant.messages[0].content = system.replace('These summaries identify entities that may appear in the current location.\n', '');
    expect(variant).toEqual(baseline);
  });

  it('adds only the entity definition beside the summary list', () => {
    const input = { caseId: 'entity-definition', action: MAIN_ACTION, sourceRevision: 'test', world: world(),
      promptMode: 'experimental' as const, experiment: { roleOnly: true, summaryLabel: true, thinking: true, outputMode: 'text' as const, knownEntityNames: ['Bram'] } };
    const baseline = prepareNarrationToolCallCase(input).request;
    const variant = prepareNarrationToolCallCase({ ...input, experiment: { ...input.experiment, entityDefinition: true } }).request;
    const definition = 'An entity is a character, creature, or object listed in the entity summaries.';
    expect(variant.messages[0].content).toContain(`## Characters and Things That May Appear in This Location\n${definition}\n\n- **Bram**`);
    variant.messages[0].content = variant.messages[0].content!.replace(`${definition}\n\n`, '');
    expect(variant).toEqual(baseline);
  });

  it('relabels entity summaries without changing the location, cached lore, or request controls', () => {
    const input = { caseId: 'summary-label', action: MAIN_ACTION, sourceRevision: 'test', world: world(),
      promptMode: 'experimental' as const, experiment: { roleOnly: true, thinking: true, outputMode: 'text' as const, knownEntityNames: ['Bram'] } };
    const baseline = prepareNarrationToolCallCase(input).request;
    const variant = prepareNarrationToolCallCase({ ...input, experiment: { ...input.experiment, summaryLabel: true } }).request;
    const system = variant.messages[0].content!;
    expect(system).toContain('- **Bram**\n  - **summary:**');
    expect(system).toContain('- **Odette**\n  - **summary:**');
    expect(system).toContain('- **Rope Ferry**\n  - **summary:**');
    expect(system.match(/\*\*summary:\*\*/g)).toHaveLength(3);
    variant.messages[0].content = system.replaceAll('  - **summary:**', '  - **description:**');
    expect(variant).toEqual(baseline);
  });

  it('keeps only role and perspective plus unchanged context chips', () => {
    const input = { caseId: 'role-only', action: MAIN_ACTION, sourceRevision: 'test', world: world(),
      promptMode: 'experimental' as const, experiment: { preparationGoal: true, requiredLore: true, decisionNotes: true, thinking: true, outputMode: 'text' as const, knownEntityNames: ['Bram'] } };
    const baseline = prepareNarrationToolCallCase(input).request;
    const variant = prepareNarrationToolCallCase({ ...input, experiment: { ...input.experiment, roleOnly: true } }).request;
    const context = baseline.messages[0].content!.match(/## Game World\n[\s\S]*?(?=## Preparation\n)/)![0].trim();
    expect(variant.messages[0].content?.trim()).toBe(`You are the narrator of an interactive story. Narrate what happens in response to the player's action in second person, present tense.\n\n${context}`);
    variant.messages[0] = baseline.messages[0];
    expect(variant).toEqual(baseline);
  });

  it('changes only preparation for decision notes while preserving required lore', () => {
    const input = { caseId: 'decision-notes', action: MAIN_ACTION, sourceRevision: 'test', world: world(),
      promptMode: 'experimental' as const, experiment: { preparationGoal: true, requiredLore: true, thinking: true, outputMode: 'text' as const, knownEntityNames: ['Bram'] } };
    const baseline = prepareNarrationToolCallCase(input).request;
    const variant = prepareNarrationToolCallCase({ ...input, experiment: { ...input.experiment, decisionNotes: true } }).request;
    expect(variant.messages[0].content).toContain('Keep preparation in brief decision notes: participants, relevant facts, and what changes.');
    expect(variant.messages[0].content).toContain('Move directly to the final narration, composing');
    expect(variant.messages[0].content).toContain('Before portraying any listed person or object, call request_info for its full entry unless that full entry is already in context.');
    const section = /## Preparation\n[\s\S]*?(?=## Output\n)/;
    variant.messages[0].content = variant.messages[0].content!.replace(section, baseline.messages[0].content!.match(section)![0]);
    expect(variant).toEqual(baseline);
  });

  it('changes only the retrieval prerequisite against the preparation-goal baseline', () => {
    const input = { caseId: 'prerequisite', action: MAIN_ACTION, sourceRevision: 'test', world: world(),
      promptMode: 'experimental' as const, experiment: { preparationGoal: true, thinking: true, outputMode: 'text' as const, knownEntityNames: ['Bram'] } };
    const baseline = prepareNarrationToolCallCase(input).request;
    const variant = prepareNarrationToolCallCase({ ...input, experiment: { ...input.experiment, requiredLore: true } }).request;
    const rule = 'Before portraying any listed person or object, call request_info for its full entry unless that full entry is already in context.';
    expect(variant.messages[0].content).toContain(rule);
    expect(variant.messages[0].content).not.toContain('When a needed entry is missing');
    variant.messages[0].content = variant.messages[0].content!.replace(rule, 'When a needed entry is missing, request it before composing the scene.');
    expect(variant).toEqual(baseline);
  });

  it('changes only preparation for the reasoning-goal experiment', () => {
    const input = { caseId: 'preparation', action: MAIN_ACTION, sourceRevision: 'test', world: world(),
      promptMode: 'experimental' as const, experiment: { thinking: true, outputMode: 'text' as const, knownEntityNames: ['Bram'] } };
    const baseline = prepareNarrationToolCallCase(input).request;
    const variant = prepareNarrationToolCallCase({ ...input, experiment: { ...input.experiment, preparationGoal: true } }).request;
    const system = variant.messages[0].content!;
    expect(system).toContain('Use preparation to establish what happens next and which authored facts it requires.');
    expect(system).toContain('Once the needed entries are available and continuity is resolved, proceed to the narration.');
    expect(system).not.toContain('Use reasoning to select');
    expect(system).not.toContain('burn scar across her right cheek');
    const section = /## Preparation\n[\s\S]*?(?=## Output\n)/;
    expect(system.replace(section, '')).toBe(baseline.messages[0].content!.replace(section, ''));
    variant.messages[0] = baseline.messages[0];
    expect(variant).toEqual(baseline);
  });

  it('removes only write and completes lookup followed by ordinary narration', async () => {
    const input = { caseId: 'plain', action: MAIN_ACTION, sourceRevision: 'test', world: world(),
      promptMode: 'experimental' as const, experiment: { thinking: true } };
    const baseline = prepareNarrationToolCallCase(input).request;
    const transport = scriptedTransport([
      { choices: [{ message: { content: null, tool_calls: [toolCall('lookup', 'request_info', { term: 'Bram' })] } }] },
      { choices: [{ finish_reason: 'stop', message: { content: 'You notice his pinned left sleeve.' } }] },
    ]);
    const trial = await runNarrationToolCallTrial({ ...input, experiment: { ...input.experiment, outputMode: 'text' }, transport });
    expect(trial.status).toBe('succeeded');
    expect(trial.narration).toBe('You notice his pinned left sleeve.');
    expect(trial.lookupCount).toBe(1);
    expect(transport.requests[0]).toEqual({ ...baseline, tools: baseline.tools.filter((tool) => tool.function.name === 'request_info') });
    expect(transport.requests[1].messages.at(-1)?.content).toContain('left sleeve is pinned up');
  });

  it.each([
    ['length', 'You notice his', 'incomplete_narration'],
    ['stop', '  ', 'missing_narration'],
    [undefined, 'You notice his sleeve.', 'incomplete_narration'],
  ])('rejects incomplete or empty ordinary narration (%s)', async (finish_reason, content, failure) => {
    const trial = await runNarrationToolCallTrial({ caseId: 'plain-failure', action: MAIN_ACTION,
      sourceRevision: 'test', world: world(), promptMode: 'experimental', experiment: { outputMode: 'text' },
      transport: scriptedTransport([{ choices: [{ finish_reason, message: { content } }] }]) });
    expect(trial.status).toBe('failed');
    expect(trial.failure?.kind).toBe(failure);
  });

  it('rejects an unadvertised write call in ordinary narration mode', async () => {
    const trial = await runNarrationToolCallTrial({ caseId: 'plain-write', action: MAIN_ACTION,
      sourceRevision: 'test', world: world(), promptMode: 'experimental', experiment: { outputMode: 'text' },
      transport: scriptedTransport([{ choices: [{ message: { content: null,
        tool_calls: [toolCall('write', 'write', { narration: 'You look around.' })] } }] }]) });
    expect(trial.failure?.kind).toBe('unknown_function');
  });

  it('runs Experimental with withheld lore and preserves all non-prompt controls', async () => {
    const input = { caseId: 'experimental', action: MAIN_ACTION, sourceRevision: 'test', world: world(), seed: 424243,
      experiment: { thinking: true, knownEntityNames: ['Bram'] }, nineCharacterCallIds: true };
    const baseline = prepareNarrationToolCallCase(input).request;
    const transport = scriptedTransport([
      { choices: [{ message: { content: null, tool_calls: [toolCall('lookup', 'request_info', { term: 'Odette' })] } }] },
      { choices: [{ message: { content: null, tool_calls: [toolCall('finish', 'write', { narration: 'You greet them.' })] } }] },
    ]);
    const trial = await runNarrationToolCallTrial({ ...input, promptMode: 'experimental', transport });
    expect(trial.status).toBe('succeeded');
    const request = transport.requests[0];
    expect(request.messages[0].content).toContain('An observational turn can remain silent.');
    expect(request.messages[0].content).toContain('compose the narration directly in the final output');
    expect(request.messages[0].content).not.toContain('burn scar across her right cheek');
    expect(request.messages[1].content).toBe(MAIN_ACTION);
    expect(request.messages.at(-1)?.content).toContain('left sleeve is pinned up');
    expect(transport.requests[1].messages.at(-1)?.content).toContain('burn scar across her right cheek');
    expect({ ...request, messages: [] }).toEqual({ ...baseline, messages: [] });
    expect(trial.lookupCount).toBe(1);
  });

  it('changes only the lookup description between paired requests', () => {
    const input = { caseId: 'pair', action: MAIN_ACTION, sourceRevision: 'test', world: world(), seed: 7 };
    const baseline = prepareNarrationToolCallCase({ ...input, experiment: { thinking: true } }).request;
    const variant = prepareNarrationToolCallCase({ ...input, experiment: { thinking: true, requestInfoDescription: 'Candidate description' } }).request;
    expect(variant.tools[0].function.description).toBe('Candidate description');
    expect(variant).not.toHaveProperty('reasoning_effort');
    variant.tools[0].function.description = baseline.tools[0].function.description;
    expect(variant).toEqual(baseline);
    expect(PROBE_TOOLS[0].function.description).toBe('Retrieve full descriptions of world entities by name or keyword.');
  });

  it('retains cached lore through a new lookup and final write with matching history IDs', async () => {
    const transport = scriptedTransport([
      { choices: [{ message: { content: null, tool_calls: [toolCall('server-odette', 'request_info', { term: 'Odette' })] } }] },
      { choices: [{ message: { content: null, tool_calls: [toolCall('server-write', 'write', { narration: 'The ferryman gestures while the woman counts twice.' })] } }] },
    ]);
    const result = await runNarrationToolCallTrial({
      caseId: 'cache', action: MAIN_ACTION, sourceRevision: 'test', world: world(), transport,
      nineCharacterCallIds: true, experiment: { thinking: true, knownEntityNames: ['Bram'] },
    });
    expect(result.status).toBe('succeeded');
    expect(result.lookupCount).toBe(1);
    for (const request of transport.requests) {
      const calls = request.messages.flatMap((message) => message.tool_calls ?? []);
      const results = request.messages.filter((message) => message.role === 'tool');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('left sleeve is pinned up');
      for (const message of results) {
        expect(calls.some((call) => call.id === message.tool_call_id)).toBe(true);
        expect(message.tool_call_id).toHaveLength(9);
      }
    }
    expect(transport.requests[1].messages.filter((message) => message.role === 'tool')).toHaveLength(2);
    expect(transport.requests[1].messages.at(-1)?.content).toContain('burn scar across her right cheek');
  });

  it('rejects missing cached lore instead of pretending it is available', () => {
    expect(() => prepareNarrationToolCallCase({
      caseId: 'missing', action: MAIN_ACTION, sourceRevision: 'test', world: world(),
      experiment: { knownEntityNames: ['No such entity'] },
    })).toThrow('Cached lore requires one complete match');
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function toolCall(id: string, name: string, args: unknown) {
  return { id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } };
}

function scriptedTransport(responses: unknown[]): ProbeTransport & { requests: ProbeRequest[] } {
  const requests: ProbeRequest[] = [];
  return {
    requests,
    async send(request) {
      requests.push(structuredClone(request));
      if (responses.length === 0) throw new Error('Script exhausted.');
      return responses.shift();
    },
  };
}

describe('narration tool-call probe preparation', () => {
  it('renders the main case through production helpers without leaking full entity facts', () => {
    const prepared = prepareNarrationToolCallCase({
      caseId: 'main',
      action: MAIN_ACTION,
      sourceRevision: 'test-revision',
      world: world(),
    });

    expect(prepared.request).toMatchObject({
      model: 'default',
      max_tokens: 1024,
      reasoning_effort: 'none',
      stream: false,
      tool_choice: 'auto',
      tools: PROBE_TOOLS,
    });
    expect(prepared.request).not.toHaveProperty('temperature');
    expect(prepared.request).not.toHaveProperty('repetition_penalty');
    expect(prepared.request.messages).toHaveLength(2);
    expect(prepared.request.messages[0]).toMatchObject({ role: 'system' });
    expect(prepared.request.messages[1]).toEqual({
      role: 'user',
      content: `${MAIN_ACTION}\n\nThe player's action is the turn's first beat, written as it happens - an action that speaks reaches the page as the player's own quoted sentences, carrying the feeling the action names, and then the character answers in their own quoted voice with something of their own.`,
    });

    const system = prepared.request.messages[0].content;
    expect(system).toContain('## Entity information');
    expect(system).toContain('Submit the finished story through write');
    expect(system).toContain("- **Bram**\n  - **description:** The one-armed ferryman who won't cross after dark.");
    expect(system).toContain('- **Odette**\n  - **description:** The scarred eel-smoker waiting to cross; distrusts strangers.');
    expect(system).not.toContain('his left sleeve is pinned up');
    expect(system).not.toContain('green glass bead braided into her hair');
    expect(system).not.toMatch(/<[A-Z][A-Z _-]*(?:\|[^>\n]+)?>/);
  });

  it.each([
    ['summary fallback', (migrated: ReturnType<typeof world>) => { migrated.entities.find((entity) => entity.id === 'ent-bram')!.aiSummary = ''; }, 'Full description leaked'],
    ['unresolved token', (migrated: ReturnType<typeof world>) => { migrated.worldOverview.systemPrompt += ' <BROKEN TOKEN>'; }, 'Unresolved prompt token'],
    ['withheld fact', (migrated: ReturnType<typeof world>) => { migrated.worldOverview.systemPrompt += ' His left sleeve is pinned up.'; }, 'Withheld fact leaked'],
  ])('rejects %s before a transport can run', async (_label, mutate, message) => {
    const migrated = world();
    mutate(migrated);
    let calls = 0;
    const transport: ProbeTransport = { async send() { calls++; return {}; } };

    await expect(runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: migrated, transport,
    })).rejects.toThrow(message);
    expect(calls).toBe(0);
  });

  it('prepares the exact main and control requests without a transport', () => {
    const review = prepareNarrationToolCallReview(world(), 'test-revision');
    expect(review).toMatchObject({
      kind: 'narration-tool-call-preparation',
      sourceRevision: 'test-revision',
      cloudBehaviorUntested: true,
    });
    expect(review.cases.map((probeCase) => probeCase.caseId)).toEqual(['main', 'control']);
    expect(review.cases[0].request.messages[1].content).toContain(MAIN_ACTION);
    expect(review.cases[1].request.messages[1].content).toContain(CONTROL_ACTION);
  });
});

describe('narration tool-call probe lookup', () => {
  it('returns verbatim descriptions for exact names and approved aliases', () => {
    const migrated = world();
    const bram = migrated.entities.find((entity) => entity.id === 'ent-bram')!;

    expect(lookupEntityInfo(migrated.entities, '  FERRYMAN  ')).toEqual({
      matches: [{ id: bram.id, name: bram.name, description: bram.aiDescription }],
    });
    expect(lookupEntityInfo(migrated.entities, 'Bram')).toEqual({
      matches: [{ id: bram.id, name: bram.name, description: bram.aiDescription }],
    });
  });

  it('returns empty unknown results and every ambiguous exact-name match', () => {
    const entities = world().entities;
    const duplicate = { ...entities[0], id: 'ent-bram-double' };

    expect(lookupEntityInfo(entities, 'nobody here')).toEqual({ matches: [] });
    expect(lookupEntityInfo([...entities, duplicate], 'bram').matches.map((match) => match.id))
      .toEqual(['ent-bram', 'ent-bram-double']);
  });
});

describe('narration tool-call probe trial', () => {
  it('remaps local call IDs across batched and sequential lookups without changing raw evidence', async () => {
    const rawIds = ['sameprefix-first-long-id', 'sameprefix-second-long-id', '000000001'];
    const responses = [
      { choices: [{ message: { role: 'assistant', content: '', tool_calls: rawIds.slice(0, 2).map((id, index) => toolCall(id, 'request_info', { term: index ? 'Odette' : 'Bram' })) } }] },
      { choices: [{ message: { role: 'assistant', content: '', tool_calls: [toolCall(rawIds[2], 'request_info', { term: 'Bram' })] } }] },
      { choices: [{ message: { role: 'assistant', content: '', tool_calls: [toolCall('done', 'write', { narration: 'Bram wears a brass ring.' })] } }] },
    ];
    const originals = structuredClone(responses);
    const transport = scriptedTransport(responses);
    const evidence = await runNarrationToolCallTrial({
      caseId: 'local-ids', action: MINIMAL_TOOL_ACTION, sourceRevision: 'test', world: world(),
      transport, promptMode: 'minimal', nineCharacterCallIds: true,
    });
    expect(evidence.status).toBe('succeeded');
    for (const [index, request] of transport.requests.entries()) {
      const calls = request.messages.flatMap((message) => message.tool_calls ?? []);
      const results = request.messages.filter((message) => message.role === 'tool');
      expect(calls).toHaveLength(index === 0 ? 0 : index + 1);
      expect(new Set(calls.map((call) => call.id)).size).toBe(calls.length);
      calls.forEach((call, callIndex) => {
        expect(call.id).toMatch(/^[a-zA-Z0-9]{9}$/);
        expect(results[callIndex].tool_call_id).toBe(call.id);
      });
    }
    expect(transport.requests[2].messages.slice(0, 5)).toEqual(transport.requests[1].messages);
    expect(evidence.requests.map((exchange) => exchange.response)).toEqual(originals);
    expect(evidence.toolResults.map((result) => result.callId)).toEqual(rawIds);
  });
  it('runs the minimal lookup and write conversation without story context', async () => {
    const transport = scriptedTransport([
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [toolCall('lookup', 'request_info', { term: 'Bram' })] } }] },
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [toolCall('finish', 'write', { narration: 'Bram wears a brass ring through his left ear.' })] } }] },
    ]);
    const evidence = await runNarrationToolCallTrial({
      caseId: 'minimal', action: MINIMAL_TOOL_ACTION, sourceRevision: 'test', world: world(), transport,
      model: 'local-model', seed: 424242, promptMode: 'minimal',
    });
    expect(evidence.status).toBe('succeeded');
    expect(evidence.lookupCount).toBe(1);
    expect(evidence.narration).toBe('Bram wears a brass ring through his left ear.');
    expect(transport.requests).toHaveLength(2);
    const initial = transport.requests[0];
    expect(initial).toMatchObject({ model: 'local-model', seed: 424242, tools: PROBE_TOOLS, tool_choice: 'auto' });
    expect(initial.messages[0].content).toContain('First call request_info');
    expect(initial.messages[0].content).not.toContain('Game World');
    expect(initial.messages[1].content).toBe(MINIMAL_TOOL_ACTION);
    expect(JSON.stringify(initial.messages)).not.toContain('brass ring');
    expect(transport.requests[1].messages.at(-1)).toMatchObject({
      role: 'tool', tool_call_id: 'lookup',
      content: JSON.stringify(lookupEntityInfo(world().entities, 'Bram')),
    });
  });
  it('supports sequential lookups and finishes on a terminal write', async () => {
    const first = toolCall('call-bram', 'request_info', { term: 'Bram' });
    const second = toolCall('call-odette', 'request_info', { term: 'Odette' });
    const terminal = toolCall('call-write', 'write', { narration: 'You greet them beside the pale water.' });
    const transport = scriptedTransport([
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [first] } }], usage: { prompt_tokens: 100 } },
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [second] } }], usage: { prompt_tokens: 140 } },
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [terminal] } }], usage: { completion_tokens: 20 } },
    ]);

    const result = await runNarrationToolCallTrial({
      caseId: 'main',
      action: MAIN_ACTION,
      sourceRevision: 'test-revision',
      world: world(),
      transport,
    });

    expect(result.status).toBe('succeeded');
    expect(result.narration).toBe('You greet them beside the pale water.');
    expect(result.requestCount).toBe(3);
    expect(result.lookupCount).toBe(2);
    expect(result.requests).toHaveLength(3);
    expect(result.requests.every((exchange) => exchange.durationMs >= 0)).toBe(true);
    expect(result.usage).toEqual({ prompt_tokens: 240, completion_tokens: 20 });

    expect(transport.requests[1].messages.slice(-2)).toEqual([
      { role: 'assistant', content: null, tool_calls: [first] },
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-bram' }),
    ]);
    expect(JSON.parse(transport.requests[1].messages.at(-1)!.content!)).toMatchObject({
      matches: [{ id: 'ent-bram', name: 'Bram' }],
    });
    expect(transport.requests[2].messages.slice(-2)).toEqual([
      { role: 'assistant', content: null, tool_calls: [second] },
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-odette' }),
    ]);
  });

  it('supports batched and unknown lookups before the terminal write', async () => {
    const batched = [
      toolCall('call-bram', 'request_info', { term: 'Bram' }),
      toolCall('call-unknown', 'request_info', { term: 'nobody here' }),
    ];
    const terminal = toolCall('call-write', 'write', { narration: 'The ferryman watches you from the raft.' });
    const transport = scriptedTransport([
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: batched } }] },
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [terminal] } }] },
    ]);

    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });

    expect(result.status).toBe('succeeded');
    expect(result.lookupCount).toBe(2);
    expect(result.toolResults[1].result).toEqual({ matches: [] });
    expect(transport.requests[1].messages.slice(-3)).toEqual([
      { role: 'assistant', content: null, tool_calls: batched },
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-bram' }),
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-unknown' }),
    ]);
  });

  it('accepts a direct control write with no lookup', async () => {
    const transport = scriptedTransport([
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('call-write', 'write', { narration: 'Pale water presses soundlessly against the pilings.' }),
      ] } }] },
    ]);
    const result = await runNarrationToolCallTrial({
      caseId: 'control', action: CONTROL_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });
    expect(result).toMatchObject({ status: 'succeeded', requestCount: 1, lookupCount: 0 });
  });

  it.each([
    ['malformed arguments', [toolCall('bad-json', 'request_info', { term: 'Bram' })], 'invalid_arguments'],
    ['unexpected arguments', [toolCall('extra-field', 'request_info', { term: 'Bram', limit: 1 })], 'invalid_arguments'],
    ['wrong argument type', [toolCall('wrong-type', 'request_info', { term: 12 })], 'invalid_arguments'],
    ['unknown function', [toolCall('unknown', 'search_everywhere', { term: 'Bram' })], 'unknown_function'],
    ['duplicate identifiers', [
      toolCall('same-id', 'request_info', { term: 'Bram' }),
      toolCall('same-id', 'request_info', { term: 'Odette' }),
    ], 'duplicate_call_id'],
    ['multiple writes', [
      toolCall('write-a', 'write', { narration: 'One.' }),
      toolCall('write-b', 'write', { narration: 'Two.' }),
    ], 'multiple_writes'],
    ['mixed lookup and write', [
      toolCall('lookup', 'request_info', { term: 'Bram' }),
      toolCall('write', 'write', { narration: 'Too soon.' }),
    ], 'mixed_calls'],
    ['empty narration', [toolCall('write', 'write', { narration: '   ' })], 'invalid_arguments'],
  ])('records %s and makes no follow-up request', async (label, calls, failureKind) => {
    if (label === 'malformed arguments') calls[0].function.arguments = '{not json';
    const raw = { choices: [{ message: { role: 'assistant', content: null, tool_calls: calls } }] };
    const transport = scriptedTransport([raw]);

    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });

    expect(result).toMatchObject({ status: 'failed', failure: { kind: failureKind }, requestCount: 1 });
    expect(result.requests[0].response).toEqual(raw);
    expect(transport.requests).toHaveLength(1);
  });

  it('does not treat function-looking prose as a native call', async () => {
    const raw = { choices: [{ message: { role: 'assistant', content: 'write({"narration":"not native"})' } }] };
    const transport = scriptedTransport([raw]);
    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });
    expect(result).toMatchObject({ status: 'failed', failure: { kind: 'missing_write' }, requestCount: 1 });
    expect(transport.requests).toHaveLength(1);
  });

  it('fails repeated lookups at the request budget without a fifth request', async () => {
    const transport = scriptedTransport([0, 1, 2, 3].map((round) => ({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall(`lookup-${round}`, 'request_info', { term: 'Bram' }),
      ] } }],
    })));
    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });
    expect(result).toMatchObject({
      status: 'failed', failure: { kind: 'request_budget_exhausted' }, requestCount: 4, lookupCount: 4,
    });
    expect(transport.requests).toHaveLength(4);
  });

  it('records four lookups and stops when a fifth exhausts the lookup budget', async () => {
    const raw = { choices: [{ message: { role: 'assistant', content: null, tool_calls: [
      toolCall('lookup-1', 'request_info', { term: 'Bram' }),
      toolCall('lookup-2', 'request_info', { term: 'Odette' }),
      toolCall('lookup-3', 'request_info', { term: 'Rope Ferry' }),
      toolCall('lookup-4', 'request_info', { term: 'Tomas' }),
      toolCall('lookup-5', 'request_info', { term: 'Wick' }),
    ] } }] };
    const transport = scriptedTransport([raw]);

    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });

    expect(result).toMatchObject({
      status: 'failed',
      failure: { kind: 'lookup_budget_exhausted' },
      requestCount: 1,
      lookupCount: 4,
    });
    expect(result.requests[0].response).toEqual(raw);
    expect(result.toolResults).toHaveLength(4);
    expect(transport.requests).toHaveLength(1);
  });

  it('records cancellation and timeout without another request', async () => {
    const waitForAbort: ProbeTransport = {
      send: (_request, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
    };
    const controller = new AbortController();
    const canceled = runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(),
      transport: waitForAbort, signal: controller.signal,
    });
    controller.abort();
    await expect(canceled).resolves.toMatchObject({ status: 'canceled', failure: { kind: 'canceled' }, requestCount: 1 });

    await expect(runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(),
      transport: waitForAbort, requestTimeoutMs: 5,
    })).resolves.toMatchObject({ status: 'failed', failure: { kind: 'request_timeout' }, requestCount: 1 });
  });

  it('stops a batch on endpoint rejection', async () => {
    let calls = 0;
    const transport: ProbeTransport = {
      async send() {
        calls++;
        throw new EndpointRejectionError(400, { error: 'unsupported tools' });
      },
    };
    const batch = await runNarrationToolCallBatch({
      sourceRevision: 'test-revision', world: world(), transport,
    });
    expect(batch.trials).toHaveLength(1);
    expect(batch.trials[0]).toMatchObject({ status: 'failed', failure: { kind: 'endpoint_rejection' } });
    expect(calls).toBe(1);
  });

  it('runs two fresh main trials followed by two fresh controls', async () => {
    const responses = [0, 1, 2, 3].map((index) => ({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall(`write-${index}`, 'write', { narration: `Narration ${index}` }),
      ] } }],
    }));
    const transport = scriptedTransport(responses);
    const batch = await runNarrationToolCallBatch({ sourceRevision: 'test-revision', world: world(), transport });

    expect(batch.trials.map((trial) => trial.caseId)).toEqual(['main-1', 'main-2', 'control-1', 'control-2']);
    expect(batch.trials.every((trial) => trial.status === 'succeeded')).toBe(true);
    expect(transport.requests.map((request) => request.messages)).toEqual([
      expect.arrayContaining([{ role: 'user', content: expect.stringContaining(MAIN_ACTION) }]),
      expect.arrayContaining([{ role: 'user', content: expect.stringContaining(MAIN_ACTION) }]),
      expect.arrayContaining([{ role: 'user', content: expect.stringContaining(CONTROL_ACTION) }]),
      expect.arrayContaining([{ role: 'user', content: expect.stringContaining(CONTROL_ACTION) }]),
    ]);
    expect(transport.requests.every((request) => request.messages.length === 2)).toBe(true);
  });

  it('carries the selected model and seed through every local request', async () => {
    const responses = [
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('lookup-bram', 'request_info', { term: 'Bram' }),
      ] } }] },
      ...[0, 1, 2, 3].map((index) => ({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall(`write-${index}`, 'write', { narration: `Narration ${index}` }),
      ] } }],
      })),
    ];
    const transport = scriptedTransport(responses);

    await runNarrationToolCallBatch({
      sourceRevision: 'test-revision',
      world: world(),
      transport,
      model: 'rocinante-x-12b-v1',
      seed: 424242,
    });

    expect(transport.requests).toHaveLength(5);
    expect(transport.requests.every((request) =>
      request.model === 'rocinante-x-12b-v1' && request.seed === 424242)).toBe(true);
  });

  it('cleans the request timeout after a completed call', async () => {
    vi.useFakeTimers();
    const transport = scriptedTransport([{ choices: [{ message: {
      role: 'assistant', content: null,
      tool_calls: [toolCall('write', 'write', { narration: 'Done.' })],
    } }] }]);
    const result = await runNarrationToolCallTrial({
      caseId: 'control', action: CONTROL_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });
    expect(result.status).toBe('succeeded');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('narration tool-call cloud transport', () => {
  it('posts the prepared request once and keeps credentials outside recorded evidence', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('write', 'write', { narration: 'Done.' }),
      ] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const transport = createProbeTransport({ token: 'secret-token', fetchImpl: fetchMock });
    const result = await runNarrationToolCallTrial({
      caseId: 'control', action: CONTROL_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.lyonade.net/v1/chat/completions');
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });

  it('surfaces the endpoint status and response body without retrying', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify({ error: { message: 'tools unsupported' } }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    ));
    const transport = createProbeTransport({ fetchImpl: fetchMock });
    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });

    expect(result).toMatchObject({ status: 'failed', failure: { kind: 'endpoint_rejection' }, requestCount: 1 });
    expect(result.requests[0].error).toEqual({
      name: 'EndpointRejectionError',
      message: 'HTTP 422: {"error":{"message":"tools unsupported"}}',
      status: 422,
      responseBody: { error: { message: 'tools unsupported' } },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
