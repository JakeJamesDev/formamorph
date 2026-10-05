import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { openHelpSettings, storeMinimalWindow, stubHelpStream } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Settings: '# ⚙️ Settings\n\nSettings hold your options.\n\n## How to Change the Theme\n\n<!-- route: settings.display -->\n\n1. Open the **Display** tab.\n2. Pick a theme.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Settings](Settings)\n- [Traits](Traits)\n' }));

const WINDOW_KEY = 'formamorph.formaquestion.window';
const SCALE_KEY = 'formamorph.formaquestion.mascotScale';

const helpWindow = () => screen.getByRole('dialog', { name: 'Formaquestion' });
const piece = (name: string) => helpWindow().querySelector<HTMLElement>(`[data-fq-${name}]`);
const bubble = () => helpWindow().querySelector<HTMLElement>('[data-fq-piece="bubble"]');
const mascot = () => helpWindow().querySelector<HTMLElement>('[data-fq-piece="mascot"]');
const strip = () => piece('strip');
const left = () => parseFloat(helpWindow().style.left);

async function openWindow() {
  const view = render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  return { view, field };
}

async function ask(field: HTMLElement, question: string) {
  await userEvent.type(field, question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled());
}

function drag(handle: HTMLElement, dx: number, dy: number) {
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 800, clientY: 500 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 800 + dx, clientY: 500 + dy });
  fireEvent.pointerUp(handle, { pointerId: 1 });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('innerWidth', 1600);
  vi.stubGlobal('innerHeight', 900);
  ai.current = helpAi({ revalidate: vi.fn(async () => true), requestSurface: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the bubble chrome', () => {
  it('is the Auto chrome with the Mascot on, and shows her and the ask input alone before any exchange', async () => {
    await openWindow();
    expect(helpWindow()).toHaveAttribute('data-fq-chrome', 'bubble');
    expect(mascot()).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(bubble()).toBeNull();
    expect(strip()).toBeNull();
    expect(screen.queryByRole('note', { name: 'Your Question' })).toBeNull();
  });

  it('speaks the newest answer from the bubble, with its question under it and Sources and Take Me There in the strip', async () => {
    const { field } = await openWindow();
    stubHelpStream(sseReply('Open the **Traits** tab.'));
    await ask(field, 'How do I add a trait?');
    await waitFor(() => expect(bubble()).toHaveTextContent('Open the Traits tab.'));
    stubHelpStream(sseReply('Open the **Display** tab.'));
    await ask(field, 'How do I change the theme?');
    await waitFor(() => expect(within(strip()!).getByRole('button', { name: 'Take Me There' })).toBeInTheDocument());

    expect(bubble()).toHaveTextContent('Open the Display tab.');
    expect(bubble()).not.toHaveTextContent('Open the Traits tab.');
    expect(screen.getByRole('note', { name: 'Your Question' })).toHaveTextContent('How do I change the theme?');
    expect(within(strip()!).getByRole('button', { name: /^Sources \(\d+\)$/ })).toHaveAttribute('aria-expanded', 'false');
    expect(within(bubble()!).queryByRole('group', { name: 'Sources' })).toBeNull();
    expect(bubble()!.querySelector('[data-radix-scroll-area-viewport]')).not.toBeNull();
    expect(within(strip()!).getByRole('button', { name: 'Previous Answer' })).toBeDisabled();
    expect(within(strip()!).getByRole('button', { name: 'Next Answer' })).toBeDisabled();
    expect(field).toHaveValue('');

    await userEvent.click(within(strip()!).getByRole('button', { name: 'Take Me There' }));
    expect(ai.current.requestSurface).toHaveBeenCalledWith({ id: 'settings.display' });
  });

  it('opens the Sources list as a popover from the strip, and a link opens the section in the reader', async () => {
    const { field } = await openWindow();
    stubHelpStream(sseReply('Open the **Display** tab.'));
    await ask(field, 'How do I change the theme?');
    const trigger = await within(strip()!).findByRole('button', { name: /^Sources \(\d+\)$/ });
    expect(trigger.querySelector('svg')).not.toHaveClass('-rotate-90');
    await userEvent.click(trigger);
    const popover = await screen.findByRole('dialog', { name: 'Sources' });
    expect(helpWindow()).toContainElement(popover);
    // The chevron turns up toward the popover, as the Thinking toggle's turns toward its block.
    expect(trigger.querySelector('svg')).toHaveClass('-rotate-90', 'transition-transform');

    await userEvent.click(within(popover).getByRole('button', { name: /How to Change the Theme/ }));
    expect(screen.queryByRole('dialog', { name: 'Sources' })).toBeNull();
    expect(await within(helpWindow()).findByRole('heading', { name: 'How to Change the Theme' })).toBeInTheDocument();
  });

  it('points the tail from the bubble toward her, on the side she stands', async () => {
    await openWindow();
    stubHelpStream(sseReply('Open the **Traits** tab.'));
    await ask(screen.getByRole('textbox', { name: 'Ask a Question' }), 'How do I add a trait?');
    await waitFor(() => expect(bubble()).not.toBeNull());
    // She stands at the bottom right by default, so the bubble is on her left and its tail points right.
    expect(helpWindow()).toHaveAttribute('data-fq-side', 'right');
    expect(piece('tail')).toHaveAttribute('data-fq-tail', 'right');
    // The tail paints under the bubble, so it never covers the text or the scroll bar.
    expect(piece('tail')!.compareDocumentPosition(bubble()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(piece('tail')!.parentElement).toBe(bubble()!.parentElement);
  });

  it('moves the window by her body, keeps her place across a remount, and mirrors past the center', async () => {
    const { view } = await openWindow();
    const before = left();
    drag(piece('body')!, -40, 0);
    expect(left()).toBe(before - 40);
    const stored = JSON.parse(localStorage.getItem(WINDOW_KEY)!) as { bubble: { x: number } };
    view.unmount();

    await openWindow();
    expect(left()).toBe(before - 40);
    expect(JSON.parse(localStorage.getItem(WINDOW_KEY)!)).toMatchObject({ bubble: stored.bubble });
    drag(piece('body')!, -1000, 0);
    expect(helpWindow()).toHaveAttribute('data-fq-side', 'left');
  });

  it('moves the window by the pill too', async () => {
    await openWindow();
    const before = left();
    drag(helpWindow().querySelector<HTMLElement>('[data-fq-drag]')!, -30, 0);
    expect(left()).toBe(before - 30);
  });

  it("sets her scale in the device's Scale store from her own grip, and leaves the chat width alone", async () => {
    const { field } = await openWindow();
    stubHelpStream(sseReply('Open the **Traits** tab.'));
    await ask(field, 'How do I add a trait?');
    await waitFor(() => expect(bubble()).not.toBeNull());
    const height = parseFloat(mascot()!.style.height);
    const width = parseFloat(bubble()!.style.width);
    const grip = piece('mascot-resize')!;
    expect(grip).toHaveAttribute('data-fq-mascot-resize', 'nw');

    drag(grip, -80, -80);
    expect(Number(localStorage.getItem(SCALE_KEY))).toBeGreaterThan(0);
    expect(parseFloat(mascot()!.style.height)).toBeGreaterThan(height);
    expect(parseFloat(bubble()!.style.width)).toBe(width);
  });

  it('sets the chat room from the bubble grip, grows the Backdrop and not a short bubble, keeps it across a remount, and leaves her scale alone', async () => {
    const { field, view } = await openWindow();
    stubHelpStream(sseReply('Open the **Traits** tab.'));
    await ask(field, 'How do I add a trait?');
    await waitFor(() => expect(bubble()).not.toBeNull());
    const height = parseFloat(mascot()!.style.height);
    const width = parseFloat(bubble()!.style.width);
    const bubbleHeight = parseFloat(bubble()!.style.height);
    const scrimHeight = parseFloat(piece('scrim')!.style.height);
    const grip = piece('resize')!;
    expect(grip).toHaveAttribute('data-fq-resize', 'nw');

    drag(grip, -60, -90);
    expect(parseFloat(bubble()!.style.width)).toBe(width + 60);
    // The answer is short, so the bubble keeps fitting it; the room and its Backdrop grow, as under Minimal.
    expect(parseFloat(bubble()!.style.height)).toBe(bubbleHeight);
    expect(parseFloat(piece('scrim')!.style.height)).toBe(scrimHeight + 90);
    expect(parseFloat(grip.parentElement!.style.height)).toBe(bubbleHeight + 90);
    expect(parseFloat(mascot()!.style.height)).toBe(height);
    expect(localStorage.getItem(SCALE_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(WINDOW_KEY)!)).toMatchObject({ chat: { w: width + 60, h: bubbleHeight + 90 } });
    view.unmount();

    // The room holds for the next answer too, as the Minimal box does.
    const next = await openWindow();
    stubHelpStream(sseReply('Open the **Display** tab.'));
    await ask(next.field, 'How do I change the theme?');
    await waitFor(() => expect(bubble()).not.toBeNull());
    expect(parseFloat(piece('scrim')!.style.height)).toBe(scrimHeight + 90);
  });

  it('fades a long answer out at the top of the bubble itself, as Minimal fades its bubbles, and keeps the grip clear of the fade', async () => {
    const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('role') === 'log' ? 5000 : 0;
    });
    const { field } = await openWindow();
    stubHelpStream(sseReply('Open the **Traits** tab.'));
    await ask(field, 'How do I add a trait?');
    await waitFor(() => expect(bubble()?.className).toContain('mask-image'));
    expect(bubble()!.querySelector('[data-radix-scroll-area-viewport]')!.className).not.toContain('mask-image');
    expect(bubble()).not.toContainElement(piece('resize'));
    offsetHeight.mockRestore();
  });

  it('stacks one column in head view, with the tail pointing down at the head', async () => {
    localStorage.setItem('formamorph.formaquestion.mascotView', 'head');
    const { field } = await openWindow();
    stubHelpStream(sseReply('Open the **Traits** tab.'));
    await ask(field, 'How do I add a trait?');
    await waitFor(() => expect(bubble()).not.toBeNull());
    expect(mascot()).toHaveAttribute('data-fq-view', 'head');
    expect(piece('tail')).toHaveAttribute('data-fq-tail', 'down');
    const top = (element: Element) => parseFloat((element as HTMLElement).style.top);
    expect(top(bubble()!)).toBeLessThan(top(strip()!));
    expect(top(strip()!)).toBeLessThan(top(screen.getByRole('note', { name: 'Your Question' })));
  });

  it('switches between her whole body and her head from the pill', async () => {
    await openWindow();
    await userEvent.click(screen.getByRole('button', { name: 'Show Head Only' }));
    expect(mascot()).toHaveAttribute('data-fq-view', 'head');
    await userEvent.click(screen.getByRole('button', { name: 'Show Full Mascot' }));
    expect(mascot()).toHaveAttribute('data-fq-view', 'full');
  });

  it('opens a source in the reader beside the group', async () => {
    const { field } = await openWindow();
    stubHelpStream(sseReply('Open the **Display** tab.'));
    await ask(field, 'How do I change the theme?');
    await userEvent.click(await within(strip()!).findByRole('button', { name: /^Sources \(\d+\)$/ }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Sources' })).getByRole('button', { name: /How to Change the Theme/ }));
    expect(await within(helpWindow()).findByRole('heading', { name: 'How to Change the Theme' })).toBeInTheDocument();
  });

  it('draws Minimal on the mobile sheet', async () => {
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    await openWindow();
    expect(helpWindow()).toHaveAttribute('data-fq-chrome', 'minimal');
    expect(helpWindow()).toHaveAttribute('data-fq-sheet');
  });
});

describe('Mascot Position under Bubble', () => {
  it('leaves the row and the ⋮ menu entry out under Bubble', async () => {
    await openWindow();
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'More Actions' }));
    expect(await screen.findByRole('group', { name: 'Chat Style' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Mascot Position' })).toBeNull();
    await userEvent.keyboard('{Escape}');

    await openHelpSettings();
    const dialog = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
    expect(within(dialog).getByRole('radiogroup', { name: 'Chat Style' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('radiogroup', { name: 'Mascot Position' })).toBeNull();
  });

  it('shows the row and the ⋮ menu entry under Minimal', async () => {
    storeMinimalWindow();
    await openWindow();
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'More Actions' }));
    expect(await screen.findByRole('group', { name: 'Mascot Position' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await openHelpSettings();
    const dialog = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
    expect(within(dialog).getByRole('radiogroup', { name: 'Mascot Position' })).toBeInTheDocument();
  });

  it('lists four Chat Styles in the ⋮ menu and the General row', async () => {
    await openWindow();
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'More Actions' }));
    const menu = await screen.findByRole('group', { name: 'Chat Style' });
    expect(within(menu).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['Auto', 'Bubble', 'Minimal', 'Full']);
    await userEvent.keyboard('{Escape}');

    await openHelpSettings();
    const dialog = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
    expect(within(within(dialog).getByRole('radiogroup', { name: 'Chat Style' })).getAllByRole('radio').map((item) => item.textContent))
      .toEqual(['Auto', 'Bubble', 'Minimal', 'Full']);
  });
});
