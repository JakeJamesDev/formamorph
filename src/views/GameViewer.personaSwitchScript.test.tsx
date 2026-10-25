import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity, PlayerStat, Stat, Trait, World } from '@/types';

/** A persona change's When a Trait Switches run reads the cast the change left (Q4). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 10_000, value: 50, regen: 0, descriptors: [] };
const grit = (value: number): Stat => ({ id: 'grit', name: 'Grit', type: 'number', description: '', min: 0, max: 100, value, starting: value, regen: 0, descriptors: [] });
// Persona-only: each is in the cast only while played.
const ash: Entity = { id: 'ash', name: 'Ash', persona: true, personaOnly: true, stats: [grit(11)] };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true, personaOnly: true, stats: [grit(23)] };
const wren: Entity = { id: 'l-wren', name: 'Wren', persona: true };

/** Held while the player plays Ash, so a change to Mira switches it off and fires the world's switch script. */
const sworn: Trait = { id: 'sworn', name: 'Sworn', statChanges: [], playerToggle: true, requires: [{ all: [{ kind: 'playingAs', id: 'ash' }] }] };
/** Held while the player does not play Mira. */
const drifter: Trait = { id: 'drifter', name: 'Drifter', statChanges: [], playerToggle: true, requires: [{ all: [{ kind: 'playingAs', id: 'mira', not: true }] }] };

const world = (code: string, traits: Trait[] = [sworn]): World => ({
  ...harborWorld({ stats: [vigor], entities: [ash, mira] }), traits, scripts: [{ id: 'sw', timing: 'switch', code }],
});

/** Whether `entities` holds a name: an unknown name still reads as an empty entry. */
const inCast = 'const inCast = (name) => Object.keys(entities).includes(name);';

let stats: PlayerStat[] = [];
let traitsOn: string[] = [];
let showTraits = () => {};
function Probe() {
  const play = useGameplay();
  stats = play.globalStats;
  traitsOn = play.globalTraits.filter((t) => !play.disabledTraitIds.includes(t.id)).map((t) => t.id);
  showTraits = () => play.setActiveTab('traits');
  return null;
}
const vigorNow = () => stats.find((s) => s.id === 'vigor')?.value;

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  for (const meta of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(meta.id);
  stats = [];
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});
afterEach(() => vi.restoreAllMocks());

