import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { helpWorld, type OpenWorld } from '@/lib/formaquestion/helpWorld';
import type { WorldIndexInput } from '@/lib/formaquestion/worldIndex';
import { openSseReply, sseFrame, sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { openWorld, storeFramedWindow, stubHelpStream } from '@/test/helpFixtures';
import { renderAskPanel, sendQuestion } from '@/test/askPanelBench';
import type { Entity } from '@/types';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));

/** The help window's side of entity blocks: card or code, Add, and the duplicate tip. */

const index = createDocsIndex({ pages: { Entities: '# Entities\n\nAn entity.\n' }, sidebar: '- [Entities](Entities)\n' });

const GUARD = '```entity\nName: Maren Holt\nAI Description: A gate guard who knows every face in town.\nShe never takes a bribe.\n```';
const REPLY = `Here is a guard:\n\n${GUARD}`;

const conversation = () => screen.getByRole('log', { name: 'Conversation' });
const card = (name: string) => within(conversation()).getByRole('group', { name: `Entity: ${name}` });
const addButton = (name: string) => within(card(name)).getByRole('button', { name: 'Add' });

const openAsk = () => { renderAskPanel(index); };

/** Asks one question and waits for its answer to finish. */
async function ask(question = 'Make me a gate guard.') {
  await sendQuestion(question);
  await screen.findByRole('button', { name: 'Send' });
}

const world = (entities: Entity[] = []): WorldIndexInput => ({
  worldOverview: { name: 'Sedge', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  stats: [], locations: [], traits: [], items: [], dictionaries: [], entities,
});

/** A World Editor as the registry sees it. */
function openEditor(entities: Entity[] = []) {
  const addEntity = vi.fn((draft: { name: string; aiDescription: string }) => {
    entities.push({ id: `added-${entities.length}`, playerDescription: '', ...draft });
  });
  const editor: OpenWorld = { ...openWorld(), lean: 'editor', world: () => world(entities), addEntity };
  let unregister = () => {};
  act(() => { unregister = helpWorld.register(editor); });
  closeEditor = () => act(() => unregister());
  return addEntity;
}

let closeEditor: () => void = () => {};
beforeEach(() => {
  localStorage.clear();
  storeFramedWindow();
  ai.current = helpAi({ requestSurface: vi.fn() });
});
afterEach(() => {
  closeEditor();
  closeEditor = () => {};
  cleanup();
  vi.unstubAllGlobals();
});

describe('an entity block in an answer', () => {
  it('shows as a card with the name, the AI description, Copy and Add', async () => {
    stubHelpStream(sseReply(REPLY));
    openEditor();
    openAsk();
    await ask();
    const shown = card('Maren Holt');
    expect(shown).toHaveTextContent('A gate guard who knows every face in town.');
    expect(shown).toHaveTextContent('She never takes a bribe.');
    expect(within(shown).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(addButton('Maren Holt')).not.toHaveAttribute('aria-disabled');
    expect(conversation().querySelector('pre')).toBeNull();
  });

  it('shows every block of a reply as its own card', async () => {
    stubHelpStream(sseReply(`${REPLY}\n\nAnd a merchant:\n\n\`\`\`entity\nName: Pell\nAI Description: A salt merchant.\n\`\`\``));
    openAsk();
    await ask();
    expect(card('Maren Holt')).toBeInTheDocument();
    expect(card('Pell')).toBeInTheDocument();
  });

  it('shows an invalid block as code with Copy', async () => {
    stubHelpStream(sseReply('Here:\n\n```entity\nName: Maren Holt\nType: guard\nAI Description: A guard.\n```'));
    openAsk();
    await ask();
    expect(within(conversation()).queryByRole('group', { name: /^Entity/ })).toBeNull();
    expect(conversation().querySelector('pre')).toHaveTextContent('Type: guard');
    expect(within(conversation()).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('shows a block that is still arriving as a card with Add off', async () => {
    const reply = openSseReply([sseFrame({ content: 'Here is a guard:\n\n```entity\nName: Maren Holt\nAI Description: A gate guard' })]);
    stubHelpStream(reply.respond);
    openEditor();
    openAsk();
    await sendQuestion('Make me a gate guard.');
    const shown = await within(conversation()).findByRole('group', { name: 'Entity: Maren Holt' });
    expect(shown).toHaveTextContent('A gate guard');
    expect(addButton('Maren Holt')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  });
});

describe('Add on an entity card', () => {
  it('is disabled with its reason when no World Editor is open', async () => {
    stubHelpStream(sseReply(REPLY));
    openAsk();
    await ask();
    const add = addButton('Maren Holt');
    expect(add).toHaveAttribute('aria-disabled', 'true');
    await userEvent.hover(add);
    expect(await screen.findByText('Open the World Editor to add this entity')).toBeInTheDocument();
  });

  it('is disabled in game, which registers no Add', async () => {
    stubHelpStream(sseReply(REPLY));
    let unregister = () => {};
    act(() => { unregister = helpWorld.register(openWorld()); });
    closeEditor = () => act(() => unregister());
    openAsk();
    await ask();
    expect(addButton('Maren Holt')).toHaveAttribute('aria-disabled', 'true');
  });

  it("hands the block's name and AI description to the open World Editor", async () => {
    stubHelpStream(sseReply(REPLY));
    const addEntity = openEditor();
    openAsk();
    await ask();
    await userEvent.click(addButton('Maren Holt'));
    expect(addEntity).toHaveBeenCalledWith({ name: 'Maren Holt', aiDescription: 'A gate guard who knows every face in town.\nShe never takes a bribe.' });
  });

  it('warns when the world has the name, in any case, and still adds', async () => {
    stubHelpStream(sseReply(REPLY));
    const addEntity = openEditor([{ id: 'm', name: 'maren holt', playerDescription: '', aiDescription: '' }]);
    openAsk();
    await ask();
    expect(within(card('Maren Holt')).getByRole('img', { name: 'Your world already has an entity named Maren Holt' })).toBeInTheDocument();
    await userEvent.hover(addButton('Maren Holt'));
    expect(await screen.findByText('Your world already has an entity named Maren Holt')).toBeInTheDocument();
    await userEvent.click(addButton('Maren Holt'));
    expect(addEntity).toHaveBeenCalledTimes(1);
  });

  it('warns once its own Add put the name in the world', async () => {
    stubHelpStream(sseReply(REPLY));
    openEditor();
    openAsk();
    await ask();
    expect(within(card('Maren Holt')).queryByRole('img')).toBeNull();
    await userEvent.click(addButton('Maren Holt'));
    expect(within(card('Maren Holt')).getByRole('img', { name: 'Your world already has an entity named Maren Holt' })).toBeInTheDocument();
  });

  it('shows no warning for a new name', async () => {
    stubHelpStream(sseReply(REPLY));
    openEditor([{ id: 'p', name: 'Pell', playerDescription: '', aiDescription: '' }]);
    openAsk();
    await ask();
    expect(within(card('Maren Holt')).queryByRole('img')).toBeNull();
  });
});
