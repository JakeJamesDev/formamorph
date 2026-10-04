import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { HELP_CHIP } from '@/lib/formaquestion/helpChips';
import { pickList } from '@/lib/formaquestion/helpPicks';
import { DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpPrompt, EMPTY_HELP_PRESET_STORE } from '@/lib/formaquestion/helpPresets';
import { helpSettingsCodec, helpSettingsOf } from '@/lib/formaquestion/helpSettings';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { openSseReply, sseFrame, sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { stubHelpStream } from '@/test/helpFixtures';
import { renderReporting } from '@/test/surfaceReporter';
import { AI_CONTEXT_COPY } from './formaquestionSettingsTabs';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
const download = vi.hoisted(() => vi.fn<(blob: Blob, name: string) => void>());
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: download }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Settings: '# ⚙️ Settings\n\nSettings hold your options.\n\n## Display\n\nDisplay holds the theme and text size.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Settings](Settings)\n- [Traits](Traits)\n' });
const loadFixture = () => Promise.resolve(index);
/** The pick list's line for the Traits how-to, as a pick reply copies it. */
const TRAIT_LINE = pickList(index).lines.find((line) => line.includes('How to Add a Trait'))!;

const STORAGE_KEY = 'FORMAMORPH_helpSettings';

/** The text of a blob. jsdom's Blob has no `text()`. */
const blobText = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(reader.error);
  reader.readAsText(blob);
});

const conversation = () => screen.getByRole('log', { name: 'Conversation' });

const aiContext = () => screen.getByRole('dialog', { name: 'AI Context' });

function setScreenWidth(width: number) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('matchMedia', (query: string) => {
    const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
    return { matches: query.includes('max-width') && width <= max, media: query, addEventListener: () => {}, removeEventListener: () => {} };
  });
}

