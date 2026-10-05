import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { composeMascot, DEFAULT_MASCOT_RIG, type MascotPhase } from '@/lib/formaquestion/mascot';
import { mascotImageUrl } from '@/lib/formaquestion/mascotAssets';
import { MASCOT_BELOW_CAP, NARROW_WIDTH, READER_GAP } from '@/lib/formaquestion/windowBox';
import { DOCS_LOOKUP } from '@/lib/formaquestion/docsLookup';
import { HELP_FACE } from '@/lib/formaquestion/helpFace';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { stubReducedMotion } from '@/test/reducedMotion';
import { mascotStoreOf, openHelpSettings, stubHelpStream, storeFramedWindow, storeMinimalWindow } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));

// Each test is a fresh app load: the Initial look is once per load.
let Formaquestion: typeof import('./Formaquestion').Formaquestion;
let openDocs: typeof import('@/lib/formaquestion/docsOpener').openDocs;

const PAGES = {
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Traits](Traits)\n' }));

/** An answer that lists "How to Add a Trait" under it as a source. */
const REPLY_WITH_SOURCE = [sseFrame({ content: '1. Open the **Traits** tab.\n' }), ...sseReply('2. Select **Add Trait**.')];

const BOX_KEY ='formamorph.formaquestion.window';
const PLACEMENT_KEY = 'formamorph.formaquestion.mascotPlacement';
/** The default base is 888 by 1184. */
const ASPECT = 0.75;

const helpWindow = () => screen.getByRole('dialog', { name: 'Formaquestion' });
const conversation = () => screen.getByRole('log', { name: 'Conversation' });
const mascot = () => helpWindow().querySelector<HTMLElement>('[data-fq-piece="mascot"]');
const column = () => helpWindow().querySelector<HTMLElement>('[data-fq-piece="column"]')!;
const pill = () => helpWindow().querySelector<HTMLElement>('[data-fq-drag]')!;
/** The newest look: the one on screen, or the one a running transition moves to. */
const drawn = () => [...mascot()!.querySelectorAll('[data-fq-look="new"] img')].map((image) => image.getAttribute('src'));
/** Every look on screen, bottom first. */
const lookImages = () => [...mascot()!.querySelectorAll('[data-fq-look]')].map((look) => [...look.querySelectorAll('img')].map((image) => image.getAttribute('src')));
/** The default rig's images for a phase with no AI expression. Answering with none is the Idle look. */
const look = (phase: MascotPhase) => composeMascot(DEFAULT_MASCOT_RIG, phase, null).map(mascotImageUrl);

/** An answer stream that stays open until the test pushes its frames. */
function heldReply() {
  const encoder = new TextEncoder();
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } });
  return {
    respond: () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    push: (frame: string) => act(() => { stream.enqueue(encoder.encode(frame)); }),
    end: (finish = 'stop') => act(() => {
      stream.enqueue(encoder.encode(sseFrame({}, finish)));
      stream.enqueue(encoder.encode('data: [DONE]\n\n'));
      stream.close();
    }),
  };
}

async function openWindow() {
  const view = render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  return { view, field };
}

/** jsdom loads no image, so the base reports its natural size here. */
function loadBase() {
  const base = mascot()!.querySelector('[data-fq-look="new"] img')!;
  Object.defineProperty(base, 'naturalWidth', { configurable: true, value: 888 });
  Object.defineProperty(base, 'naturalHeight', { configurable: true, value: 1184 });
  fireEvent.load(base);
}

