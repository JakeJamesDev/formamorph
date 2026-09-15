import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveReasoningCapability, mergeReasoningCapability, SAFE_REASONING_EFFORTS,
  type ReasoningCapability,
} from './reasoningEffort';
import { resetProbeMemo } from './probeMemo';
import {
  reasoningBackend as backend, probeCount, REASONING_TARGET as TARGET,
  LM_STUDIO_URL as LM_STUDIO, OLLAMA_URL as OLLAMA, PROPS_URL as PROPS, OPENAI_URL as OPENAI,
  COMPLETIONS_URL as COMPLETIONS, type BackendAnswer as Answer,
} from '@/test/reasoningBackend';

beforeEach(() => resetProbeMemo());

describe('LM Studio native model list', () => {
  const list = (capabilities: unknown) => ({
    status: 200,
    body: { models: [{ key: 'm', loaded_instances: [{ id: 'm' }], capabilities }] },
  });

  it('reads a reasoning model as reasoning, and as taking a budget', async () => {
    const { doFetch } = backend({ [LM_STUDIO]: list({ reasoning: { allowed_options: ['off', 'on'], default: 'on' } }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: true, budget: true });
    expect(record?.sources.reasons).toBe('native');
    expect(record?.sources.budget).toBe('native');
  });

  // `on` is the switch, not a strength, so it names no literal of ours and an on/off model lists `none`
  // alone. The strength dropdown then offers Model Default only, which is what the server honors.
  it('maps allowed options to our literals, dropping the ones that name no strength', async () => {
    const { doFetch } = backend({ [LM_STUDIO]: list({ reasoning: { allowed_options: ['off', 'on'] } }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.levels).toEqual(['none']);
    expect(record?.sources.levels).toBe('native');
  });

  it('keeps the graded options a model does list', async () => {
    const { doFetch } = backend({ [LM_STUDIO]: list({ reasoning: { allowed_options: ['off', 'low', 'medium', 'high'] } }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.levels).toEqual(['none', 'low', 'medium', 'high']);
  });

  it('rules a model out when the list carries no reasoning capability', async () => {
    const { doFetch, calls } = backend({ [LM_STUDIO]: list({ vision: false }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: false, levels: [] });
    // Budget is unanswered, not denied: nothing has tested whether the endpoint takes the field here.
    expect(record?.budget).toBeNull();
    expect(probeCount(calls)).toBe(0);
  });

  it('asks the origin-derived native path, not the configured completions URL', async () => {
    const { doFetch, calls } = backend({ [LM_STUDIO]: list({ reasoning: {} }) });
    await resolveReasoningCapability(TARGET, doFetch);
    expect(calls[0].url).toBe(LM_STUDIO);
  });

  it('moves on when the list is the OpenAI shape rather than the native one', async () => {
    const { doFetch } = backend({ [LM_STUDIO]: { status: 200, body: { data: [{ id: 'm' }] } } });
    expect(await resolveReasoningCapability(TARGET, doFetch)).toBeNull();
  });

  it('moves on when the model is absent from the list', async () => {
    const { doFetch } = backend({ [LM_STUDIO]: { status: 200, body: { models: [{ key: 'other', loaded_instances: [] }] } } });
    expect(await resolveReasoningCapability(TARGET, doFetch)).toBeNull();
  });

  it('answers nothing when the endpoint is not a URL', async () => {
    const { doFetch, calls } = backend({});
    expect(await resolveReasoningCapability({ ...TARGET, url: 'not a url' }, doFetch)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('falls back to the loaded model when the configured name is not a key', async () => {
    const { doFetch } = backend({
      [LM_STUDIO]: {
        status: 200,
        body: {
          models: [
            { key: 'other', loaded_instances: [] },
            { key: 'loaded-one', loaded_instances: [{ id: 'loaded-one' }], capabilities: { reasoning: { allowed_options: ['off', 'on'] } } },
          ],
        },
      },
    });
    const record = await resolveReasoningCapability({ ...TARGET, model: 'default' }, doFetch);
    expect(record?.reasons).toBe(true);
  });
});

describe('Ollama show endpoint', () => {
  const show = (capabilities: unknown) => ({ status: 200, body: { capabilities } });

  it('reads a thinking model as reasoning', async () => {
    const { doFetch, calls } = backend({ [OLLAMA]: show(['completion', 'tools', 'thinking']) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: true });
    expect(record?.sources.reasons).toBe('native');
    expect(probeCount(calls)).toBe(0);
  });

  it('rules a model out when the array is present without thinking', async () => {
    const { doFetch } = backend({ [OLLAMA]: show(['completion', 'tools']) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: false });
  });

  it('asks it with the model in a POST body', async () => {
    const { doFetch, calls } = backend({ [OLLAMA]: show(['thinking']) });
    await resolveReasoningCapability(TARGET, doFetch);
    expect(calls.find((c) => c.url === OLLAMA)?.method).toBe('POST');
  });

  // The array is omitempty on the wire, so a 200 without it says nothing and the chain moves on.
  it('moves on when the capabilities array is absent', async () => {
    const { doFetch } = backend({ [OLLAMA]: { status: 200, body: { model: 'm' } } });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toBeNull();
  });
});

describe('llama.cpp properties endpoint', () => {
  const props = (caps: unknown) => ({ status: 200, body: { build_info: 'b1', chat_template_caps: caps } });

  it('accepts the effort levels when the template honors the field', async () => {
    const { doFetch } = backend({ [PROPS]: props({ supports_reasoning_effort: true }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.levels).toEqual([...SAFE_REASONING_EFFORTS]);
    expect(record?.sources.levels).toBe('native');
  });

  // llama.cpp exposes no flag for "does this model think", so the question stays open either way.
  it('leaves the reasons question unknown whatever the template says', async () => {
    const honored = backend({ [PROPS]: props({ supports_reasoning_effort: true }) });
    const ignored = backend({ [PROPS]: props({ supports_reasoning_effort: false }) });
    expect((await resolveReasoningCapability(TARGET, honored.doFetch))?.reasons).toBeNull();
    resetProbeMemo();
    expect((await resolveReasoningCapability(TARGET, ignored.doFetch))?.reasons).toBeNull();
  });

  it('accepts no effort level when the template ignores the field', async () => {
    const { doFetch } = backend({ [PROPS]: props({ supports_reasoning_effort: false }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.levels).toEqual([]);
  });

  it('moves on when an older build omits the flag', async () => {
    const { doFetch } = backend({ [PROPS]: props({ supports_tools: true }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toBeNull();
  });
});

describe('gateway model list', () => {
  const entry = (extra: Record<string, unknown>) => ({ status: 200, body: { data: [{ id: 'm', ...extra }] } });

  it('reads the reasoning object and fills the levels it lists', async () => {
    const { doFetch, calls } = backend({
      [OPENAI]: entry({ reasoning: { mandatory: false, supported_efforts: ['high', 'medium', 'low', 'none'] } }),
    });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: true });
    expect(record?.levels).toEqual(['high', 'medium', 'low', 'none']);
    expect(record?.sources.levels).toBe('native');
    expect(probeCount(calls)).toBe(0);
  });

  // A mandatory-reasoning model rejects `none`, so the switch-off state must omit the field instead.
  it('drops none from the levels when reasoning is mandatory', async () => {
    const { doFetch } = backend({
      [OPENAI]: entry({ reasoning: { mandatory: true, supported_efforts: ['high', 'low', 'none'] } }),
    });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.levels).toEqual(['high', 'low']);
  });

  it('answers reasons from the supported parameters when there is no reasoning object', async () => {
    const { doFetch } = backend({ [OPENAI]: entry({ supported_parameters: ['temperature', 'reasoning_effort'] }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: true, levels: null });
  });

  it('rules a model out when the parameter list carries no reasoning field', async () => {
    const { doFetch } = backend({ [OPENAI]: entry({ supported_parameters: ['temperature', 'top_p'] }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: false });
  });

  it('moves on when the model is not in the list', async () => {
    const { doFetch } = backend({ [OPENAI]: { status: 200, body: { data: [{ id: 'someone-else' }] } } });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toBeNull();
  });
});

describe('source identification', () => {
  // Live, LM Studio answers `GET /props` with HTTP 200 and an error payload. A status-code check would
  // read it as a llama.cpp server, so the body decides.
  it('does not read a 200 error payload as an answer', async () => {
    const { doFetch } = backend({
      [PROPS]: { status: 200, body: { error: 'Unexpected endpoint or method. (GET /props)' } },
      [LM_STUDIO]: { status: 200, body: { models: [{ key: 'm', capabilities: { reasoning: { allowed_options: ['off', 'on'] } } }] } },
    });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: true, budget: true });
  });

  it('asks a known-absent endpoint once per session', async () => {
    const answers = { [OLLAMA]: { status: 415, body: {} } };
    const first = backend(answers);
    await resolveReasoningCapability(TARGET, first.doFetch);
    expect(first.calls.filter((c) => c.url === OLLAMA)).toHaveLength(1);

    const second = backend(answers);
    await resolveReasoningCapability(TARGET, second.doFetch);
    expect(second.calls.filter((c) => c.url === OLLAMA)).toHaveLength(0);
  });

  it('tries the next source when one does not answer', async () => {
    const { doFetch, calls } = backend({ [OPENAI]: { status: 200, body: { data: [{ id: 'm', supported_parameters: ['reasoning'] }] } } });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.reasons).toBe(true);
    expect(calls.map((c) => c.url)).toEqual([LM_STUDIO, OLLAMA, PROPS, OPENAI]);
  });
});

describe('the chain ends on the reasons question, not on any answer', () => {
  // llama.cpp names the strengths but never says whether the model thinks, so the chain must carry on.
  it('keeps asking after a source that answers only the levels', async () => {
    const { doFetch, calls } = backend({
      [PROPS]: { status: 200, body: { chat_template_caps: { supports_reasoning_effort: true } } },
      [OPENAI]: { status: 200, body: { data: [{ id: 'm', supported_parameters: ['reasoning_effort'] }] } },
    });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.reasons).toBe(true);
    expect(calls.map((c) => c.url)).toContain(OPENAI);
  });

  it('falls through to the probe when no source answers the reasons question', async () => {
    const { doFetch, calls } = backend({
      [PROPS]: { status: 200, body: { chat_template_caps: { supports_reasoning_effort: true } } },
      [COMPLETIONS]: { status: 400, body: {} },
    });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.reasons).toBe(false);
    expect(record?.sources.reasons).toBe('probe');
    expect(probeCount(calls)).toBe(1);
  });

  // An advertisement outranks the probe, which only learns whether the field parses.
  it('keeps the advertised levels when the probe also answers', async () => {
    const { doFetch } = backend({
      [PROPS]: { status: 200, body: { chat_template_caps: { supports_reasoning_effort: false } } },
      [COMPLETIONS]: { status: 200, body: {} },
    });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.levels).toEqual([]);
    expect(record?.sources.levels).toBe('native');
  });

  it('stops at the first source that answers the reasons question', async () => {
    const { doFetch, calls } = backend({
      [OLLAMA]: { status: 200, body: { capabilities: ['thinking'] } },
      [OPENAI]: { status: 200, body: { data: [{ id: 'm', supported_parameters: [] }] } },
    });
    expect((await resolveReasoningCapability(TARGET, doFetch))?.reasons).toBe(true);
    expect(calls.map((c) => c.url)).not.toContain(OPENAI);
  });
});

describe('a source never contradicts itself', () => {
  // `on` maps to no literal of ours. An empty list reads as "accepts no literal", which hides the
  // control — so a source that just called the model reasoning must leave the levels unanswered instead.
  it('leaves the levels unknown when LM Studio lists a reasoning model with no mappable strength', async () => {
    const { doFetch } = backend({
      [LM_STUDIO]: { status: 200, body: { models: [{ key: 'm', capabilities: { reasoning: { allowed_options: ['on'] } } }] } },
    });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.reasons).toBe(true);
    expect(record?.levels).toBeNull();
  });

  it('leaves the levels unknown when a mandatory gateway model lists only none', async () => {
    const { doFetch } = backend({
      [OPENAI]: { status: 200, body: { data: [{ id: 'm', reasoning: { mandatory: true, supported_efforts: ['none'] } }] } },
    });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.reasons).toBe(true);
    expect(record?.levels).toBeNull();
  });
});

describe('what the replies already showed', () => {
  const saw = { sawReasoning: true, effort: 'high' } as const;
  const bare = { sawReasoning: false, effort: 'high' } as const;

  it('marks a model whose reply carried reasoning as reasoning, with no completion sent', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 200, body: {} } });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: saw });
    expect(record?.reasons).toBe(true);
    expect(record?.sources.reasons).toBe('observed');
    expect(probeCount(calls)).toBe(0);
  });

  // Seeing a scratchpad says the model thinks. It never says which strengths the endpoint takes.
  it('answers the reasons question alone', async () => {
    const { doFetch } = backend({});
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: saw });
    expect(record?.levels).toBeNull();
    expect(record?.budget).toBeNull();
  });

  it('rules a model out when a reply came back bare under a positive effort', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 200, body: {} } });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: bare });
    expect(record).toMatchObject({ reasons: false, levels: [] });
    expect(record?.sources.reasons).toBe('observed');
    expect(probeCount(calls)).toBe(0);
  });

  it.each([
    ['none', { sawReasoning: false, effort: 'none' } as const],
    ['Model Default', { sawReasoning: false, effort: null } as const],
  ])('leaves a bare reply under %s to the probe, since neither asked the model to think', async (_name, observation) => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 200, body: {} } });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation });
    expect(record?.reasons).toBeNull();
    expect(record?.sources.levels).toBe('probe');
    expect(probeCount(calls)).toBe(1);
  });

  it.each([
    ['a native yes', { [OLLAMA]: { status: 200, body: { capabilities: ['thinking'] } } }, true, bare],
    ['a native no', { [OLLAMA]: { status: 200, body: { capabilities: ['vision'] } } }, false, saw],
  ])('never lets one reply override %s', async (_name, answers, expected, observation) => {
    const { doFetch } = backend(answers as Record<string, Answer>);
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation });
    expect(record?.reasons).toBe(expected);
    expect(record?.sources.reasons).toBe('native');
  });

  // llama.cpp names the strengths its template honors but never whether the model thinks, so the
  // observation fills that gap without touching the levels the server reported.
  it('fills the gap a source left open, keeping that source’s levels', async () => {
    const { doFetch } = backend({
      [PROPS]: { status: 200, body: { chat_template_caps: { supports_reasoning_effort: true } } },
    });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: saw });
    expect(record?.reasons).toBe(true);
    expect(record?.sources.reasons).toBe('observed');
    expect(record?.levels).toEqual([...SAFE_REASONING_EFFORTS]);
    expect(record?.sources.levels).toBe('native');
  });
});

