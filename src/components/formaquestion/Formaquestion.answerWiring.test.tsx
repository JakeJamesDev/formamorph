import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { entityAddNote } from '@/lib/formaquestion/entityBlock';
import { helpWorld, type OpenWorld } from '@/lib/formaquestion/helpWorld';
import { registerScriptInsert, reportScriptInsert } from '@/lib/formaquestion/scriptInsert';
import { sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { openWorld, storeFramedWindow, stubHelpStream } from '@/test/helpFixtures';
import type { Entity } from '@/types';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Stats: '# 📊 Stats\n\nA stat is a number.\n\n## How to Write Stat Code\n\n<!-- route: worldEditor.stats -->\n\n1. Open the **Code** tab.\n2. Type a script:\n\n```javascript\nreturn stats.hp + 1;\n```\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n' }));
const UNTAGGED = 'Open the **Code** tab. Use this:\n\n```javascript\nreturn 1;\n```';

const conversation = () => screen.getByRole('log', { name: 'Conversation' });
const insertButtons = () => within(conversation()).getAllByRole('button', { name: 'Insert' });
const helpWindow = () => document.getElementById('formaquestion-window');

async function openWindow() {
  render(<TooltipProvider><Formaquestion loadIndex={loadFixture} /></TooltipProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
}

async function askQuestion(question: string) {
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  await userEvent.type(field, question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByRole('button', { name: 'Send' });
}

/** Opens the window, asks one question, and waits for the answer to finish. */
async function ask(reply: string) {
  stubHelpStream(sseReply(reply));
  await openWindow();
  await askQuestion('How do I write stat code?');
}

/** A stat panel as the bridge sees it. */
function openStat(statName = 'Warmth') {
  const insert = vi.fn();
  let unregister = () => {};
  act(() => { unregister = registerScriptInsert({ homeName: statName, insert }); });
  return { insert, close: () => act(() => unregister()) };
}

let closeStat: () => void = () => {};
let closeEditor: () => void = () => {};
beforeEach(() => {
  localStorage.clear();
  storeFramedWindow({ sourcesOpen: true });
  ai.current = helpAi({ requestSurface: vi.fn() });
});
afterEach(() => {
  closeStat();
  closeStat = () => {};
  closeEditor();
  closeEditor = () => {};
  cleanup();
  vi.unstubAllGlobals();
});

describe('Insert on a help answer', () => {
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

  it('closes the sheet on a mobile-size screen when the panel reports a write', async () => {
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    storeFramedWindow({ sourcesOpen: true, chatStyle: 'minimal' });
    const stat = openStat();
    closeStat = stat.close;
    stat.insert.mockImplementation(() => reportScriptInsert('written'));
    await ask(UNTAGGED);
    await userEvent.click(insertButtons()[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Before the AI' }));
    expect(stat.insert).toHaveBeenCalledOnce();
    await waitFor(() => expect(helpWindow()?.dataset.state ?? 'closed').toBe('closed'));
  });

  it('keeps the desktop window open on a write', async () => {
    const stat = openStat();
    closeStat = stat.close;
    stat.insert.mockImplementation(() => reportScriptInsert('written'));
    await ask(UNTAGGED);
    await userEvent.click(insertButtons()[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'After the AI' }));
    expect(stat.insert).toHaveBeenCalledOnce();
    expect(helpWindow()).toHaveAttribute('data-state', 'open');
  });
});

describe('code blocks in the help window', () => {
  it('shows Copy on a guide page', async () => {
    await ask('Open the **Code** tab.');
    const sources = await within(conversation()).findByRole('group', { name: 'Sources' });
    await userEvent.click(within(sources).getByRole('button', { name: /How to Write Stat Code/ }));
    const article = screen.getByRole('article', { name: '📊 Stats: How to Write Stat Code' });
    expect(within(article).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });
});

describe('Add on an entity card', () => {
  const REPLY = 'Here is a guard:\n\n```entity\nName: Maren Holt\nAI Description: A gate guard who knows every face in town.\nShe never takes a bribe.\n```';
  const addButton = (name: string) => within(within(conversation()).getByRole('group', { name: `Entity: ${name}` })).getByRole('button', { name: 'Add' });
  const ask = (question = 'Make me a gate guard.') => askQuestion(question);

  /** A World Editor as the registry sees it. */
  function openEditor(entities: Entity[] = []) {
    const addEntity = vi.fn((draft: { name: string; aiDescription: string }) => {
      entities.push({ id: `added-${entities.length}`, playerDescription: '', ...draft });
    });
    const editor: OpenWorld = {
      ...openWorld(),
      lean: 'editor',
      world: () => ({
        worldOverview: { name: 'Sedge', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
        stats: [], locations: [], traits: [], items: [], dictionaries: [], entities,
      }),
      addEntity,
    };
    let unregister = () => {};
    act(() => { unregister = helpWorld.register(editor); });
    closeEditor = () => act(() => unregister());
  }

  it('names the added entities on the next question only', async () => {
    const answers = stubHelpStream(sseReply(REPLY));
    openEditor();
    await openWindow();
    await ask();
    await userEvent.click(addButton('Maren Holt'));
    await userEvent.click(addButton('Maren Holt'));
    await ask('Now a merchant.');
    await ask('Thanks.');
    const lastMessage = (call: number) => (JSON.parse(answers.mock.calls[call][1].body as string) as { messages: { content: string }[] }).messages.at(-1)!.content;
    const note = entityAddNote(['Maren Holt', 'Maren Holt']);
    expect(lastMessage(0)).not.toContain(note);
    expect(lastMessage(1).endsWith(note)).toBe(true);
    expect(lastMessage(2)).not.toContain(note);
  });

  it('keeps the note for the next question when a question fails', async () => {
    const answers = stubHelpStream(sseReply(REPLY));
    openEditor();
    await openWindow();
    await ask();
    await userEvent.click(addButton('Maren Holt'));
    answers.mockImplementationOnce(() => new Response('down', { status: 500 }));
    await ask('Now a merchant.');
    await ask('Now a merchant.');
    const lastMessage = (call: number) => (JSON.parse(answers.mock.calls[call][1].body as string) as { messages: { content: string }[] }).messages.at(-1)!.content;
    expect(lastMessage(2).endsWith(entityAddNote(['Maren Holt']))).toBe(true);
  });
});
