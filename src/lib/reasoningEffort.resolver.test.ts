import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveReasoningCapability, mergeReasoningCapability, reasoningRuledOut,
  SAFE_REASONING_EFFORTS, REASONING_CANDIDATES,
  type ReasoningCapability,
} from './reasoningEffort';
import { resetProbeMemo } from './probeMemo';
import {
  reasoningBackend as backend, probeCount, probeKinds, REASONING_TARGET as TARGET,
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
    expect(probeKinds(calls)).toEqual(['tools']); // the list answered reasoning; only tools is asked
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

  // vLLM and Aphrodite publish `max_model_len` on each entry, the key the context-length lookup already
  // reads for them. It names the dialect and nothing else: the reasoning parser is a server-side option no
  // list advertises, so the budget question stays open and the chain carries on.
  it('names the vllm dialect from an entry carrying max_model_len', async () => {
    const { doFetch } = backend({ [OPENAI]: entry({ max_model_len: 10750 }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.dialect).toBe('vllm');
    expect(record?.sources.dialect).toBe('native');
    expect(record?.budget).toBeNull();
    expect(record?.reasons).toBeNull();
  });

  it('reads the Aphrodite shape as vllm too, entry extras and all', async () => {
    const { doFetch } = backend({
      [OPENAI]: entry({ root: 'm', parent: null, permission: [{ id: 'p' }], max_model_len: 10750, owned_by: 'aphrodite' }),
    });
    expect((await resolveReasoningCapability(TARGET, doFetch))?.dialect).toBe('vllm');
  });

  it('keeps the vllm dialect while a later source answers the reasons question', async () => {
    const { doFetch } = backend({
      [OPENAI]: entry({ max_model_len: 10750 }),
      [COMPLETIONS]: { status: 200, body: {} },
    });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.dialect).toBe('vllm');
    expect(record?.levels).toEqual([...SAFE_REASONING_EFFORTS]);
    expect(record?.sources.levels).toBe('probe');
  });

  // Only OpenRouter publishes a reasoning object on its model list, so carrying one names the dialect.
  it('names the openrouter dialect from an entry carrying a reasoning object', async () => {
    const { doFetch } = backend({
      [OPENAI]: entry({ reasoning: { mandatory: false, supported_efforts: ['high', 'low', 'none'] } }),
    });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.dialect).toBe('openrouter');
    expect(record?.sources.dialect).toBe('native');
  });

  it('leaves the dialect unknown on a plain OpenAI list, which says nothing about the spelling', async () => {
    const { doFetch } = backend({ [OPENAI]: entry({ supported_parameters: ['temperature', 'reasoning_effort'] }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.dialect).toBe('unknown');
    expect(record?.sources.dialect).toBeUndefined();
  });
});

/**
 * One OpenRouter models-list entry per case, in the shapes its own list serves. The field meanings are
 * OpenRouter's, read from its reasoning-tokens guide on 2026-09-15: a `supported_efforts` list names the
 * accepted literals, `null` accepts every gateway effort, an omitted field exposes no strength at all,
 * `supports_max_tokens` turns the budget on, and `mandatory` forbids switching reasoning off.
 */
describe('OpenRouter model list', () => {
  const listing = (reasoning: Record<string, unknown>) =>
    ({ status: 200 as const, body: { data: [{ id: 'm', reasoning }] } });

  const resolve = async (reasoning: Record<string, unknown>) => {
    const { doFetch, calls } = backend({ [OPENAI]: listing(reasoning) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(probeKinds(calls)).toEqual(['tools']); // the list answered reasoning; only tools is asked
    return record;
  };

  it('takes the listed efforts as the levels, in the order the list gives them', async () => {
    const record = await resolve({ mandatory: false, supported_efforts: ['max', 'high', 'low', 'none'] });
    expect(record?.levels).toEqual(['max', 'high', 'low', 'none']);
    expect(record?.sources.levels).toBe('native');
  });

  // OpenRouter documents null as "every gateway effort", which is the whole ladder the app knows.
  it('offers every effort the app knows when the list leaves the efforts null', async () => {
    const record = await resolve({ mandatory: false, supported_efforts: null });
    expect(record?.levels).toEqual([...REASONING_CANDIDATES]);
  });

  // An omitted field is a real answer, not a gap: the model reasons on its own terms and exposes no
  // strength, so the dropdown goes while the switch and any budget slider stay.
  it('lists no level at all when the entry names no efforts', async () => {
    const record = await resolve({ mandatory: false, supports_max_tokens: true });
    expect(record?.levels).toEqual([]);
    expect(record?.reasons).toBe(true);
    expect(reasoningRuledOut(record)).toBe(false);
  });

  it('takes the budget answer from supports_max_tokens', async () => {
    const takes = await resolve({ mandatory: false, supports_max_tokens: true, supported_efforts: ['high', 'low'] });
    expect(takes?.budget).toBe(true);
    expect(takes?.sources.budget).toBe('native');
    const skips = await resolve({ mandatory: false, supported_efforts: ['high', 'low'] });
    expect(skips?.budget).toBe(false);
  });

  it('takes the off answer from mandatory', async () => {
    const optional = await resolve({ mandatory: false, supported_efforts: ['high', 'none'] });
    expect(optional?.offAllowed).toBe(true);
    expect(optional?.sources.offAllowed).toBe('native');
    const always = await resolve({ mandatory: true, supported_efforts: ['high', 'none'] });
    expect(always?.offAllowed).toBe(false);
  });

  // A list of literals this app does not know is an answer it cannot read, not an answer of "no strength".
  // The safe fallback stands, exactly as it does for a mandatory list of nothing but `none`.
  it('leaves the levels unanswered when the list names nothing the app knows', async () => {
    const record = await resolve({ mandatory: false, supported_efforts: ['ludicrous', 'plaid'] });
    expect(record?.levels).toBeNull();
    expect(record?.reasons).toBe(true);
  });

  it('drops the none literal from a mandatory model, which rejects it', async () => {
    const record = await resolve({ mandatory: true, supported_efforts: ['high', 'low', 'none'] });
    expect(record?.levels).toEqual(['high', 'low']);
  });

  // The whole ladder minus `none`, since a mandatory model rejects that one literal.
  it('drops none from the null-efforts ladder too', async () => {
    const record = await resolve({ mandatory: true, supported_efforts: null });
    expect(record?.levels).toEqual(REASONING_CANDIDATES.filter((l) => l !== 'none'));
  });
});

describe('the dialect each existing source names', () => {
  it('marks LM Studio from its native list, on a reasoning model and on one that does not reason', async () => {
    const reasoning = backend({
      [LM_STUDIO]: { status: 200, body: { models: [{ key: 'm', capabilities: { reasoning: { allowed_options: ['off', 'high'] } } }] } },
    });
    const listed = await resolveReasoningCapability(TARGET, reasoning.doFetch);
    expect(listed?.dialect).toBe('lmstudio');
    expect(listed?.sources.dialect).toBe('native');

    resetProbeMemo();
    const plain = backend({ [LM_STUDIO]: { status: 200, body: { models: [{ key: 'm', capabilities: { vision: false } }] } } });
    const ruledOut = await resolveReasoningCapability(TARGET, plain.doFetch);
    expect(ruledOut).toMatchObject({ reasons: false, dialect: 'lmstudio' });
  });

  it('leaves Ollama and llama.cpp unknown, since neither names a spelling', async () => {
    const ollama = backend({ [OLLAMA]: { status: 200, body: { capabilities: ['completion', 'thinking'] } } });
    expect((await resolveReasoningCapability(TARGET, ollama.doFetch))?.dialect).toBe('unknown');

    resetProbeMemo();
    const llama = backend({
      [PROPS]: { status: 200, body: { chat_template_caps: { supports_reasoning_effort: true } } },
      [COMPLETIONS]: { status: 200, body: {} },
    });
    expect((await resolveReasoningCapability(TARGET, llama.doFetch))?.dialect).toBe('unknown');
  });

  it('leaves the dialect unknown when only the probe answered', async () => {
    const { doFetch } = backend({ [COMPLETIONS]: { status: 200, body: {} } });
    expect((await resolveReasoningCapability(TARGET, doFetch))?.dialect).toBe('unknown');
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
    // The list answers reasoning, so the one completion after it asks tools alone.
    expect(calls.map((c) => c.url)).toEqual([LM_STUDIO, OLLAMA, PROPS, OPENAI, COMPLETIONS]);
    expect(probeKinds(calls)).toEqual(['tools']);
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
    expect(probeKinds(calls)).toEqual(['bundle', 'reasoning', 'tools']); // a 400 splits to attribute it
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

// A vLLM server separates its reasoning only when its operator started one with a reasoning parser. No model
// list says whether they did, so the record waits for a reply to show a field of its own. Until then the
// budget answer stays unanswered, which is what hides both controls and sends no reasoning field.
describe('a vLLM reply proving the server separates its reasoning', () => {
  const vllm = { status: 200, body: { data: [{ id: 'm', max_model_len: 10750 }] } };
  const separated = { sawReasoning: true, sawSeparateReasoning: true, effort: 'high' } as const;
  const inline = { sawReasoning: true, sawSeparateReasoning: false, effort: 'high' } as const;
  const prose = { sawReasoning: false, sawSeparateReasoning: false, effort: 'high' } as const;

  it('marks the budget yes and fills the safe levels once a reply carried a reasoning field', async () => {
    const { doFetch } = backend({ [OPENAI]: vllm });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: separated });
    expect(record?.dialect).toBe('vllm');
    expect(record?.budget).toBe(true);
    expect(record?.sources.budget).toBe('observed');
    expect(record?.levels).toEqual([...SAFE_REASONING_EFFORTS]);
    expect(record?.sources.levels).toBe('observed');
  });

  // A think block says the model thought. It never says the server parsed the thinking out, which is the
  // thing the reasoning parser does and the thing the budget field rides on.
  it('leaves the budget unanswered when the reasoning came inline in the prose', async () => {
    const { doFetch } = backend({ [OPENAI]: vllm });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: inline });
    expect(record?.dialect).toBe('vllm');
    expect(record?.reasons).toBe(true);
    expect(record?.budget).toBeNull();
    expect(record?.levels).toBeNull();
  });

  it('rules the model out when a reply under a positive effort showed no reasoning at all', async () => {
    const { doFetch } = backend({ [OPENAI]: vllm });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: prose });
    expect(record?.dialect).toBe('vllm');
    expect(record).toMatchObject({ reasons: false, levels: [] });
    expect(record?.budget).toBeNull();
  });

  // The gate belongs to the dialect that advertises nothing. An endpoint the app has never identified keeps
  // today's record, where one reply answers the reasons question and nothing else.
  it('leaves an unidentified endpoint’s budget unanswered on the same reply', async () => {
    const { doFetch } = backend({ [OLLAMA]: { status: 200, body: { capabilities: ['thinking'] } } });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: separated });
    expect(record?.dialect).toBe('unknown');
    expect(record?.budget).toBeNull();
  });

  // The catalog answers the reasons question and returns early, so the proof has to survive that exit too.
  it('proves the budget even where the catalog answered first', async () => {
    const { doFetch } = backend({ [OPENAI]: vllm });
    const record = await resolveReasoningCapability(TARGET, doFetch, {
      observation: separated,
      loadCatalog: async () => new Set(['m']),
    });
    expect(record?.sources.reasons).toBe('catalog');
    expect(record?.budget).toBe(true);
    expect(record?.sources.budget).toBe('observed');
  });
});

