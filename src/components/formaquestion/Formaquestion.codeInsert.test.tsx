import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { GENERAL_KNOWLEDGE_MARKER } from '@/lib/formaquestion/generalKnowledge';
import { registerStatCodeInsert, reportStatCodeInsert } from '@/lib/formaquestion/statCodeInsert';
import { sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { storeFramedWindow, stubHelpStream } from '@/test/helpFixtures';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Stats: '# 📊 Stats\n\nA stat is a number.\n\n## How to Write Stat Code\n\n<!-- route: worldEditor.stats -->\n\n1. Open the **Code** tab.\n2. Type a script:\n\n```javascript\nreturn stats.hp + 1;\n```\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n' }));
const TWO_BLOCKS = [
  'Open the **Code** tab. Put this in **Before the AI**:',
  '```javascript before\nself.value = 2;\n```',
  'And this in **After the AI**:',
  '```javascript after\nreturn stats.hp - 1;\n```',
].join('\n\n');
const UNTAGGED = 'Open the **Code** tab. Use this:\n\n```javascript\nreturn 1;\n```';

const conversation = () => screen.getByRole('log', { name: 'Conversation' });
const insertButtons = () => within(conversation()).getAllByRole('button', { name: 'Insert' });
const helpWindow = () => document.getElementById('formaquestion-window');

