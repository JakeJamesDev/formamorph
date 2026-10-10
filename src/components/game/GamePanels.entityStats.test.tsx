import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeftPanel, RightPanel } from './GamePanels';
import { defaultSystemPrompt } from './GamePrompts';
import { renderInGame, renderRightPanel, statFixture, type Gameplay, type TurnFixture } from '@/test/gamePanels';
import type { EntityStatValues, SceneEntity } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const PICTURE = 'data:image/png;base64,AAAA';
const bram = { id: 'bram', name: 'Bram', image: PICTURE };
const odette = { id: 'odette', name: 'Odette', image: PICTURE };
const wick = { id: 'wick', name: 'Wick', image: PICTURE };
const world = { entities: [bram, odette, wick] } as never;

const values: EntityStatValues = {
  bram: [statFixture('Trust', 40), statFixture('Secret', 9, { hidden: true }), statFixture('Dormant', 3, { enabled: false })],
  odette: [statFixture('Stock', 12)],
  wick: [statFixture('Nerve', 7)],
};

// Turn one: Odette and Bram are met by name. Turn two, the live scene: Bram by name, Wick only by alias.
const met: SceneEntity[] = [{ name: 'Odette', revealed: true }, { name: 'Bram', revealed: true }];
const now: SceneEntity[] = [{ name: 'Bram', revealed: true }, { name: 'Wick', alias: 'a thin runner', revealed: false }];
const turns: TurnFixture[] = [
  { narration: 'You meet Odette and Bram.', turnId: 't1', scene: met, entityStats: values },
  { narration: 'A runner joins Bram.', turnId: 't2', scene: now, entityStats: values },
];
const stage = {
  world, turns, stats: [statFixture('Vigor', 50)],
  seed: (g: Gameplay) => { g.setEntityStats(values); g.setVisibleEntities(now); },
};

const choose = async (label: string) => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Entity stats' }));
  await userEvent.click(await screen.findByRole('option', { name: label }));
};
const optionLabels = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Entity stats' }));
  return (await screen.findAllByRole('option')).map((o) => o.textContent);
};
const section = () => screen.queryByTestId('entity-stats');

