import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_CHAT_URL, TURN_HEADER } from '@/lib/hostedAi/hostedUrls';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import AuthService from '@/services/AuthService';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { isPickRequest, NO_PICK } from '@/test/helpFixtures';
import { askHelp } from './helpSession';
import { helpSettingsOf } from './helpSettings';

const index = createDocsIndex({
  pages: { Library: '# Library\n\nYour tiles.\n\n## How to Import a World\n\n1. Select **Import**.\n' },
  sidebar: '- [Library](Library)\n',
});

const snapshot = textSnapshot(textTarget({
  endpointId: 'formamorph-ai', url: HOSTED_CHAT_URL, apiToken: '', model: 'entry-1', maxTokens: 400, hosted: true,
  reasoning: UNKNOWN_REASONING_CAPABILITY,
}));

afterEach(() => { AuthService.token = null; hostedSession.reset(); });

describe('help questions on Formamorph AI', () => {
  it('make each question its own turn, with the pick and the answer sharing it', async () => {
    AuthService.token = 'token-a';
    let issued = 0;
    const sent: Array<{ pick: boolean; turn: string | undefined; auth: string | undefined }> = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      sent.push({ pick: isPickRequest(init), turn: headers[TURN_HEADER], auth: headers.Authorization });
      const response = sseResponse(sseReply(isPickRequest(init) ? NO_PICK : 'Select **Import**.'));
      // The proxy issues an id to each call that opens a turn.
      if (!headers[TURN_HEADER]) response.headers.set(TURN_HEADER, `turn-${++issued}`);
      return response;
    }) as unknown as typeof fetch;

    for (const question of ['How do I import a world?', 'And export one?']) {
      for await (const event of askHelp({ question, settings: helpSettingsOf({}), snapshot, index, fetchImpl })) void event;
    }

    expect(sent).toEqual([
      { pick: true, turn: undefined, auth: 'Bearer token-a' },
      { pick: false, turn: 'turn-1', auth: 'Bearer token-a' },
      { pick: true, turn: undefined, auth: 'Bearer token-a' },
      { pick: false, turn: 'turn-2', auth: 'Bearer token-a' },
    ]);
  });
});
