import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { storeFramedWindow, stubHelpStream } from '@/test/helpFixtures';
import { AI_CONTEXT_COPY } from './formaquestionSettingsTabs';
import type { HelpAi } from './useHelpAi';

// The navigation request is the window's one way into the app, through the settings seam.
const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Settings: '# ⚙️ Settings\n\nSettings hold your options.\n\n## How to Change the Theme\n\n<!-- route: settings.display -->\n\n1. Open the **Display** tab.\n2. Pick a theme.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n\n## How to Add a Trait Color\n\n<!-- route: settings.display -->\n\nA trait takes the theme color.\n',
  Help: '# ❓ Help\n\nThe help window answers questions.\n\n## How to Edit the Help Prompt\n\n<!-- route: formaquestionSettings.prompts -->\n\n1. Open the **Prompts** tab of the help settings.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Settings](Settings)\n- [Traits](Traits)\n- [Help](Help)\n' }));

const conversation = () => screen.getByRole('log', { name: 'Conversation' });
/** The window, or null once it has closed. */
const helpWindow = () => document.getElementById('formaquestion-window');
const takeMeThere = () => within(conversation()).queryByRole('button', { name: 'Take Me There' });
/** The source links, in order: the group's buttons less its toggle and Take Me There. */
const sourceNames = () => within(within(conversation()).getByRole('group', { name: 'Sources' })).getAllByRole('button')
  .filter((button) => !button.hasAttribute('aria-expanded') && button.textContent !== 'Take Me There')
  .map((button) => button.textContent);

function setScreenWidth(width: number) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('matchMedia', (query: string) => {
    const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
    return { matches: query.includes('max-width') && width <= max, media: query, addEventListener: () => {}, removeEventListener: () => {} };
  });
}

/** Opens the window, asks one question, and waits for the answer's sources. */
async function ask(question: string, reply = 'Open the **Display** tab.') {
  stubHelpStream(sseReply(reply));
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  await userEvent.type(field, question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await within(conversation()).findByRole('group', { name: 'Sources' });
}

beforeEach(() => {
  localStorage.clear();
  storeFramedWindow({ sourcesOpen: true });
  ai.current = helpAi({ requestSurface: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Take Me There', () => {
  it('sends the top source route, and the desktop window stays open', async () => {
    await ask('How do I change the theme?');
    expect(sourceNames()[0]).toContain('How to Change the Theme');
    await userEvent.click(takeMeThere()!);
    expect(ai.current.requestSurface).toHaveBeenCalledExactlyOnceWith('settings.display');
    expect(helpWindow()).toHaveAttribute('data-state', 'open');
  });

  it('is absent when the top source has no route, though a later source has one', async () => {
    await ask('How do I add a trait?');
    const names = sourceNames();
    expect(names[0]).toContain('How to Add a Trait');
    expect(names.slice(1).some((name) => name?.includes('How to Add a Trait Color'))).toBe(true);
    expect(takeMeThere()).toBeNull();
  });

  it('closes the sheet on a mobile-size screen', async () => {
    setScreenWidth(375);
    storeFramedWindow({ sourcesOpen: true, chatStyle: 'minimal' });
    await ask('How do I change the theme?');
    await userEvent.click(takeMeThere()!);
    expect(ai.current.requestSurface).toHaveBeenCalledExactlyOnceWith('settings.display');
    await waitFor(() => expect(helpWindow()?.dataset.state ?? 'closed').toBe('closed'));
  });

  it('opens a help window surface itself and sends no request', async () => {
    await ask('How do I edit the help prompt?', 'Open the **Prompts** tab.');
    await userEvent.click(takeMeThere()!);
    const settings = await screen.findByRole('dialog', { name: 'Formaquestion Settings' });
    expect(within(settings).getByRole('tab', { name: 'Prompts' })).toHaveAttribute('data-state', 'active');
    expect(ai.current.requestSurface).not.toHaveBeenCalled();
  });

  it('waits for the answer to finish', async () => {
    stubHelpStream(() => new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'text/event-stream' } }));
    render(<Formaquestion loadIndex={loadFixture} />);
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
    await userEvent.type(field, 'How do I change the theme?');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('button', { name: 'Stop' });
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await within(conversation()).findByText('Stopped');
    expect(takeMeThere()).toBeNull();
  });

  it('names the route in AI Context', async () => {
    await ask('How do I change the theme?');
    await userEvent.click(screen.getByRole('button', { name: 'More Actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'AI Context' }));
    const dialog = await screen.findByRole('dialog', { name: 'AI Context' });
    expect(within(dialog).getByText(`${AI_CONTEXT_COPY.route}: settings.display`)).toBeInTheDocument();
  });
});
