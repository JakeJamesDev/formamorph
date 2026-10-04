import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { resolvePromptEndpoint, routeMap, type ActiveEndpointState } from '@/lib/promptEndpoints';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { TextEndpointPresetStore, TextEndpointValues } from '@/lib/textEndpointPresets';
import { sseReply, sseResponse, textSnapshot } from '@/test/aiTextFixtures';
import { isPickRequest, NO_PICK } from '@/test/helpFixtures';
import type { AIRequestType } from '@/types';
import { askHelp, type HelpEvent } from './helpSession';
import { helpSettingsOf, SAME_AS_ANSWER, type HelpSettingsChange } from './helpSettings';

const index = createDocsIndex({
  pages: { Library: '# Library\n\nYour tiles.\n\n## How to Import a World\n\n1. Select **Import**.\n' },
  sidebar: '- [Library](Library)\n',
});

const values = (host: string): TextEndpointValues => ({
  endpoint: `http://${host}.test/v1`, apiToken: '', model: `${host}-model`, contextWindowOverride: null,
  maxOutputOverride: { enabled: false, value: 1000 }, samplerOverrides: defaultEndpointSamplerOverrides(),
});

// The game plays on "game"; the help routes can name "big" and "small".
const store: TextEndpointPresetStore = {
  activeId: 'game',
  presets: ['game', 'big', 'small'].map((id) => ({ id, name: id, values: values(id) })),
};
const active: ActiveEndpointState = {
  activeId: 'game', values: values('game'), isBuiltIn: false, localEngine: false,
  maxTokens: undefined, engineMaxTokens: 512, engineModelId: '',
};

/** Only "big" is known to take function calls. */
const TAKES_TOOLS = new Set(['big-model']);

/** A snapshot whose targets come from the routing resolver the app uses. */
const snapshot = textSnapshot(undefined, {
  resolveTarget: (kind: AIRequestType, routes?: readonly string[]) => {
    const resolved = resolvePromptEndpoint(kind, routes ? routeMap(kind, routes, store) : {}, store, active);
    return {
      endpointId: resolved.endpointId, url: `${resolved.endpoint}/chat/completions`, apiToken: resolved.apiToken,
      model: resolved.model, maxTokens: resolved.maxTokens, localEngine: resolved.localEngine,
      samplerOverrides: resolved.samplerOverrides,
      reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: TAKES_TOOLS.has(resolved.model), sources: { tools: 'native' } },
    };
  },
});

/** Every request one question sends: its URL and its body. */
async function requests(settings: HelpSettingsChange, through: typeof snapshot) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => sseResponse(sseReply(isPickRequest(init) ? NO_PICK : 'Select **Import**.')));
  for await (const event of askHelp({ question: 'How do I import a world?', settings: helpSettingsOf(settings), snapshot: through, index, fetchImpl: fetchImpl as unknown as typeof fetch })) void event;
  return fetchImpl.mock.calls.map(([url, init]) => ({ url, body: JSON.parse(init.body as string) as unknown }));
}

/** Asks one question and returns the host each request went to, by kind. */
async function hosts(change: HelpSettingsChange) {
  const sent: { pick: string[]; answer: string[]; answerBodies: Record<string, unknown>[] } = { pick: [], answer: [], answerBodies: [] };
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const host = new URL(url).hostname.replace('.test', '');
    if (isPickRequest(init)) {
      sent.pick.push(host);
      return sseResponse(sseReply(NO_PICK));
    }
    sent.answer.push(host);
    sent.answerBodies.push(JSON.parse(init.body as string) as Record<string, unknown>);
    return sseResponse(sseReply('Select **Import**.'));
  });
  const events: HelpEvent[] = [];
  for await (const event of askHelp({ question: 'How do I import a world?', settings: helpSettingsOf(change), snapshot, index, fetchImpl: fetchImpl as unknown as typeof fetch })) {
    events.push(event);
  }
  return { ...sent, events };
}

describe('the help routes', () => {
  it('send both requests to the active endpoint by default', async () => {
    const sent = await hosts({});
    expect(sent).toMatchObject({ pick: ['game'], answer: ['game'] });
  });

  it('send the same requests by default as the help kind sent before it had routes', async () => {
    const unrouted = { ...snapshot, resolveTarget: (kind: AIRequestType) => snapshot.resolveTarget(kind) };
    const sent = await requests({}, snapshot);
    expect(sent).toHaveLength(2);
    expect(sent).toEqual(await requests({}, unrouted));
  });

  it('send picks where answers go when only the answer endpoint is set', async () => {
    const sent = await hosts({ answerEndpoint: 'small' });
    expect(sent).toMatchObject({ pick: ['small'], answer: ['small'] });
  });

  it('send the two requests to two endpoints when the pick endpoint is set', async () => {
    const sent = await hosts({ answerEndpoint: 'big', pickEndpoint: 'small' });
    expect(sent).toMatchObject({ pick: ['small'], answer: ['big'] });
  });

  it('send picks to the active endpoint with Follow Active, whatever the answer route', async () => {
    const sent = await hosts({ answerEndpoint: 'big', pickEndpoint: null });
    expect(sent).toMatchObject({ pick: ['game'], answer: ['big'] });
  });

  it('read a deleted preset as the default of its route, with no error', async () => {
    expect(await hosts({ answerEndpoint: 'deleted' })).toMatchObject({ pick: ['game'], answer: ['game'] });
    const sent = await hosts({ answerEndpoint: 'big', pickEndpoint: 'deleted' });
    expect(sent).toMatchObject({ pick: ['big'], answer: ['big'] });
    expect(sent.events.at(-1)).toMatchObject({ type: 'done', stopped: false });
  });

  it('offer the guide lookup by what the answer endpoint takes, not the active one', async () => {
    const routed = await hosts({ lookup: true, mascot: false, answerEndpoint: 'big', pickEndpoint: SAME_AS_ANSWER });
    expect(routed.answerBodies[0].tools).toHaveLength(1);
    const followed = await hosts({ lookup: true, mascot: false, pickEndpoint: 'big' });
    expect(followed.answerBodies[0].tools).toBeUndefined();
  });
});