async function openAsk() {
  const view = renderReporting(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  return { view, field };
}

async function send(field: HTMLElement, question: string) {
  await userEvent.type(field, question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await within(conversation()).findByRole('group', { name: 'Sources' });
}

/** The dialog's question line reads this. The quote marks are CSS, so the text has none. */
const questionLine = (dialog: HTMLElement, text: string) =>
  within(dialog).getByText((_content, element) => element?.tagName === 'DIV' && element.textContent === text);

/** Opens AI Context from the title bar menu. */
async function openAiContext() {
  await userEvent.click(screen.getByRole('button', { name: 'More Actions' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'AI Context' }));
  return aiContext();
}

beforeEach(() => {
  localStorage.clear();
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AI Context in Formaquestion', () => {
  it('opens from the title bar menu, and the dialog reports to the surface registry', async () => {
    await openAsk();
    await openAiContext();
    await waitFor(() => expect(surfaceRegistry.get()).toMatchObject({ dialog: 'formaquestionAiContext' }));
    expect(within(aiContext()).getByText(AI_CONTEXT_COPY.empty)).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'AI Context' })).toBeNull());
  });

  it('shows a question: its Search block, then its pick and answer cards', async () => {
    stubHelpStream([sseFrame({ reasoning: 'Traits first.' }), ...sseReply('Select **Add Trait**.')], TRAIT_LINE);
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    const dialog = await openAiContext();

    const question = within(dialog).getByRole('group', { name: 'How do I add a trait?' });
    expect(within(question).getByText('Search')).toBeInTheDocument();
    expect(within(question).getByText(`Sources on: ${AI_CONTEXT_COPY.sources.keyword}, ${AI_CONTEXT_COPY.sources.aiPicks}`)).toBeInTheDocument();
    expect(within(question).getByText('Request 1: AI Search')).toBeInTheDocument();
    expect(within(question).getByText('Request 2: Answer')).toBeInTheDocument();
    // The endpoint, the samplers and the reasoning of each request show on its card.
    expect(within(question).getAllByText('cloud · m')).toHaveLength(2);
    expect(within(question).getAllByText('Temp 0.2 · Rep 1')).toHaveLength(2);
    expect(within(question).getByText('Traits first.')).toBeInTheDocument();
    expect(within(question).getByText('Select **Add Trait**.')).toBeInTheDocument();
    expect(within(question).queryByText(AI_CONTEXT_COPY.customPrompt.label)).toBeNull();
  });

  it('lists each source and the merged order, and marks the sections that reached the model', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'), TRAIT_LINE);
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    const dialog = await openAiContext();
    const question = within(dialog).getByRole('group', { name: 'How do I add a trait?' });

    const lists = within(question).getAllByRole('list');
    const labels = lists.map((list) => list.previousElementSibling?.textContent);
    expect(labels).toEqual([AI_CONTEXT_COPY.sources.keyword, AI_CONTEXT_COPY.sources.aiPicks, 'Merged', 'Sent']);
    for (const list of lists) {
      const sent = within(list).getAllByRole('listitem').filter((item) => item.hasAttribute('data-sent'));
      expect(sent.map((item) => item.textContent)).toContain(`Traits › How to Add a Trait${AI_CONTEXT_COPY.sent}`);
    }
    // The Settings page has no word of the question, so it reached no list as sent.
    expect(within(question).queryByText(/Settings › Display.*sent/)).toBeNull();
  });

  it('marks the request whose prompt differs from the default text', async () => {
    // A stored custom preset with an edited answer prompt, active, and the switch on.
    let presets = duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine');
    presets = editHelpPrompt(presets, 'mine', 'answer', `Be brief. ${HELP_CHIP.marker}`);
    localStorage.setItem(STORAGE_KEY, helpSettingsCodec.serialize(helpSettingsOf({ presets })));
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    const dialog = await openAiContext();

    const question = within(dialog).getByRole('group', { name: 'How do I add a trait?' });
    const marks = within(question).getAllByText(AI_CONTEXT_COPY.customPrompt.label);
    expect(marks).toHaveLength(1);
    expect(marks[0].closest('button')?.textContent).toContain('Request 2: Answer');
    expect(within(question).getByText(/Preset: /)).toHaveTextContent('Preset: Mine');
  });

  it('empties with Clear, and exports every question as JSON', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    let dialog = await openAiContext();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Export' }));
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][1]).toBe('ai-context-formaquestion.json');
    const exported = JSON.parse(await blobText(download.mock.calls[0][0])) as { question: string; trace: { requests: { record: { type: string } }[] } }[];
    expect(exported.map((entry) => entry.question)).toEqual(['How do I add a trait?']);
    expect(exported[0].trace.requests.map((request) => request.record.type)).toEqual(['AI Search', 'Answer']);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'AI Context' })).toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'More Actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Clear Conversation' }));
    dialog = await openAiContext();
    expect(within(dialog).queryByRole('group', { name: 'How do I add a trait?' })).toBeNull();
    expect(within(dialog).getByText(AI_CONTEXT_COPY.empty)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('shows one question per page, opens on the newest, and pages back to an earlier one', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await userEvent.type(field, 'And the theme?');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(within(conversation()).getAllByRole('group', { name: 'Sources' })).toHaveLength(2));
    const dialog = await openAiContext();

    expect(questionLine(dialog, 'Question 2 of 2 — And the theme?')).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'And the theme?' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('group', { name: 'How do I add a trait?' })).toBeNull();
    expect(within(dialog).getByRole('navigation', { name: 'pagination' })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByLabelText('Go to previous page'));
    expect(questionLine(dialog, 'Question 1 of 2 — How do I add a trait?')).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'How do I add a trait?' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('group', { name: 'And the theme?' })).toBeNull();

    // Collapse all folds the open page alone. The other page keeps its blocks open.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Collapse all' }));
    expect(within(dialog).queryByText('Raw Output')).toBeNull();
    await userEvent.click(within(dialog).getByLabelText('Go to next page'));
    expect(within(dialog).getAllByText('Raw Output')).toHaveLength(2);
    expect(within(dialog).getByRole('button', { name: 'Collapse all' })).toBeInTheDocument();
  });

  it('shows no pager for one question', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    const dialog = await openAiContext();
    expect(questionLine(dialog, 'Question 1 of 1 — How do I add a trait?')).toBeInTheDocument();
    expect(within(dialog).queryByRole('navigation', { name: 'pagination' })).toBeNull();
  });

  it('collapses and expands every block at once', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    const dialog = await openAiContext();
    expect(within(dialog).getAllByText('Raw Output')).toHaveLength(2);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Collapse all' }));
    expect(within(dialog).queryByText('Raw Output')).toBeNull();
    expect(within(dialog).queryByText(/Preset: /)).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Expand all' }));
    expect(within(dialog).getAllByText('Raw Output')).toHaveLength(2);
  });

  it('shows a source that was on but ranked nothing as having no ranking', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    const dialog = await openAiContext();
    expect(within(dialog).getByText(`${AI_CONTEXT_COPY.sources.aiPicks}: ${AI_CONTEXT_COPY.noRanking}`)).toBeInTheDocument();
  });

  it('unmounts during a stream with the dialog open, and the late events reach nothing', async () => {
    const reply = openSseReply([sseFrame({ content: '1. Select' })]);
    stubHelpStream(reply.respond);
    localStorage.setItem(STORAGE_KEY, helpSettingsCodec.serialize(helpSettingsOf()));
    const { view, field } = await openAsk();
    await userEvent.type(field, 'How do I add a trait?');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('button', { name: 'Stop' });
    const dialog = await openAiContext();
    // The trace arrives once the answer request is built, while its reply is still open.
    await within(dialog).findByText('Request 1: AI Search');

    // The unmount ends the request; the stream's reader closes it, so nothing writes to the gone state.
    view.unmount();
    await waitFor(() => expect(reply.cancel).toHaveBeenCalled());
  });

  it('keeps the sheet under it, inert, on a mobile-size screen, and live again after', async () => {
    setScreenWidth(375);
    await openAsk();
    const sheet = screen.getByRole('dialog', { name: 'Formaquestion' });
    expect(sheet).toHaveAttribute('data-fq-sheet');
    const layer = sheet.closest<HTMLElement>('[data-shielded-layer]')!;
    await openAiContext();
    expect(Number(layer.style.zIndex)).toBeLessThan(50);
    expect((layer.firstElementChild as HTMLElement).inert).toBe(true);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'AI Context' })).toBeNull());
    expect(Number(layer.style.zIndex)).toBeGreaterThan(50);
    expect((layer.firstElementChild as HTMLElement).inert).toBe(false);
  });
});
