import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderMiddlePanel, stubChatLayout, worldFixture, type Settings, type TurnFixture } from '@/test/gamePanels';
import type { ScriptTell } from '@/lib/scriptTells';
import type { MediaList } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

/** Before and After images land around the turn's narration, in both layouts. */

const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock.', turnId: 't1' },
  { action: 'I step onto the pier.', narration: 'Boards creak under you.', turnId: 't2' },
];

const MEDIA: MediaList = {
  'm-harbor': { id: 'm-harbor', name: 'Harbor', kind: 'image', data: 'data:image/png;base64,AAAA' },
  'm-gull': { id: 'm-gull', name: 'Gull', kind: 'image', data: 'data:image/png;base64,BBBB' },
};
const world = { worldOverview: { ...worldFixture().worldOverview, mediaList: MEDIA } };

const TELLS: ScriptTell[] = [
  { text: 'A bell rings.', timing: 'before' },
  { image: 'm-harbor', size: 'large', wrap: 'block', timing: 'before' },
  { image: 'm-gull', size: 'small', wrap: 'block', timing: 'after' },
  { text: 'The gull leaves.', timing: 'after' },
];

/** Every image, tell and narration line of the page, in document order. */
function order(scope: HTMLElement): string[] {
  return [...scope.querySelectorAll('[data-testid="narration"], [data-testid="script-tell"], [data-testid="script-image"] img')]
    .map((node) => (node instanceof HTMLImageElement ? `image ${node.alt}` : node.textContent ?? ''));
}

const EXPECTED = ['image Harbor', 'Boards creak under you.', 'A bell rings.', 'image Gull', 'The gull leaves.'];

describe('Script images: Pages', () => {
  it('puts a Before image above the narration, and After images below in call order with the tells', async () => {
    renderMiddlePanel({}, { turns: TURNS, world, seed: (play) => play.setScriptTells({ t2: TELLS }) });
    await screen.findByText('Boards creak under you.');
    expect(order(document.body)).toEqual(EXPECTED);
  });

  it('shows the sent turn’s Before image before its narration lands', async () => {
    // The sent turn's page has no narration yet, so GameViewer passes no committed turn id.
    renderMiddlePanel({ liveTurnId: 't-live', sceneTurnId: undefined }, {
      turns: TURNS.slice(0, 1), world,
      seed: (play) => {
        play.setScriptTells({ 't-live': [TELLS[1]] });
        play.setFullMessageHistory((history) => [...history, { role: 'user', content: 'I wait.' }]);
      },
    });
    expect(await screen.findByRole('img', { name: 'Harbor' })).toBeInTheDocument();
  });
});

describe('Script images: Chat', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());
  const chat = (settings: Settings) => settings.setNarrationLayout('chat');

  it('puts a Before image above the narration bubble, and After images below it, on that turn alone', async () => {
    renderMiddlePanel({}, { turns: TURNS, world, settings: chat, seed: (play) => play.setScriptTells({ t2: TELLS }) });
    const turns = await screen.findAllByRole('article');
    expect(order(turns[1])).toEqual(EXPECTED);
    expect(order(turns[0])).toEqual(['The ferry bumps the dock.']);
    expect(within(turns[1]).getByText('I step onto the pier.').compareDocumentPosition(within(turns[1]).getByRole('img', { name: 'Harbor' })))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('shows the sent turn’s Before image under its action before the narration lands', async () => {
    renderMiddlePanel({ liveTurnId: 't-live' }, {
      turns: TURNS.slice(0, 1), world, settings: chat,
      seed: (play) => {
        play.setScriptTells({ 't-live': [TELLS[1]] });
        play.setFullMessageHistory((history) => [...history, { role: 'user', content: 'I wait.' }]);
      },
    });
    const turns = await screen.findAllByRole('article');
    expect(within(turns[1]).getByRole('img', { name: 'Harbor' })).toBeInTheDocument();
  });
});
