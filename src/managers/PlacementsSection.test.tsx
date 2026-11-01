import { useEffect } from 'react';
import { bodyFixture } from '@/test/bodyFixture';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { worldFixture } from '@/test/gamePanels';
import PlacementsSection from './PlacementsSection';
import type { Body, Entity, Item, Placement, PlacementWhere } from '@/types';

// The provider initializes IndexedDB storage on mount; these tests read only the store.
vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const gear = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const helm = gear('helm', 'Helm', { slotRule: { mode: 'either', slotIds: ['head'] } });
const gauntlets = gear('gauntlets', 'Gauntlets', { slotRule: { mode: 'all', slotIds: ['hand', 'head'] } });
const circlet = gear('circlet', 'Circlet', { slotRule: { mode: 'either', slotIds: ['head', 'hand'] } });
const crest = gear('crest', 'Crest', { slotRule: { mode: 'either', slotIds: ['head', 'tail'] } });
const potion = gear('potion', 'Potion');
const humanoid: Body = bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'head' }, { slotId: 'hand', capacity: 2 }] });
const dog: Body = bodyFixture({ id: 'dog', name: 'Dog', entries: [{ slotId: 'hand' }] });
const entity = (id: string, over: Partial<Entity> = {}) => ({ id, name: id, description: '', locations: [], ...over }) as Entity;

const place = (id: string, where: PlacementWhere, itemId: string, over: Partial<Placement> = {}): Placement =>
  ({ id, where, quantity: 1, source: { kind: 'item', itemId }, ...over });

