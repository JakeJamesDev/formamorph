import 'fake-indexeddb/auto';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGameData } from '@/contexts/GameDataContext';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import type { Entity, PlayerStat, StatRequirement, TraitRequirement } from '@/types';
import EntityManager from './EntityManager';

const stat = (id: string, name: string): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 5, regen: 0, descriptors: [] });
const trust: StatRequirement = { kind: 'stat', id: 'trust', operator: '>=', value: 3, unit: 'raw' };
const night: TraitRequirement = { kind: 'time', dayparts: ['night'] };

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

const mount = (enabledWhen: Entity['enabledWhen'], mode: 'simple' | 'advanced' = 'simple') => renderPanelBench(
  panelWorld({
    entities: [{ id: 'mira', name: 'Mira', playerDescription: '', aiDescription: '', stats: [stat('trust', 'Trust')], enabledWhen } as Entity],
  }),
  mode,
  <Host />,
);
const warning = () => document.querySelector('[data-host-gate-warning]');

describe("an entity's Enabled gate on the Presence tab", () => {
  it('shows in Simple mode (Q46)', async () => {
    mount(undefined);
    expect(await screen.findByText('Enabled')).toBeInTheDocument();
  });

  it('warns when every row reads only the entity itself (Q48)', async () => {
    mount([{ all: [trust] }]);
    await screen.findByText('Enabled');
    expect(warning()?.textContent).toMatch(/can’t turn back on/);
  });

  it('does not warn for a mixed gate', async () => {
    mount([{ all: [trust] }, { all: [night] }]);
    await screen.findByText('Enabled');
    expect(warning()).toBeNull();
  });
});
