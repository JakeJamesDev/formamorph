import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { setGameplayText } from '@/lib/gameplayTextStore';
import { renderMiddlePanel, stubChatLayout, worldFixture, type Settings, type TurnFixture } from '@/test/gamePanels';
import type { ScriptImageTell, ScriptTell } from '@/lib/scriptTells';
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

/** During AI Output images land inside the narration, after their anchor sentence. */

const NARRATED: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock.', turnId: 't1' },
  { action: 'I step onto the pier.', narration: 'Boards creak. A gull cries. Rain starts.', turnId: 't2' },
];

const inline = (image: string, sentence: number): ScriptImageTell => ({ image, size: 'medium', wrap: 'block', sentence, timing: 'output' });

/** The narration's paragraphs and images, in document order. */
function inlineOrder(scope: HTMLElement): string[] {
  const narration = within(scope).getByTestId('narration');
  return [...narration.querySelectorAll('p, img')].map((node) => (node instanceof HTMLImageElement ? `image ${node.alt}` : node.textContent ?? ''));
}

describe('Script images: During AI Output, Pages', () => {
  it('puts an image after its sentence and before the next', async () => {
    renderMiddlePanel({}, { turns: NARRATED, world, seed: (play) => play.setScriptTells({ t2: [inline('m-harbor', 1)] }) });
    await screen.findByRole('img', { name: 'Harbor' });
    expect(inlineOrder(document.body)).toEqual(['Boards creak. A gull cries.', 'image Harbor', 'Rain starts.']);
  });

  it('stacks two images on one sentence in call order', async () => {
    renderMiddlePanel({}, { turns: NARRATED, world, seed: (play) => play.setScriptTells({ t2: [inline('m-gull', 0), inline('m-harbor', 0)] }) });
    await screen.findByRole('img', { name: 'Harbor' });
    expect(inlineOrder(document.body)).toEqual(['Boards creak.', 'image Gull', 'image Harbor', 'A gull cries. Rain starts.']);
  });

  it('cuts nothing for an image no longer on the Media List', async () => {
    renderMiddlePanel({}, { turns: NARRATED, world, seed: (play) => play.setScriptTells({ t2: [inline('m-gone', 0)] }) });
    await screen.findByText('Boards creak. A gull cries. Rain starts.');
    expect(screen.queryByTestId('script-image')).toBeNull();
  });

  it('keeps a live image out of the DOM until the reveal releases its sentence', async () => {
    renderMiddlePanel({ liveTurnId: 't2', liveShows: [inline('m-harbor', 1)] }, {
      turns: NARRATED, world,
      seed: (play) => { play.setIsRevealingNarration(true); setGameplayText('Boards creak.'); },
    });
    await waitFor(() => expect(screen.getByTestId('narration').textContent).toBe('Boards creak.'));
    expect(screen.queryByRole('img', { name: 'Harbor' })).toBeNull();
    act(() => setGameplayText('Boards creak. A gull cries. Rain'));
    expect(await screen.findByRole('img', { name: 'Harbor' })).toBeInTheDocument();
  });
});

const floated = (image: string, sentence: number, wrap: 'left' | 'right', size: 'small' | 'medium' | 'large' = 'medium'): ScriptImageTell =>
  ({ image, size, wrap, sentence, timing: 'output' });

describe('Script images: floats', () => {
  it('floats a left image and a right image, with the text after each as a sibling run', async () => {
    renderMiddlePanel({}, { turns: NARRATED, world, seed: (play) => play.setScriptTells({ t2: [floated('m-harbor', 0, 'left'), floated('m-gull', 1, 'right', 'small')] }) });
    const harbor = (await screen.findByRole('img', { name: 'Harbor' })).closest('figure');
    const gull = screen.getByRole('img', { name: 'Gull' }).closest('figure');
    expect(harbor).toHaveAttribute('data-wrap', 'left');
    expect(harbor).toHaveClass('float-left');
    expect(gull).toHaveAttribute('data-wrap', 'right');
    expect(gull).toHaveClass('float-right');
    expect(inlineOrder(document.body)).toEqual(['Boards creak.', 'image Harbor', 'A gull cries.', 'image Gull', 'Rain starts.']);
  });

  it('turns a float into a block below the mobile breakpoint', async () => {
    renderMiddlePanel({}, { turns: NARRATED, world, seed: (play) => play.setScriptTells({ t2: [floated('m-harbor', 0, 'left')] }) });
    const figure = (await screen.findByRole('img', { name: 'Harbor' })).closest('figure');
    expect(figure).toHaveClass('max-md:float-none', 'max-md:mx-auto');
  });

  it('keeps a large image a block even when it asks to float', async () => {
    renderMiddlePanel({}, { turns: NARRATED, world, seed: (play) => play.setScriptTells({ t2: [floated('m-harbor', 0, 'right', 'large')] }) });
    const figure = (await screen.findByRole('img', { name: 'Harbor' })).closest('figure');
    expect(figure).toHaveAttribute('data-wrap', 'block');
    expect(figure).not.toHaveClass('float-right');
    // A block makes its own formatting context, so it sits beside an earlier float and never under it.
    expect(figure).toHaveClass('flow-root');
  });

  it('holds a float on the last sentence inside the narration, so it never reaches the turn below', async () => {
    renderMiddlePanel({}, { turns: NARRATED, world, seed: (play) => play.setScriptTells({ t2: [floated('m-harbor', 2, 'left')] }) });
    const figure = (await screen.findByRole('img', { name: 'Harbor' })).closest('figure');
    expect(figure?.parentElement).toHaveClass('flow-root');
    expect(screen.getByTestId('narration').contains(figure)).toBe(true);
  });
});

describe('Script images: floats, Chat', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());

  it('floats an image inside the turn’s bubble', async () => {
    renderMiddlePanel({}, {
      turns: NARRATED, world, settings: (settings) => settings.setNarrationLayout('chat'),
      seed: (play) => play.setScriptTells({ t2: [floated('m-harbor', 0, 'right')] }),
    });
    const turns = await screen.findAllByRole('article');
    const figure = within(turns[1]).getByRole('img', { name: 'Harbor' }).closest('figure');
    expect(figure).toHaveClass('float-right');
    expect(figure?.parentElement).toHaveClass('flow-root');
  });
});

describe('Script images: During AI Output, Chat', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());

  it('puts an image after its sentence inside that turn’s bubble', async () => {
    renderMiddlePanel({}, {
      turns: NARRATED, world, settings: (settings) => settings.setNarrationLayout('chat'),
      seed: (play) => play.setScriptTells({ t2: [inline('m-harbor', 1)] }),
    });
    const turns = await screen.findAllByRole('article');
    expect(inlineOrder(turns[1])).toEqual(['Boards creak. A gull cries.', 'image Harbor', 'Rain starts.']);
    expect(inlineOrder(turns[0])).toEqual(['The ferry bumps the dock.']);
  });
});
