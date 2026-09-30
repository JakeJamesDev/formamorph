import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { useRemoveEntity } from './useRemoveEntity';
import type { Entity, World } from '@/types';

// The provider initializes IndexedDB storage on mount; these tests exercise only the store.
vi.mock('../services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));

const newcomer: Entity = {
  id: 'cp', name: 'Newcomer', customPersona: true,
  traitLinks: [{ id: 'l1', originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null }],
  traits: [{ id: 'scar', name: 'Scar', statChanges: [] }],
  placeholders: [{ id: 'home', name: 'Home', values: [] }],
};
const ash: Entity = { id: 'ash', name: 'Ash', traits: [{ id: 'pack', name: 'Pack', statChanges: [] }] };

const world = (entities: Entity[]) => ({
  id: 'w',
  worldOverview: { name: 'w', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', use3DModel: true, tags: [] },
  stats: [], locations: [], entities, statUpdates: [],
  traits: [{ id: 'paladin', name: 'Paladin', statChanges: [], groupId: 'blueprints' }],
  traitGroups: [{ id: 'blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' }],
} as unknown as World);

function Harness({ entities }: { entities: Entity[] }) {
  const { loadWorldData, entities: live } = useGameData();
  const { ask, dialog } = useRemoveEntity();
  useEffect(() => { loadWorldData(world(entities)); }, [loadWorldData, entities]);
  return (
    <>
      {live.map((e) => <button key={e.id} type="button" onClick={() => ask(e.id)}>Delete {e.name}</button>)}
      {dialog}
    </>
  );
}

const mount = async (entities: Entity[]) => {
  render(<GameDataProvider><Harness entities={entities} /></GameDataProvider>);
  await act(async () => {});
};

describe('deleting an entity', () => {
  it('asks before deleting the Custom Persona entity, naming what goes with it', async () => {
    const user = userEvent.setup();
    await mount([newcomer, ash]);
    await user.click(screen.getByRole('button', { name: 'Delete Newcomer' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete Newcomer?');
    expect(dialog).toHaveTextContent('This also deletes its 1 link, 1 trait and 1 placeholder.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete Newcomer' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete Newcomer' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.queryByRole('button', { name: 'Delete Newcomer' })).not.toBeInTheDocument();
  });

  it('deletes any other entity at once', async () => {
    const user = userEvent.setup();
    await mount([newcomer, ash]);
    await user.click(screen.getByRole('button', { name: 'Delete Ash' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Ash' })).not.toBeInTheDocument();
  });

  it('deletes an empty Custom Persona entity at once, having nothing to name', async () => {
    const user = userEvent.setup();
    await mount([{ id: 'cp', name: 'Newcomer', customPersona: true }]);
    await user.click(screen.getByRole('button', { name: 'Delete Newcomer' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Newcomer' })).not.toBeInTheDocument();
  });
});
