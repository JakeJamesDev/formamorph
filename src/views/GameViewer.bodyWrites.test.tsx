import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { bodyFixture } from '@/test/bodyFixture';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
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

describe('an equip right after a Body write', () => {
  const EQUIP = 'persona.items.find((copy) => copy.item === "Collar").equip();';
  const collar: Item = { id: 'collar', name: 'Collar', slotRule: { mode: 'either', slotIds: ['collar'] }, statEffects: [], traitEffects: [], equipRequires: [] };
  const held: Placement = { id: 'p-collar', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'collar' } };
  const gem: Item = { id: 'gem', name: 'Gem', stackable: false, statEffects: [], traitEffects: [], equipRequires: [], scripts: [] };
  // A give, since a landing can lay a stat write over a second run's.
  const counted: Item = { ...helm, scripts: [{ id: 'off', timing: 'unequipped', code: 'stats.Calm.value += 1; items.Gem.give(location);' }] };
  const onHowl = (code: string): Script => ({ id: 'sw', timing: 'switch', code: `if (trait.name === "Howl" && trait.enabled) { ${code} }` });
  const worn1 = () => gameplay().itemCopies.filter((c) => c.equipped).map((c) => (c.item.kind === 'item' ? c.item.itemId : ''));
  const calmNow = () => gameplay().globalStats.find((s) => s.id === 'calm')?.value;
  /** Helm's When Unequipped has run once, and no second run lands after it. */
  const ranOnce = async () => {
    const gems = () => gameplay().itemCopies.filter((c) => c.item.kind === 'item' && c.item.itemId === 'gem').reduce((sum, c) => sum + c.quantity, 0);
    await waitFor(() => expect(gems()).toBeGreaterThan(0));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    expect(gems()).toBe(1);
    expect(calmNow()).toBe(51);
  };

  async function howlIn(world: Partial<World>) {
    renderGameViewer({ ...worldWith(''), items: [counted, collar, gem], placements: [...placements, held], ...world }, { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(worn()).toBe(1));
    await clickHowl();
  }

  it('fits the new Body in an item script the Body’s settle fires', async () => {
    await howlIn({ items: [{ ...helm, scripts: [{ id: 'off', timing: 'unequipped', code: EQUIP }] }, collar], scripts: [onHowl('persona.body = "Wolf";')] });
    await waitFor(() => expect(worn1()).toEqual(['collar']));
  });

  it('fits the new Body in the same script, and the old piece’s script runs once', async () => {
    await howlIn({ scripts: [onHowl(`persona.body = "Wolf"; ${EQUIP}`)] });
    await waitFor(() => expect(worn1()).toEqual(['collar']));
    await ranOnce();
    expect(gameplay().saveCurrentGameState().bodies?.base).toEqual({ '': { kind: 'body', id: 'wolf' } });
    expect(gameplay().logEntries.map((e) => e.text).filter((line) => line.includes('skipped'))).toEqual([]);
  });

  it('fits the new Body in the next script in the list', async () => {
    await howlIn({ scripts: [onHowl('persona.body = "Wolf";'), { ...onHowl(EQUIP), id: 'sw2' }] });
    await waitFor(() => expect(worn1()).toEqual(['collar']));
    await ranOnce();
  });

  it('fits the new Body when an item script writes both', async () => {
    const wolfHelm: Item = { ...helm, scripts: [{ id: 'off', timing: 'unequipped', code: `persona.body = "Wolf"; ${EQUIP}` }] };
    // Sword fits only the old Body, so the chain drops it, and its script runs once.
    const sword: Item = { ...counted, id: 'sword', name: 'Sword', slotRule: { mode: 'either', slotIds: ['hand'] } };
    renderGameViewer({
      ...worldWith(''), items: [wolfHelm, sword, collar, gem], slots: [...slots, { id: 'hand', name: 'Hand' }],
      bodies: [bodyFixture({ id: 'human', name: 'Humanoid', entries: [{ slotId: 'head' }, { slotId: 'hand' }] }), bodies[1]],
      placements: [...placements, { ...placements[0], id: 'p-sword', source: { kind: 'item', itemId: 'sword' } }, held], scripts: [],
    }, { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(worn()).toBe(2));
    gameplay().setActiveTab('inventory');
    fireEvent.click(await screen.findByRole('button', { name: /: Helm$/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Unequip Helm' }));
    await waitFor(() => expect(worn1()).toEqual(['collar']));
    await ranOnce();
    expect(gameplay().saveCurrentGameState().bodies?.base).toEqual({ '': { kind: 'body', id: 'wolf' } });
  });

  it('refuses what only the old Body held', async () => {
    const lines = () => gameplay().logEntries.map((e) => e.text);
    renderGameViewer({
      ...worldWith(''), items: [counted], placements: [{ ...placements[0], equipped: false }],
      scripts: [onHowl('persona.body = "Wolf"; persona.items.find((copy) => copy.item === "Helm").equip();')],
    }, { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await clickHowl();
    await waitFor(() => expect(lines()).toContain('Inventory (script) skipped equip: no Head slot on you'));
    expect(lines()).toContain('Body: Wolf');
    expect(worn1()).toEqual([]);
    expect(calmNow()).toBe(50);
  });

  it('fits the new Body in a Before the AI script', async () => {
    renderGameViewer({
      ...worldWith(''), items: [counted, collar, gem], placements: [...placements, held],
      scripts: [{ id: 'a', timing: 'before', code: 'persona.body = "Wolf";' }, { id: 'b', timing: 'before', code: EQUIP }],
    }, { inGameplay: <Probe /> });
    const box = await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(worn()).toBe(1));
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const system = (JSON.parse(init.body as string) as { messages: { role: string; content: string }[] }).messages
        .find((m) => m.role === 'system')?.content ?? '';
      if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
      if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
      return sseResponse(sseReply('The ferry bell rings.'));
    }));
    fireEvent.change(box, { target: { value: 'I wait.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
    await waitFor(() => expect(worn1()).toEqual(['collar']));
    await ranOnce();
    vi.unstubAllGlobals();
  });
});
