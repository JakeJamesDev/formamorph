import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { LibraryWorldCard } from './LibraryWorldCard';
import { daysFrom, serverEvent } from '@/test/serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ServerEvent } from '@/types';

const at = (offsetDays: number) => daysFrom(offsetDays);

/** A contest that ended a fortnight ago with `Saltmarsh` — the listing id, not the local record's. */
const decided = (over: Partial<ServerEvent> = {}): ServerEvent =>
  serverEvent({ startsAt: at(-30), endsAt: at(-14), winnerWorldId: 'srv-salt', winnerName: 'Saltmarsh', ...over });

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
          onDelete={() => {}}
        />
      </SortableContext>
    </DndContext>,
  );

afterEach(cleanup);

describe('a downloaded world that won a contest', () => {
  it('wears the badge on the grid tile', () => {
    view(localWorld({ sourceId: 'srv-salt' }), [decided()]);

    expect(screen.getByTitle('Winter World-Building Contest'))
      .toHaveTextContent('Winner — Winter World-Building Contest');
  });

  it('wears the same badge in the detailed layout, so a layout choice hides nothing', () => {
    view(localWorld({ sourceId: 'srv-salt' }), [decided()], 'detailed');

    expect(screen.getByTitle('Winter World-Building Contest'))
      .toHaveTextContent('Winner — Winter World-Building Contest');
  });

  it('keeps it after the copy has been edited locally', () => {
    view(localWorld({ sourceId: 'srv-salt', dirty: true, editedAt: at(-1) }), [decided()]);

    expect(screen.getByText('Winner —', { exact: false })).toBeInTheDocument();
  });

  it('badges a second copy of the same listing just as loudly', () => {
    // Worlds mint a per-copy id, so two copies differ in everything but the link that earned the trophy.
    view(localWorld({ id: 'downloaded-2', sourceId: 'srv-salt' }), [decided()]);

    expect(screen.getByText('Winner —', { exact: false })).toBeInTheDocument();
  });

  it('names every contest it has won', () => {
    const older = decided({ id: 'e0', title: 'Autumn Ruins Contest', startsAt: at(-400), endsAt: at(-380) });
    const { container } = view(localWorld({ sourceId: 'srv-salt' }), [decided(), older]);

    expect(screen.getByTitle('Winter World-Building Contest')).toBeInTheDocument();
    expect(screen.getByTitle('Autumn Ruins Contest')).toBeInTheDocument();
    // Newest first, so the most recent honor leads.
    expect(within(container).getAllByText(/Contest$/).map((n) => n.textContent))
      .toEqual(['Winter World-Building Contest', 'Autumn Ruins Contest']);
  });
});

describe('a local world with nothing to show for it', () => {
  it('stays bare when its link names no winner', () => {
    view(localWorld({ sourceId: 'srv-other' }), [decided()]);

    expect(screen.queryByText('Winner —', { exact: false })).not.toBeInTheDocument();
  });

  it('stays bare when it was never downloaded at all', () => {
    view(localWorld(), [decided()]);

    expect(screen.queryByText('Winner —', { exact: false })).not.toBeInTheDocument();
  });

  it('stays bare offline, where the archive could not be read', () => {
    // The library must work exactly as it did before when the community server is unreachable.
    view(localWorld({ sourceId: 'srv-salt' }), []);

    expect(screen.queryByText('Winner —', { exact: false })).not.toBeInTheDocument();
  });

  it('stays bare while the contest it entered is still undecided', () => {
    view(localWorld({ sourceId: 'srv-salt' }), [serverEvent()]);

    expect(screen.queryByText('Winner —', { exact: false })).not.toBeInTheDocument();
  });
});
