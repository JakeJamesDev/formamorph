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
    events.push(event);
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

  it('sends the default settings as the help kind sent them before it had a reasoning setting', async () => {
    // Bodies recorded at the base commit of this change, with the game reasoning hard everywhere.
    const openrouter = await bodies({}, gameReasons(reasoner('openrouter')));
    expect(openrouter.answer).toMatchObject({ max_tokens: 800, reasoning: { effort: 'none' } });
    expect(openrouter.pick).toMatchObject({ reasoning: { effort: 'none' } });
    const engine = await bodies({}, gameReasons(reasoner('engine', { localEngine: true })));
    expect(engine.answer).toMatchObject({ max_tokens: 800, thinking_budget_tokens: 0 });
    expect(engine.pick).toMatchObject({ thinking_budget_tokens: 0 });
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
