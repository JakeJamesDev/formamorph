import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * What the World Editor's Overview tab puts on screen, driven through the real editor.
 *
 * Overview is two forms rather than a list and a panel, so each column is read from its own pane: the
 * identity fields on the left, the writing on the right. A field that goes missing, gains a duplicate or
 * lands out of order shows up here as a changed label list. The Find cases prove the reorder left
 * navigation alone.
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

/** Every readme and prompt holds a word found nowhere else, so a query names the field it lands in. The
 *  narration override is stored and switched on, which is what registers it as something Find can reach. */
const WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'Sedge Landing', description: 'A fen town.', author: 'Wren', thumbnail: null, bgm: null,
    systemPrompt: 'Narrate the fen.', use3DModel: true, tags: [],
    introReadme: 'Before you choose, brackish water.',
    readme: 'Once you land, peat-smoke everywhere.',
    promptOverrides: { systemPrompt: 'Narrate in lamplight.', systemPromptEnabled: true },
  },
} as unknown as Partial<World>);

/** Both column labels, so a label that moves between the columns fails rather than passing twice. */
const FIELD_LABELS = new RegExp(
  '^(World Name|Author|Tags|Thumbnail|3D Player Avatar|Custom Player Avatar|Persona Choice|Background Music'
  + '|Player-Facing Description|Readme|AI-Facing Description|Custom Prompts)$',
);

/** The labels of one editor pane, in document order. Read from the pane rather than the page: both columns
 *  are on screen at once, and the editor's own tab strip carries some of the same words. */
const columnLabels = (panelId: 'editor-list' | 'editor-detail') => {
  const pane = document.querySelector<HTMLElement>(`[data-panel-id="${panelId}"]`);
  if (!pane) throw new Error(`No ${panelId} pane`);
  return within(pane).getAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);
};

const leftLabels = () => columnLabels('editor-list');
const rightLabels = () => columnLabels('editor-detail');

/** The readme's own strip, found by the tabs it holds — the editor's top-level strip has neither name. */
const readmeStrip = () => {
  const strip = screen.getAllByRole('tablist')
    .find((l) => within(l).queryByRole('tab', { name: 'Introduction' }));
  if (!strip) throw new Error('No readme strip');
  return strip;
};

const shownReadmeTab = () => within(readmeStrip()).getAllByRole('tab')
  .find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

/** Which custom-prompt kind the picker has open. Its items are radios, not tabs — and so is the editor's
 *  own Simple/Advanced switch, so the selection is read by kind name rather than by walking the DOM. */
const PROMPT_KINDS = ['Narration', 'Choices', 'Stats', 'Openings'];

const openPromptKind = () => screen.getAllByRole('radio')
  .filter((r) => r.getAttribute('data-state') === 'on')
  .map((r) => r.textContent)
  .filter((t) => t && PROMPT_KINDS.includes(t));

/** Open Find and wait for the bar to take focus. */
const openFind = async () => {
  fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
  await screen.findByRole('search', { name: 'Find and replace in world' });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Find')));
};

/** Type a query and wait for the bar to land on its first hit, which it does on its own. */
const findFirst = async (query: string) => {
  fireEvent.change(screen.getByLabelText('Find'), { target: { value: query } });
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
  it('reads the listing fields, then the avatar, then the music down the left column', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    expect(leftLabels()).toEqual([
      'World Name', 'Author', 'Tags', 'Thumbnail', '3D Player Avatar', 'Custom Player Avatar',
      'Persona Choice', 'Background Music',
    ]);
  });

  it('reads the player-facing text, then the prompts, down the right column', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    expect(rightLabels()).toEqual([
      'Player-Facing Description', 'Readme', 'AI-Facing Description', 'Custom Prompts',
    ]);
  });

  it('drops the avatar upload and the persona choice from the left column in Simple mode, keeping the order', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    await screen.findByLabelText('World Name');
    expect(leftLabels()).toEqual([
      'World Name', 'Author', 'Tags', 'Thumbnail', '3D Player Avatar', 'Background Music',
    ]);
  });

  it('drops Custom Prompts from the right column in Simple mode, keeping the order', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    await screen.findByLabelText('World Name');
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

  // The button's width comes from the box it shares with the picture, so what this can assert in jsdom is
  // the sharing. That it renders at the frame's width was read off the running editor, not from here.
  it('puts the Generate button in the thumbnail frame’s own box', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    const generate = await screen.findByRole('button', { name: /Generate with AI/ });
    const box = generate.parentElement;
    expect(box?.querySelector('#image-upload-thumbnail')).not.toBeNull();
  });

  it('names the avatar checkbox and explains it in a hint beside it', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    const box = await screen.findByRole('checkbox', { name: /3D Player Avatar/ });
    const row = box.closest('div');
    expect(within(row as HTMLElement).getByText('The player can customize it')).toBeInTheDocument();
  });
});

