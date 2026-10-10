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

/** The headings the panel draws, in document order. */
const headings = () => screen.queryAllByRole('button', { expanded: true }).concat(screen.queryAllByRole('button', { expanded: false }))
  .filter((b) => ['Body', 'Mind', 'Reflexes'].includes(b.textContent ?? ''))
  .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
  .map((b) => b.textContent);
const statNames = () => screen.getAllByText(/^(Vigor|Grit|Calm|Luck)$/).map((el) => el.textContent);

describe('RightPanel — stat groups', () => {
  it('shows the player stats under collapsible group headings, nested as authored', () => {
    renderRightPanel({}, { world: { statGroups }, stats });
    expect(headings()).toEqual(['Body', 'Reflexes']);
    expect(statNames()).toEqual(['Grit', 'Vigor', 'Luck']);
    expect(screen.getByRole('button', { name: 'Body' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('leaves out a group with no visible stat, and its heading with it', () => {
    renderRightPanel({}, { world: { statGroups }, stats });
    expect(screen.queryByRole('button', { name: 'Mind' })).toBeNull();
    expect(screen.queryByText('Calm')).toBeNull();
  });

  it('collapses a group to its heading and opens it again', () => {
    renderRightPanel({}, { world: { statGroups }, stats });
    fireEvent.click(screen.getByRole('button', { name: 'Body' }));
    expect(screen.getByRole('button', { name: 'Body' })).toHaveAttribute('aria-expanded', 'false');
    expect(statNames()).toEqual(['Luck']);
    expect(screen.queryByRole('button', { name: 'Reflexes' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Body' }));
    expect(statNames()).toEqual(['Grit', 'Vigor', 'Luck']);
  });

  it('collapses an inner group alone and leaves its parent open', () => {
    renderRightPanel({}, { world: { statGroups }, stats });
    fireEvent.click(screen.getByRole('button', { name: 'Reflexes' }));
    expect(statNames()).toEqual(['Vigor', 'Luck']);
  });

  it('draws a world with no groups as the plain list it always was', () => {
    renderRightPanel({}, { stats: [statFixture('Vigor', 50), statFixture('Luck', 10)] });
    expect(statNames()).toEqual(['Vigor', 'Luck']);
    expect(screen.queryAllByRole('button', { expanded: true })).toHaveLength(0);
  });

  it('follows the world\'s grouping when a save holds an older copy of the stat', () => {
    const frozen = stats.map(({ groupId: _g, order: _o, ...rest }) => rest);
    renderRightPanel({}, {
      world: { statGroups }, stats,
      seed: (g: Gameplay) => g.setPlayerStats(frozen),
    });
    expect(headings()).toEqual(['Body', 'Reflexes']);
    expect(statNames()).toEqual(['Grit', 'Vigor', 'Luck']);
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

    it('nests the picked entity\'s rows under its own groups, in the entity section', () => {
      renderRightPanel({}, stage);
      const section = screen.getByTestId('entity-stats');
      expect(within(section).getByRole('button', { name: 'Bond' })).toHaveAttribute('aria-expanded', 'true');
      expect(within(section).getAllByText(/^(Trust|Hunger)$/).map((el) => el.textContent)).toEqual(['Trust', 'Hunger']);
    });

    it('leaves out an entity group whose stats are all hidden', () => {
      renderRightPanel({}, stage);
      expect(screen.queryByRole('button', { name: 'Quiet' })).toBeNull();
    });

    it('keeps the entity\'s groups apart from the world\'s player groups', () => {
      renderRightPanel({}, { ...stage, world: { entities: [bram], statGroups } as never });
      const section = screen.getByTestId('entity-stats');
      expect(within(section).queryByRole('button', { name: 'Body' })).toBeNull();
    });

    it('collapses an entity group on its own, without touching the player\'s', () => {
      renderRightPanel({}, { ...stage, world: { entities: [bram], statGroups } as never, stats });
      fireEvent.click(within(screen.getByTestId('entity-stats')).getByRole('button', { name: 'Bond' }));
      expect(within(screen.getByTestId('entity-stats')).queryByText('Trust')).toBeNull();
      expect(screen.getByRole('button', { name: 'Body' })).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