/** Picks `name` in the side panel's persona picker. */
async function changePersona(name: string) {
  const row = await screen.findByTestId('persona-row');
  fireEvent.click(within(row).getByRole('button', { name: 'Change' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(await within(dialog).findByRole('radio', { name }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
}

/** A trait's switch in the Traits tab's closed Global section. */
async function clickTrait(name: string) {
  showTraits();
  const global = await screen.findByRole('group', { name: 'Global' });
  const header = within(global).getByRole('button', { name: /^Global,/ });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(global).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  fireEvent.click(await within(global).findByRole('checkbox', { name: new RegExp(name) }));
}

describe('a persona change’s switch run', () => {
  it('reads the new persona, its name and its stats', async () => {
    renderGameViewer(world('stats.Vigor.value = persona.name === "Mira" ? persona.stats.Grit.value : 1;'), {
      inGameplay: <Probe />, initialTraits: ['sworn'], initialPersona: { ref: { source: 'world', entityId: 'ash' } },
    });
    await screen.findByPlaceholderText(/Type your action/);
    await changePersona('Mira');
    await waitFor(() => expect(vigorNow()).toBe(23));
  });

  it('reads the new cast: the persona that left is gone from `entities`, the one that came is in it', async () => {
    await EntityStorageService.storeEntity({ id: wren.id, name: wren.name, data: wren });
    renderGameViewer(world(`${inCast} stats.Vigor.value = (inCast("Wren") ? 1 : 0) + (inCast("Mira") ? 10 : 0);`, [drifter]), {
      inGameplay: <Probe />, initialTraits: ['drifter'], initialPersona: { ref: { source: 'library', entityId: wren.id }, libraryEntity: wren },
    });
    await screen.findByPlaceholderText(/Type your action/);
    await changePersona('Mira');
    await waitFor(() => expect(vigorNow()).toBe(10));
  });

  describe('switches off the traits of the persona it left, each read as it stood before the change', () => {
    const oath: Trait = { id: 'oath', name: 'Oath', statChanges: [] };
    const readsOath = 'stats.Vigor.value = trait.name === "Oath" && !trait.enabled ? 7 : 3;';

    it('a library persona’s, which leave the trait scope', async () => {
      const oathWren: Entity = { ...wren, traits: [oath] };
      await EntityStorageService.storeEntity({ id: oathWren.id, name: oathWren.name, data: oathWren });
      renderGameViewer(world(readsOath, []), {
        inGameplay: <Probe />, initialPersona: { ref: { source: 'library', entityId: oathWren.id }, libraryEntity: oathWren },
        initialOwnedTraits: { [oathWren.id]: ['oath'] },
      });
      await screen.findByPlaceholderText(/Type your action/);
      await changePersona('Mira');
      await waitFor(() => expect(vigorNow()).toBe(7));
    });

    it('a persona-only world persona’s', async () => {
      renderGameViewer({ ...world(readsOath, []), entities: [{ ...ash, traits: [oath] }, mira] }, {
        inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ash' } }, initialOwnedTraits: { ash: ['oath'] },
      });
      await screen.findByPlaceholderText(/Type your action/);
      await changePersona('Mira');
      await waitFor(() => expect(vigorNow()).toBe(7));
    });

    it('runs the trait’s own script on its switch-off', async () => {
      const own: Trait = { ...oath, scripts: [{ id: 'own', timing: 'switch', code: 'stats.Vigor.value = trait.enabled ? 1 : 9;' }] };
      renderGameViewer({ ...harborWorld({ stats: [vigor], entities: [{ ...ash, traits: [own] }, mira] }), traits: [] }, {
        inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ash' } }, initialOwnedTraits: { ash: ['oath'] },
      });
      await screen.findByPlaceholderText(/Type your action/);
      await changePersona('Mira');
      await waitFor(() => expect(vigorNow()).toBe(9));
    });
  });

  it('reads a gate on playing the new world persona as open', async () => {
    const kin: Trait = { id: 'kin', name: 'Kin', statChanges: [], playerToggle: true, requires: [{ all: [{ kind: 'playingAs', id: 'mira' }] }] };
    renderGameViewer(world('stats.Vigor.value = traits.Kin.available ? 7 : 3;', [sworn, kin]), {
      inGameplay: <Probe />, initialTraits: ['sworn'], initialPersona: { ref: { source: 'world', entityId: 'ash' } },
    });
    await screen.findByPlaceholderText(/Type your action/);
    await changePersona('Mira');
    await waitFor(() => expect(vigorNow()).not.toBe(50));
    expect(vigorNow()).toBe(7);
  });

  describe('to a library persona', () => {
    /** Holds the library read of Wren until `land` runs; `served` settles once every read of Wren has returned. */
    async function holdWrenLoad() {
      await EntityStorageService.storeEntity({ id: wren.id, name: wren.name, data: wren });
      const read = EntityStorageService.getEntityData.bind(EntityStorageService);
      let land = () => {};
      const landed = new Promise<void>((resolve) => { land = resolve; });
      const reads: Promise<unknown>[] = [];
      vi.spyOn(EntityStorageService, 'getEntityData').mockImplementation((id) => {
        const result = (async () => {
          if (id === wren.id) await landed;
          return read(id);
        })();
        if (id === wren.id) reads.push(result);
        return result;
      });
      return {
        land: () => land(),
        asked: () => reads.length,
        served: () => Promise.allSettled(reads),
      };
    }
    const readsWren = `${inCast} stats.Vigor.value = (persona.name === "Wren" ? 1 : 0) + (inCast("Wren") ? 10 : 0) + (inCast("Ash") ? 100 : 0);`;

    it('runs once the persona loads, and reads it', async () => {
      const load = await holdWrenLoad();
      renderGameViewer(world(readsWren), {
        inGameplay: <Probe />, initialTraits: ['sworn'], initialPersona: { ref: { source: 'world', entityId: 'ash' } },
      });
      await screen.findByPlaceholderText(/Type your action/);
      const before = load.asked();
      await changePersona('Wren');
      // The change asked for Wren. The settle that fires the run turns Sworn off in the same render, so it waits too.
      await waitFor(() => expect(load.asked()).toBeGreaterThan(before));
      expect(traitsOn).toEqual(['sworn']);
      expect(vigorNow()).toBe(50);
      load.land();
      await waitFor(() => expect(vigorNow()).toBe(11));
    });

    it('never runs when the view closes while the persona loads', async () => {
      const load = await holdWrenLoad();
      const played = renderGameViewer(world(readsWren), {
        inGameplay: <Probe />, initialTraits: ['sworn'], initialPersona: { ref: { source: 'world', entityId: 'ash' } },
      });
      await screen.findByPlaceholderText(/Type your action/);
      const before = load.asked();
      await changePersona('Wren');
      await waitFor(() => expect(load.asked()).toBeGreaterThan(before));
      await played.unmountView();
      load.land();
      // Every read of Wren has returned; a 0 ms flush lets what follows it land.
      await act(async () => { await load.served(); await new Promise((resolve) => setTimeout(resolve, 0)); });
      expect(vigorNow()).toBe(50);
      expect(traitsOn).toEqual(['sworn']);
    });
  });

  it('leaves a toggle’s run on the live cast', async () => {
    const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], playerToggle: true };
    renderGameViewer(world(`${inCast} stats.Vigor.value = persona.stats.Grit.value + (inCast("Mira") ? 100 : 0);`, [brave]), {
      inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ash' } },
    });
    await screen.findByPlaceholderText(/Type your action/);
    await clickTrait('Brave');
    await waitFor(() => expect(vigorNow()).toBe(11));
  });
});
