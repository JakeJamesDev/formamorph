import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { HELP_FACE } from '@/lib/formaquestion/helpFace';
import { composeMascot, DEFAULT_MASCOT_RIG, type MascotPhase } from '@/lib/formaquestion/mascot';
import { mascotImageUrl } from '@/lib/formaquestion/mascotAssets';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
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

/** An answer stream that stays open until the test ends it. */
function heldReply() {
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } });
  const encoder = new TextEncoder();
  return {
    respond: () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    end: () => act(() => {
      stream.enqueue(encoder.encode(sseFrame({ content: 'Late answer.' })));
      stream.enqueue(encoder.encode(sseFrame({}, 'stop')));
      stream.enqueue(encoder.encode('data: [DONE]\n\n'));
      stream.close();
    }),
  };
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

  it("lists a flagged answer's nearest sections in the popover, and a link opens the section (Q22)", async () => {
    const { field } = await openWindow();
    stubHelpStream([sseFrame({ content: '[NOT IN' }), ...sseReply(' GUIDE]\nA trait is a tag on an entity.')]);
    await ask(field, 'How do I add a trait to a stat?');
    const trigger = await within(strip()!).findByRole('button', { name: /^Nearest Sections \(\d+\)$/ });
    expect(within(strip()!).queryByRole('button', { name: /^Sources/ })).toBeNull();
    await userEvent.click(trigger);
    const popover = await screen.findByRole('dialog', { name: 'Nearest Sections' });
    expect(helpWindow()).toContainElement(popover);
    expect(within(popover).getByRole('button', { name: /How to Add a Trait/ })).toBeInTheDocument();

    await userEvent.click(within(popover).getByRole('button', { name: /How to Add a Trait/ }));
    expect(screen.queryByRole('dialog', { name: 'Nearest Sections' })).toBeNull();
    expect(await within(helpWindow()).findByRole('heading', { name: 'How to Add a Trait' })).toBeInTheDocument();
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

/** Answers the nth request with the nth text, one request per question. */
const answersInOrder = (...texts: string[]) => {
  let next = 0;
  stubHelpStream(() => sseResponse(sseReply(texts[next++])));
};

/** Asks each question in turn and waits for its answer to finish. */
async function askAll(field: HTMLElement, questions: readonly string[]) {
  for (const question of questions) {
    await ask(field, question);
    await waitFor(() => expect(screen.getByRole('log', { name: 'Conversation' })).toHaveAttribute('aria-busy', 'false'));
  }
}

/** The newest look on screen. */
const drawn = () => [...mascot()!.querySelectorAll('[data-fq-look="new"] img')].map((image) => image.getAttribute('src'));
const look = (phase: MascotPhase, face: string | null = null) => composeMascot(DEFAULT_MASCOT_RIG, phase, face).map(mascotImageUrl);

const chevron = (name: 'Previous Answer' | 'Next Answer') => within(strip()!).getByRole('button', { name });
const questionPill = () => screen.getByRole('note', { name: 'Your Question' });

describe('paging through the conversation', () => {
  const QUESTIONS = ['How do I add a trait?', 'How do I change the theme?', 'How do I reset the world?'] as const;

  async function threeExchanges() {
    answersInOrder('First answer.', 'Second answer.', 'Third answer.');
    const opened = await openWindow();
    await askAll(opened.field, QUESTIONS);
    return opened;
  }

  it('shows the newest exchange, steps back and forward with the chevrons, and disables each at its end', async () => {
    const { field } = await threeExchanges();
    expect(bubble()).toHaveTextContent('Third answer.');
    expect(questionPill()).toHaveTextContent(QUESTIONS[2]);
    expect(chevron('Next Answer')).toBeDisabled();

    await userEvent.click(chevron('Previous Answer'));
    expect(bubble()).toHaveTextContent('Second answer.');
    expect(questionPill()).toHaveTextContent(QUESTIONS[1]);
    expect(chevron('Next Answer')).toBeEnabled();

    await userEvent.click(chevron('Previous Answer'));
    expect(bubble()).toHaveTextContent('First answer.');
    expect(questionPill()).toHaveTextContent(QUESTIONS[0]);
    expect(chevron('Previous Answer')).toBeDisabled();
    expect(field).toHaveValue('');

    await userEvent.click(chevron('Next Answer'));
    await userEvent.click(chevron('Next Answer'));
    expect(bubble()).toHaveTextContent('Third answer.');
    expect(chevron('Next Answer')).toBeDisabled();
    expect(field).toHaveValue('');
  });

  it('keeps the input as the player left it while paging, and never fills it with an old question', async () => {
    const { field } = await threeExchanges();
    await userEvent.type(field, 'half a thought');
    await userEvent.click(chevron('Previous Answer'));
    expect(field).toHaveValue('half a thought');
  });

  it('jumps to the newest page on a new question', async () => {
    const { field } = await threeExchanges();
    await userEvent.click(chevron('Previous Answer'));
    await userEvent.click(chevron('Previous Answer'));
    expect(bubble()).toHaveTextContent('First answer.');

    answersInOrder('Fourth answer.');
    await ask(field, 'How do I save?');
    await waitFor(() => expect(bubble()).toHaveTextContent('Fourth answer.'));
    expect(questionPill()).toHaveTextContent('How do I save?');
    expect(chevron('Next Answer')).toBeDisabled();
    expect(chevron('Previous Answer')).toBeEnabled();
  });

  it('empties the bubble on Clear Conversation and starts the next page at the newest', async () => {
    const { field } = await threeExchanges();
    await userEvent.click(chevron('Previous Answer'));
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'More Actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Clear Conversation' }));
    expect(bubble()).toBeNull();
    expect(strip()).toBeNull();

    answersInOrder('Only answer.');
    await ask(field, 'How do I add a trait?');
    await waitFor(() => expect(bubble()).toHaveTextContent('Only answer.'));
    expect(chevron('Previous Answer')).toBeDisabled();
    expect(chevron('Next Answer')).toBeDisabled();
  });

  it('marks the next chevron while an answer streams and the player reads an earlier page, and clears the mark on the newest page', async () => {
    const { field } = await openWindow();
    answersInOrder('First answer.');
    await askAll(field, [QUESTIONS[0]]);
    const held = heldReply();
    stubHelpStream(held.respond);
    await userEvent.type(field, QUESTIONS[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('button', { name: 'Stop' });
    expect(chevron('Next Answer')).not.toHaveAttribute('aria-describedby');

    await userEvent.click(chevron('Previous Answer'));
    expect(bubble()).toHaveTextContent('First answer.');
    expect(drawn()).toEqual(look('answering'));
    expect(chevron('Next Answer')).toHaveAccessibleDescription('A new answer is writing');
    expect(chevron('Next Answer').querySelector('[data-fq-mark]')).not.toBeNull();

    await userEvent.click(chevron('Next Answer'));
    // The newest page shows the live phase: the question still waits on its answer.
    expect(drawn()).toEqual(look('thinking'));
    expect(chevron('Next Answer').querySelector('[data-fq-mark]')).toBeNull();
    expect(chevron('Next Answer')).not.toHaveAccessibleDescription();
    await held.end();
  });

  describe('her face', () => {
    const reasoning = { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' as const } };
    const faceCall = (face: string) => sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name: HELP_FACE.name, arguments: JSON.stringify({ face }) } }] });
    const faceLook = (id: string | null) => look('answering', id);

    it('follows the paged exchange, and the newest page shows the live face', async () => {
      ai.current = helpAi({ snapshot: textSnapshot(textTarget({ reasoning })), answerTarget: { reasoning, localEngine: false, maxTokens: undefined }, revalidate: vi.fn(async () => true) });
      // Each question takes two requests: the face call, then the answer.
      const replies = [
        () => sseResponse([faceCall('Happy'), sseFrame({}, 'tool_calls'), 'data: [DONE]\n\n']),
        () => sseResponse(sseReply('First answer.')),
        () => sseResponse([faceCall('Wink'), sseFrame({}, 'tool_calls'), 'data: [DONE]\n\n']),
        () => sseResponse(sseReply('Second answer.')),
      ];
      let request = 0;
      stubHelpStream(() => replies[request++]());
      const { field } = await openWindow();
      await askAll(field, QUESTIONS.slice(0, 2));
      expect(bubble()).toHaveTextContent('Second answer.');
      expect(drawn()).toEqual(faceLook('wink'));

      await userEvent.click(chevron('Previous Answer'));
      expect(bubble()).toHaveTextContent('First answer.');
      expect(drawn()).toEqual(faceLook('happy'));

      await userEvent.click(chevron('Next Answer'));
      expect(drawn()).toEqual(faceLook('wink'));
    });
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