/** Loads the world once, shows the section, and prints the stored placements. */
function Harness({ where, placements, entities }: { where: PlacementWhere; placements: Placement[]; entities?: Entity[] }) {
  const { loadWorldData, placements: stored } = useGameData();
  useEffect(() => {
    loadWorldData(worldFixture({
      items: [helm, gauntlets, circlet, crest, potion], slots: [{ id: 'head', name: 'Head' }, { id: 'hand', name: 'Hand' }, { id: 'tail', name: 'Tail' }],
      bodies: [humanoid, dog], entities: entities ?? [], placements,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the props are fixed for a test's life
  }, [loadWorldData]);
  return (
    <>
      <PlacementsSection where={where} label="Items" hint="Starting items" />
      <pre data-testid="stored">{JSON.stringify(stored)}</pre>
    </>
  );
}

const stored = (): Placement[] => JSON.parse(screen.getByTestId('stored').textContent ?? '[]');
const show = (props: Parameters<typeof Harness>[0]) => render(<GameDataProvider><Harness {...props} /></GameDataProvider>);

describe('PlacementsSection — Equipped', () => {
  it('shows Equipped only on rows whose item has a slot, and stores it', async () => {
    show({ where: { kind: 'you' }, placements: [place('p1', { kind: 'you' }, 'helm'), place('p2', { kind: 'you' }, 'potion')] });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Helm Equipped' }));
    expect(screen.queryByRole('checkbox', { name: 'Potion Equipped' })).toBeNull();
    expect(stored().find((p) => p.id === 'p1')?.equipped).toBe(true);
  });

  it('never shows Equipped on a location row', async () => {
    show({ where: { kind: 'location', id: 'gate' }, placements: [place('p1', { kind: 'location', id: 'gate' }, 'helm')] });
    await screen.findByRole('checkbox', { name: 'Helm Hidden' });
    expect(screen.queryByRole('checkbox', { name: 'Helm Equipped' })).toBeNull();
  });

  it("warns when the owner's Body can't hold the rule: All of on any missing slot, Either of on none", async () => {
    const rex = entity('rex', { body: { kind: 'body', id: 'dog' } });
    const where = { kind: 'entity', id: 'rex' } as const;
    show({ where, entities: [rex], placements: [
      place('p1', where, 'helm', { equipped: true }), place('p2', where, 'gauntlets', { equipped: true }),
      place('p3', where, 'circlet', { equipped: true }), place('p4', where, 'crest', { equipped: true }),
    ] });
    expect(await screen.findByText('Dog has no Head slot. Helm starts carried.')).toBeInTheDocument();
    expect(screen.getByText('Dog has no Head slot. Gauntlets starts carried.')).toBeInTheDocument();
    expect(screen.getByText('Dog has no Head or Tail slot. Crest starts carried.')).toBeInTheDocument();
    // Circlet fits through Hand.
    expect(screen.getAllByRole('status')).toHaveLength(3);
  });

  it('warns on a None Body, and stays quiet when the Body fits or the row is not Equipped', async () => {
    const ghost = entity('ghost', { body: { kind: 'none' } });
    const knight = entity('knight');
    show({ where: { kind: 'entity', id: 'ghost' }, entities: [ghost, knight], placements: [
      place('p1', { kind: 'entity', id: 'ghost' }, 'helm', { equipped: true }),
      place('p2', { kind: 'entity', id: 'ghost' }, 'gauntlets'),
    ] });
    expect(await screen.findByText('Body is None. Helm starts carried.')).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it("reads the player's Body from the Custom Persona entity, else the Default", async () => {
    const custom = entity('custom', { customPersona: true, body: { kind: 'body', id: 'dog' } });
    show({ where: { kind: 'you' }, entities: [custom], placements: [place('p1', { kind: 'you' }, 'helm', { equipped: true })] });
    expect(await screen.findByText('Dog has no Head slot. Helm starts carried.')).toBeInTheDocument();
  });

  it('drops Equipped when the row changes to an item with no slot, and keeps it for one with a slot', async () => {
    show({ where: { kind: 'you' }, placements: [place('p1', { kind: 'you' }, 'helm', { equipped: true })] });
    const pick = async (name: string) => {
      fireEvent.keyDown(await screen.findByRole('combobox', { name: 'Item' }), { key: 'Enter' });
      fireEvent.click(await screen.findByRole('option', { name }));
    };
    await pick('Gauntlets');
    expect(stored()[0]).toMatchObject({ equipped: true, source: { itemId: 'gauntlets' } });
    await pick('Potion');
    expect(stored()[0].source.itemId).toBe('potion');
    expect(stored()[0].equipped).toBeUndefined();
  });

  it('stays quiet on the Default Body when it fits', async () => {
    show({ where: { kind: 'you' }, placements: [place('p1', { kind: 'you' }, 'gauntlets', { equipped: true })] });
    await screen.findByRole('checkbox', { name: 'Gauntlets Equipped' });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('PlacementsSection — starting slot', () => {
  const slotSelect = (item: string) => screen.queryByRole('combobox', { name: `${item} Slot` });
  const where = { kind: 'you' } as const;

  it('shows the slot select only on an Equipped Either of row with 2+ slots', async () => {
    show({ where, placements: [
      place('p1', where, 'circlet', { equipped: true }), place('p2', where, 'circlet'), place('p3', where, 'helm', { equipped: true }),
      place('p4', where, 'gauntlets', { equipped: true }),
    ] });
    await screen.findByRole('combobox', { name: 'Circlet Slot' });
    expect(screen.getAllByRole('combobox', { name: 'Circlet Slot' })).toHaveLength(1);
    expect(slotSelect('Helm')).toBeNull();
    expect(slotSelect('Gauntlets')).toBeNull();
  });

  it('shows the chosen slot, and unticking Equipped clears it', async () => {
    show({ where, placements: [place('p1', where, 'circlet', { equipped: true, slotId: 'hand' })] });
    expect(await screen.findByRole('combobox', { name: 'Circlet Slot' })).toHaveTextContent('Hand');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Circlet Equipped' }));
    expect(stored()[0].slotId).toBeUndefined();
    expect(slotSelect('Circlet')).toBeNull();
  });

  it('shows First Free Slot when no slot is chosen', async () => {
    show({ where, placements: [place('p1', where, 'circlet', { equipped: true })] });
    expect(await screen.findByRole('combobox', { name: 'Circlet Slot' })).toHaveTextContent('First Free Slot');
  });
});
