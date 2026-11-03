import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { bodyFixture } from '@/test/bodyFixture';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const collar: Item = { id: 'collar', name: 'Collar', slotRule: { mode: 'either', slotIds: ['collar'] }, statEffects: [], traitEffects: [], equipRequires: [] };
const held: Placement = { id: 'p-collar', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'collar' } };

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
const wornItems = () => gameplay().itemCopies.filter((c) => c.equipped).map((c) => (c.item.kind === 'item' ? c.item.itemId : ''));
const logLines = () => gameplay().logEntries.map((e) => e.text);

/** Plays one turn of `world`, the Inventory pass answering `inventoryReply`. Answers the choices requests so far. */
async function playTurn(world: World, inventoryReply?: string) {
  renderGameViewer(world, { inGameplay: <Probe /> });
  const box = await screen.findByPlaceholderText(/Type your action/);
  await waitFor(() => expect(gameplay().itemCopies.length).toBeGreaterThan(0));
  const calls = { choices: 0 };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const system = (JSON.parse(init.body as string) as { messages: { role: string; content: string }[] }).messages
      .find((m) => m.role === 'system')?.content ?? '';
    if (inventoryReply && system.includes('inventory keeper')) return sseResponse(sseReply(inventoryReply));
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    if (system.includes('player choice writer')) {
      calls.choices += 1;
      return sseResponse(sseReply('1. Wait\n2. Go'));
    }
    return sseResponse(sseReply('The ferry bell rings.'));
  }));
  fireEvent.change(box, { target: { value: 'I wait.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
  return calls;
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

afterEach(() => { vi.unstubAllGlobals(); });

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
  const gem: Item = { id: 'gem', name: 'Gem', stackable: false, statEffects: [], traitEffects: [], equipRequires: [], scripts: [] };
  // A give, since a landing can lay a stat write over a second run's.
  const counted: Item = { ...helm, scripts: [{ id: 'off', timing: 'unequipped', code: 'stats.Calm.value += 1; items.Gem.give(location);' }] };
  const onHowl = (code: string): Script => ({ id: 'sw', timing: 'switch', code: `if (trait.name === "Howl" && trait.enabled) { ${code} }` });
  const calmNow = () => gameplay().globalStats.find((s) => s.id === 'calm')?.value;
  const bodyLines = () => logLines().filter((line) => line.startsWith('Body:'));
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
    await waitFor(() => expect(wornItems()).toEqual(['collar']));
  });

  it('fits the new Body in the same script, and the old piece’s script runs once', async () => {
    await howlIn({ scripts: [onHowl(`persona.body = "Wolf"; ${EQUIP}`)] });
    await waitFor(() => expect(wornItems()).toEqual(['collar']));
    await ranOnce();
    expect(gameplay().saveCurrentGameState().bodies?.base).toEqual({ '': { kind: 'body', id: 'wolf' } });
    expect(logLines().filter((line) => line.includes('skipped'))).toEqual([]);
    expect(bodyLines()).toEqual(['Body: Wolf. Unequipped Helm']);
  });

  it('fits the new Body in the next script in the list', async () => {
    await howlIn({ scripts: [onHowl('persona.body = "Wolf";'), { ...onHowl(EQUIP), id: 'sw2' }] });
    await waitFor(() => expect(wornItems()).toEqual(['collar']));
    await ranOnce();
    expect(bodyLines()).toEqual(['Body: Wolf. Unequipped Helm']);
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
    await waitFor(() => expect(wornItems()).toEqual(['collar']));
    await ranOnce();
    expect(gameplay().saveCurrentGameState().bodies?.base).toEqual({ '': { kind: 'body', id: 'wolf' } });
    expect(bodyLines()).toEqual(['Body: Wolf. Unequipped Sword']);
  });

  it('refuses what only the old Body held', async () => {
    renderGameViewer({
      ...worldWith(''), items: [counted], placements: [{ ...placements[0], equipped: false }],
      scripts: [onHowl('persona.body = "Wolf"; persona.items.find((copy) => copy.item === "Helm").equip();')],
    }, { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await clickHowl();
    await waitFor(() => expect(logLines()).toContain('Inventory (script) skipped equip: no Head slot on you'));
    expect(logLines()).toContain('Body: Wolf');
    expect(wornItems()).toEqual([]);
    expect(calmNow()).toBe(50);
  });

  it.each(['before', 'output'] as const)('fits the new Body and names what it took off, in a %s script', async (timing) => {
    await playTurn({
      ...worldWith(''), items: [counted, collar, gem], placements: [...placements, held],
      scripts: [{ id: 'a', timing, code: 'persona.body = "Wolf";' }, { id: 'b', timing, code: EQUIP }],
    });
    await waitFor(() => expect(wornItems()).toEqual(['collar']));
    await ranOnce();
    expect(bodyLines()).toEqual(['Body: Wolf. Unequipped Helm']);
  });
});

describe('the Inventory pass after a script’s Body write', () => {
  const wolfBefore: Script = { id: 'a', timing: 'before', code: 'persona.body = "Wolf";' };
  const equipOf = (item: string) => JSON.stringify({ operations: [{ op: 'equip', item, quantity: 1, owner: 'you', to: '' }] });
  const worldOf = (world: Partial<World>): World => ({ ...worldWith(''), items: [helm, collar], placements: [...placements, held], ...world });
  const skipped = () => logLines().filter((line) => line.includes('skipped'));

  it('fits an equip to the Body a Before the AI script wrote', async () => {
    await playTurn(worldOf({ scripts: [wolfBefore] }), equipOf('Collar'));
    await waitFor(() => expect(wornItems()).toEqual(['collar']));
    expect(skipped()).toEqual([]);
  });

  it('refuses a slot that Body lacks', async () => {
    await playTurn(worldOf({ scripts: [wolfBefore], placements: [{ ...placements[0], equipped: false }] }), equipOf('Helm'));
    await waitFor(() => expect(logLines().some((line) => /skipped equip: no Head slot on you/.test(line))).toBe(true));
    expect(wornItems()).toEqual([]);
  });

  it('fits it the same way when Regenerate Stats replays the turn', async () => {
    await playTurn(worldOf({ scripts: [wolfBefore] }), equipOf('Collar'));
    await waitFor(() => expect(wornItems()).toEqual(['collar']));
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Stats' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
    await waitFor(() => expect(wornItems()).toEqual(['collar']));
    expect(skipped()).toEqual([]);
  });

  it('fits it the same way when Regenerate Choices replays the turn', async () => {
    const after: Script = { id: 'b', timing: 'after', code: 'turn.choices = [...turn.choices, "Worn " + persona.items.filter((copy) => copy.equipped).map((copy) => copy.item).join()];' };
    const calls = await playTurn(worldOf({ scripts: [wolfBefore, after] }), equipOf('Collar'));
    await waitFor(() => expect(gameplay().choices).toEqual(['Wait', 'Go', 'Worn Collar']));
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate Choices' }));
    await waitFor(() => expect(calls.choices).toBe(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Choices' })).toBeEnabled());
    expect(gameplay().choices).toEqual(['Wait', 'Go', 'Worn Collar']);
    expect(wornItems()).toEqual(['collar']);
  });
});
