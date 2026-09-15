import { describe, it, expect, beforeEach } from 'vitest';
import { reasoningIdentityAnswer } from './reasoningIdentity';
import { resolveReasoningCapability } from './reasoningEffort';
import { resetProbeMemo } from './probeMemo';
import { reasoningBackend as backend } from '@/test/reasoningBackend';

/**
 * Moonshot is the one first-party host whose model id decides both the dialect and whether the model may be
 * switched off. Every case here names a fixed host and a fixed model id, so none of it reaches the network.
 *
 * Sources, read live on 2026-09-15: Kimi's chat API reference at platform.kimi.ai. k3 takes `reasoning_effort`
 * with `low`, `high`, and `max`, and always reasons. k2.6 switches thinking with `thinking.type`. k2.7-code
 * accepts `enabled` alone and errors on `disabled`.
 */

const GLOBAL = 'https://api.moonshot.ai/v1/chat/completions';
const CHINA = 'https://api.moonshot.cn/v1/chat/completions';

describe('Moonshot model ids name the dialect', () => {
  it.each([GLOBAL, CHINA])('claims the flagship on %s', (url) => {
    expect(reasoningIdentityAnswer(url, 'kimi-k3')).toMatchObject({ dialect: 'moonshot-k3', reasons: true });
  });

  it('reads the rolling alias as the flagship, since that is what it points at', () => {
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-latest')).toMatchObject({ dialect: 'moonshot-k3' });
  });

  it.each(['kimi-k2.6', 'kimi-k2-thinking', 'kimi-k2.7-code'])('reads %s as the k2 dialect', (model) => {
    expect(reasoningIdentityAnswer(GLOBAL, model)).toMatchObject({ dialect: 'moonshot-k2', reasons: true });
  });

  // The high-speed build is the same model with the same thinking rules, so it must not fall through to the
  // plain-k2 bucket and lose its controls.
  it('keeps the high-speed code build with the code model it is a build of', () => {
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-k2.7-code-highspeed'))
      .toMatchObject({ dialect: 'moonshot-k2', offAllowed: false });
  });

  // The plain k2 builds and the pre-Kimi line all lack a thinking parameter, so none of them gets controls.
  it.each([
    'kimi-k2', 'kimi-k2-0905', 'kimi-k2-0905-preview', 'kimi-k2-0711-preview', 'kimi-k2-turbo-preview',
    'moonshot-v1-8k', 'moonshot-v1-128k', 'moonshot-v1-auto', 'moonshot-v1-32k-vision-preview',
  ])('rules %s out, since it does not reason at all', (model) => {
    expect(reasoningIdentityAnswer(GLOBAL, model)).toMatchObject({ reasons: false, levels: [] });
  });

  // The thinking build shares the plain family's prefix, so the whole-id match must not swallow it.
  it('keeps the thinking build out of the plain k2 bucket it shares a prefix with', () => {
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-k2-thinking')).toMatchObject({ dialect: 'moonshot-k2' });
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-k2-thinking-turbo')).toMatchObject({ dialect: 'moonshot-k2' });
  });

  it('matches whatever case and padding the model field carries', () => {
    expect(reasoningIdentityAnswer(GLOBAL, '  Kimi-K2.6  ')).toMatchObject({ dialect: 'moonshot-k2' });
  });
});

describe('Moonshot claims only its own host and its own models', () => {
  it('claims nothing for a Kimi id served from somewhere else, which speaks that host\'s dialect', () => {
    expect(reasoningIdentityAnswer('https://openrouter.ai/api/v1/chat/completions', 'kimi-k3')).toBeNull();
    expect(reasoningIdentityAnswer('http://localhost:1234/v1/chat/completions', 'kimi-k2.6')).toBeNull();
  });

  // An unnamed id is left open rather than ruled out, so a model Moonshot adds later keeps its controls.
  it('claims nothing for an id this row does not name, so the chain carries on', () => {
    expect(reasoningIdentityAnswer(GLOBAL, 'gpt-4o')).toBeNull();
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-k9-imaginary')).toBeNull();
  });
});

