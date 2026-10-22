import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderRightPanel, statFixture, type Gameplay } from '@/test/gamePanels';
import type { EntityStatValues, SceneEntity, Stat, StatLink } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

/** One Blueprint stat linked onto two entities, placed in each one's own group, each with its own value. */
const trust: Stat = { ...statFixture('Trust', 5), id: 'bp-trust', groupId: 'bp' };
const link = (id: string, groupId: string | null): StatLink => ({ id, originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId, order: 0 });
const bram = {
  id: 'bram', name: 'Bram', image: 'data:image/png;base64,AAAA',
  statGroups: [{ id: 'g-bond', name: 'Bond', parentId: null, order: 0 }],
  statLinks: [link('l-bram', 'g-bond')],
};
const odette = { id: 'odette', name: 'Odette', image: 'data:image/png;base64,AAAA', statLinks: [link('l-odette', null)] };
const values: EntityStatValues = {
  bram: [{ ...statFixture('Trust', 40), id: 'bp-trust' }],
  odette: [{ ...statFixture('Trust', 12), id: 'bp-trust' }],
};
const scene: SceneEntity[] = [{ name: 'Bram', revealed: true }, { name: 'Odette', revealed: true }];
const stage = (selected: string) => ({
  world: {
    stats: [trust], statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }], entities: [bram, odette],
  } as never,
  turns: [{ narration: 'Bram and Odette wait.', turnId: 't1', scene, entityStats: values }],
  stats: [statFixture('Vigor', 50)],
  seed: (g: Gameplay) => { g.setEntityStats(values); g.setVisibleEntities(scene); g.setSelectedEntityId(selected); },
});

describe('RightPanel — linked stats', () => {
  it('lays a linked stat out where the entity placed its link, with that entity\'s own value', () => {
    renderRightPanel({}, stage('bram'));
    const section = screen.getByTestId('entity-stats');
    // The subheader's block holds the rows under it.
    expect(within(section).getByText('Bond').parentElement).toHaveTextContent('Trust');
    expect(within(section).getByText('40 / 100')).toBeInTheDocument();
  });

  it('gives each owner of one Blueprint its own value', () => {
    renderRightPanel({}, stage('odette'));
    expect(within(screen.getByTestId('entity-stats')).getByText('12 / 100')).toBeInTheDocument();
  });

  it('never shows the Blueprint among the player\'s stats or its group as a heading', () => {
    renderRightPanel({}, stage('bram'));
    const outside = screen.getAllByText(/^Trust$/).filter((el) => !screen.getByTestId('entity-stats').contains(el));
    expect(outside).toEqual([]);
    expect(screen.queryByText('Blueprints')).toBeNull();
  });
});