describe('the Overview persona choice', () => {
  const choice = () => screen.getByRole('radiogroup', { name: 'Persona Choice' });

  it('reads an absent setting as Open and writes each value, with Open writing no field', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    expect(within(choice()).getByRole('radio', { name: 'Open' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByText('Lets players pick any persona, or none')).toBeInTheDocument();

    fireEvent.click(within(choice()).getByRole('radio', { name: 'Fixed' }));
    await waitFor(() => expect(ctx().worldOverview.playerSetting).toBe('fixed'));
    expect(screen.getByText('Starts new players with no persona. They can still pick one.')).toBeInTheDocument();

    fireEvent.click(within(choice()).getByRole('radio', { name: 'Open' }));
    await waitFor(() => expect(ctx().worldOverview.playerSetting).toBeUndefined());
  });

  it('keeps its value when the active item is clicked again', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    fireEvent.click(within(choice()).getByRole('radio', { name: 'Fixed' }));
    fireEvent.click(within(choice()).getByRole('radio', { name: 'Fixed' }));
    expect(ctx().worldOverview.playerSetting).toBe('fixed');
  });

  it('says Cast works as Fixed while no entity carries the Persona mark', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    fireEvent.click(within(choice()).getByRole('radio', { name: 'Cast' }));
    expect(await screen.findByText('Works like Fixed until you select Persona on an entity')).toBeInTheDocument();
  });

  it("describes Cast once the world has a persona", async () => {
    const world = benchEditorWorld({
      ...WORLD,
      worldOverview: { ...WORLD.worldOverview, playerSetting: 'cast' },
      entities: [{ id: 'e1', name: 'Maren', playerDescription: '', aiDescription: '', persona: true }],
    } as unknown as Partial<World>);
    renderWorldEditorBench(world, 'advanced');
    await screen.findByLabelText('World Name');
    expect(screen.getByText("Limits players to this world's personas and starts on the first")).toBeInTheDocument();
  });
});

describe('the Overview background music widget', () => {
  it('offers the shared sound dropzone while the world has no music', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    expect(screen.getByText('Add Sound')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove sound' })).toBeNull();
  });

  it('shows the player and the remove control once a track is added, and clears both on remove', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');

    const input = document.querySelector<HTMLInputElement>('#sound-upload-world-bgm');
    if (!input) throw new Error('No background music input');
    fireEvent.change(input, {
      target: { files: [new File(['fen-drone'], 'Drone.mp3', { type: 'audio/mpeg' })] },
    });

    const remove = await screen.findByRole('button', { name: 'Remove sound' });
    expect(document.querySelector('audio')).not.toBeNull();
    // Still the bare data URL the world has always stored, not the widget's media record.
    expect(typeof ctx().worldOverview.bgm).toBe('string');

    fireEvent.click(remove);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove sound' })).toBeNull());
    expect(ctx().worldOverview.bgm).toBeNull();
    expect(screen.getByText('Add Sound')).toBeInTheDocument();
  });
});

describe('a Find hit on the Overview tab', () => {
  it('opens the Gameplay readme and rings it', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    expect(shownReadmeTab()).toBe('Introduction');

    await openFind();
    await findFirst('peat-smoke');

    await waitFor(() => expect(shownReadmeTab()).toBe('Gameplay'));
    expect((await ringed()).textContent).toContain('peat-smoke');
  });

  it('opens the custom prompt kind holding the hit', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    expect(openPromptKind()).toEqual([]);

    await openFind();
    await findFirst('lamplight');

    await waitFor(() => expect(openPromptKind()).toEqual(['Narration']));
    expect((await ringed()).textContent).toContain('lamplight');
  });
});