/** Opens the window, asks one question, and waits for the answer to finish. */
async function ask(reply: string) {
  stubHelpStream(sseReply(reply));
  // The app's root provider, which a tip needs to open.
  render(<TooltipProvider><Formaquestion loadIndex={loadFixture} /></TooltipProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  await userEvent.type(field, 'How do I write stat code?');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByRole('button', { name: 'Send' });
}

/** A stat panel as the bridge sees it. */
function openStat(statName = 'Warmth') {
  const insert = vi.fn();
  let unregister = () => {};
  act(() => { unregister = registerStatCodeInsert({ statName, insert }); });
  return { insert, close: () => act(() => unregister()) };
}

let closeStat: () => void = () => {};
beforeEach(() => {
  localStorage.clear();
  storeFramedWindow({ sourcesOpen: true });
  ai.current = helpAi({ requestSurface: vi.fn() });
});
afterEach(() => {
  closeStat();
  closeStat = () => {};
  cleanup();
  vi.unstubAllGlobals();
});

describe('Insert on a help answer', () => {
  it('is disabled with a reason while no stat panel is open, and Copy still shows', async () => {
    await ask(UNTAGGED);
    const insert = insertButtons()[0];
    expect(insert).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(insert);
    expect(screen.queryByText('Before the AI')).toBeNull();
    await userEvent.hover(insert);
    expect(await screen.findByText("Switch the World Editor to Advanced and open a stat's Code tab")).toBeInTheDocument();
    expect(within(conversation()).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('opens a menu headed by the open stat with the two boxes', async () => {
    const stat = openStat();
    closeStat = stat.close;
    await ask(UNTAGGED);
    await userEvent.click(insertButtons()[0]);
    const menu = await screen.findByRole('menu', { name: 'Insert into Warmth' });
    expect(menu).toHaveTextContent('Warmth');
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Before the AI', 'After the AI']);
    // An untagged fence preselects neither box.
    expect(within(menu).getAllByRole('menuitem').some((item) => item === document.activeElement)).toBe(false);
  });

  it('preselects the box the fence names, and each block inserts into its own box', async () => {
    const stat = openStat();
    closeStat = stat.close;
    await ask(TWO_BLOCKS);
    const [first, second] = insertButtons();

    await userEvent.click(first);
    let menu = await screen.findByRole('menu', { name: 'Insert into Warmth' });
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'Before the AI' })).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    expect(stat.insert).toHaveBeenLastCalledWith('before', 'self.value = 2;');

    await userEvent.click(second);
    menu = await screen.findByRole('menu', { name: 'Insert into Warmth' });
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'After the AI' })).toHaveFocus());
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'After the AI' }));
    expect(stat.insert).toHaveBeenLastCalledWith('after', 'return stats.hp - 1;');
    expect(stat.insert).toHaveBeenCalledTimes(2);
  });

  it('moves between the boxes with the arrow keys, wrapping at the ends', async () => {
    const stat = openStat();
    closeStat = stat.close;
    await ask(UNTAGGED);
    await userEvent.click(insertButtons()[0]);
    const menu = await screen.findByRole('menu', { name: 'Insert into Warmth' });
    await userEvent.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Before the AI' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'After the AI' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Before the AI' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(stat.insert).toHaveBeenCalledExactlyOnceWith('after', 'return 1;');
  });

  it('drops a slot word the model put on the first line, and reads it as the tag', async () => {
    const stat = openStat();
    closeStat = stat.close;
    await ask('Use this:\n\n```javascript\nafter\nreturn 3;\n```');
    await userEvent.click(insertButtons()[0]);
    const menu = await screen.findByRole('menu', { name: 'Insert into Warmth' });
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'After the AI' })).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    expect(stat.insert).toHaveBeenCalledExactlyOnceWith('after', 'return 3;');
  });

  it('keeps Insert on a flagged answer, where Take Me There stays hidden', async () => {
    const stat = openStat();
    closeStat = stat.close;
    await ask(`${GENERAL_KNOWLEDGE_MARKER}\n${UNTAGGED}`);
    await within(conversation()).findByText(/not from the guide/);
    expect(insertButtons()[0]).not.toHaveAttribute('aria-disabled');
    expect(within(conversation()).queryByRole('button', { name: 'Take Me There' })).toBeNull();
  });

  it('disables Insert when the stat panel closes', async () => {
    const stat = openStat();
    await ask(UNTAGGED);
    expect(insertButtons()[0]).not.toHaveAttribute('aria-disabled');
    stat.close();
    expect(insertButtons()[0]).toHaveAttribute('aria-disabled', 'true');
  });

  it('leaves guide pages with Copy alone', async () => {
    const stat = openStat();
    closeStat = stat.close;
    await ask('Open the **Code** tab.');
    const sources = await within(conversation()).findByRole('group', { name: 'Sources' });
    await userEvent.click(within(sources).getByRole('button', { name: /How to Write Stat Code/ }));
    const article = screen.getByRole('article', { name: '📊 Stats: How to Write Stat Code' });
    expect(within(article).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(within(article).queryByRole('button', { name: 'Insert' })).toBeNull();
  });

  it.each(['written', 'confirming'] as const)('closes the sheet on a mobile-size screen when the panel reports %s', async (event) => {
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    storeFramedWindow({ sourcesOpen: true, chatStyle: 'minimal' });
    const stat = openStat();
    closeStat = stat.close;
    stat.insert.mockImplementation(() => reportStatCodeInsert(event));
    await ask(UNTAGGED);
    await userEvent.click(insertButtons()[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Before the AI' }));
    expect(stat.insert).toHaveBeenCalledOnce();
    await waitFor(() => expect(helpWindow()?.dataset.state ?? 'closed').toBe('closed'));
  });

  it('steps aside on the desktop while the replace confirm is open, and comes back when it closes', async () => {
    const stat = openStat();
    closeStat = stat.close;
    stat.insert.mockImplementation(() => reportStatCodeInsert('confirming'));
    await ask(UNTAGGED);
    await userEvent.click(insertButtons()[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'After the AI' }));
    await waitFor(() => expect(helpWindow()?.dataset.state ?? 'closed').toBe('closed'));

    act(() => reportStatCodeInsert('settled'));
    await waitFor(() => expect(helpWindow()).toHaveAttribute('data-state', 'open'));
    expect(conversation()).toHaveTextContent('return 1;');
  });

  it('keeps the desktop window open on a write', async () => {
    const stat = openStat();
    closeStat = stat.close;
    stat.insert.mockImplementation(() => reportStatCodeInsert('written'));
    await ask(UNTAGGED);
    await userEvent.click(insertButtons()[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'After the AI' }));
    expect(stat.insert).toHaveBeenCalledOnce();
    expect(helpWindow()).toHaveAttribute('data-state', 'open');
  });
});
