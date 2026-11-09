import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import {
  benchEditorWorld, openEditorTab, pickEditorMode, renderWorldEditorBench, searchWorldField,
} from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * What the World Editor's Overview tab puts on screen, driven through the real editor.
 *
 * Overview is two forms rather than a list and a panel, so each column is read from its own pane: the
 * identity fields on the left, the writing on the right. The right column's Details, Custom Prompts and
 * Openings tabs each hold their own fields, so a field that moves between tabs fails as a changed label list.
 * The Find cases prove a hit opens the tab that holds it.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

/** Every readme, prompt and opening holds a word found nowhere else, so a query names the field it lands in.
 *  The narration override is stored and switched on, which is what registers it as something Find can reach. */
const WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'Sedge Landing', description: 'A fen town.', author: 'Wren', thumbnail: null, bgm: null,
    systemPrompt: 'Narrate the fen.', tags: [],
    introReadme: 'Before you choose, brackish water.',
    readme: 'Once you land, peat-smoke everywhere.',
    promptOverrides: { systemPrompt: 'Narrate in lamplight.', systemPromptEnabled: true },
  },
} as unknown as Partial<World>);

/** The same world with an opening of its own, which is what lets its openings be switched. */
const WITH_OPENING: World = benchEditorWorld({
  worldOverview: {
    ...WORLD.worldOverview,
    openings: [{ id: 'o-ferry', text: 'The ferry bell tolls over the reeds.', kind: 'narration' }],
  },
} as unknown as Partial<World>);

/** Both column labels, so a label that moves between the columns fails rather than passing twice. */
const FIELD_LABELS = new RegExp(
  '^(World Name|Author|Tags|Thumbnail|Avatars|Allowed Personas|Starts On|Background Music'
  + '|Player-Facing Description|Readme|AI-Facing Description)$',
);

/** The labels of one editor pane, in document order. Read from the pane rather than the page: both columns
 *  are on screen at once, and the editor's own tab strip carries some of the same words. */
const columnLabels = (panelId: 'editor-list' | 'editor-detail') => {
  const pane = document.querySelector<HTMLElement>(`[data-panel-id="${panelId}"]`);
  if (!pane) throw new Error(`No ${panelId} pane`);
  return within(pane).queryAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);
};

const leftLabels = () => columnLabels('editor-list');
const rightLabels = () => columnLabels('editor-detail');

/** A strip found by its accessible name, apart from the editor's own and the readme's. */
const strip = (name: string) => screen.getByRole('tablist', { name });
const tabNames = (name: string) => within(strip(name)).getAllByRole('tab').map((t) => t.textContent);
const shownTab = (name: string) => within(strip(name)).getAllByRole('tab')
  .find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;
/** Radix tabs switch on mouseDown. */
const openTab = (name: string, tab: string) => fireEvent.mouseDown(within(strip(name)).getByRole('tab', { name: tab }));

const OVERVIEW = 'Overview Fields';
/** The Custom Prompts status rows; a row's name reads "<Kind>, Custom" or "<Kind>, Default". */
const kindRows = () => within(screen.getByRole('list', { name: 'Custom Prompt Kinds' })).getAllByRole('button');
const kindNames = () => kindRows().map((b) => b.getAttribute('aria-label')?.split(',')[0]);
const shownKind = () => kindRows().find((b) => b.getAttribute('aria-current') === 'true')?.getAttribute('aria-label')?.split(',')[0];
const pickKind = (kind: string) => fireEvent.click(kindRows().find((b) => b.getAttribute('aria-label')?.startsWith(`${kind},`))!);

/** The readme's own strip, found by the tabs it holds. */
const readmeStrip = () => {
  const found = screen.getAllByRole('tablist')
    .find((l) => within(l).queryByRole('tab', { name: 'Introduction' }));
  if (!found) throw new Error('No readme strip');
  return found;
};

const shownReadmeTab = () => within(readmeStrip()).getAllByRole('tab')
  .find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

/** Press Ctrl+F and wait for Search World to take focus. */
const openFind = async () => {
  fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
  await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
};

