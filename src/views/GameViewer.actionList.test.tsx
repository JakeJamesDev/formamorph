import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { getGameplayText, setGameplayText } from '@/lib/gameplayTextStore';
import { bodyFixture } from '@/test/bodyFixture';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { Entity, Item, Placement, PlayerStat, Slot, Trait, World } from '@/types';

/** The Action List on the live game: panel actions list, undo restores the state before them (ticket 01). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const stat = (id: string, name: string): PlayerStat => ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] });
const slots: Slot[] = [{ id: 'head', name: 'Head' }];
const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [] };
const ash: Entity = { id: 'ash', name: 'Ash', persona: true, personaOnly: true, traits: [brave], stats: [stat('nerve', 'Nerve')] };
// The script sets the global Calm; the After Use effects add to Ash's Nerve and grant Ash Brave.
const tonic: Item = {
  id: 'tonic', name: 'Tonic', uses: 1, equipRequires: [],
  statEffects: [{ id: 'n', statId: 'nerve', facet: 'value', timing: 'used', duration: { kind: 'time', hours: 2 }, amount: 5, op: 'add' }],
  traitEffects: [{ id: 'b', traitId: 'brave', timing: 'used', duration: { kind: 'time', hours: 2 } }],
  scripts: [{ id: 'u', timing: 'used', code: 'stats.Calm.value = 90;' }],
};
const helm: Item = {
  id: 'helm', name: 'Helm', slotRule: { mode: 'either', slotIds: ['head'] }, statEffects: [], traitEffects: [], equipRequires: [],
  scripts: [{ id: 'off', timing: 'unequipped', code: 'stats.Calm.value = 10;' }],
};
const placements: Placement[] = [
  { id: 'p-tonic', where: { kind: 'you' }, quantity: 3, source: { kind: 'item', itemId: 'tonic' } },
  { id: 'p-helm', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'helm' } },
];
const world: World = {
  ...harborWorld({ stats: [stat('calm', 'Calm')], entities: [ash] }), items: [tonic, helm], slots,
  bodies: [bodyFixture({ id: 'human', name: 'Humanoid', entries: [{ slotId: 'head' }] })], placements,
};

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const value = (id: string) => gameplay().globalStats.find((s) => s.id === id)?.value;
const nerve = () => gameplay().entityStats.ash?.find((s) => s.id === 'nerve')?.value;
const isBrave = () => !!gameplay().ownedTraits.ash?.granted?.includes('brave');
const tonics = () => gameplay().itemCopies.find((c) => c.item.kind === 'item' && c.item.itemId === 'tonic')?.quantity ?? 0;
const tray = () => screen.queryByRole('region', { name: 'Since Last Turn' });
const rows = () => within(tray() ?? document.body).queryAllByRole('listitem').map((li) => li.textContent);

async function start() {
  renderGameViewer(world, { inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ash' } } });
  await screen.findByPlaceholderText(/Type your action/);
  await waitFor(() => expect(gameplay().itemCopies).toHaveLength(2));
  gameplay().setActiveTab('inventory');
  await screen.findByRole('button', { name: 'Use Tonic' });
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the Action List in a game', () => {
  it('shows no tray until a panel action runs', async () => {
    await start();
    expect(tray()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use Tonic' }));
    expect(await screen.findByRole('region', { name: 'Since Last Turn' })).toBeInTheDocument();
    expect(rows()).toEqual(['Used Tonic']);
  });

  it('undoes a use: the copy, the item effect and the script’s write all return', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Use Tonic' }));
    await waitFor(() => expect(value('calm')).toBe(90));
    expect(nerve()).toBe(55);
    expect(isBrave()).toBe(true);
    expect(tonics()).toBe(2);
    fireEvent.click(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(value('calm')).toBe(50));
    expect(nerve()).toBe(50);
    expect(isBrave()).toBe(false);
    expect(tonics()).toBe(3);
    expect(gameplay().itemEffects.timed ?? {}).toEqual({});
    expect(tray()).toBeNull();
  });

  it('collapses three uses into one row and undoes one at a time', async () => {
    await start();
    for (let i = 0; i < 3; i += 1) {
      await waitFor(() => expect(screen.getByRole('button', { name: 'Use Tonic' })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Use Tonic' }));
      await waitFor(() => expect(tonics()).toBe(2 - i));
    }
    expect(rows()).toEqual(['Used Tonic ×3']);
    fireEvent.click(within(tray() as HTMLElement).getByRole('button', { name: 'Undo One' }));
    await waitFor(() => expect(tonics()).toBe(1));
    expect(rows()).toEqual(['Used Tonic ×2']);
  });

  it('leaves no entry for an unequip right after the equip, and runs no unequip script', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Equip Helm' }));
    await waitFor(() => expect(rows()).toEqual(['Equipped Helm']));
    fireEvent.click(await screen.findByRole('button', { name: /: Helm$/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Unequip Helm' }));
    await waitFor(() => expect(tray()).toBeNull());
    expect(gameplay().itemCopies.some((c) => c.equipped)).toBe(false);
    // The unequip script would set Calm to 10.
    await new Promise((r) => setTimeout(r, 50));
    expect(value('calm')).toBe(50);
  });

  it('keeps the notes and narration the player wrote after the action through an undo', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Use Tonic' }));
    await waitFor(() => expect(value('calm')).toBe(90));
    gameplay().setPlayerNotes('Remember the bell.');
    act(() => setGameplayText('The bell rings twice.'));
    await waitFor(() => expect(gameplay().playerNotes).toBe('Remember the bell.'));
    fireEvent.click(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(value('calm')).toBe(50));
    expect(gameplay().playerNotes).toBe('Remember the bell.');
    expect(getGameplayText()).toBe('The bell rings twice.');
  });

  it('holds the next panel action and the undo until the item scripts finish', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Use Tonic' }));
    expect(screen.getByRole('button', { name: 'Use Tonic' })).toBeDisabled();
    expect(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use Tonic' })).toBeEnabled());
    expect(value('calm')).toBe(90);
    expect(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('counts shown and hidden entries, and folds with the chevron', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Use Tonic' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Equip Helm' }));
    await waitFor(() => expect(rows()).toEqual(['Used Tonic', 'Equipped Helm']));
    const region = tray() as HTMLElement;
    const header = within(region).getByRole('button', { name: /Since Last Turn/ });
    expect(header).toHaveTextContent('2 for the AI');
    fireEvent.click(within(region).getAllByRole('button', { name: 'Hide from the AI' })[0]);
    expect(header).toHaveTextContent('1 for the AI · 1 hidden');
    expect(within(region).getByText('Only You')).toBeInTheDocument();
    expect(within(region).getAllByRole('button', { name: /^Undo/ })).toHaveLength(1);
    expect(region.querySelectorAll('svg.lucide-package')).toHaveLength(2);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(header.querySelector('svg.lucide-chevron-right')).toHaveClass('rotate-90');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(header.querySelector('svg.lucide-chevron-right')).not.toHaveClass('rotate-90');
    expect((document.getElementById(header.getAttribute('aria-controls') ?? '') as HTMLElement).style.gridTemplateRows).toBe('0fr');
  });
});

describe('stat edits in the Action List', () => {
  const calmField = () => screen.getByRole('spinbutton', { name: 'Calm' });
  const nerveField = () => screen.getByRole('spinbutton', { name: 'Nerve' });
  const pageStat = (id: string) => gameplay().gameStates[0].globalStats.find((s) => s.id === id)?.value;
  const pageNerve = () => gameplay().gameStates[0].entityStats?.ash?.find((s) => s.id === 'nerve')?.value;

  async function editMode() {
    renderGameViewer(world, { inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ash' } } });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(gameplay().itemCopies).toHaveLength(2));
    // One turn's page snapshot, which a manual edit patches.
    act(() => gameplay().setGameStates([gameplay().saveCurrentGameState()]));
    gameplay().setActiveTab('stats');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Stats' }));
  }

  it('lists a global stat edit hidden, with the Stats icon and both values, and counts it as hidden', async () => {
    await editMode();
    fireEvent.change(calmField(), { target: { value: '70' } });
    await waitFor(() => expect(rows()).toEqual(['Calm 50 → 70Only You']));
    const region = tray() as HTMLElement;
    expect(region.querySelectorAll('svg.lucide-chart-column')).toHaveLength(1);
    expect(within(region).getByRole('button', { name: /Since Last Turn/ })).toHaveTextContent('0 for the AI · 1 hidden');
  });

  it('lists an entity stat edit, and showing it counts it as told to the AI', async () => {
    await editMode();
    fireEvent.change(nerveField(), { target: { value: '65' } });
    await waitFor(() => expect(rows()).toEqual(['Ash’s Nerve 50 → 65Only You']));
    fireEvent.click(within(tray() as HTMLElement).getByRole('button', { name: 'Tell the AI' }));
    expect(within(tray() as HTMLElement).getByRole('button', { name: /Since Last Turn/ })).toHaveTextContent('1 for the AI');
  });

  it('merges a drag into one entry; undo restores the live value and the page snapshot', async () => {
    await editMode();
    for (const v of ['60', '65', '70']) fireEvent.change(calmField(), { target: { value: v } });
    await waitFor(() => expect(value('calm')).toBe(70));
    expect(pageStat('calm')).toBe(70);
    expect(rows()).toEqual(['Calm 50 → 70Only You']);
    fireEvent.click(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(value('calm')).toBe(50));
    expect(pageStat('calm')).toBe(50);
    expect(tray()).toBeNull();
  });

  it('undoes an entity stat edit in the page snapshot too', async () => {
    await editMode();
    fireEvent.change(nerveField(), { target: { value: '65' } });
    await waitFor(() => expect(nerve()).toBe(65));
    expect(pageNerve()).toBe(65);
    fireEvent.click(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(nerve()).toBe(50));
    expect(pageNerve()).toBe(50);
  });

  it('locks the stat fields while a turn runs', async () => {
    await editMode();
    expect(calmField()).toBeEnabled();
    act(() => gameplay().setIsWaitingForAI(true));
    expect(calmField()).toBeDisabled();
  });
});