describe('the k3 ladder is exactly what the endpoint accepts', () => {
  /**
   * The guard. k3 takes three rungs and no more: a fourth in this list puts a level in the dropdown that
   * fails the turn when a player picks it. `none` is absent on purpose — k3 always reasons, and its off comes
   * from the dialect row's refusal, never from a level the record cleared for sending.
   */
  it('lists low, high, and max, and nothing else', () => {
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-k3')?.levels).toEqual(['low', 'high', 'max']);
  });

  it('offers no strength at all on k2, which takes no effort field', () => {
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-k2.6')?.levels).toEqual([]);
  });

  it('names no token budget on either dialect, since Moonshot takes none', () => {
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-k3')?.budget).toBe(false);
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-k2.6')?.budget).toBe(false);
  });
});

describe('off is allowed per model, not per host', () => {
  // k2.6 is the only Kimi model that takes the switch. The other two reasoning models error on `disabled`,
  // and k3 refuses off through its own dialect row.
  it('lets k2.6 be switched off', () => {
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-k2.6')?.offAllowed).toBe(true);
  });

  it.each(['kimi-k2-thinking', 'kimi-k2.7-code'])('refuses off on %s', (model) => {
    expect(reasoningIdentityAnswer(GLOBAL, model)?.offAllowed).toBe(false);
  });

  // k3's refusal is the dialect row's, so the row says nothing of its own and the two cannot disagree.
  it('leaves k3 to its dialect row rather than answering twice', () => {
    expect(reasoningIdentityAnswer(GLOBAL, 'kimi-k3')?.offAllowed).toBeUndefined();
  });
});

describe('the resolver reaches the Moonshot answer without a request', () => {
  beforeEach(() => resetProbeMemo());

  /** Nothing answers any URL, so only a source that needs no request can produce a record here. */
  const silent = () => backend({});
  const target = (model: string) => ({ url: GLOBAL, token: 't', model });

  it('names the k3 dialect and its ladder from the host and the id alone', async () => {
    const { doFetch, calls } = silent();
    const record = await resolveReasoningCapability(target('kimi-k3'), doFetch);
    expect(record).toMatchObject({
      dialect: 'moonshot-k3', reasons: true, budget: false, levels: ['low', 'high', 'max'],
    });
    expect(record?.sources.dialect).toBe('identity');
    expect(record?.sources.levels).toBe('identity');
    // Identity beats every source that costs a request, so none is sent.
    expect(calls).toHaveLength(0);
  });

  it('carries the per-model off answer onto the record, sourced to identity', async () => {
    const { doFetch } = silent();
    const record = await resolveReasoningCapability(target('kimi-k2-thinking'), doFetch);
    expect(record).toMatchObject({ dialect: 'moonshot-k2', offAllowed: false });
    expect(record?.sources.offAllowed).toBe('identity');

    const open = silent();
    const k26 = await resolveReasoningCapability(target('kimi-k2.6'), open.doFetch);
    expect(k26).toMatchObject({ dialect: 'moonshot-k2', offAllowed: true });
  });

  it('rules a non-reasoning k2 out, so the controls give way to the note', async () => {
    const { doFetch } = silent();
    const record = await resolveReasoningCapability(target('kimi-k2-0905'), doFetch);
    expect(record).toMatchObject({ reasons: false, levels: [] });
  });

  it('leaves a model the host does not publish to the rest of the chain', async () => {
    const { doFetch } = backend({
      'https://api.moonshot.ai/v1/models': { status: 200, body: { data: [{ id: 'gpt-5', max_model_len: 4096 }] } },
    });
    const record = await resolveReasoningCapability(target('gpt-5'), doFetch);
    expect(record?.sources.dialect).not.toBe('identity');
  });
});
