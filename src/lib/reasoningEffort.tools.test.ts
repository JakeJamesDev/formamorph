import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveReasoningCapability, parseReasoningCapability, mergeReasoningCapability, reasoningNeedsResolve,
  toolsSupported, SAFE_REASONING_EFFORTS, UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability,
} from './reasoningEffort';
import { parseReasoningCatalog } from './reasoningCatalog';
import { resetProbeMemo } from './probeMemo';
import {
  reasoningBackend as backend, probeCount, probeKinds, completionsAccepting,
  REASONING_TARGET as TARGET, LM_STUDIO_URL as LM_STUDIO, OLLAMA_URL as OLLAMA, COMPLETIONS_URL as COMPLETIONS,
} from '@/test/reasoningBackend';

beforeEach(() => resetProbeMemo());

/** A reply that showed reasoning, so the reasons question is settled without any advertisement. */
const sawReasoning = { sawReasoning: true, sawSeparateReasoning: false, effort: 'high' } as const;

describe('LM Studio native model list', () => {
  const list = (capabilities: unknown) => ({
    status: 200,
    body: { models: [{ key: 'm', loaded_instances: [{ id: 'm' }], capabilities }] },
  });

  it('reads a model trained for tool use as supporting tools, with no probe', async () => {
    const { doFetch, calls } = backend({ [LM_STUDIO]: list({ trained_for_tool_use: true, reasoning: {} }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.tools).toBe(true);
    expect(record?.sources.tools).toBe('native');
    expect(probeCount(calls)).toBe(0);
  });

  it('records a model not trained for tool use as unsupported', async () => {
    const { doFetch, calls } = backend({ [LM_STUDIO]: list({ trained_for_tool_use: false }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.tools).toBe(false);
    expect(record?.sources.tools).toBe('native');
    expect(probeCount(calls)).toBe(0);
  });

  it('records a model whose list entry names no tool use as unsupported', async () => {
    const { doFetch, calls } = backend({ [LM_STUDIO]: list({ vision: false }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.tools).toBe(false);
    expect(probeCount(calls)).toBe(0);
  });
});

describe('Ollama show endpoint', () => {
  const show = (capabilities: string[]) => ({ status: 200, body: { capabilities } });

  it('reads the tools capability as supported, with no probe', async () => {
    const { doFetch, calls } = backend({ [OLLAMA]: show(['completion', 'tools']) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.tools).toBe(true);
    expect(record?.sources.tools).toBe('native');
    expect(probeCount(calls)).toBe(0);
  });

  it('reads an array without tools as unsupported', async () => {
    const { doFetch, calls } = backend({ [OLLAMA]: show(['completion', 'thinking']) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.tools).toBe(false);
    expect(probeCount(calls)).toBe(0);
  });
});

describe('the bundled probe', () => {
  it('asks both questions in one completion, carrying a Tool and tool_choice auto', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: true }) });
    await resolveReasoningCapability(TARGET, doFetch);
    expect(probeKinds(calls)).toEqual(['bundle']);
    const body = calls.find((c) => c.url === COMPLETIONS)!.body;
    expect(body.reasoning_effort).toBe('none');
    expect(body.tool_choice).toBe('auto');
    expect(body.tools).toEqual([expect.objectContaining({ type: 'function' })]);
  });

  it('answers both questions from one 200', async () => {
    const { doFetch } = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: true }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record?.tools).toBe(true);
    expect(record?.sources.tools).toBe('probe');
    expect(record?.levels).toEqual([...SAFE_REASONING_EFFORTS]);
    expect(record?.sources.levels).toBe('probe');
  });

  it('splits a 400 and pins it on the tools field when only tools is rejected', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: false }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(probeKinds(calls)).toEqual(['bundle', 'reasoning', 'tools']);
    expect(record?.tools).toBe(false);
    expect(record?.levels).toEqual([...SAFE_REASONING_EFFORTS]);
    expect(record?.reasons).toBeNull();
  });

  it('splits a 400 and pins it on the reasoning field when only reasoning is rejected', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: false, tools: true }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(probeKinds(calls)).toEqual(['bundle', 'reasoning', 'tools']);
    expect(record?.tools).toBe(true);
    expect(record).toMatchObject({ reasons: false, levels: [] });
  });

  it('splits a 400 into two noes when both fields are rejected', async () => {
    const { doFetch } = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: false, tools: false }) });
    const record = await resolveReasoningCapability(TARGET, doFetch);
    expect(record).toMatchObject({ reasons: false, levels: [], tools: false });
    expect(record?.sources.tools).toBe('probe');
  });

  it('does not split an inconclusive answer', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 500, body: {} } });
    expect(await resolveReasoningCapability(TARGET, doFetch)).toBeNull();
    expect(probeKinds(calls)).toEqual(['bundle']);
  });
});