/** Type a query and wait for the search to land on its first hit, which it does on its own. */
const findFirst = async (query: string) => {
  fireEvent.change(searchWorldField(), { target: { value: query } });
  await waitFor(() => expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument());
};

/** The element the reveal ringed, whichever kind of field it turned out to be. */
const ringed = async () =>
  await waitFor(() => {
    const el = document.querySelector('.editor-find-target');
    expect(el).not.toBeNull();
    return el as HTMLElement;
  });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('the World Editor Overview columns', () => {
  it('reads the listing fields, then the persona rules, then the music down the left column', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    expect(leftLabels()).toEqual([
      'World Name', 'Author', 'Tags', 'Thumbnail', 'Allowed Personas', 'Starts On', 'Background Music',
    ]);
  });

  it('splits the right column into Details, Custom Prompts and Openings, opening on Details', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    expect(tabNames(OVERVIEW)).toEqual(['Details', 'Custom Prompts', 'Openings']);
    expect(shownTab(OVERVIEW)).toBe('Details');
    expect(rightLabels()).toEqual(['Player-Facing Description', 'Readme', 'AI-Facing Description']);
  });

  it('keeps the Details fields off the Custom Prompts and Openings tabs', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openTab(OVERVIEW, 'Custom Prompts');
    expect(rightLabels()).toEqual([]);
    expect(screen.getByLabelText('World narration prompt')).toBeInTheDocument();
    openTab(OVERVIEW, 'Openings');
    expect(rightLabels()).toEqual([]);
    expect(screen.queryByLabelText('World narration prompt')).toBeNull();
  });

  it('drops the Avatars and the persona rules from the left column in Simple mode, keeping the order', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    await screen.findByLabelText('World Name');
    expect(leftLabels()).toEqual(['World Name', 'Author', 'Tags', 'Thumbnail', 'Background Music']);
  });

  it('shows the Details fields with no tab strip in Simple mode', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    await screen.findByLabelText('World Name');
    expect(screen.queryByRole('tablist', { name: OVERVIEW })).toBeNull();
    expect(rightLabels()).toEqual(['Player-Facing Description', 'Readme', 'AI-Facing Description']);
  });

  it.each(['simple', 'advanced'] as const)('puts an ⓘ tip beside each description caption in %s mode', async (mode) => {
    renderWorldEditorBench(WORLD, mode);
    await screen.findByLabelText('World Name');
    const pane = document.querySelector<HTMLElement>('[data-panel-id="editor-detail"]')!;
    for (const [caption, reader] of [
      ['Player-Facing Description', /AI never reads it/],
      ['AI-Facing Description', /Players never see it/],
    ] as const) {
      const row = within(pane).getByText(caption).parentElement!;
      const info = within(row).getByRole('button', { name: 'More info' });
      fireEvent.click(info);
      expect(await screen.findByText(reader)).toBeTruthy();
      fireEvent.click(info);
      await waitFor(() => expect(screen.queryByText(reader)).toBeNull());
    }
  });
});

describe('the Custom Prompts tab', () => {
  it('opens on Narration, with one prompt always showing', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openTab(OVERVIEW, 'Custom Prompts');
    expect(kindNames()).toEqual(['Narration', 'Choices', 'Stats']);
    expect(shownKind()).toBe('Narration');

    // Picking the open kind again keeps it open: one prompt always shows.
    pickKind('Narration');
    expect(shownKind()).toBe('Narration');
    pickKind('Choices');
    expect(shownKind()).toBe('Choices');
    expect(screen.getByLabelText('World choices prompt')).toBeInTheDocument();
  });

  it('switches a prompt off and keeps its text, then back on', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openTab(OVERVIEW, 'Custom Prompts');
    const use = screen.getByRole('checkbox', { name: 'Use Narration Prompt' });
    expect(use).toHaveAttribute('data-state', 'checked');

    await act(async () => { fireEvent.click(use); });
    expect(ctx().worldOverview.promptOverrides).toMatchObject({
      systemPrompt: 'Narrate in lamplight.', systemPromptEnabled: false,
    });
    expect(screen.getByRole('checkbox', { name: 'Use Narration Prompt' })).toHaveAttribute('data-state', 'unchecked');
    // Switching off leaves the author on the panel, with the text still in its field.
    expect(shownKind()).toBe('Narration');
    expect(screen.getByLabelText('World narration prompt').textContent).toContain('Narrate in lamplight.');

    await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: 'Use Narration Prompt' })); });
    expect(ctx().worldOverview.promptOverrides).toMatchObject({
      systemPrompt: 'Narrate in lamplight.', systemPromptEnabled: true,
    });
  });
});

