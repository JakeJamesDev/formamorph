import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { World } from '@/types';
import { renderOverviewTab } from '@/test/overviewBench';
import { panelWorld } from '@/test/panelBench';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';

/** The Overview tab's left column: the thumbnail's Generate button, the persona rules and the background music. */

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
const WORLD: World = panelWorld({
  worldOverview: {
    name: 'Sedge Landing', description: 'A fen town.', author: 'Wren', thumbnail: null, bgm: null,
    systemPrompt: 'Narrate the fen.', tags: [],
    introReadme: 'Before you choose, brackish water.',
    readme: 'Once you land, peat-smoke everywhere.',
    promptOverrides: { systemPrompt: 'Narrate in lamplight.', systemPromptEnabled: true },
  },
} as unknown as Partial<World>);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('the World Editor Overview columns', () => {
  // The button's width comes from the box it shares with the picture, so what this can assert in jsdom is
  // the sharing. That it renders at the frame's width was read off the running editor, not from here.
  it('puts the Generate button in the thumbnail frame’s own box', async () => {
    renderOverviewTab(WORLD, 'advanced');
    const generate = await screen.findByRole('button', { name: /Generate with AI/ });
    const box = generate.parentElement;
    expect(box?.querySelector('#image-upload-thumbnail')).not.toBeNull();
  });

});