async function send(field: HTMLElement, question: string) {
  await userEvent.type(field, question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

async function reopen() {
  await userEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await waitFor(() => expect(helpWindow()).toHaveAttribute('data-state', 'open'));
}

async function setMascot(on: boolean) {
  await openHelpSettings();
  const dialog = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
  const box = within(dialog).getByRole('checkbox', { name: 'Mascot' });
  if ((box.getAttribute('aria-checked') === 'true') !== on) await userEvent.click(box);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(helpWindow()).toHaveAttribute('data-state', 'open'));
}

beforeEach(async () => {
  vi.resetModules();
  ({ Formaquestion } = await import('./Formaquestion'));
  ({ openDocs } = await import('@/lib/formaquestion/docsOpener'));
  localStorage.clear();
  // These tests read the Minimal chrome's Beside geometry; 'the Mascot below' starts from the Auto default.
  localStorage.setItem(PLACEMENT_KEY, 'beside');
  storeMinimalWindow();
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the minimal chrome', () => {
  it('shows the column, the pill, the corner grip and the Mascot drawing the Initial look, with no frame or tabs', async () => {
    await openWindow();
    expect(helpWindow()).toHaveAttribute('data-fq-chrome', 'minimal');
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Formaquestion' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Wide View' })).toBeNull();
    expect(column().querySelector('[data-fq-resize]')).not.toBeNull();
    expect(within(pill()).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Show Head Only', 'More Actions', 'Close Formaquestion']);
    expect(drawn()).toEqual(look('initial'));
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
    expect(helpWindow()).toHaveAttribute('data-fq-chrome', 'bubble');
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

    const stored = JSON.parse(localStorage.getItem(BOX_KEY)!) as { x: number; minimal: { w: number } };
    expect(stored.minimal.w).toBe(NARROW_WIDTH);
    expect(stored.x).toBe(before - 40 + parseFloat(mascot()!.style.width));

    view.unmount();
    await openWindow();
    loadBase();
    expect(parseFloat(helpWindow().style.left)).toBe(before - 40);
  });

  it('opens the reader right of the column from a source name, widens the box, and closes alone', async () => {
    vi.stubGlobal('innerWidth', 1920);
    stubHelpStream(REPLY_WITH_SOURCE);
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    loadBase();
    const closedWidth = parseFloat(helpWindow().style.width);
    const closedLeft = parseFloat(helpWindow().style.left);

    const sources = await within(conversation()).findByRole('group', { name: 'Sources' });
    await userEvent.click(within(sources).getByRole('button', { name: /How to Add a Trait/ }));

    const reader = helpWindow().querySelector<HTMLElement>('[data-fq-piece="reader"]')!;
    expect(within(reader).getByRole('article', { name: /How to Add a Trait/ })).toBeInTheDocument();
    expect(column().compareDocumentPosition(reader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reader.style.height).toBe(helpWindow().style.height);
    expect(parseFloat(helpWindow().style.width)).toBe(closedWidth + READER_GAP + parseFloat(reader.style.width));
    // The default place sits at the screen's right edge, so the box shifts left to keep the reader whole.
    expect(parseFloat(helpWindow().style.left) + parseFloat(helpWindow().style.width)).toBeLessThanOrEqual(window.innerWidth);

    await userEvent.click(within(reader).getByRole('button', { name: 'Close Reader' }));
    expect(helpWindow().querySelector('[data-fq-piece="reader"]')).toBeNull();
    expect(helpWindow().style.width).toBe(`${closedWidth}px`);
    expect(parseFloat(helpWindow().style.left)).toBe(closedLeft);
    expect(conversation()).toBeInTheDocument();
    expect(mascot()).not.toBeNull();
  });

  it('moves the reader with the other pieces by the pill', async () => {
    vi.stubGlobal('innerWidth', 1920);
    stubHelpStream(REPLY_WITH_SOURCE);
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    loadBase();
    const sources = await within(conversation()).findByRole('group', { name: 'Sources' });
    await userEvent.click(within(sources).getByRole('button', { name: /How to Add a Trait/ }));

    const before = { left: parseFloat(helpWindow().style.left), top: parseFloat(helpWindow().style.top) };
    fireEvent.pointerDown(pill(), { button: 0, pointerId: 1, clientX: 600, clientY: 300 });
    fireEvent.pointerMove(pill(), { pointerId: 1, clientX: 560, clientY: 280 });
    fireEvent.pointerUp(pill(), { pointerId: 1 });
    // One shared box holds every piece, so it moves them as one.
    expect(parseFloat(helpWindow().style.left)).toBe(before.left - 40);
    expect(parseFloat(helpWindow().style.top)).toBe(before.top - 20);
    expect(helpWindow().querySelector('[data-fq-piece="reader"]')).not.toBeNull();
    expect(mascot()).not.toBeNull();
  });

  it('opens a docs request in the reader', async () => {
    await openWindow();
    act(() => { openDocs({ page: 'Traits', anchor: 'how-to-add-a-trait' }); });
    const reader = await waitFor(() => {
      const found = helpWindow().querySelector<HTMLElement>('[data-fq-piece="reader"]');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(within(reader).getByRole('article', { name: /How to Add a Trait/ })).toBeInTheDocument();
  });

  it('sends a docs request to the wiki on a mobile-size screen, which has no reader piece', async () => {
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    const browse = vi.fn();
    vi.stubGlobal('open', browse);
    await openWindow();
    act(() => { openDocs({ page: 'Traits', anchor: 'how-to-add-a-trait' }); });
    expect(browse).toHaveBeenCalledWith(expect.stringContaining('/wiki/Traits#how-to-add-a-trait'), '_blank', 'noopener,noreferrer');
    expect(helpWindow().querySelector('[data-fq-piece="reader"]')).toBeNull();
  });

  it('shows the masked head left of the pill on a mobile-size screen, with no full view and no toggle', async () => {
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    await openWindow();
    expect(helpWindow()).toHaveAttribute('data-fq-sheet');
    expect(helpWindow()).toHaveAttribute('data-fq-chrome', 'minimal');
    expect(helpWindow().querySelector('[data-fq-drag] svg.lucide-grip-horizontal')).toBeNull();
    expect(within(pill()).queryByRole('button', { name: /^Show / })).toBeNull();
    loadBase();
    expect(helpWindow().querySelectorAll('[data-fq-piece="mascot"]')).toHaveLength(1);
    expect(mascot()).toHaveAttribute('data-fq-view', 'head');
    expect(mascot()!.nextElementSibling).toBe(pill());
    // The default Mask is 768 by 680 from (100, 0).
    expect(mascot()!.style.height).toBe('64px');
    expect(parseFloat(mascot()!.style.width)).toBeCloseTo(72.28, 2);
    // The whole base draws past the piece, so the Mask fills it.
    const frame = (mascot()!.firstElementChild as HTMLElement).style;
    expect(parseFloat(frame.left)).toBeCloseTo(-13.02, 2);
    expect(parseFloat(frame.height)).toBeCloseTo(174.12, 2);
    expect(drawn()).toEqual(look('initial'));
  });

  it('stands the Mascot right of the column and the head at the pill\'s right end once the column is dragged past the middle', async () => {
    await openWindow();
    loadBase();
    expect(mascot()!.compareDocumentPosition(column()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.pointerDown(pill(), { button: 0, pointerId: 1, clientX: 900, clientY: 200 });
    fireEvent.pointerMove(pill(), { pointerId: 1, clientX: 100, clientY: 200 });
    fireEvent.pointerUp(pill(), { pointerId: 1 });
    expect(column().compareDocumentPosition(mascot()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await userEvent.click(within(pill()).getByRole('button', { name: 'Show Head Only' }));
    loadBase();
    expect(mascot()).toHaveAttribute('data-fq-view', 'head');
    expect(mascot()!.previousElementSibling).toBe(pill());
  });

  it('swaps the whole Mascot and its head from the pill, narrows the box for the head, and keeps the view across a remount', async () => {
    const { view } = await openWindow();
    loadBase();
    const fullLeft = parseFloat(helpWindow().style.left);
    expect(mascot()).toHaveAttribute('data-fq-view', 'full');
    await userEvent.click(within(pill()).getByRole('button', { name: 'Show Head Only' }));
    expect(helpWindow().querySelectorAll('[data-fq-piece="mascot"]')).toHaveLength(1);
    loadBase();
    expect(mascot()).toHaveAttribute('data-fq-view', 'head');
    expect(mascot()!.nextElementSibling).toBe(pill());
    expect(mascot()!.style.height).toBe('96px');
    // The head sits in the column, so the box is the column alone, at the column's place.
    expect(parseFloat(helpWindow().style.width)).toBe(NARROW_WIDTH);
    expect(parseFloat(helpWindow().style.left)).toBe(fullLeft + parseFloat(helpWindow().style.height) * ASPECT);
    expect(drawn()).toEqual(look('initial'));

    view.unmount();
    await openWindow();
    loadBase();
    expect(mascot()).toHaveAttribute('data-fq-view', 'head');
    await userEvent.click(within(pill()).getByRole('button', { name: 'Show Full Mascot' }));
    loadBase();
    expect(mascot()).toHaveAttribute('data-fq-view', 'full');
    expect(parseFloat(helpWindow().style.left)).toBe(fullLeft);
  });
});

describe('the Mascot scale', () => {
  const SCALE_KEY = 'formamorph.formaquestion.mascotScale';

  it("sizes the Mascot to a stored percent of the base's pixel height, rising above the column, and the head view with it", async () => {
    localStorage.setItem(SCALE_KEY, '50');
    await openWindow();
    loadBase();
    expect(mascot()!.style.height).toBe('592px');
    expect(mascot()!.style.width).toBe('444px');
    // The default column is 60% of the screen height; the shared box grows upward to the Mascot's height.
    expect(column().style.height).toBe(`${window.innerHeight * 0.6}px`);
    expect(helpWindow().style.height).toBe('592px');
    await userEvent.click(within(pill()).getByRole('button', { name: 'Show Head Only' }));
    loadBase();
    // The default Mask is 680 pixels tall.
    expect(mascot()!.style.height).toBe('340px');
  });

  it('keeps a large head view within the column height', async () => {
    localStorage.setItem(SCALE_KEY, '150');
    await openWindow();
    loadBase();
    await userEvent.click(within(pill()).getByRole('button', { name: 'Show Head Only' }));
    loadBase();
    expect(mascot()!.style.height).toBe(column().style.height);
  });

  it('follows the Scale slider at once, and keeps the percent across a remount', async () => {
    const { view } = await openWindow();
    loadBase();
    expect(mascot()!.style.height).toBe(helpWindow().style.height);
    await openHelpSettings();
    const dialog = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Mascot' }));
    within(dialog).getByRole('slider', { name: 'Scale' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{Escape}');
    expect(localStorage.getItem(SCALE_KEY)).toBe('25');
    expect(mascot()!.style.height).toBe('296px');

    view.unmount();
    await openWindow();
    loadBase();
    expect(mascot()!.style.height).toBe('296px');
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
    storeFramedWindow({ mascot: true });
    stubHelpStream(sseReply('Open the Traits tab.'));
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(conversation()).toHaveTextContent('Open the Traits tab.'));

    await setMascot(false);
    expect(helpWindow()).not.toHaveAttribute('data-fq-chrome');
    expect(conversation()).toHaveTextContent('How do I add a trait?');
    expect(conversation()).toHaveTextContent('Open the Traits tab.');

    await setMascot(true);
    expect(helpWindow()).toHaveAttribute('data-fq-chrome', 'bubble');
    expect(screen.getByRole('note', { name: 'Your Question' })).toHaveTextContent('How do I add a trait?');
    expect(conversation()).toHaveTextContent('Open the Traits tab.');
  });
});

describe('the Chat Style', () => {
  const anyMascot = () => document.querySelector<HTMLElement>('[data-fq-piece="mascot"]');
  const chromeOf = () => helpWindow().getAttribute('data-fq-chrome') ?? 'full';

  async function pickInMenu(style: string) {
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'More Actions' }));
    await userEvent.click(within(await screen.findByRole('group', { name: 'Chat Style' })).getByRole('menuitemradio', { name: style }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  }

  async function checkedInMenu() {
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'More Actions' }));
    const checked = within(await screen.findByRole('group', { name: 'Chat Style' })).getAllByRole('menuitemradio')
      .filter((item) => item.getAttribute('aria-checked') === 'true');
    await userEvent.keyboard('{Escape}');
    return checked.map((item) => item.textContent);
  }

  it.each([
    { chatStyle: 'auto', mascot: true, chrome: 'bubble', drawsMascot: true },
    { chatStyle: 'auto', mascot: false, chrome: 'full', drawsMascot: false },
    { chatStyle: 'bubble', mascot: true, chrome: 'bubble', drawsMascot: true },
    { chatStyle: 'bubble', mascot: false, chrome: 'minimal', drawsMascot: false },
    { chatStyle: 'minimal', mascot: true, chrome: 'minimal', drawsMascot: true },
    { chatStyle: 'minimal', mascot: false, chrome: 'minimal', drawsMascot: false },
    { chatStyle: 'full', mascot: true, chrome: 'full', drawsMascot: true },
    { chatStyle: 'full', mascot: false, chrome: 'full', drawsMascot: false },
  ])('draws the $chrome chrome for $chatStyle with the Mascot on: $mascot', async ({ chatStyle, mascot: on, chrome, drawsMascot }) => {
    storeFramedWindow({ chatStyle, mascot: on });
    await openWindow();
    expect(chromeOf()).toBe(chrome);
    expect(anyMascot() !== null).toBe(drawsMascot);
    if (chrome !== 'full') expect(within(helpWindow()).queryByRole('button', { name: /^Show / }) !== null).toBe(drawsMascot);
  });

  it('stands the whole Mascot left of the full frame at its height, whatever the stored head view', async () => {
    localStorage.setItem('formamorph.formaquestion.mascotView', 'head');
    storeFramedWindow({ chatStyle: 'full', mascot: true });
    await openWindow();
    expect(screen.getByRole('tablist', { name: 'Formaquestion Parts' })).toBeInTheDocument();
    expect(anyMascot()).toHaveAttribute('data-fq-view', 'full');
    const base = anyMascot()!.querySelector('[data-fq-look="new"] img')!;
    Object.defineProperty(base, 'naturalWidth', { configurable: true, value: 888 });
    Object.defineProperty(base, 'naturalHeight', { configurable: true, value: 1184 });
    fireEvent.load(base);
    const frame = helpWindow().style;
    const piece = anyMascot()!.parentElement!.style;
    expect(anyMascot()!.style.height).toBe(frame.height);
    expect(parseFloat(piece.left) + parseFloat(anyMascot()!.style.width)).toBe(parseFloat(frame.left));
  });

  it('draws no Mascot beside the full sheet on a mobile-size screen', async () => {
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    storeFramedWindow({ chatStyle: 'full', mascot: true });
    await openWindow();
    expect(helpWindow()).toHaveAttribute('data-fq-sheet');
    expect(anyMascot()).toBeNull();
  });

  it('swaps the chrome in place from the ⋮ menu, keeps the conversation, and agrees with the General row', async () => {
    storeFramedWindow({ mascot: true });
    stubHelpStream(sseReply('Open the Traits tab.'));
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(conversation()).toHaveTextContent('Open the Traits tab.'));
    expect(await checkedInMenu()).toEqual(['Auto']);
    expect(helpWindow().className).toContain('zoom-in-75');

    await pickInMenu('Full');
    expect(chromeOf()).toBe('full');
    // The new chrome draws in place: it does not zoom out of the Help tab again.
    expect(helpWindow().className).not.toContain('zoom-in-75');
    expect(conversation()).toHaveTextContent('Open the Traits tab.');
    expect(anyMascot()).not.toBeNull();
    // The swap removed the menu's button, so focus moves into the new chrome.
    expect(helpWindow()).toContainElement(document.activeElement as HTMLElement);
    expect(await checkedInMenu()).toEqual(['Full']);
    // A swap back while still open draws in place too.
    await pickInMenu('Auto');
    expect(chromeOf()).toBe('bubble');
    expect(helpWindow().className).not.toContain('zoom-in-75');
    await pickInMenu('Full');

    await openHelpSettings();
    const dialog = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
    expect(within(dialog).getByRole('radio', { name: 'Full' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Minimal' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(helpWindow()).toHaveAttribute('data-state', 'open'));
    expect(chromeOf()).toBe('minimal');
    expect(conversation()).toHaveTextContent('Open the Traits tab.');
    expect(await checkedInMenu()).toEqual(['Minimal']);
  });

  it('keeps a size per chrome and one place across a remount', async () => {
    vi.stubGlobal('innerWidth', 1600);
    vi.stubGlobal('innerHeight', 900);
    const { view } = await openWindow();
    loadBase();
    const grip = column().querySelector<HTMLElement>('[data-fq-resize]')!;
    const minimalHeight = parseFloat(helpWindow().style.height);
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: 900, clientY: 700 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 860, clientY: 640 });
    fireEvent.pointerUp(grip, { pointerId: 1 });
    expect(parseFloat(helpWindow().style.height)).toBe(minimalHeight - 60);
    expect(parseFloat(column().parentElement!.style.width) - parseFloat(mascot()!.style.width)).toBe(NARROW_WIDTH - 40);
    const columnLeft = parseFloat(helpWindow().style.left) + parseFloat(mascot()!.style.width);

    await pickInMenu('Full');
    // The frame keeps the default size at the column's place.
    expect(helpWindow().style).toMatchObject({ width: `${NARROW_WIDTH}px`, height: `${minimalHeight}px`, left: `${columnLeft}px` });

    view.unmount();
    await openWindow();
    expect(chromeOf()).toBe('full');
    expect(helpWindow().style.height).toBe(`${minimalHeight}px`);
    await pickInMenu('Minimal');
    loadBase();
    expect(parseFloat(helpWindow().style.height)).toBe(minimalHeight - 60);
    expect(parseFloat(helpWindow().style.left) + parseFloat(mascot()!.style.width)).toBe(columnLeft);
  });
});

describe('the Mascot below', () => {
  const MARGIN = 16;
  const px = (value: string) => parseFloat(value);

  beforeEach(() => {
    localStorage.removeItem(PLACEMENT_KEY);
  });

  it('stands her under a short column on Auto, filling the room to the screen margin', async () => {
    await openWindow();
    loadBase();
    const group = helpWindow().style;
    const columnHeight = px(column().style.height);
    expect(columnHeight).toBeLessThanOrEqual(window.innerHeight * MASCOT_BELOW_CAP);
    expect(px(group.top) + px(group.height)).toBe(window.innerHeight - MARGIN);
    expect(px(mascot()!.style.height)).toBe(px(group.height) - columnHeight);
    expect(px(mascot()!.style.width)).toBeCloseTo(px(mascot()!.style.height) * ASPECT);
    expect(column().compareDocumentPosition(mascot()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('stands her beside once the column is dragged past the cap on Auto', async () => {
    await openWindow();
    loadBase();
    const grip = column().querySelector<HTMLElement>('[data-fq-resize]')!;
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: 900, clientY: 300 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 900, clientY: 900 });
    fireEvent.pointerUp(grip, { pointerId: 1 });
    const columnHeight = px(column().style.height);
    expect(columnHeight).toBeGreaterThan(window.innerHeight * MASCOT_BELOW_CAP);
    expect(mascot()!.style.height).toBe(`${columnHeight}px`);
    expect(mascot()!.compareDocumentPosition(column()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('stops the grip at the cap on Below', async () => {
    localStorage.setItem(PLACEMENT_KEY, 'below');
    await openWindow();
    loadBase();
    const grip = column().querySelector<HTMLElement>('[data-fq-resize]')!;
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: 900, clientY: 300 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 900, clientY: 900 });
    fireEvent.pointerUp(grip, { pointerId: 1 });
    expect(px(column().style.height)).toBe(window.innerHeight * MASCOT_BELOW_CAP);
    const stored = JSON.parse(localStorage.getItem(BOX_KEY)!) as { minimal: { h: number } };
    expect(stored.minimal.h).toBe(window.innerHeight * MASCOT_BELOW_CAP);
  });

  it('stands her under the full frame, centered', async () => {
    storeFramedWindow({ chatStyle: 'full', mascot: true });
    await openWindow();
    const piece = document.querySelector<HTMLElement>('[data-fq-piece="mascot"]')!;
    const base = piece.querySelector('[data-fq-look="new"] img')!;
    Object.defineProperty(base, 'naturalWidth', { configurable: true, value: 888 });
    Object.defineProperty(base, 'naturalHeight', { configurable: true, value: 1184 });
    fireEvent.load(base);
    const frame = helpWindow().style;
    const holder = piece.parentElement!.style;
    expect(px(holder.top)).toBe(px(frame.top) + px(frame.height));
    expect(px(holder.top) + px(holder.height)).toBe(window.innerHeight - MARGIN);
    expect(px(holder.left) + px(piece.style.width) / 2).toBeCloseTo(px(frame.left) + px(frame.width) / 2);
  });
});

describe('the Mascot Position', () => {
  const stored = () => localStorage.getItem(PLACEMENT_KEY);
  const menuPosition = async () => {
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'More Actions' }));
    return screen.findByRole('group', { name: 'Mascot Position' });
  };
  const checkedIn = (group: HTMLElement) =>
    within(group).getAllByRole('menuitemradio').filter((item) => item.getAttribute('aria-checked') === 'true').map((item) => item.textContent);
  async function generalDialog() {
    await openHelpSettings();
    return screen.findByRole('dialog', { name: 'Formaquestion Settings' });
  }

  beforeEach(() => {
    localStorage.removeItem(PLACEMENT_KEY);
  });

  it('puts the row after Chat Style with Beside, Below and Auto, and Auto chosen', async () => {
    await openWindow();
    const dialog = await generalDialog();
    const rows = within(dialog).getAllByRole('radiogroup').map((group) => group.getAttribute('aria-label'));
    expect(rows.indexOf('Mascot Position')).toBe(rows.indexOf('Chat Style') + 1);
    const row = within(within(dialog).getByRole('radiogroup', { name: 'Mascot Position' }));
    expect(row.getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Beside', 'Below', 'Auto']);
    expect(row.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
  });

  it('writes the device store from the row, and the menu marks the new value', async () => {
    await openWindow();
    const dialog = await generalDialog();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Below' }));
    expect(stored()).toBe('below');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(helpWindow()).toHaveAttribute('data-state', 'open'));
    const group = await menuPosition();
    expect(within(group).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['Beside', 'Below', 'Auto']);
    expect(checkedIn(group)).toEqual(['Below']);
  });

  it('writes the device store from the menu, and the row marks the new value', async () => {
    await openWindow();
    await userEvent.click(within(await menuPosition()).getByRole('menuitemradio', { name: 'Beside' }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(stored()).toBe('beside');
    const dialog = await generalDialog();
    expect(within(dialog).getByRole('radio', { name: 'Beside' })).toHaveAttribute('aria-checked', 'true');
  });

  it('stores the cap height when Below is picked over a column taller than the cap', async () => {
    const tall = Math.round(window.innerHeight * 0.9);
    localStorage.setItem(BOX_KEY, JSON.stringify({ x: 40, y: 0, minimal: { w: 380, h: tall }, full: { w: 560, h: tall } }));
    await openWindow();
    loadBase();
    expect(parseFloat(column().style.height)).toBe(tall);
    await userEvent.click(within(await menuPosition()).getByRole('menuitemradio', { name: 'Below' }));
    await waitFor(() => expect(parseFloat(column().style.height)).toBe(window.innerHeight * MASCOT_BELOW_CAP));
    const box = JSON.parse(localStorage.getItem(BOX_KEY)!) as { minimal: { h: number } };
    expect(box.minimal.h).toBe(window.innerHeight * MASCOT_BELOW_CAP);
  });

  it('keeps the stored height when Below is picked while no Mascot is drawn', async () => {
    const tall = Math.round(window.innerHeight * 0.9);
    storeFramedWindow({ chatStyle: 'minimal', mascot: false });
    localStorage.setItem(BOX_KEY, JSON.stringify({ x: 40, y: 0, minimal: { w: 380, h: tall }, full: { w: 560, h: tall } }));
    localStorage.setItem(PLACEMENT_KEY, 'beside');
    await openWindow();
    await userEvent.click(within(await menuPosition()).getByRole('menuitemradio', { name: 'Below' }));
    await waitFor(() => expect(stored()).toBe('below'));
    expect(parseFloat(column().style.height)).toBe(tall);
    expect(JSON.parse(localStorage.getItem(BOX_KEY)!).minimal.h).toBe(tall);
  });

  it('leaves the column alone when Auto is picked over a tall column', async () => {
    const tall = Math.round(window.innerHeight * 0.9);
    localStorage.setItem(BOX_KEY, JSON.stringify({ x: 40, y: 0, minimal: { w: 380, h: tall }, full: { w: 560, h: tall } }));
    localStorage.setItem(PLACEMENT_KEY, 'beside');
    await openWindow();
    loadBase();
    await userEvent.click(within(await menuPosition()).getByRole('menuitemradio', { name: 'Auto' }));
    await waitFor(() => expect(stored()).toBe('auto'));
    expect(JSON.parse(localStorage.getItem(BOX_KEY)!).minimal.h).toBe(tall);
  });

  it('shows no Position choices in the menu of the mobile sheet', async () => {
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    storeFramedWindow({ chatStyle: 'full', mascot: true });
    await openWindow();
    expect(helpWindow()).toHaveAttribute('data-fq-sheet');
    await userEvent.click(within(helpWindow()).getByRole('button', { name: 'More Actions' }));
    await screen.findByRole('group', { name: 'Chat Style' });
    expect(screen.queryByRole('group', { name: 'Mascot Position' })).toBeNull();
  });
});

describe('the Scrim', () => {
  const scrim = () => helpWindow().querySelector<HTMLElement>('[data-fq-scrim]');

  it.each([
    { chatStyle: 'auto', mascot: true, drawn: true },
    { chatStyle: 'bubble', mascot: true, drawn: true },
    { chatStyle: 'minimal', mascot: true, drawn: true },
    { chatStyle: 'minimal', mascot: false, drawn: true },
    { chatStyle: 'auto', mascot: false, drawn: false },
    { chatStyle: 'full', mascot: true, drawn: false },
    { chatStyle: 'full', mascot: false, drawn: false },
  ])('draws behind the column: $drawn for $chatStyle with the Mascot on: $mascot', async ({ chatStyle, mascot: on, drawn: expected }) => {
    storeFramedWindow({ chatStyle, mascot: on });
    await openWindow();
    expect(scrim() !== null).toBe(expected);
    // Minimal draws it in the column; Bubble behind its column of pieces.
    if (expected && chatStyle === 'minimal') expect(column()).toContainElement(scrim());
  });

  it('draws the stored opacity, and nothing at 0', async () => {
    storeFramedWindow({ chatStyle: 'minimal', scrimOpacity: 35 });
    const { view } = await openWindow();
    expect(scrim()!.style.opacity).toBe('0.35');
    view.unmount();

    storeFramedWindow({ chatStyle: 'minimal', scrimOpacity: 0 });
    await openWindow();
    expect(scrim()).toBeNull();
  });

  it('draws at 60% for a player who changed nothing', async () => {
    storeFramedWindow({ chatStyle: 'minimal' });
    await openWindow();
    expect(scrim()!.style.opacity).toBe('0.6');
  });

  it('follows the Backdrop slider at once and keeps the value across a remount', async () => {
    storeFramedWindow({ chatStyle: 'minimal' });
    const { view } = await openWindow();
    await openHelpSettings();
    const dialog = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
    const slider = within(dialog).getByRole('slider', { name: 'Backdrop' });
    expect(slider).toHaveAttribute('aria-valuenow', '60');
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(helpWindow()).toHaveAttribute('data-state', 'open'));
    expect(scrim()!.style.opacity).toBe('0.65');

    view.unmount();
    await openWindow();
    expect(scrim()!.style.opacity).toBe('0.65');
  });
});

describe('the Mascot phases', () => {
  it('waves across a close and reopen until the first send, and draws Idle on every open after it', async () => {
    stubHelpStream(sseReply('Open the Traits tab.'));
    const { field } = await openWindow();
    expect(drawn()).toEqual(look('initial'));
    await reopen();
    expect(drawn()).toEqual(look('initial'));

    await send(field, 'How do I add a trait?');
    await within(conversation()).findByText(/Open the Traits tab/);
    expect(drawn()).toEqual(look('answering'));
    await reopen();
    expect(drawn()).toEqual(look('answering'));
  });

  it('waves on a remount, which starts an empty conversation (Q28)', async () => {
    stubHelpStream(sseReply('Open the Traits tab.'));
    const { view, field } = await openWindow();
    await send(field, 'How do I add a trait?');
    await within(conversation()).findByText(/Open the Traits tab/);
    view.unmount();

    await openWindow();
    expect(drawn()).toEqual(look('initial'));
  });

  it('keeps the wave through a Settings round trip that turns the Mascot on', async () => {
    storeFramedWindow();
    await openWindow();
    expect(mascot()).toBeNull();
    await setMascot(true);
    expect(drawn()).toEqual(look('initial'));
  });

  it("plays the rig's transition on a change of look: the old look stays under the new one until it lands", async () => {
    stubHelpStream(heldReply().respond);
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    expect(lookImages()).toEqual([look('initial'), look('thinking')]);
    await waitFor(() => expect(lookImages()).toEqual([look('thinking')]));
  });

  it('swaps the look at once under the reduced-motion preference', async () => {
    stubReducedMotion();
    stubHelpStream(heldReply().respond);
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    expect(lookImages()).toEqual([look('thinking')]);
  });

  it('thinks from the send through reasoning-only text, and rests at the first content token', async () => {
    const reply = heldReply();
    stubHelpStream(reply.respond);
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    expect(drawn()).toEqual(look('thinking'));

    await reply.push(sseFrame({ reasoning_content: 'The player wants the Traits page.' }));
    await within(conversation()).findByRole('button', { name: 'Thinking…' });
    expect(drawn()).toEqual(look('thinking'));

    await reply.push(sseFrame({ content: 'Open' }));
    await waitFor(() => expect(drawn()).toEqual(look('answering')));
    await reply.end();
    await within(conversation()).findByText(/Open/);
    expect(drawn()).toEqual(look('answering'));
  });

  it('keeps resting through a guide lookup that clears the text written before the call', async () => {
    localStorage.setItem('FORMAMORPH_helpSettings', JSON.stringify({ lookup: true }));
    const reasoning = { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' as const } };
    ai.current = helpAi({ snapshot: textSnapshot(textTarget({ reasoning })), answerTarget: { reasoning, localEngine: false, maxTokens: undefined }, revalidate: vi.fn(async () => true) });
    const reply = heldReply();
    let request = 0;
    stubHelpStream(() => (request++ === 0
      ? sseResponse([
        sseFrame({ content: 'Let me check.' }),
        sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name: DOCS_LOOKUP.name, arguments: '{"sections":"Traits#how-to-add-a-trait"}' } }] }),
        sseFrame({}, 'tool_calls'),
        'data: [DONE]\n\n',
      ])
      : reply.respond()));
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(request).toBe(2));
    expect(drawn()).toEqual(look('answering'));

    await reply.push(sseFrame({ content: 'Open the Traits tab.' }));
    await reply.end();
    await within(conversation()).findByText(/Open the Traits tab/);
    expect(drawn()).toEqual(look('answering'));
  });

  it('holds Thinking through a face call, shows the face at the first content token, swaps at once on a later call, and clears on the next send', async () => {
    const reasoning = { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' as const } };
    ai.current = helpAi({ snapshot: textSnapshot(textTarget({ reasoning })), answerTarget: { reasoning, localEngine: false, maxTokens: undefined }, revalidate: vi.fn(async () => true) });
    const faceCall = (face: string) => sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name: HELP_FACE.name, arguments: JSON.stringify({ face }) } }] });
    const second = heldReply();
    const third = heldReply();
    const next = heldReply();
    const replies = [
      () => sseResponse([faceCall('Happy'), sseFrame({}, 'tool_calls'), 'data: [DONE]\n\n']),
      second.respond,
      third.respond,
      next.respond,
    ];
    let request = 0;
    stubHelpStream(() => replies[request++]());
    const faceLook = (id: string) => composeMascot(DEFAULT_MASCOT_RIG, 'answering', id).map(mascotImageUrl);
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(request).toBe(2));
    expect(drawn()).toEqual(look('thinking'));

    await second.push(sseFrame({ content: 'Open' }));
    await waitFor(() => expect(drawn()).toEqual(faceLook('happy')));

    await second.push(faceCall('Wink'));
    await second.end('tool_calls');
    await waitFor(() => expect(request).toBe(3));
    expect(drawn()).toEqual(faceLook('wink'));
    await third.push(sseFrame({ content: 'Open the Traits tab.' }));
    await third.end();
    await within(conversation()).findByText(/Open the Traits tab/);
    expect(drawn()).toEqual(faceLook('wink'));

    await send(field, 'And then?');
    await waitFor(() => expect(request).toBe(4));
    expect(drawn()).toEqual(look('thinking'));
    await next.push(sseFrame({ content: 'Select Add Trait.' }));
    await waitFor(() => expect(drawn()).toEqual(look('answering')));
  });

  it('rests, not on the stored face, when a question stops after a face call and before any content', async () => {
    const reasoning = { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' as const } };
    ai.current = helpAi({ snapshot: textSnapshot(textTarget({ reasoning })), answerTarget: { reasoning, localEngine: false, maxTokens: undefined }, revalidate: vi.fn(async () => true) });
    const held = heldReply();
    let request = 0;
    stubHelpStream(() => (request++ === 0
      ? sseResponse([
        sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name: HELP_FACE.name, arguments: '{"face":"Happy"}' } }] }),
        sseFrame({}, 'tool_calls'),
        'data: [DONE]\n\n',
      ])
      : held.respond()));
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(request).toBe(2));
    expect(drawn()).toEqual(look('thinking'));

    await userEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(drawn()).toEqual(look('answering')));
  });

  it('rests when a question stops before any content, and waves again after a clear (Q28)', async () => {
    const reply = heldReply();
    stubHelpStream(reply.respond);
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    expect(drawn()).toEqual(look('thinking'));
    await userEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(drawn()).toEqual(look('answering')));

    await userEvent.click(screen.getByRole('button', { name: 'More Actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Clear Conversation' }));
    await waitFor(() => expect(drawn()).toEqual(look('initial')));
  });

  it('shows Thinking for a question in progress after a clear, and the first answer ends the Initial look', async () => {
    stubHelpStream(sseReply('Open the Traits tab.'));
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    await within(conversation()).findByText(/Open the Traits tab/);
    await userEvent.click(screen.getByRole('button', { name: 'More Actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Clear Conversation' }));
    await waitFor(() => expect(drawn()).toEqual(look('initial')));

    const reply = heldReply();
    stubHelpStream(reply.respond);
    await send(field, 'And a skill?');
    expect(drawn()).toEqual(look('thinking'));

    await reply.push(sseFrame({ content: 'Open the Skills tab.' }));
    await reply.end();
    await waitFor(() => expect(drawn()).toEqual(look('answering')));
  });
});