describe('RightPanel — entity stats', () => {
  it('shows the player stats first and the selected entity stats below, with the same rows', () => {
    renderRightPanel({}, { ...stage, seed: (g) => { stage.seed(g); g.setSelectedEntityId('bram'); } });
    const rows = screen.getAllByText(/^(Vigor|Trust)$/);
    expect(rows.map((r) => r.textContent)).toEqual(['Vigor', 'Trust']);
    expect(within(section()!).getByText('Trust')).toBeInTheDocument();
    expect(within(section()!).getByText('40 / 100')).toBeInTheDocument();
  });

  it('never shows a hidden or switched-off entity stat', () => {
    renderRightPanel({}, { ...stage, seed: (g) => { stage.seed(g); g.setSelectedEntityId('bram'); } });
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(screen.queryByText('Dormant')).not.toBeInTheDocument();
  });

  it('lists present entities, then absent ones, then (None)', async () => {
    renderRightPanel({}, stage);
    expect(await optionLabels()).toEqual(['Bram', 'a thin runner', 'Odette', '(None)']);
  });

  it('lists an unrevealed entity by its alias and never by its name', async () => {
    renderRightPanel({}, stage);
    await choose('a thin runner');
    expect(within(section()!).getByText('Nerve')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'a thin runner' })).toBeInTheDocument();
    expect(screen.queryByText('Wick')).not.toBeInTheDocument();
  });

  it('lists an absent entity by name once an earlier turn revealed it', async () => {
    renderRightPanel({}, stage);
    expect(await optionLabels()).toContain('Odette');
  });

  it('lists an absent entity no turn revealed as Unknown', async () => {
    renderRightPanel({}, { ...stage, turns: [{ ...turns[1] }, { ...turns[1], turnId: 't3' }] });
    expect(await optionLabels()).toEqual(['Bram', 'a thin runner', 'Unknown', '(None)']);
  });

  it('shows a picked absent entity with its stats', async () => {
    renderRightPanel({}, stage);
    await choose('Odette');
    expect(within(section()!).getByText('Stock')).toBeInTheDocument();
  });

  it('hides the entity section on (None)', async () => {
    const view = renderRightPanel({}, { ...stage, seed: (g) => { stage.seed(g); g.setSelectedEntityId('bram'); } });
    expect(section()).not.toBeNull();
    await choose('(None)');
    expect(section()).toBeNull();
    expect(view.gameplay().selectedEntityId).toBeNull();
    expect(screen.getByText('Vigor')).toBeInTheDocument();
  });

  it('records a pick in the shared selection', async () => {
    const view = renderRightPanel({}, stage);
    await choose('Odette');
    expect(view.gameplay().selectedEntityId).toBe('odette');
  });

  it('opens on the entity the entity view falls back to when nothing was picked', () => {
    renderRightPanel({}, stage);
    expect(screen.getByRole('combobox', { name: 'Entity stats' })).toHaveTextContent('Bram');
    expect(within(section()!).getByText('Trust')).toBeInTheDocument();
  });

  it('says so when the picked entity has nothing to show', async () => {
    renderRightPanel({}, { ...stage, seed: (g) => { stage.seed(g); g.setEntityStats({ ...values, wick: [statFixture('Nerve', 7, { hidden: true })] }); } });
    await choose('a thin runner');
    expect(within(section()!).getByRole('status')).toHaveTextContent('No stats to show.');
  });

  it('adds no picker and no section to a world whose entities show no stat', () => {
    const secret: EntityStatValues = { bram: [statFixture('Secret', 9, { hidden: true })] };
    renderRightPanel({}, {
      world, turns, stats: [statFixture('Vigor', 50)],
      seed: (g) => { g.setEntityStats(secret); g.setVisibleEntities(now); },
    });
    expect(screen.queryByRole('combobox', { name: 'Entity stats' })).not.toBeInTheDocument();
    expect(section()).toBeNull();
  });

  it('opens the Stats tab for a world whose only visible stats belong to entities', () => {
    renderRightPanel({}, { ...stage, stats: [statFixture('Vigor', 50, { hidden: true })] });
    expect(screen.getByRole('tab', { name: /Stats/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Entity stats' })).toBeInTheDocument();
  });

  it('drops the pick when a save loads, but keeps it through a rollback', () => {
    const view = renderRightPanel({}, { ...stage, seed: (g) => { stage.seed(g); g.setSelectedEntityId('odette'); } });
    const snapshot = view.gameplay().gameStates[0];
    act(() => { view.gameplay().loadGameState(snapshot, [], { keepLiveHistory: true }); });
    expect(view.gameplay().selectedEntityId).toBe('odette');
    act(() => { view.gameplay().loadGameState(snapshot, []); });
    expect(view.gameplay().selectedEntityId).toBeUndefined();
  });

  it('reads the viewed turn on a past page', () => {
    const earlier: EntityStatValues = { bram: [statFixture('Trust', 11)] };
    renderRightPanel({}, {
      ...stage, page: 1,
      turns: [{ ...turns[0], entityStats: earlier }, turns[1]],
      seed: (g) => { stage.seed(g); g.setSelectedEntityId('bram'); },
    });
    expect(within(section()!).getByText('11 / 100')).toBeInTheDocument();
  });
});

describe('the entity view and the stat panel', () => {
  const both = (selected?: string) => renderInGame(
    <>
      <LeftPanel entities={[bram, odette, wick] as never} onEntityClick={vi.fn()} narrationPrompt={defaultSystemPrompt} />
      <RightPanel
        onLocationClick={vi.fn()} onToggleTrait={vi.fn()} onPersonaChange={vi.fn()} traitCascade={null}
        onDismissTraitCascade={vi.fn()} onRegenerateStats={vi.fn()} sceneImageJob={null} language="" setLanguage={vi.fn()}
      />
    </>,
    { ...stage, seed: (g) => { stage.seed(g); if (selected) g.setSelectedEntityId(selected); } },
  );
  const shownInView = () => screen.getAllByRole('img').map((img) => img.getAttribute('alt'));

  it('shows the same entity in both places before anyone picks', () => {
    both();
    expect(shownInView()).toContain('Bram');
    expect(screen.getByRole('combobox', { name: 'Entity stats' })).toHaveTextContent('Bram');
  });

  it('moves the entity view when the dropdown picks', async () => {
    both();
    await choose('a thin runner');
    expect(shownInView()).toContain('Wick');
    expect(shownInView()).not.toContain('Bram');
  });

  it('moves the dropdown when the entity list picks', async () => {
    both();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Entities/i }));
    fireEvent.click(await screen.findByText('a thin runner'));
    expect(screen.getByRole('combobox', { name: 'Entity stats' })).toHaveTextContent('a thin runner');
    expect(within(section()!).getByText('Nerve')).toBeInTheDocument();
  });

  it('leaves the entity view on its fallback while the dropdown reads (None)', async () => {
    both('wick');
    await choose('(None)');
    expect(section()).toBeNull();
    expect(shownInView()).toContain('Bram');
  });
});
