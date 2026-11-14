import 'fake-indexeddb/auto';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGameData } from '@/contexts/GameDataContext';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import type { GameLocation } from '@/types';
import LocationManager from './LocationManager';

function Host() {
  const { locations } = useGameData();
  const location = locations.find((l) => l.id === 'lane');
  if (!location) return null;
  return <LocationManager location={location} tab="presence" onTabChange={() => {}} />;
}

const mount = (enabledWhen: GameLocation['enabledWhen']) => renderPanelBench(
  panelWorld({ locations: [{ id: 'lane', name: 'Lantern Lane', enabledWhen }] }),
  'simple',
  <Host />,
);

describe("a location's Enabled gate on the Presence tab", () => {
  it('shows first on the tab in Simple mode (Q46, Q52)', async () => {
    mount(undefined);
    expect(await screen.findByText('Enabled')).toBeInTheDocument();
    const gate = document.querySelector('[data-host-gate]');
    expect(gate?.parentElement?.firstElementChild).toBe(gate);
    expect(gate?.textContent).toMatch(/locations inside it/);
  });

  it('shows the rows the location stores', async () => {
    mount([{ all: [{ kind: 'time', dayparts: ['night'] }] }]);
    await screen.findByText('Enabled');
    expect(document.querySelector('[data-host-gate]')?.textContent).toMatch(/Night/);
  });
});