describe('the mascot draft', () => {
  /** "Mine" smiles at rest, so its Idle look differs from the Default's. */
  const mine = { ...DEFAULT_MASCOT_RIG, picks: { ...DEFAULT_MASCOT_RIG.picks, idle: { expression: 'happy', state: 'rest' } } };
  const IDLE = composeMascot(mine, 'answering', null).map(mascotImageUrl);
  /** Mine's Idle look with the Rest layer off. */
  const RESTLESS = composeMascot({ ...mine, layers: mine.layers.map((layer) => (layer.id === 'rest' ? { ...layer, enabled: false } : layer)) }, 'answering', null)
    .map(mascotImageUrl);
  const settingsDialog = () => screen.getByRole('dialog', { name: 'Formaquestion Settings' });
  const preview = () => [...settingsDialog().querySelectorAll('[data-fq-mascot-preview] [data-fq-view="full"] [data-fq-look="new"] img')]
    .map((image) => image.getAttribute('src'));

  /** Opens the window on "Mine" with one answer on screen, so the window draws the Idle look the preview shows. */
  async function openAnswered() {
    localStorage.setItem('FORMAMORPH_helpSettings', JSON.stringify({ mascotPresets: mascotStoreOf(mine) }));
    stubHelpStream(sseReply('Open the Traits tab.'));
    const { field } = await openWindow();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(conversation()).toHaveTextContent('Open the Traits tab.'));
    expect(drawn()).toEqual(IDLE);
  }

  async function openMascotTab() {
    await openHelpSettings();
    const dialog = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Mascot' }));
    return dialog;
  }

  /** Closes Settings; on a desktop screen the window waits closed behind it and comes back now. */
  async function closeSettings() {
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(helpWindow()).toHaveAttribute('data-state', 'open'));
  }

  it('shows an edit in the preview, and Save puts it in the window', async () => {
    await openAnswered();
    const dialog = await openMascotTab();
    expect(preview()).toEqual(IDLE);
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Enable Rest' }));
    expect(preview()).toEqual(RESTLESS);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await closeSettings();
    expect(drawn()).toEqual(RESTLESS);
  });

  it('restores the preview on Cancel, and the window keeps the saved mascot', async () => {
    await openAnswered();
    const dialog = await openMascotTab();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Enable Rest' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(preview()).toEqual(IDLE);
    await closeSettings();
    expect(drawn()).toEqual(IDLE);
  });

  it('asks before a tab change or a close drops a dirty draft, and the window never draws the dropped edit', async () => {
    await openAnswered();
    const dialog = await openMascotTab();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Enable Rest' }));

    await userEvent.click(within(dialog).getByRole('tab', { name: 'General' }));
    let prompt = await screen.findByRole('alertdialog');
    await userEvent.click(within(prompt).getByRole('button', { name: 'Cancel' }));
    expect(within(settingsDialog()).getByRole('tab', { name: 'Mascot' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{Escape}');
    prompt = await screen.findByRole('alertdialog');
    await userEvent.click(within(prompt).getByRole('button', { name: 'Exit Without Saving' }));
    await waitFor(() => expect(helpWindow()).toHaveAttribute('data-state', 'open'));
    expect(screen.queryByRole('dialog', { name: 'Formaquestion Settings' })).toBeNull();
    expect(drawn()).toEqual(IDLE);
  });

  it('leaves full screen on Escape with the dialog and the draft kept, then still asks before a close drops the draft', async () => {
    await openAnswered();
    const dialog = await openMascotTab();
    await userEvent.click(within(dialog).getByRole('button', { name: 'View full screen' }));
    const box = screen.getByRole('dialog', { name: 'Mascot' });
    await userEvent.click(within(box).getByRole('checkbox', { name: 'Enable Rest' }));

    // The window covers the dialog's own close, so Escape is the one close path: it leaves full screen first.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mascot' })).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(settingsDialog()).getByTestId('mascot-footer')).toBeInTheDocument();
    expect(preview()).toEqual(RESTLESS);

    await userEvent.keyboard('{Escape}');
    const prompt = await screen.findByRole('alertdialog');
    await userEvent.click(within(prompt).getByRole('button', { name: 'Exit Without Saving' }));
    expect(screen.queryByRole('dialog', { name: 'Formaquestion Settings' })).toBeNull();
    expect(drawn()).toEqual(IDLE);
  });

  it('draws the active mascot in the window after a switch', async () => {
    await openAnswered();
    const dialog = await openMascotTab();
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('combobox', { name: 'Preset' }));
    await user.click(await screen.findByRole('option', { name: 'Default' }));
    await closeSettings();
    expect(drawn()).toEqual(look('answering'));
    expect(drawn()).not.toEqual(IDLE);
  });
});
