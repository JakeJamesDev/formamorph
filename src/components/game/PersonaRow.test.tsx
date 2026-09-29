import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGameplay } from '@/contexts/GameplayContext';
import { renderInGame, renderRightPanel, worldFixture, type TurnFixture } from '@/test/gamePanels';
import { PersonaRow } from './PersonaRow';
import { usePersonaNotice } from '@/lib/usePersonaNotice';
import EntityStorageService from '@/services/EntityStorageService';
import { readWorldPersona } from '@/lib/personaPick';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import type { Entity, PersonaRef } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('react-toastify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-toastify')>();
  return { ...actual, toast: Object.assign(vi.fn(), actual.toast, { warn }) };
});

const wren: Entity = { id: 'l-wren', name: 'Wren', persona: true, images: ['data:image/webp;base64,AA'] };
const ash: Entity = { id: 'l-ash', name: 'Ash', persona: true };
const store = (entity: Entity) => EntityStorageService.storeEntity({ id: entity.id, name: entity.name, data: entity });

const NoticeProbe = () => { usePersonaNotice(); return null; };
// Remounts the probe on every notes edit, the way the mobile layout remounts a panel on a tab switch.
const RemountingProbe = () => <NoticeProbe key={useGameplay().playerNotes} />;
const row = () =>screen.getByTestId('persona-row');
const openPicker = async () => {
  await userEvent.click(within(row()).getByRole('button', { name: 'Change' }));
  return screen.findByRole('dialog');
};
const pick = async (dialog: HTMLElement, name: string) => {
  await userEvent.click(await within(dialog).findByRole('radio', { name }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
};

beforeEach(async () => {
  warn.mockClear();
  for (const meta of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(meta.id);
});

describe('the persona row', () => {
  it('shows None for a save from before personas, and a Change gives it one', async () => {
    await store(wren);
    const turns: TurnFixture[] = [{ narration: 'You meet Vos.', summary: 'The player met Vos.' }];
    const h = renderRightPanel({}, { turns });
    await act(async () => { h.gameData().setWorldId('w1'); });
    expect(h.gameplay().personaRef).toBeUndefined();
    expect(within(row()).getByText('None')).toBeTruthy();
    const history = h.gameplay().fullMessageHistory;

    await pick(await openPicker(), 'Wren');

    const ref: PersonaRef = { source: 'library', entityId: 'l-wren' };
    expect(h.gameplay().personaRef).toEqual(ref);
    expect(readWorldPersona('w1')).toEqual(ref);
    await waitFor(() => expect(within(row()).getByText('Wren')).toBeTruthy());
    expect(row().querySelector('img')?.getAttribute('src')).toBe(wren.images?.[0]);
    // No re-attribution: the memory written before the change keeps its words.
    expect(h.gameplay().fullMessageHistory).toBe(history);
    expect(warn).not.toHaveBeenCalled();
  });

  it('stands the Custom Persona entity in None’s place, and carries the entered name into the ref and the row', async () => {
    const you: Entity = { id: 'w-you', name: 'Wanderer', customPersona: true, playerDescription: 'A newcomer to the fen.' };
    const onPersonaChange = vi.fn();
    const h = renderRightPanel({ onPersonaChange }, { world: { entities: [you] } });
    expect(within(row()).getByText('Wanderer')).toBeTruthy();
    const dialog = await openPicker();
    expect(within(dialog).queryByRole('radio', { name: 'None' })).toBeNull();
    expect(within(dialog).getByRole('radio', { name: 'Wanderer' })).toBeChecked();
    expect(within(dialog).getByText('A newcomer to the fen.')).toBeTruthy();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Ash');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Description' }), 'Quiet.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
    const ref: PersonaRef = { source: 'none', name: 'Ash', description: 'Quiet.' };
    expect(h.gameplay().personaRef).toEqual(ref);
    expect(onPersonaChange).toHaveBeenCalledWith(ref, 'Ash');
    await waitFor(() => expect(within(row()).getByText('Ash')).toBeTruthy());
  });

  it('hands the new persona and its name on, so the traits can settle under it', async () => {
    await store(wren);
    const onPersonaChange = vi.fn();
    renderRightPanel({ onPersonaChange });
    await pick(await openPicker(), 'Wren');
    expect(onPersonaChange).toHaveBeenCalledWith({ source: 'library', entityId: 'l-wren' }, 'Wren');
  });

  it('leaves a persona already in play as a character out of the picker', async () => {
    await Promise.all([store(wren), store(ash)]);
    renderRightPanel({}, {
      seed: (g) => g.setDiscoveredEntities([{ entity: { id: 'copy', name: 'Wren' }, sourceTurnId: 'initial' }]),
    });
    const dialog = await openPicker();
    await within(dialog).findByRole('radio', { name: 'Ash' });
    expect(within(dialog).queryByRole('radio', { name: 'Wren' })).toBeNull();
  });

  it('keeps showing a persona that lost its mark, which the picker no longer offers once left', async () => {
    const unmarked: Entity = { id: 'l-old', name: 'Old Self' };
    await Promise.all([store(unmarked), store(ash)]);
    const h = renderRightPanel({}, { seed: (g) => g.setPersonaRef({ source: 'library', entityId: 'l-old' }) });
    await waitFor(() => expect(within(row()).getByText('Old Self')).toBeTruthy());
    expect(warn).not.toHaveBeenCalled();

    let dialog = await openPicker();
    await within(dialog).findByRole('radio', { name: 'Ash' });
    expect(within(dialog).queryByRole('radio', { name: 'Old Self' })).toBeNull();
    await pick(dialog, 'None');
    expect(h.gameplay().personaRef).toEqual({ source: 'none' });
    expect(within(row()).getByText('None')).toBeTruthy();

    dialog = await openPicker();
    await within(dialog).findByRole('radio', { name: 'Ash' });
    expect(within(dialog).queryByRole('radio', { name: 'Old Self' })).toBeNull();
  });

  it('raises one notice per load for a persona that no longer exists, never one per turn', async () => {
    const h = renderInGame(<><RemountingProbe /><PersonaRow onChange={vi.fn()} /></>, {
      seed: (g) => g.setPersonaRef({ source: 'library', entityId: 'l-gone' }),
    });
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(within(row()).getByText('None')).toBeTruthy();

    // Later turns re-render, and remount, with the same reference.
    await act(async () => { h.gameplay().setPlayerNotes('turn two'); });
    await act(async () => { h.gameplay().setPlayerNotes('turn three'); });
    expect(warn).toHaveBeenCalledTimes(1);

    // A second load sets a fresh reference, so it gets its own notice.
    await act(async () => { h.gameplay().setPersonaRef({ source: 'library', entityId: 'l-gone' }); });
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
  });
});

describe('world personas in the Change picker', () => {
  const warden: Entity = { id: 'w-warden', name: 'Harbor Warden', persona: true, locations: ['dock'] };
  const clerk: Entity = { id: 'w-clerk', name: 'Dock Clerk', locations: ['dock'] };
  const world = { entities: [warden, clerk] };
  // Reads the cast every in-play reader takes.
  const CastProbe = () => <ul data-testid="cast">{useResolvedWorld().entities.map((e) => <li key={e.id}>{e.name}</li>)}</ul>;
  const castNames = () => within(screen.getByTestId('cast')).queryAllByRole('listitem').map((li) => li.textContent);

  it("lists the world's marked entities under their own heading, apart from the library personas", async () => {
    await store(ash);
    renderInGame(<PersonaRow onChange={vi.fn()} />, { world });
    const dialog = await openPicker();
    await within(dialog).findByRole('radio', { name: 'Ash' });
    const order = [...dialog.querySelectorAll('[role="radio"], h3')].map((el) => el.getAttribute('aria-label') ?? el.textContent);
    expect(order).toEqual(['None', 'From This World', 'Harbor Warden', 'Your Personas', 'Ash']);
  });

  it("shows each persona's player description under its name", async () => {
    await store({ ...ash, playerDescription: 'A courier who never sleeps.' });
    renderInGame(<PersonaRow onChange={vi.fn()} />, { world: { entities: [{ ...warden, playerDescription: 'Keeps the harbor ledger.' }, clerk] } });
    const dialog = await openPicker();
    await within(dialog).findByText('A courier who never sleeps.');
    expect(within(dialog).getByText('Keeps the harbor ledger.')).toBeTruthy();
  });

  it("lists only the world's personas, with no None, in a World Only world", async () => {
    await store(ash);
    const overview = worldFixture().worldOverview;
    renderInGame(<PersonaRow onChange={vi.fn()} />, { world: { ...world, worldOverview: { ...overview, allowedPersonas: 'world' } } });
    const dialog = await openPicker();
    await within(dialog).findByRole('radio', { name: 'Harbor Warden' });
    expect(within(dialog).queryByRole('radio', { name: 'None' })).toBeNull();
    expect(within(dialog).queryByRole('radio', { name: 'Ash' })).toBeNull();
  });

  it('offers None and the library personas in a world that starts on None', async () => {
    await store(ash);
    const overview = worldFixture().worldOverview;
    renderInGame(<PersonaRow onChange={vi.fn()} />, { world: { ...world, worldOverview: { ...overview, startPersona: { source: 'none' } } } });
    const dialog = await openPicker();
    await within(dialog).findByRole('radio', { name: 'Ash' });
    expect(within(dialog).getByRole('radio', { name: 'None' })).toBeTruthy();
  });

  it('takes a picked world persona out of the cast, and a switch away returns it', async () => {
    await store(ash);
    const h = renderInGame(<><PersonaRow onChange={vi.fn()} /><CastProbe /></>, { world });
    expect(castNames()).toEqual(['Harbor Warden', 'Dock Clerk']);

    await pick(await openPicker(), 'Harbor Warden');
    expect(h.gameplay().personaRef).toEqual({ source: 'world', entityId: 'w-warden' });
    await waitFor(() => expect(within(row()).getByText('Harbor Warden')).toBeTruthy());
    expect(castNames()).toEqual(['Dock Clerk']);

    await pick(await openPicker(), 'Ash');
    await waitFor(() => expect(castNames()).toEqual(['Harbor Warden', 'Dock Clerk']));
  });
});
