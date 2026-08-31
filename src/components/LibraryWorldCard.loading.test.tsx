import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { LibraryWorldCard } from './LibraryWorldCard';
import type { WorldRecord } from '@/components/WorldDetails';

/**
 * The tile a stored world gets before its content has been read off disc.
 *
 * The menu draws its real arrangement from the id list, which arrives long before the worlds do, so
 * every tile on screen is a tile the player actually has — the right one, in the right place, at the
 * right size. What it must not do is behave like a loaded card: a blank tile names nothing, so it can
 * open nothing, and a gesture across one would commit an arrangement the player could not see.
 */

/** What the menu builds from an id alone, before any metadata exists for it. */
const blank = (): WorldRecord => ({ id: 'world-1', isLoading: true });

/** The same tile once its metadata has landed. */
const loaded = (): WorldRecord => ({
  id: 'world-1', name: 'Saltmarsh', description: 'A drowned coastal town.', tags: [],
});

const view = (world: WorldRecord, layout: 'grid' | 'detailed' = 'grid', onSelect = vi.fn()) => {
  render(
    <DndContext>
      <SortableContext items={[world.id]}>
        <LibraryWorldCard world={world} contests={[]} layout={layout} onSelect={onSelect} />
      </SortableContext>
    </DndContext>,
  );
  return onSelect;
};

afterEach(cleanup);

describe('a library tile whose world has not loaded yet', () => {
  // `fireEvent`, not `userEvent`: dnd-kit's sensor swallows a synthetic pointer sequence in jsdom, so
  // userEvent's click never reaches the handler even on a card that genuinely opens. This dispatches the
  // same click React binds, and the loaded-card case below is what proves it still tells the two apart.
  const clickTile = () => fireEvent.click(document.querySelector('[class*="rounded-lg"]')!);

  it('opens nothing when clicked, in either layout', () => {
    for (const layout of ['grid', 'detailed'] as const) {
      const onSelect = view(blank(), layout);
      clickTile();
      expect(onSelect).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it('opens the world once its metadata lands, proving the block is the blank state and not the wiring', () => {
    const onSelect = view(loaded());

    clickTile();

    expect(onSelect).toHaveBeenCalledWith('world-1');
  });

  it('prints no name, rather than an empty name strip where a name will be', () => {
    view(blank());
    // A heading is what the loaded tile renders its name in; a blank tile has none to render.
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('says nothing about a missing description in the detailed layout', () => {
    view(blank(), 'detailed');

    // The shell's own fallback for a world that genuinely has no blurb. A tile that has not been read
    // yet is not a tile without a description, and saying so would be a claim about unread data.
    expect(screen.queryByText(/No description available/i)).not.toBeInTheDocument();
  });

  it('still says it in the detailed layout for a loaded world that truly has no description', () => {
    view({ ...loaded(), description: '' }, 'detailed');

    expect(screen.getByText(/No description available/i)).toBeInTheDocument();
  });

  it('carries no drag handle, so a gesture cannot rearrange tiles nobody can read', () => {
    view(blank());

    // dnd-kit marks a draggable with the attributes it spreads; the blank tile is given none of them.
    expect(document.querySelector('[role="button"][aria-roledescription]')).toBeNull();
  });

  it('carries one on the loaded tile, so the missing handle is the blank state and not a broken drag', () => {
    view(loaded());

    expect(document.querySelector('[role="button"][aria-roledescription]')).not.toBeNull();
  });
});
