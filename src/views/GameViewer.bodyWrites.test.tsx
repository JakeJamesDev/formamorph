import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { bodyFixture } from '@/test/bodyFixture';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { Body, Item, PlayerStat, Placement, Script, Slot, Trait, World } from '@/types';

/** A between-turn switch script writes the player's Body: the settle runs at once, not at the next turn (Q56). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const slots: Slot[] = [{ id: 'head', name: 'Head' }, { id: 'collar', name: 'Collar' }];
const bodies: Body[] = [
  bodyFixture({ id: 'human', name: 'Humanoid', entries: [{ slotId: 'head' }] }),
  bodyFixture({ id: 'wolf', name: 'Wolf', entries: [{ slotId: 'collar' }] }),
];
const calm: PlayerStat = { id: 'calm', name: 'Calm', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const unequipScript: Script = { id: 'off', timing: 'unequipped', code: 'stats.Calm.value = 99;' };
const helm: Item = {
  id: 'helm', name: 'Helm', slotRule: { mode: 'either', slotIds: ['head'] }, statEffects: [], traitEffects: [], equipRequires: [], scripts: [unequipScript],
};
const placements: Placement[] = [{ id: 'p-helm', where: { kind: 'you' }, quantity: 1, equipped: true, source: { kind: 'item', itemId: 'helm' } }];
const howl: Trait = { id: 'howl', name: 'Howl', statChanges: [], playerToggle: true };

const bodyScript = (code: string): Script => ({ id: 'sw', timing: 'switch', code });
const worldWith = (code: string): World => ({
  ...harborWorld({ stats: [calm] }), items: [helm], slots, bodies, placements, traits: [howl], scripts: [bodyScript(code)],
});

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const worn = () => gameplay().itemCopies.filter((c) => c.equipped).length;

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

async function clickHowl() {
  gameplay().setActiveTab('traits');
  const global = await screen.findByRole('group', { name: 'Global' });
  const header = within(global).getByRole('button', { name: /^Global,/ });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(global).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  fireEvent.click(await within(global).findByRole('checkbox', { name: /Howl/ }));
}

describe('a Body written by a script between turns', () => {
  it('unequips at once, fires When Unequipped, writes the log line and saves the base', async () => {
    renderGameViewer(worldWith('persona.body = "Wolf";'), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(worn()).toBe(1));
    await clickHowl();
    await waitFor(() => expect(worn()).toBe(0));
    expect(gameplay().itemCopies).toHaveLength(1);
    await waitFor(() => expect(gameplay().globalStats.find((s) => s.id === 'calm')?.value).toBe(99));
    expect(gameplay().logEntries.map((e) => e.text)).toContain('Body: Wolf. Unequipped Helm');
    expect(gameplay().saveCurrentGameState().bodies?.base).toEqual({ '': { kind: 'body', id: 'wolf' } });
  });

  it('settles at once when an item script writes the Body', async () => {
    const hand: Slot = { id: 'hand', name: 'Hand' };
    const sword: Item = { id: 'sword', name: 'Sword', slotRule: { mode: 'either', slotIds: ['hand'] }, statEffects: [], traitEffects: [], equipRequires: [] };
    const wolfHelm: Item = { ...helm, scripts: [{ id: 'off', timing: 'unequipped', code: 'persona.body = "Wolf";' }] };
    const armed: Placement[] = [
      { id: 'p-helm', where: { kind: 'you' }, quantity: 1, equipped: true, source: { kind: 'item', itemId: 'helm' } },
      { id: 'p-sword', where: { kind: 'you' }, quantity: 1, equipped: true, source: { kind: 'item', itemId: 'sword' } },
    ];
    const both: Body[] = [bodyFixture({ id: 'human', name: 'Humanoid', entries: [{ slotId: 'head' }, { slotId: 'hand' }] }), bodies[1]];
    renderGameViewer({
      ...worldWith(''), items: [wolfHelm, sword], slots: [...slots, hand], bodies: both, placements: armed, scripts: [],
    }, { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(worn()).toBe(2));
    gameplay().setActiveTab('inventory');
    fireEvent.click(await screen.findByRole('button', { name: /: Helm$/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Unequip Helm' }));
    await waitFor(() => expect(gameplay().logEntries.map((e) => e.text)).toContain('Body: Wolf. Unequipped Sword'));
    expect(worn()).toBe(0);
    expect(gameplay().saveCurrentGameState().bodies?.base).toEqual({ '': { kind: 'body', id: 'wolf' } });
  });

  it('fails the script on an unknown Body name and changes nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderGameViewer(worldWith('persona.body = "Dragon";'), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(worn()).toBe(1));
    await clickHowl();
    await waitFor(() => expect(gameplay().globalTraits.map((t) => t.id)).toContain('howl'));
    expect(worn()).toBe(1);
    expect(gameplay().saveCurrentGameState().bodies?.base).toBeUndefined();
  });
});
