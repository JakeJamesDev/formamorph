import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { GENERAL_KNOWLEDGE_MARKER } from '@/lib/formaquestion/generalKnowledge';
import { sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { storeFramedWindow, stubHelpStream } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Stats: '# 📊 Stats\n\nA stat is a number.\n\n## How to Write Stat Code\n\n1. Open the **Code** tab.\n2. Type a script:\n\n```javascript\nreturn stats.hp + 1;\n```\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n' }));
const ANSWER = 'Put this in **Before the AI**:\n\n```javascript before\nreturn stats.hp - 1;\n```';

const conversation = () => screen.getByRole('log', { name: 'Conversation' });

/** Opens the window, asks one question, and waits for the answer to finish. */
async function ask(reply: string) {
  stubHelpStream(sseReply(reply));
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  await userEvent.type(field, 'How do I write stat code?');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByRole('button', { name: 'Send' });
}

beforeEach(() => {
  localStorage.clear();
  storeFramedWindow({ sourcesOpen: true });
  ai.current = helpAi({ requestSurface: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // The stub is an own property; removing it restores jsdom's clipboard.
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('code blocks in the help window', () => {
  it('copies an answer block to the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const success = vi.spyOn(toast, 'success');
    await ask(ANSWER);
    await userEvent.click(await within(conversation()).findByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith('return stats.hp - 1;');
    await waitFor(() => expect(document.querySelector('[data-flash-tip]')).toHaveTextContent('Copied'));
    expect(success).not.toHaveBeenCalled();
  });

  it('shows Copy on a flagged answer', async () => {
    await ask(`${GENERAL_KNOWLEDGE_MARKER}\n${ANSWER}`);
    await within(conversation()).findByText(/not from the guide/);
    expect(within(conversation()).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('shows Copy on a guide page', async () => {
    await ask('Open the **Code** tab.');
    const sources = await within(conversation()).findByRole('group', { name: 'Sources' });
    await userEvent.click(within(sources).getByRole('button', { name: /How to Write Stat Code/ }));
    const article = screen.getByRole('article', { name: '📊 Stats: How to Write Stat Code' });
    expect(within(article).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });
});
