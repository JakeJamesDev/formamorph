import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { LibraryWorldCard } from './LibraryWorldCard';
import { daysFrom, decidedContest, serverEvent } from '@/test/serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ServerEvent } from '@/types';

const at = (offsetDays: number) => daysFrom(offsetDays);

/** A contest decided a fortnight ago, with `srv-salt` on the step asked for. */
const decided = (place: 1 | 2 | 3 = 1, over: Partial<ServerEvent> = {}): ServerEvent => {
  const podium: Array<[string, string, string]> = [
    ['srv-gold', 'Gold World', 'wren'],
    ['srv-silver', 'Silver World', 'mirelle'],
    ['srv-bronze', 'Bronze World', 'ashgrove'],
  ];
  podium[place - 1] = ['srv-salt', 'Saltmarsh', 'sedgewright'];

  return decidedContest(podium.slice(0, place), { startsAt: at(-30), endsAt: at(-14), ...over });
};

/** A library record as `getWorldMetadata` projects one: local id, plus its community link. */
const localWorld = (over: Partial<WorldRecord> = {}): WorldRecord => ({
  id: 'downloaded-1', name: 'Saltmarsh', description: 'A world', tags: [], ...over,
});

const view = (world: WorldRecord, contests: ServerEvent[], layout: 'grid' | 'detailed' = 'grid') =>
  render(
    <DndContext>
      <SortableContext items={[world.id]}>
        <LibraryWorldCard
          world={world}
          contests={contests}
          layout={layout}
          onSelect={() => {}}
        />
      </SortableContext>
    </DndContext>,
  );

afterEach(cleanup);

/** The badge line for a contest. Its name is drawn inside the line, and the tip that used to be a `title`
 *  now repeats it — so the visible text is what locates the row it belongs to. */
const badge = (contestTitle: string) => screen.getByText(contestTitle).closest('p') as HTMLElement;

describe('a downloaded world that placed in a contest', () => {
  it.each([
    [1, '1st Place'],
    [2, '2nd Place'],
    [3, '3rd Place'],
  ] as const)('names place %i as "%s" on the grid tile', (place, label) => {
    view(localWorld({ sourceId: 'srv-salt' }), [decided(place)]);

    expect(badge('Winter World-Building Contest'))
      .toHaveTextContent(`${label} — Winter World-Building Contest`);
  });

  it.each([
    [1, 'text-gold'],
    [2, 'text-silver'],
    [3, 'text-bronze'],
  ] as const)('colors place %i with its own metal', (place, token) => {
    view(localWorld({ sourceId: 'srv-salt' }), [decided(place)]);

    expect(badge('Winter World-Building Contest')).toHaveClass(token);
  });

  it('wears the same badge in the detailed layout, so a layout choice hides nothing', () => {
    view(localWorld({ sourceId: 'srv-salt' }), [decided(2)], 'detailed');

    expect(badge('Winter World-Building Contest'))
      .toHaveTextContent('2nd Place — Winter World-Building Contest');
  });

  it('keeps it after the copy has been edited locally', () => {
    view(localWorld({ sourceId: 'srv-salt', dirty: true, editedAt: at(-1) }), [decided()]);

    expect(screen.getByText('1st Place —', { exact: false })).toBeInTheDocument();
  });

  it('badges a second copy of the same listing just as loudly', () => {
    // Worlds mint a per-copy id, so two copies differ in everything but the link that earned the badge.
    view(localWorld({ id: 'downloaded-2', sourceId: 'srv-salt' }), [decided()]);

    expect(screen.getByText('1st Place —', { exact: false })).toBeInTheDocument();
  });

  it('names every contest it has placed in, one line each, newest first', () => {
    const older = decided(3, { id: 'e0', title: 'Autumn Ruins Contest', startsAt: at(-400), endsAt: at(-380) });
    const { container } = view(localWorld({ sourceId: 'srv-salt' }), [decided(1), older]);

    expect(badge('Winter World-Building Contest')).toHaveTextContent('1st Place');
    expect(badge('Autumn Ruins Contest')).toHaveTextContent('3rd Place');
    expect(within(container).getAllByText(/Contest$/).map((n) => n.textContent))
      .toEqual(['Winter World-Building Contest', 'Autumn Ruins Contest']);
  });
});

describe('a local world with nothing to show for it', () => {
  it('stays bare when its link is not on the podium', () => {
    view(localWorld({ sourceId: 'srv-other' }), [decided()]);

    expect(screen.queryByText('Place —', { exact: false })).not.toBeInTheDocument();
  });

  it('stays bare when it was never downloaded at all', () => {
    view(localWorld(), [decided()]);

    expect(screen.queryByText('Place —', { exact: false })).not.toBeInTheDocument();
  });

  it('stays bare offline, where the archive could not be read', () => {
    // The library must work exactly as it did before when the community server is unreachable.
    view(localWorld({ sourceId: 'srv-salt' }), []);

    expect(screen.queryByText('Place —', { exact: false })).not.toBeInTheDocument();
  });

  it('stays bare while the contest it entered is still undecided', () => {
    view(localWorld({ sourceId: 'srv-salt' }), [serverEvent()]);

    expect(screen.queryByText('Place —', { exact: false })).not.toBeInTheDocument();
  });

  it('stays bare when the contest that decided it was called off', () => {
    view(localWorld({ sourceId: 'srv-salt' }), [decided(1, { cancelledAt: at(-10) })]);

    expect(screen.queryByText('Place —', { exact: false })).not.toBeInTheDocument();
  });
});