describe('what the replies already showed', () => {
  const saw = { sawReasoning: true, sawSeparateReasoning: true, effort: 'high' } as const;
  const bare = { sawReasoning: false, sawSeparateReasoning: false, effort: 'high' } as const;

  it('marks a model whose reply carried reasoning as reasoning, with no reasoning probe sent', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 200, body: {} } });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: saw });
    expect(record?.reasons).toBe(true);
    expect(record?.sources.reasons).toBe('observed');
    expect(probeKinds(calls)).toEqual(['tools']);
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
    expect(probeKinds(calls)).toEqual(['tools']);
  });

  it.each([
    ['none', { sawReasoning: false, sawSeparateReasoning: false, effort: 'none' } as const],
    ['Model Default', { sawReasoning: false, sawSeparateReasoning: false, effort: null } as const],
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

describe('the reasoning probe', () => {
  it('rules a model out when the endpoint rejects the none literal', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 400, body: {} } });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: false, levels: [] });
    expect(record?.sources.reasons).toBe('probe');
    expect(probeKinds(calls)).toEqual(['bundle', 'reasoning', 'tools']); // a 400 splits to attribute it
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

  // Only a 400 splits the bundled probe, since only a 400 names a field to attribute. It fails if a
  // completion is ever added to any path.
  it.each([
    ['nothing advertises', {}, ['bundle']],
    ['the probe is rejected', { [COMPLETIONS]: { status: 400, body: {} } }, ['bundle', 'reasoning', 'tools']],
    ['the probe is accepted', { [COMPLETIONS]: { status: 200, body: {} } }, ['bundle']],
    ['the probe errors', { [COMPLETIONS]: { status: 500, body: {} } }, ['bundle']],
  ])('sends only the completions it needs when %s', async (_name, answers, kinds) => {
    const { doFetch, calls } = backend(answers as Record<string, Answer>);
    await resolveReasoningCapability(TARGET, doFetch);
    expect(probeKinds(calls)).toEqual(kinds);
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
    dialect: 'unknown',
    offAllowed: null, tools: null,
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
    const stored: ReasoningCapability = { reasons: true, levels: ['none', 'high'], budget: true, dialect: 'lmstudio', offAllowed: null, tools: null, sources: { reasons: 'native', levels: 'native', budget: 'native', dialect: 'native' } };
    const fresh: ReasoningCapability = { reasons: null, levels: null, budget: null, dialect: 'unknown', offAllowed: null, tools: null, sources: {} };
    expect(mergeReasoningCapability(stored, fresh)).toEqual(stored);
  });

  it('takes every fresh answer over the stored one', () => {
    const stored: ReasoningCapability = { reasons: false, levels: [], budget: null, dialect: 'unknown', offAllowed: null, tools: null, sources: { reasons: 'probe', levels: 'probe' } };
    const fresh: ReasoningCapability = { reasons: true, levels: ['none', 'low'], budget: true, dialect: 'lmstudio', offAllowed: true, tools: null, sources: { reasons: 'native', levels: 'native', budget: 'native', dialect: 'native' } };
    expect(mergeReasoningCapability(stored, fresh)).toEqual(fresh);
  });
});
