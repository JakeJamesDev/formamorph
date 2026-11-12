import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGameData } from '@/contexts/GameDataContext';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import type { Entity, GameLocation } from '@/types';
import { KnownInField } from './KnownInField';

const LOCATIONS = [
  { id: 'village', name: 'Village' },
  { id: 'inn', name: 'Inn', parentId: 'village' },
  { id: 'farm', name: 'Farm' },
] as GameLocation[];

const mira = (over: Partial<Entity> = {}): Entity => ({
  id: 'mira', name: 'Mira', playerDescription: '', aiDescription: '', ...over,
} as Entity);

function Host() {
  const { entities, updateEntity } = useGameData();
  const entity = entities.find((e) => e.id === 'mira');
  return entity ? <KnownInField entity={entity} onChange={updateEntity} list /> : null;
}

const mount = (entity: Entity) =>
  renderPanelBench(panelWorld({ locations: LOCATIONS, entities: [entity] }), 'simple', <Host />);
const stored = (bench: ReturnType<typeof mount>) => bench.ctx().entities.find((e) => e.id === 'mira')!;

const choose = async (name: string) => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Known In' }));
  await userEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name }));
};

describe('the Known In field with its picked list', () => {
  it('picks a location after Picked Locations is chosen, and stores nothing before', async () => {
    const bench = mount(mira());
    await choose('Picked Locations');
    expect(stored(bench)).not.toHaveProperty('knownIn');
    await userEvent.click(screen.getByRole('button', { name: 'Add Location' }));
    await userEvent.click(screen.getByRole('option', { name: /Farm/ }));
    expect(stored(bench).knownIn).toEqual(['farm']);
  });

  it('keeps Picked Locations on screen when the last pick is removed', async () => {
    const bench = mount(mira({ knownIn: ['inn'] }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Inn' }));
    expect(stored(bench)).not.toHaveProperty('knownIn');
    expect(screen.getByRole('combobox', { name: 'Known In' }).textContent).toBe('Picked Locations');
    expect(screen.getByRole('button', { name: 'Add Location' })).toBeTruthy();
  });

  it('writes Nowhere and hides the list', async () => {
    const bench = mount(mira({ knownIn: ['inn'] }));
    await choose('Nowhere');
    expect(stored(bench).knownIn).toBe('nowhere');
    expect(screen.queryByRole('button', { name: 'Add Location' })).toBeNull();
  });
});
