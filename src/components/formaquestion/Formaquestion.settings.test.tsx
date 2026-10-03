import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { GENERAL_KNOWLEDGE_MARKER } from '@/lib/formaquestion/generalKnowledge';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { sseFrame, sseReply, textSnapshot } from '@/test/aiTextFixtures';
import { stubHelpStream } from '@/test/helpFixtures';
import { sentenceShapeViolation } from '@/test/copyShape';
import { renderReporting } from '@/test/surfaceReporter';
import { GENERAL_COPY } from './formaquestionSettingsTabs';
import type { HelpAi } from './useHelpAi';

// The AI settings and the reachability check come from the app's providers. Each test sets them here.
const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Settings: '# ⚙️ Settings\n\nSettings hold your options.\n\n## Display\n\nDisplay holds the theme and text size.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Settings](Settings)\n- [Traits](Traits)\n' }));

/** A place in the surface registry above every other, for the screen the player asks from. */
const SCREEN_PLACE = 1_000_000;

const conversation = () => screen.getByRole('log', { name: 'Conversation' });
const settingsDialog = () => screen.getByRole('dialog', { name: 'Formaquestion Settings' });
type Body = { messages: { role: string; content: string }[] };
const sentBody = (spy: ReturnType<typeof stubHelpStream>, call = 0): Body => JSON.parse(spy.mock.calls[call][1].body as string) as Body;

async function openAsk() {
  const view = renderReporting(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  return { view, field };
}

async function send(field: HTMLElement, question: string) {
  await userEvent.type(field, question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

async function openSettings() {
  await userEvent.click(screen.getByRole('button', { name: 'Formaquestion Settings' }));
  return settingsDialog();
}

/** Opens the settings, sets each named checkbox, and closes them. */
async function setChecks(checks: Record<string, boolean>) {
  const dialog = await openSettings();
  for (const [name, on] of Object.entries(checks)) {
    const box = within(dialog).getByRole('checkbox', { name });
    if ((box.getAttribute('aria-checked') === 'true') !== on) await userEvent.click(box);
  }
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Formaquestion Settings' })).toBeNull());
}

beforeEach(() => {
  localStorage.clear();
  ai.current = { snapshot: textSnapshot(), language: 'English', reachable: true, revalidate: vi.fn(async () => true), readsImages: false };
});
afterEach(() => {
  surfaceRegistry.clear(SCREEN_PLACE);
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Formaquestion Settings', () => {
  it('opens from the gear on General, with four tabs, and the window stays usable above it', async () => {
    const { field } = await openAsk();
    const dialog = await openSettings();

    expect(within(dialog).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['General', 'Endpoint', 'Prompts', 'Tools']);
    expect(within(dialog).getByRole('tab', { name: 'General' })).toHaveAttribute('data-state', 'active');
    expect(within(dialog).getAllByRole('checkbox').map((box) => box.getAttribute('aria-checked'))).toEqual(['true', 'true', 'true']);
    expect(within(dialog).getByRole('spinbutton', { name: 'History Length' })).toHaveValue(4);

    // jsdom loads no stylesheet, so it reads the open dialog's `pointer-events: none` on the body and not the
    // window's `pointer-events-auto`. Playwright checks the press; this checks focus and typing.
    await userEvent.setup({ pointerEventsCheck: 0 }).type(field, 'Still here');
    expect(field).toHaveValue('Still here');
    expect(settingsDialog()).toBeInTheDocument();
  });

  it('reports the dialog and its tab to the surface registry', async () => {
    await openAsk();
    const dialog = await openSettings();
    await waitFor(() => expect(surfaceRegistry.get()).toMatchObject({ dialog: 'formaquestionSettings', tabs: ['formaquestionSettings.general'] }));

    await userEvent.click(within(dialog).getByRole('tab', { name: 'Tools' }));
    await waitFor(() => expect(surfaceRegistry.get().tabs).toEqual(['formaquestionSettings.tools']));
  });

  it('keeps each setting on the device through a remount', async () => {
    const { view } = await openAsk();
    await setChecks({ 'Keyword Search': false, 'Use the Open Screen': false });
    const dialog = await openSettings();
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'History Length' }), { target: { value: '7' } });
    view.unmount();

    await openAsk();
    const again = await openSettings();
    expect(within(again).getByRole('checkbox', { name: 'Keyword Search' })).toHaveAttribute('aria-checked', 'false');
    expect(within(again).getByRole('checkbox', { name: 'AI Picks' })).toHaveAttribute('aria-checked', 'true');
    expect(within(again).getByRole('checkbox', { name: 'Use the Open Screen' })).toHaveAttribute('aria-checked', 'false');
    expect(within(again).getByRole('spinbutton', { name: 'History Length' })).toHaveValue(7);
  });

  it('applies a change when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    const fetchSpy = stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await setChecks({ 'AI Picks': false });
    await send(field, 'How do I add a trait?');
    await within(conversation()).findByRole('group', { name: 'Sources' });

    expect(fetchSpy.picks).not.toHaveBeenCalled();
  });

  it('writes each description as one short line', () => {
    for (const { hint } of Object.values(GENERAL_COPY)) {
      expect(sentenceShapeViolation(hint), hint).toBeNull();
      expect(hint.split(/\s+/).length, hint).toBeLessThanOrEqual(12);
    }
  });
});