describe('the Overview persona rules', () => {
  const allowed = () => screen.getByRole('radiogroup', { name: 'Allowed Personas' });
  const startsOn = () => screen.getByRole('combobox', { name: 'Starts On' });
  // The Select's pointer open does not fire inside the bench; the keyboard open does.
  const openStartsOn = async (user: ReturnType<typeof userEvent.setup>) => { startsOn().focus(); await user.keyboard('{Enter}'); };
  const withPersonas = (overview: Partial<World['worldOverview']> = {}, extra: object[] = []) => panelWorld({
    ...WORLD,
    worldOverview: { ...WORLD.worldOverview, ...overview },
    entities: [
      { id: 'e1', name: 'Maren', playerDescription: '', aiDescription: '', persona: true },
      { id: 'e2', name: 'Tobin', playerDescription: '', aiDescription: '', persona: true },
      ...extra,
    ],
  } as unknown as Partial<World>);

  it('reads absent rules as Any on the player default, and Any writes no field', async () => {
    const { ctx } = renderOverviewTab(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    expect(within(allowed()).getByRole('radio', { name: 'Any' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByText('Lets players pick any persona, their own included')).toBeInTheDocument();
    expect(startsOn()).toHaveTextContent("Player's Default");

    fireEvent.click(within(allowed()).getByRole('radio', { name: 'World Only' }));
    await waitFor(() => expect(ctx().worldOverview.allowedPersonas).toBe('world'));
    fireEvent.click(within(allowed()).getByRole('radio', { name: 'Any' }));
    await waitFor(() => expect(ctx().worldOverview.allowedPersonas).toBeUndefined());
  });

  it('keeps its value when the active item is clicked again', async () => {
    const { ctx } = renderOverviewTab(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    fireEvent.click(within(allowed()).getByRole('radio', { name: 'World Only' }));
    fireEvent.click(within(allowed()).getByRole('radio', { name: 'World Only' }));
    expect(ctx().worldOverview.allowedPersonas).toBe('world');
  });

  it('says World Only works like Any while no entity has a Persona role', async () => {
    renderOverviewTab(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    fireEvent.click(within(allowed()).getByRole('radio', { name: 'World Only' }));
    expect(await screen.findByText('Works like Any until you give an entity a Persona role')).toBeInTheDocument();
  });

  it('writes each Starts On pick, and the player default writes no field', async () => {
    const user = userEvent.setup();
    const { ctx } = renderOverviewTab(withPersonas(), 'advanced');
    await screen.findByLabelText('World Name');
    await openStartsOn(user);
    await user.click(await screen.findByRole('option', { name: 'Tobin' }));
    await waitFor(() => expect(ctx().worldOverview.startPersona).toEqual({ source: 'world', entityId: 'e2' }));
    await openStartsOn(user);
    await user.click(await screen.findByRole('option', { name: 'None' }));
    await waitFor(() => expect(ctx().worldOverview.startPersona).toEqual({ source: 'none' }));
    await openStartsOn(user);
    await user.click(await screen.findByRole('option', { name: "Player's Default" }));
    await waitFor(() => expect(ctx().worldOverview.startPersona).toBeUndefined());
  });

  it("offers only the world's personas under World Only, on the first by default", async () => {
    const user = userEvent.setup();
    renderOverviewTab(withPersonas({ allowedPersonas: 'world' }), 'advanced');
    await screen.findByLabelText('World Name');
    expect(screen.getByText('Limits players to the personas this world defines')).toBeInTheDocument();
    expect(startsOn()).toHaveTextContent('Maren');
    await openStartsOn(user);
    await screen.findByRole('option', { name: 'Tobin' });
    expect(screen.queryByRole('option', { name: "Player's Default" })).toBeNull();
    expect(screen.queryByRole('option', { name: 'None' })).toBeNull();
  });

  it('names the Custom Persona entity in place of None', async () => {
    const user = userEvent.setup();
    renderOverviewTab(withPersonas({ allowedPersonas: 'world' }, [
      { id: 'cp', name: 'Wanderer', playerDescription: '', aiDescription: '', customPersona: true },
    ]), 'advanced');
    await screen.findByLabelText('World Name');
    await openStartsOn(user);
    expect(await screen.findByRole('option', { name: 'Wanderer' })).toBeInTheDocument();
  });

  it('shows a persona named by a placeholder as its chip, never as the token behind it', async () => {
    const user = userEvent.setup();
    const token = encodePlaceholderToken({ id: 'p-hero', mode: 'world', placementId: 'v-hero' });
    renderOverviewTab(panelWorld({
      ...withPersonas({ allowedPersonas: 'world' }, [
        { id: 'e3', name: token, playerDescription: '', aiDescription: '', persona: true },
      ]),
      placeholders: [{ id: 'p-hero', name: 'Hero Name', values: phValues(['Ash']) }],
    } as unknown as Partial<World>), 'advanced');
    await screen.findByLabelText('World Name');
    await openStartsOn(user);
    const option = await screen.findByRole('option', { name: /Hero Name/ });
    await user.click(option);
    expect(startsOn()).toHaveTextContent('Hero Name');
    expect(startsOn().textContent).not.toContain('{{ph:');
  });

  it('reads a pick of an entity that is no longer a persona as the default', async () => {
    renderOverviewTab(withPersonas({ startPersona: { source: 'world', entityId: 'gone' } }), 'advanced');
    await screen.findByLabelText('World Name');
    expect(startsOn()).toHaveTextContent("Player's Default");
  });
});

describe('the Overview background music widget', () => {
  it('offers the sound slot while the world has no music', async () => {
    renderOverviewTab(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    const slot = document.querySelector<HTMLElement>('[data-sound-slot="world-bgm"]')!;
    expect(within(slot).getByText('Import')).toBeInTheDocument();
    expect(within(slot).getByRole('button', { name: 'Choose' })).toBeInTheDocument();
    expect(within(slot).getByRole('textbox', { name: 'Sound URL' })).toBeInTheDocument();
  });

  it('links an imported track as a Media List entry, plays it, and clears it on Remove From Slot', async () => {
    const { ctx } = renderOverviewTab(WORLD, 'advanced');
    await screen.findByLabelText('World Name');

    const input = document.querySelector<HTMLInputElement>('#sound-import-world-bgm');
    if (!input) throw new Error('No background music input');
    fireEvent.change(input, {
      target: { files: [new File(['fen-drone'], 'Drone.mp3', { type: 'audio/mpeg' })] },
    });

    const remove = await screen.findByRole('button', { name: 'Remove From Slot' });
    expect(document.querySelector('audio')).not.toBeNull();
    const bgm = ctx().worldOverview.bgm;
    const id = bgm && typeof bgm === 'object' ? bgm.mediaId : '';
    expect(ctx().worldOverview.mediaList?.[id]).toMatchObject({ name: 'Drone', kind: 'sound' });

    fireEvent.click(remove);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove From Slot' })).toBeNull());
    expect(ctx().worldOverview.bgm).toBeNull();
    // The entry stays in the world.
    expect(ctx().worldOverview.mediaList?.[id]).toBeDefined();
  });
});

