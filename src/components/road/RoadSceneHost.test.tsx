import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openExternal } from '@/lib/openExternal';
import { RoadSceneHost } from './RoadSceneHost';
import { closeRoadScene, openRoadScene } from './roadSceneStore';

vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('@/contexts/AgeGateContext', () => ({ useAgeGate: () => ({ attested: false, requireAttestation: vi.fn() }) }));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ activeTextEndpointPresetId: 'default', selectTextEndpointPreset: vi.fn() }),
}));

const scene = () => screen.queryByRole('dialog', { name: /How Far Should Your Story Go/ });

/** The host beside a view switch, as the app mounts it. */
let swapView: (view: string) => void;
function App() {
  const [view, setView] = useState('gameViewer');
  swapView = setView;
  return (
    <>
      <RoadSceneHost />
      <main key={view}>{view}</main>
    </>
  );
}

afterEach(() => {
  act(() => closeRoadScene());
  cleanup();
  vi.clearAllMocks();
});

describe('RoadSceneHost', () => {
  it('draws nothing until something asks, then opens from anywhere', () => {
    render(<App />);
    expect(scene()).toBeNull();
    act(() => openRoadScene());
    expect(scene()).not.toBeNull();
  });

  it('stays open across a view change', () => {
    render(<App />);
    act(() => openRoadScene());
    act(() => swapView('mainMenu'));
    expect(screen.getByRole('main', { hidden: true })).toHaveTextContent('mainMenu');
    expect(scene()).not.toBeNull();
  });

  it('closes on Keep Playing and opens again on the next ask', () => {
    render(<App />);
    act(() => openRoadScene());
    fireEvent.click(screen.getByRole('button', { name: 'Keep Playing' }));
    expect(scene()).toBeNull();
    act(() => openRoadScene());
    expect(scene()).not.toBeNull();
  });

  it('closes on Escape', () => {
    render(<App />);
    act(() => openRoadScene());
    fireEvent.keyDown(scene()!, { key: 'Escape' });
    expect(scene()).toBeNull();
  });

  it('opens the checklist from Support on Patreon and leaves the Patreon page closed', () => {
    render(<App />);
    act(() => openRoadScene());
    fireEvent.click(screen.getByRole('button', { name: 'Support on Patreon' }));
    expect(screen.getByRole('heading', { name: 'Get Formamorph AI' })).not.toBeNull();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('opens on the levels unless the ask names the checklist', () => {
    render(<App />);
    act(() => openRoadScene());
    expect(screen.getByRole('heading', { name: 'How Far Should Your Story Go?' })).not.toBeNull();
    act(() => closeRoadScene());
    act(() => openRoadScene('checklist'));
    expect(screen.getByRole('heading', { name: 'Get Formamorph AI' })).not.toBeNull();
  });
});