describe('the tools-only probe', () => {
  it('sends exactly one tools-only completion when an observation already answered reasoning', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: true }) });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: sawReasoning });
    expect(probeKinds(calls)).toEqual(['tools']);
    expect(calls.find((c) => c.url === COMPLETIONS)!.body.tool_choice).toBe('auto');
    expect(record?.reasons).toBe(true);
    expect(record?.sources.reasons).toBe('observed');
    expect(record?.tools).toBe(true);
    expect(record?.sources.tools).toBe('probe');
  });

  it('sends exactly one tools-only completion when the catalog answered reasoning', async () => {
    const catalog = parseReasoningCatalog({ p: { id: 'p', models: { m: { id: 'm', reasoning: true } } } });
    const { doFetch, calls } = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: false }) });
    const record = await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: async () => catalog });
    expect(probeKinds(calls)).toEqual(['tools']);
    expect(record?.sources.reasons).toBe('catalog');
    expect(record?.tools).toBe(false);
  });

  it('sends it when a first-party host answered reasoning by its identity', async () => {
    const url = 'https://api.anthropic.com/v1/chat/completions';
    const { doFetch, calls } = backend({ [url]: completionsAccepting({ reasoning: true, tools: true }) });
    const record = await resolveReasoningCapability({ url, token: 't', model: 'claude-opus-5' }, doFetch);
    expect(calls.filter((c) => c.url === url).map((c) => 'tools' in c.body && !('reasoning_effort' in c.body)))
      .toEqual([true]);
    expect(record?.sources.reasons).toBe('identity');
    expect(record?.tools).toBe(true);
  });
});