describe('the General settings in the request', () => {
  it('AI Picks off sends no pick request', async () => {
    const fetchSpy = stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await setChecks({ 'AI Picks': false });
    await send(field, 'How do I add a trait?');
    await within(conversation()).findByRole('group', { name: 'Sources' });

    expect(fetchSpy.picks).not.toHaveBeenCalled();
    expect(sentBody(fetchSpy).messages.at(-1)?.content).toContain('Select **Add Trait**.');
  });

  it('Keyword Search off leaves out the sections only the keyword search finds', async () => {
    const fetchSpy = stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await setChecks({ 'Keyword Search': false });
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    expect(fetchSpy.picks).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchSpy).messages.at(-1)?.content).not.toContain('Select **Add Trait**.');
  });

  it('Use the Open Screen off leaves out the open screen and its section', async () => {
    act(() => {
      surfaceRegistry.report(SCREEN_PLACE, 'settings', null);
      surfaceRegistry.report(SCREEN_PLACE + 1, 'settings.display', SCREEN_PLACE);
    });
    const fetchSpy = stubHelpStream(sseReply('Done.'));
    const { field } = await openAsk();
    await send(field, 'What does this do?');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchSpy).messages.at(-1)?.content).toContain('Display holds the theme');

    await setChecks({ 'Use the Open Screen': false });
    await send(field, 'What does this do?');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const sent = sentBody(fetchSpy, 1).messages.at(-1)?.content;
    expect(sent).not.toContain('Display holds the theme');
    expect(sent).not.toContain('Settings dialog');
    surfaceRegistry.clear(SCREEN_PLACE + 1);
  });

  it('History Length sets how many earlier exchanges a request carries', async () => {
    const fetchSpy = stubHelpStream(sseReply('Done.'));
    const { field } = await openAsk();
    const dialog = await openSettings();
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'History Length' }), { target: { value: '0' } });
    await userEvent.keyboard('{Escape}');

    await send(field, 'What is a stat?');
    await waitFor(() => expect(within(conversation()).getAllByText('Done.')).toHaveLength(1));
    await send(field, 'And a trait?');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    expect(sentBody(fetchSpy, 1).messages.filter((message) => message.role !== 'system')).toHaveLength(1);
  });

  it('with every source and the open screen off, sends the question alone and shows no notice and no Nearest Sections', async () => {
    const fetchSpy = stubHelpStream(sseReply(`${GENERAL_KNOWLEDGE_MARKER}\nLight scatters.`));
    const { field } = await openAsk();
    await setChecks({ 'Keyword Search': false, 'AI Picks': false, 'Use the Open Screen': false });
    await send(field, 'Why is the sky blue?');
    await waitFor(() => expect(conversation()).toHaveTextContent('Light scatters.'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument());

    expect(fetchSpy.picks).not.toHaveBeenCalled();
    expect(sentBody(fetchSpy).messages.at(-1)).toEqual({ role: 'user', content: 'Why is the sky blue?' });
    expect(conversation()).not.toHaveTextContent(/not from the guide/i);
    expect(within(conversation()).queryByRole('group', { name: 'Nearest Sections' })).toBeNull();
    expect(within(conversation()).queryByRole('group', { name: 'Sources' })).toBeNull();
  });
});

describe('Formaquestion Settings on a mobile-size screen', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
  });

  it('hides the sheet while the settings are open, and the answer that was coming in finishes', async () => {
    // The answer starts, and its end waits until the test sends it.
    const encoder = new TextEncoder();
    let finish = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(encoder.encode(sseFrame({ content: '1. Open the **Traits** tab.' })));
        finish = () => {
          for (const frame of sseReply('\n2. Select **Add Trait**.')) stream.enqueue(encoder.encode(frame));
          stream.close();
        };
      },
    });
    stubHelpStream(() => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(conversation()).toHaveTextContent('Open the Traits tab.'));

    await openSettings();
    const sheet = document.getElementById('formaquestion-window')!;
    expect(sheet).toHaveClass('invisible');
    act(() => finish());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Formaquestion Settings' })).toBeNull());
    expect(sheet).not.toHaveClass('invisible');
    expect(document.getElementById('formaquestion-window')).toBe(sheet);
    await waitFor(() => expect(conversation()).toHaveTextContent('Open the Traits tab. Select Add Trait.'));
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });
});