describe('the single probe', () => {
  it('rules a model out when the endpoint rejects the none literal', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 400, body: {} } });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: false, levels: [] });
    expect(record?.sources.reasons).toBe('probe');
    expect(probeCount(calls)).toBe(1);
  });

  it('leaves the reasons question open on the safe levels when the endpoint accepts it', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 200, body: {} } });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.reasons).toBeNull();
    expect(record?.levels).toEqual([...SAFE_REASONING_EFFORTS]);
    expect(record?.sources.levels).toBe('probe');
    expect(probeCount(calls)).toBe(1);
  });

  it('sends the none literal, not a level', async () => {
    const sent: string[] = [];
    const doFetch = async (url: string, init?: RequestInit) => {
      if (url === COMPLETIONS) sent.push(String(JSON.parse(String(init?.body)).reasoning_effort));
      return { ok: false, status: url === COMPLETIONS ? 200 : 404, json: async () => ({}), text: async () => '' } as Response;
    };
    await resolveReasoningCapability(TARGET, doFetch);
    expect(sent).toEqual(['none']);
  });

  it('keeps the fallback when the endpoint answers inconclusively', async () => {
    const { doFetch } = backend({ [COMPLETIONS]: { status: 500, body: {} } });
    expect(await resolveReasoningCapability(TARGET, doFetch)).toBeNull();
  });

  // The guard the ticket names. It fails if a second completion is ever added to any path.
  it.each([
    ['nothing advertises', {}],
    ['the probe is rejected', { [COMPLETIONS]: { status: 400, body: {} } }],
    ['the probe is accepted', { [COMPLETIONS]: { status: 200, body: {} } }],
    ['the probe errors', { [COMPLETIONS]: { status: 500, body: {} } }],
  ])('never sends more than one completion when %s', async (_name, answers) => {
    const { doFetch, calls } = backend(answers as Record<string, Answer>);
    await resolveReasoningCapability(TARGET, doFetch);
    expect(probeCount(calls)).toBeLessThanOrEqual(1);
  });

  it('sends no completion at all when a source answered', async () => {
    const { doFetch, calls } = backend({
      [OLLAMA]: { status: 200, body: { capabilities: ['thinking'] } },
      [COMPLETIONS]: { status: 200, body: {} },
    });
    await resolveReasoningCapability(TARGET, doFetch);
    expect(probeCount(calls)).toBe(0);
  });
});

