import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { openDocs } from '@/lib/formaquestion/docsOpener';
import { composeMascot, DEFAULT_MASCOT_RIG } from '@/lib/formaquestion/mascot';
import { mascotImageUrl } from '@/lib/formaquestion/mascotAssets';
import { NARROW_WIDTH } from '@/lib/formaquestion/windowBox';
import { sseFrame, sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { openHelpSettings, stubHelpStream, storeFramedWindow } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Traits](Traits)\n' }));

const BOX_KEY = 'formamorph.formaquestion.window';
/** The default base is 888 by 1184. */
const ASPECT = 0.75;

const helpWindow = () => screen.getByRole('dialog', { name: 'Formaquestion' });
const conversation = () => screen.getByRole('log', { name: 'Conversation' });
const mascot = () => helpWindow().querySelector<HTMLElement>('[data-fq-piece="mascot"]');
const column = () => helpWindow().querySelector<HTMLElement>('[data-fq-piece="column"]')!;
const pill = () => helpWindow().querySelector<HTMLElement>('[data-fq-drag]')!;
const drawn = () => [...mascot()!.querySelectorAll('img')].map((image) => image.getAttribute('src'));

async function openWindow() {
  const view = render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  return { view, field };
}

/** jsdom loads no image, so the base reports its natural size here. */
function loadBase() {
  const base = mascot()!.querySelector('img')!;
  Object.defineProperty(base, 'naturalWidth', { configurable: true, value: 888 });
  Object.defineProperty(base, 'naturalHeight', { configurable: true, value: 1184 });
  fireEvent.load(base);
}

async function send(field: HTMLElement, question: string) {
  await userEvent.type(field, question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

async function setMascot(on: boolean) {
  await openHelpSettings();
  const dialog = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
  const box = within(dialog).getByRole('checkbox', { name: 'Mascot' });
  if ((box.getAttribute('aria-checked') === 'true') !== on) await userEvent.click(box);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(helpWindow()).toHaveAttribute('data-state', 'open'));
}

beforeEach(() => {
  localStorage.clear();
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the minimal chrome', () => {
  it('shows the column, the pill and the Mascot drawing the Idle look, with no frame, tabs or grip', async () => {
    await openWindow();
    expect(helpWindow()).toHaveAttribute('data-fq-chrome', 'minimal');
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Formaquestion' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Wide View' })).toBeNull();
    expect(helpWindow().querySelector('[data-fq-resize]')).toBeNull();
    expect(within(pill()).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['More Actions', 'Close Formaquestion']);
    expect(drawn()).toEqual(composeMascot(DEFAULT_MASCOT_RIG, 'answering', null).map(mascotImageUrl));
  });

  it('stands the Mascot left of the column at the base aspect and the column height', async () => {
    await openWindow();
    loadBase();
    const { left, width, height } = helpWindow().style;
    const columnHeight = parseFloat(height);
    expect(mascot()!.style.height).toBe(height);
    expect(mascot()!.style.width).toBe(`${columnHeight * ASPECT}px`);
    expect(parseFloat(width)).toBe(columnHeight * ASPECT + NARROW_WIDTH);
    // The column keeps its default place; the shared box widens to its left.
    expect(parseFloat(left) + columnHeight * ASPECT).toBe(window.innerWidth - NARROW_WIDTH - 44);
    expect(mascot()!.compareDocumentPosition(column()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens with the Mascot when storage is blocked, since the settings read as defaults', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    await openWindow();
    expect(helpWindow()).toHaveAttribute('data-fq-chrome', 'minimal');
    expect(mascot()).not.toBeNull();
  });

  it('moves both pieces by the pill, and the stored box is the column, which survives a remount', async () => {
    const { view } = await openWindow();
    loadBase();
    const before = parseFloat(helpWindow().style.left);
    fireEvent.pointerDown(pill(), { button: 0, pointerId: 1, clientX: 900, clientY: 200 });
    fireEvent.pointerMove(pill(), { pointerId: 1, clientX: 860, clientY: 180 });
    fireEvent.pointerUp(pill(), { pointerId: 1 });
    expect(parseFloat(helpWindow().style.left)).toBe(before - 40);

    const stored = JSON.parse(localStorage.getItem(BOX_KEY)!) as { x: number; w: number };
    expect(stored.w).toBe(NARROW_WIDTH);
    expect(stored.x).toBe(before - 40 + parseFloat(mascot()!.style.width));

    view.unmount();
    await openWindow();
    loadBase();
    expect(parseFloat(helpWindow().style.left)).toBe(before - 40);
  });

  it('names the sources of an answer without opening them, and sends a docs request to the wiki', async () => {
    stubHelpStream([sseFrame({ content: '1. Open the **Traits** tab.\n' }), ...sseReply('2. Select **Add Trait**.')]);
    const browse = vi.fn();
    vi.stubGlobal('open', browse);
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');

    const sources = await within(conversation()).findByRole('group', { name: 'Sources' });
    expect(within(sources).getByText('How to Add a Trait')).toBeInTheDocument();
    expect(within(sources).queryByRole('button', { name: /How to Add a Trait/ })).toBeNull();

    act(() => { openDocs({ page: 'Traits', anchor: 'how-to-add-a-trait' }); });
    expect(browse).toHaveBeenCalledWith(expect.stringContaining('/wiki/Traits#how-to-add-a-trait'), '_blank', 'noopener,noreferrer');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('shows the column alone on a mobile-size screen', async () => {
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    await openWindow();
    expect(helpWindow()).toHaveAttribute('data-fq-sheet');
    expect(helpWindow()).toHaveAttribute('data-fq-chrome', 'minimal');
    expect(mascot()).toBeNull();
    expect(helpWindow().querySelector('[data-fq-drag] svg.lucide-grip-horizontal')).toBeNull();
  });
});

describe('the Mascot switch', () => {
  it('shows today\'s window while off', async () => {
    storeFramedWindow();
    await openWindow();
    expect(helpWindow()).not.toHaveAttribute('data-fq-chrome');
    expect(screen.getByRole('tablist', { name: 'Formaquestion Parts' })).toBeInTheDocument();
    expect(mascot()).toBeNull();
  });

  it('swaps the chrome in place both ways and keeps the conversation', async () => {
    stubHelpStream(sseReply('Open the Traits tab.'));
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(conversation()).toHaveTextContent('Open the Traits tab.'));

    await setMascot(false);
    expect(helpWindow()).not.toHaveAttribute('data-fq-chrome');
    expect(conversation()).toHaveTextContent('How do I add a trait?');
    expect(conversation()).toHaveTextContent('Open the Traits tab.');

    await setMascot(true);
    expect(helpWindow()).toHaveAttribute('data-fq-chrome', 'minimal');
    expect(conversation()).toHaveTextContent('How do I add a trait?');
    expect(conversation()).toHaveTextContent('Open the Traits tab.');
  });
});