describe('the probe memo', () => {
  it('never re-sends a memoized tools 400 for the same endpoint and model', async () => {
    const first = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: false }) });
    await resolveReasoningCapability(TARGET, first.doFetch, { observation: sawReasoning });
    const again = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: false }) });
    const record = await resolveReasoningCapability(TARGET, again.doFetch, { observation: sawReasoning });
    expect(probeCount(again.calls)).toBe(0);
    expect(record?.tools).toBe(false);
  });

  it('never re-sends a split once its answers are memoized', async () => {
    const first = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: false }) });
    await resolveReasoningCapability(TARGET, first.doFetch);
    const again = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: false }) });
    const record = await resolveReasoningCapability(TARGET, again.doFetch);
    expect(probeCount(again.calls)).toBe(0);
    expect(record).toMatchObject({ tools: false, levels: [...SAFE_REASONING_EFFORTS] });
  });

  // The singles went down after the bundle's 400, so neither question is answered, yet the bundle is known bad.
  it('never re-sends a rejected bundle, even with both questions still open', async () => {
    const strict = completionsAccepting({ reasoning: true, tools: false });
    let singlesDown = true;
    const completions = (body: Record<string, unknown>) => {
      const bundled = 'tools' in body && 'reasoning_effort' in body;
      return !bundled && singlesDown ? { status: 503, body: {} } : strict(body);
    };
    const first = backend({ [COMPLETIONS]: completions });
    expect(await resolveReasoningCapability(TARGET, first.doFetch)).toBeNull();
    expect(probeKinds(first.calls)).toEqual(['bundle', 'reasoning', 'tools']);
    singlesDown = false;
    const again = backend({ [COMPLETIONS]: completions });
    const record = await resolveReasoningCapability(TARGET, again.doFetch);
    expect(probeKinds(again.calls)).toEqual(['reasoning', 'tools']);
    expect(record).toMatchObject({ tools: false, levels: [...SAFE_REASONING_EFFORTS] });
  });

  it('asks only the question still open after a split', async () => {
    let toolsDown = true;
    const completions = (body: Record<string, unknown>) => {
      if ('tools' in body && toolsDown) return { status: 'reasoning_effort' in body ? 400 : 503, body: {} };
      return { status: 200, body: {} };
    };
    const first = backend({ [COMPLETIONS]: completions });
    await resolveReasoningCapability(TARGET, first.doFetch);
    expect(probeKinds(first.calls)).toEqual(['bundle', 'reasoning', 'tools']);
    toolsDown = false;
    const again = backend({ [COMPLETIONS]: completions });
    const record = await resolveReasoningCapability(TARGET, again.doFetch);
    expect(probeKinds(again.calls)).toEqual(['tools']);
    expect(record?.tools).toBe(true);
  });

  // A reply answered reasons, so the memoized reasoning answer is not asked for and must not fill the levels.
  it('applies a memoized answer only to the question the chain left open', async () => {
    const first = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: true }) });
    await resolveReasoningCapability(TARGET, first.doFetch);
    const again = backend({});
    const record = await resolveReasoningCapability(TARGET, again.doFetch, { observation: sawReasoning });
    expect(probeCount(again.calls)).toBe(0);
    expect(record).toMatchObject({ reasons: true, levels: null, tools: true });
  });

  it('asks again for a different model on the same endpoint', async () => {
    const first = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: false }) });
    await resolveReasoningCapability(TARGET, first.doFetch, { observation: sawReasoning });
    const other = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: true }) });
    const record = await resolveReasoningCapability({ ...TARGET, model: 'other' }, other.doFetch, { observation: sawReasoning });
    expect(probeKinds(other.calls)).toEqual(['tools']);
    expect(record?.tools).toBe(true);
  });

  it('does not memoize an inconclusive answer', async () => {
    const first = backend({ [COMPLETIONS]: { status: 500, body: {} } });
    await resolveReasoningCapability(TARGET, first.doFetch, { observation: sawReasoning });
    const again = backend({ [COMPLETIONS]: completionsAccepting({ reasoning: true, tools: true }) });
    const record = await resolveReasoningCapability(TARGET, again.doFetch, { observation: sawReasoning });
    expect(probeKinds(again.calls)).toEqual(['tools']);
    expect(record?.tools).toBe(true);
  });
});

describe('unknown support', () => {
  it('leaves tools unanswered when the tools probe is inconclusive', async () => {
    const { doFetch } = backend({ [COMPLETIONS]: { status: 500, body: {} } });
    const record = await resolveReasoningCapability(TARGET, doFetch, { observation: sawReasoning });
    expect(record?.tools).toBeNull();
    expect(toolsSupported(record)).toBe(false);
  });

  it('reads only a yes as support', () => {
    expect(toolsSupported(null)).toBe(false);
    expect(toolsSupported(UNKNOWN_REASONING_CAPABILITY)).toBe(false);
    expect(toolsSupported({ ...UNKNOWN_REASONING_CAPABILITY, tools: false })).toBe(false);
    expect(toolsSupported({ ...UNKNOWN_REASONING_CAPABILITY, tools: true })).toBe(true);
  });
});

describe('the stored record', () => {
  const known: ReasoningCapability = {
    ...UNKNOWN_REASONING_CAPABILITY, reasons: true, levels: ['none'], tools: true,
    sources: { reasons: 'native', levels: 'native', tools: 'native' },
  };

  it('round-trips the tools answer and its source', () => {
    expect(parseReasoningCapability(JSON.parse(JSON.stringify(known)))).toEqual(known);
  });

  it('loads a record stored before the tools answer existed as unanswered, and asks it once', () => {
    const { tools: _tools, ...older } = known;
    const loaded = parseReasoningCapability({ ...older, sources: { reasons: 'native', levels: 'native' } });
    expect(loaded?.tools).toBeNull();
    expect(reasoningNeedsResolve(loaded)).toBe(true);
    expect(reasoningNeedsResolve(known)).toBe(false);
  });

  it('merges a fresh tools answer over the stored one and keeps a stored answer the fresh record lacks', () => {
    expect(mergeReasoningCapability(known, { ...known, tools: false, sources: { tools: 'probe' } }).tools).toBe(false);
    expect(mergeReasoningCapability(known, UNKNOWN_REASONING_CAPABILITY).tools).toBe(true);
  });
});
