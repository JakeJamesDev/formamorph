import { describe, expect, it, vi } from 'vitest';
import type { AiEndpointTarget, AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { reasoningCapabilityFromLevels, type ReasoningCapability } from '@/lib/reasoningEffort';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { isPickRequest, NO_PICK } from '@/test/helpFixtures';
import { askHelp, type HelpEvent } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';

const index = createDocsIndex({
  pages: { Traits: '# Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n' },
  sidebar: '- [Traits](Traits)\n',
});

/** A reasoning model on the given dialect that takes every level and a token budget. */
const reasoner = (dialect: ReasoningCapability['dialect'], over: Partial<AiEndpointTarget> = {}): AiEndpointTarget => textTarget({
  maxTokens: 1000,
  reasoning: { ...reasoningCapabilityFromLevels(['none', 'low', 'medium', 'high'], 'probe'), reasons: true, budget: true, dialect },
  ...over,
});

/** The game's own settings reason hard everywhere, so a help request that reasons less shows its own setting. */
const gameReasons = (target: AiEndpointTarget, over: Partial<AiSettingsSnapshot> = {}) =>
  textSnapshot(target, { reasoningEngaged: true, reasoningEffort: 'high', promptReasoning: { help: 'high', narration: 'high' }, ...over });

type Body = Record<string, unknown>;

/** Asks one question and returns the bodies of the pick request and the answer request, and the events. */
async function bodies(change: HelpSettingsChange, snapshot: AiSettingsSnapshot, chunks: string[] = sseReply('Open the **Traits** tab.')) {
  const sent = { pick: [] as Body[], answer: [] as Body[] };
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as Body;
    if (isPickRequest(init)) {
      sent.pick.push(body);
      return sseResponse(sseReply(NO_PICK));
    }
    sent.answer.push(body);
    return sseResponse(chunks);
  });
  const events: HelpEvent[] = [];
  for await (const event of askHelp({ question: 'How do I add a trait?', settings: helpSettingsOf(change), snapshot, index, fetchImpl: fetchImpl as unknown as typeof fetch })) {
    if (event.type !== 'trace' && event.type !== 'stage') events.push(event);
  }
  return { pick: sent.pick[0], answer: sent.answer[0], events };
}

const HIGH = { reasoning: { enabled: true, level: 'high' as const } };

describe('the reasoning of a help question', () => {
  it('sends the effort on the answer request in the dialect form, and reasoning off on the pick request', async () => {
    const { pick, answer } = await bodies({ ...HIGH, reasoningBudget: 50 }, textSnapshot(reasoner('openrouter')));
    // 50% of the endpoint's 1000-token Max Output, on top of the 800-token answer cap.
    expect(answer).toMatchObject({ reasoning: { effort: 'high', max_tokens: 500 }, max_tokens: 1300 });
    // No game prompt reasons, so the pick request's off is the zero budget alone.
    expect(pick.reasoning).toEqual({ max_tokens: 0 });
  });

  it('spells the effort for each dialect', async () => {
    expect((await bodies(HIGH, textSnapshot(reasoner('openai')))).answer.reasoning_effort).toBe('high');
    const engine = await bodies(HIGH, textSnapshot(reasoner('engine', { localEngine: true })));
    expect(engine.answer.thinking_budget_tokens).toBe(750);
    expect(engine.pick.thinking_budget_tokens).toBe(0);
  });

  it('follows Settings → Output → Native Reasoning at Global', async () => {
    const { answer } = await bodies({ reasoning: { enabled: true, level: 'global' } }, textSnapshot(reasoner('openai'), { reasoningEffort: 'medium' }));
    expect(answer.reasoning_effort).toBe('medium');
  });

  it('engages reasoning for the answer when every game prompt is off', async () => {
    const { answer } = await bodies(HIGH, textSnapshot(reasoner('openai'), { reasoningEngaged: false }));
    expect(answer.reasoning_effort).toBe('high');
  });

  it('sends reasoning off with the switch off, whatever the game and Native Reasoning say', async () => {
    for (const level of ['global', 'high'] as const) {
      const novita = await bodies({ reasoning: { enabled: false, level } }, gameReasons(reasoner('novita')));
      expect(novita.answer.enable_thinking).toBe(false);
      expect(novita.pick.enable_thinking).toBe(false);
      const openai = await bodies({ reasoning: { enabled: false, level } }, gameReasons(reasoner('openai')));
      expect(openai.answer.reasoning_effort).toBe('none');
      expect(openai.answer.max_tokens).toBe(800);
    }
  });

  it('sends reasoning off on both requests with the default settings, whatever the game reasons', async () => {
    const withoutMessages = ({ messages: _messages, ...rest }: Body) => rest;
    const openrouter = await bodies({}, gameReasons(reasoner('openrouter')));
    expect(withoutMessages(openrouter.answer)).toMatchInlineSnapshot(`
      {
        "max_tokens": 800,
        "model": "m",
        "reasoning": {
          "effort": "none",
        },
        "repeat_penalty": 1,
        "repetition_penalty": 1,
        "stream": true,
        "temperature": 0.2,
      }
    `);
    expect(withoutMessages(openrouter.pick)).toMatchInlineSnapshot(`
      {
        "max_tokens": 150,
        "model": "m",
        "reasoning": {
          "effort": "none",
        },
        "repeat_penalty": 1,
        "repetition_penalty": 1,
        "stream": true,
        "temperature": 0.2,
      }
    `);
    const engine = await bodies({}, gameReasons(reasoner('engine', { localEngine: true })));
    expect(withoutMessages(engine.answer)).toMatchInlineSnapshot(`
      {
        "max_tokens": 800,
        "min_p": 0.05,
        "model": "m",
        "repeat_penalty": 1,
        "repetition_penalty": 1,
        "stream": true,
        "temperature": 0.2,
        "thinking_budget_tokens": 0,
        "top_k": 40,
        "top_p": 0.95,
      }
    `);
    expect(withoutMessages(engine.pick)).toMatchInlineSnapshot(`
      {
        "max_tokens": 150,
        "min_p": 0.05,
        "model": "m",
        "repeat_penalty": 1,
        "repetition_penalty": 1,
        "stream": true,
        "temperature": 0.2,
        "thinking_budget_tokens": 0,
        "top_k": 40,
        "top_p": 0.95,
      }
    `);
  });

  it('sends the native reasoning text with the answer events', async () => {
    const { events } = await bodies(HIGH, textSnapshot(reasoner('openai')), [
      sseFrame({ reasoning_content: 'The Traits page has the steps.' }),
      ...sseReply('Open the **Traits** tab.'),
    ]);
    expect(events[0]).toEqual({ type: 'answer', text: '', flagged: false, reasoning: 'The Traits page has the steps.' });
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Open the **Traits** tab.', reasoning: 'The Traits page has the steps.' });
  });
});
