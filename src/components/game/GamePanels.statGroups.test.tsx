import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderRightPanel, statFixture, type Gameplay } from '@/test/gamePanels';
import type { EntityStatValues, SceneEntity, StatGroup } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const group = (id: string, name: string, extra: Partial<StatGroup> = {}): StatGroup => ({ id, name, parentId: null, ...extra });

const statGroups = [
  group('g-body', 'Body', { order: 0 }),
  group('g-mind', 'Mind', { order: 1 }),
  group('g-inner', 'Reflexes', { parentId: 'g-body', order: 0 }),
];
const stats = [
  statFixture('Vigor', 50, { groupId: 'g-body', order: 1 }),
  statFixture('Grit', 20, { groupId: 'g-inner', order: 0 }),
  // Hidden, so the group that holds only this stat has nothing to show.
  statFixture('Calm', 70, { groupId: 'g-mind', order: 0, hidden: true }),
  statFixture('Luck', 10, { order: 2 }),
];

/** The group subheaders the panel draws, in document order. */
const subheaders = () => screen.queryAllByText(/^(Body|Mind|Reflexes|Body › Reflexes)$/).map((el) => el.textContent);
const statNames = () => screen.getAllByText(/^(Vigor|Grit|Calm|Luck)$/).map((el) => el.textContent);
const card = (name: string) => screen.getByRole('button', { name });

describe('RightPanel — stat groups', () => {
  it('shows the global stats under flat group subheaders, ungrouped first, each group before its subgroups', () => {
    renderRightPanel({}, { world: { statGroups }, stats });
    expect(subheaders()).toEqual(['Body', 'Body › Reflexes']);
    expect(statNames()).toEqual(['Luck', 'Vigor', 'Grit']);
    expect(screen.queryByRole('button', { name: 'Body' })).toBeNull();
  });

  it('leaves out a group with no visible stat, and its subheader with it', () => {
    renderRightPanel({}, { world: { statGroups }, stats });
    expect(screen.queryByText('Mind')).toBeNull();
    expect(screen.queryByText('Calm')).toBeNull();
  });

  it('folds the Global card to its header and opens it again', () => {
    renderRightPanel({}, { world: { statGroups }, stats });
    expect(card('Global')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(card('Global'));
    expect(card('Global')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByText(/^(Vigor|Grit|Luck)$/)).toHaveLength(0);
    fireEvent.click(card('Global'));
    expect(statNames()).toEqual(['Luck', 'Vigor', 'Grit']);
  });

  it('draws a world with no groups as a plain list in the Global card', () => {
    renderRightPanel({}, { stats: [statFixture('Vigor', 50), statFixture('Luck', 10)] });
    expect(statNames()).toEqual(['Vigor', 'Luck']);
    expect(subheaders()).toEqual([]);
  });

  it('follows the world\'s grouping when a save holds an older copy of the stat', () => {
    const frozen = stats.map(({ groupId: _g, order: _o, ...rest }) => rest);
    renderRightPanel({}, {
      world: { statGroups }, stats,
      seed: (g: Gameplay) => g.setGlobalStats(frozen),
    });
    expect(subheaders()).toEqual(['Body', 'Body › Reflexes']);
    expect(statNames()).toEqual(['Luck', 'Vigor', 'Grit']);
  });

  describe('an entity\'s stats', () => {
    const scene: SceneEntity[] = [{ name: 'Bram', revealed: true }];
    const values: EntityStatValues = {
      bram: [
        statFixture('Trust', 40, { groupId: 'g-bond', order: 0 }),
        statFixture('Nerve', 7, { groupId: 'g-quiet', order: 0, hidden: true }),
        statFixture('Hunger', 3, { order: 1 }),
      ],
    };
    const bram = {
      id: 'bram', name: 'Bram', image: 'data:image/png;base64,AAAA',
      stats: values.bram,
      statGroups: [group('g-bond', 'Bond', { order: 0 }), group('g-quiet', 'Quiet', { order: 2 })],
    };
    const stage = {
      world: { entities: [bram] } as never,
      turns: [{ narration: 'Bram waits.', turnId: 't1', scene, entityStats: values }],
      stats: [statFixture('Vigor', 50)],
      seed: (g: Gameplay) => { g.setEntityStats(values); g.setVisibleEntities(scene); g.setSelectedEntityId('bram'); },
    };

    it('lays the picked entity\'s rows out under its own group subheaders, in the entity card', () => {
      renderRightPanel({}, stage);
      const section = screen.getByTestId('entity-stats');
      expect(within(section).getByText('Bond').parentElement).toHaveTextContent('Trust');
      expect(within(section).getAllByText(/^(Trust|Hunger)$/).map((el) => el.textContent)).toEqual(['Hunger', 'Trust']);
    });

    it('leaves out an entity group whose stats are all hidden', () => {
      renderRightPanel({}, stage);
      expect(screen.queryByText('Quiet')).toBeNull();
    });

    it('keeps the entity\'s groups apart from the world\'s player groups', () => {
      renderRightPanel({}, { ...stage, world: { entities: [bram], statGroups } as never });
      expect(within(screen.getByTestId('entity-stats')).queryByText('Body')).toBeNull();
    });

    it('folds the entity card on its own, without touching the Global card', () => {
      renderRightPanel({}, { ...stage, world: { entities: [bram], statGroups } as never, stats });
      const section = screen.getByTestId('entity-stats');
      fireEvent.click(within(section).getByRole('button', { name: 'Bram' }));
      expect(within(section).queryByText('Trust')).toBeNull();
      expect(card('Global')).toHaveAttribute('aria-expanded', 'true');
      expect(statNames()).toEqual(['Luck', 'Vigor', 'Grit']);
    });
  });
});
