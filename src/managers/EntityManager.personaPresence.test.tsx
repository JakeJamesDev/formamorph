import 'fake-indexeddb/auto';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGameData } from '@/contexts/GameDataContext';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import type { Entity, GameLocation } from '@/types';
import EntityManager from './EntityManager';

const LOCATIONS = [{ id: 'inn', name: 'Inn' }] as GameLocation[];

function Host() {
  const { entities } = useGameData();
  const entity = entities.find((e) => e.id === 'mira');
  if (!entity) return null;
  const none = () => {};
  return (
    <EntityManager
      entity={entity} tab="presence" onTabChange={none} traitId={null} onTraitIdChange={none} statId={null}
      onStatIdChange={none} placeholderId={null} onPlaceholderIdChange={none} onOpenWorldPlaceholder={none}
    />
  );
}

const mount = (over: Partial<Entity>) => renderPanelBench(
  panelWorld({ locations: LOCATIONS, entities: [{ id: 'mira', name: 'Mira', playerDescription: '', aiDescription: '', ...over } as Entity] }),
  'advanced',
  <Host />,
);

describe("an entity's Presence tab", () => {
  it('shows the routine and Known In for a Playable entity', async () => {
    mount({ persona: true, kind: 'unique', starts: [{ id: 's1', place: 'inn', weight: 1, schedule: [] }] });
    expect(await screen.findByRole('combobox', { name: 'Known In' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'On Map' })).toBeInTheDocument();
    expect(screen.queryByText('Start Locations')).toBeNull();
  });

  it.each([
    ['a Persona-Only entity', { persona: true, personaOnly: true }],
    ['the Custom Persona', { customPersona: true }],
  ] as const)('shows %s only Start Locations, with no Known In or routine', async (_name, marks) => {
    mount({ ...marks, locations: ['inn'] });
    expect(await screen.findByText('Start Locations')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Known In' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'On Map' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Placement' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Routine' })).toBeNull();
  });
});