describe('the Openings tab', () => {
  it('disables its switch while the world has no opening', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openTab(OVERVIEW, 'Openings');
    expect(screen.getByRole('checkbox', { name: 'Use These Openings' })).toBeDisabled();
  });

  it('switches the world openings off and on once one exists', async () => {
    const { ctx } = renderWorldEditorBench(WITH_OPENING, 'advanced');
    await screen.findByLabelText('World Name');
    openTab(OVERVIEW, 'Openings');
    const use = screen.getByRole('checkbox', { name: 'Use These Openings' });
    expect(use).toBeEnabled();
    expect(use).toHaveAttribute('data-state', 'checked');

    await act(async () => { fireEvent.click(use); });
    expect(ctx().worldOverview.openingsEnabled).toBe(false);
    expect(ctx().worldOverview.openings).toHaveLength(1);
    await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: 'Use These Openings' })); });
    expect(ctx().worldOverview.openingsEnabled).not.toBe(false);
  });
});

describe('the remembered Overview tab', () => {
  it('keeps the right-column tab and the prompt kind across a visit to another editor tab', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openTab(OVERVIEW, 'Custom Prompts');
    pickKind('Stats');

    openEditorTab(/Stats/);
    openEditorTab(/Overview/);
    await screen.findByLabelText('World Name');
    expect(shownTab(OVERVIEW)).toBe('Custom Prompts');
    expect(shownKind()).toBe('Stats');
  });

  it('shows Details in Simple mode and returns to the kept tab in Advanced', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openTab(OVERVIEW, 'Openings');

    pickEditorMode('Simple');
    await waitFor(() => expect(screen.queryByRole('tablist', { name: OVERVIEW })).toBeNull());
    expect(rightLabels()).toEqual(['Player-Facing Description', 'Readme', 'AI-Facing Description']);

    pickEditorMode('Advanced');
    await waitFor(() => expect(shownTab(OVERVIEW)).toBe('Openings'));
  });
});

describe('a Find hit on the Overview tab', () => {
  it('opens Details and the Gameplay readme from another tab, and rings it', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openTab(OVERVIEW, 'Custom Prompts');

    await openFind();
    await findFirst('peat-smoke');

    await waitFor(() => expect(shownTab(OVERVIEW)).toBe('Details'));
    await waitFor(() => expect(shownReadmeTab()).toBe('Gameplay'));
    expect((await ringed()).textContent).toContain('peat-smoke');
  });

  it('opens Custom Prompts on the kind holding the hit', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openTab(OVERVIEW, 'Custom Prompts');
    pickKind('Choices');
    openTab(OVERVIEW, 'Details');

    await openFind();
    await findFirst('lamplight');

    await waitFor(() => expect(shownTab(OVERVIEW)).toBe('Custom Prompts'));
    expect(shownKind()).toBe('Narration');
    expect((await ringed()).textContent).toContain('lamplight');
  });

  it('leaves the remembered tab alone when Overview remounts with a hit still held', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    await openFind();
    await findFirst('lamplight');
    await waitFor(() => expect(shownTab(OVERVIEW)).toBe('Custom Prompts'));

    openTab(OVERVIEW, 'Details');
    openEditorTab(/Stats/);
    openEditorTab(/Overview/);
    await screen.findByLabelText('World Name');
    expect(shownTab(OVERVIEW)).toBe('Details');
  });

  it('opens the Openings tab for a hit in a world opening', async () => {
    renderWorldEditorBench(WITH_OPENING, 'advanced');
    await screen.findByLabelText('World Name');

    await openFind();
    await findFirst('ferry');

    await waitFor(() => expect(shownTab(OVERVIEW)).toBe('Openings'));
    expect((await ringed()).textContent).toContain('ferry');
  });
});
