import 'fake-indexeddb/auto';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGameData } from '@/contexts/GameDataContext';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import type { GameLocation } from '@/types';
import LocationManager from './LocationManager';

let stored: GameLocation | undefined;
function Host() {
  const { locations } = useGameData();
  const location = locations.find((l) => l.id === 'lane');
  stored = location;
  if (!location) return null;
  return <LocationManager location={location} tab="presence" onTabChange={() => {}} />;
}

const mount = (over: Partial<GameLocation> = {}) => renderPanelBench(
  panelWorld({ locations: [{ id: 'lane', name: 'Lantern Lane', ...over }] }),
  'simple',
  <Host />,
);

describe("a location's Lock gate on the Presence tab", () => {
  it('shows the Unlocked rows after Enabled in Simple mode (Q46)', async () => {
    mount({ unlockedWhen: [{ all: [{ kind: 'time', dayparts: ['night'] }] }] });
    expect(await screen.findByText('Unlocked')).toBeInTheDocument();
    const [enabled, unlocked] = document.querySelectorAll('[data-host-gate]');
    expect(enabled.textContent).toMatch(/^Enabled/);
    expect(unlocked.textContent).toMatch(/never locked/);
    expect(unlocked.textContent).toMatch(/Night/);
  });

  it('shows the Locked Text the location stores, after the Unlocked rows', async () => {
    mount({ lockedText: 'The gate is barred' });
    const label = await screen.findByText('Locked Text');
    const unlocked = document.querySelectorAll('[data-host-gate]')[1];
    expect(unlocked.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await screen.findByText('The gate is barred')).toBeInTheDocument();
    expect(stored?.lockedText).toBe('The gate is barred');
  });
});