describe('merging a fresh answer onto a stored record', () => {
  const cachedSeven: ReasoningCapability = {
    reasons: null,
    levels: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
    budget: null,
    sources: { levels: 'cache' },
  };

  // The pre-update record holds seven levels the old probe invented. A native answer outranks it.
  it('replaces cached levels with the ones a native source reports', async () => {
    const { doFetch } = backend({
      [LM_STUDIO]: { status: 200, body: { models: [{ key: 'm', capabilities: { reasoning: { allowed_options: ['off', 'on'] } } }] } },
    });
    const fresh = await resolveReasoningCapability(TARGET, doFetch);
    const merged = mergeReasoningCapability(cachedSeven, fresh!);
    expect(merged.levels).toEqual(['none']);
    expect(merged.sources.levels).toBe('native');
  });

  it('keeps a stored answer the fresh record does not carry', () => {
    const stored: ReasoningCapability = { reasons: true, levels: ['none', 'high'], budget: true, sources: { reasons: 'native', levels: 'native', budget: 'native' } };
    const fresh: ReasoningCapability = { reasons: null, levels: null, budget: null, sources: {} };
    expect(mergeReasoningCapability(stored, fresh)).toEqual(stored);
  });

  it('takes every fresh answer over the stored one', () => {
    const stored: ReasoningCapability = { reasons: false, levels: [], budget: null, sources: { reasons: 'probe', levels: 'probe' } };
    const fresh: ReasoningCapability = { reasons: true, levels: ['none', 'low'], budget: true, sources: { reasons: 'native', levels: 'native', budget: 'native' } };
    expect(mergeReasoningCapability(stored, fresh)).toEqual(fresh);
  });
});
