import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocationModal } from './LocationModal';
import type { GameLocation } from '@/types';

/**
 * The Change Location dialog: the two ways a player travels. The Map is stubbed — xyflow measures nodes off a
 * layout jsdom does not have — so what is guarded here is the dialog's own behavior: the order and depth the
 * rows come out in, that a click travels and closes, where the player is marked, and which view the dialog
 * opens on next time.
 */

vi.mock('@/components/game/LocationMap', () => ({
  default: ({ currentLocationId }: { currentLocationId: string | null }) => (
    <div data-testid="location-map" data-current={currentLocationId ?? ''} />
  ),
}));

const L = (id: string, name: string, parentId?: string): GameLocation => ({ id, name, parentId });

// Castle [Hall [Cellar], Tower] · Moor — authored in an order the tree has to put back together.
const LOCATIONS: GameLocation[] = [
  L('castle', 'Castle'),
  L('moor', 'Moor'),
  L('hall', 'Hall', 'castle'),
  L('tower', 'Tower', 'castle'),
  L('cellar', 'Cellar', 'hall'),
];

const openDialog = (props: Partial<Parameters<typeof LocationModal>[0]> = {}) =>
  render(
    <LocationModal
      isOpen
      onOpenChange={() => {}}
      locations={LOCATIONS}
      connections={[]}
      currentLocationId="hall"
      changeLocation={() => {}}
      {...props}
    />,
  );

/** Every travel row on the List, in the order the player reads them. */
const rows = () => screen.getAllByRole('listitem');
const rowNames = () => rows().map((row) => row.textContent);
const rowLevels = () => rows().map((row) => row.getAttribute('aria-level'));

describe('the Change Location list reads the world as a tree', () => {
  beforeEach(() => localStorage.clear());

  it('puts every sublocation under its own parent, siblings in authored order', () => {
    openDialog();
    expect(rowNames()).toEqual(['Castle', 'Hall', 'Cellar', 'Tower', 'Moor']);
  });

  it('marks each row with how deeply it is nested', () => {
    openDialog();
    expect(rowLevels()).toEqual(['1', '2', '3', '2', '1']);
  });

  it('offers a parent location as its own destination, not only its children', async () => {
    const changeLocation = vi.fn();
    openDialog({ changeLocation });
    await userEvent.click(screen.getByRole('button', { name: 'Castle' }));
    expect(changeLocation).toHaveBeenCalledWith(LOCATIONS.find((l) => l.id === 'castle'));
  });

  it('travels and closes on one click', async () => {
    const changeLocation = vi.fn();
    const onOpenChange = vi.fn();
    openDialog({ changeLocation, onOpenChange });
    await userEvent.click(screen.getByRole('button', { name: 'Cellar' }));
    expect(changeLocation).toHaveBeenCalledWith(LOCATIONS.find((l) => l.id === 'cellar'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('marks where the player is standing', () => {
    openDialog();
    expect(screen.getByRole('button', { name: 'Hall' })).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('button', { name: 'Cellar' })).not.toHaveAttribute('aria-current');
  });
});

describe('the Change Location dialog remembers the view the player travels by', () => {
  beforeEach(() => localStorage.clear());

  it('opens on the List the first time', () => {
    openDialog();
    expect(screen.getByRole('tab', { name: 'List' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('location-map')).toBeNull();
  });

  it('hands the Map the world and the location the player is standing in', async () => {
    openDialog();
    await userEvent.click(screen.getByRole('tab', { name: 'Map' }));
    expect(screen.getByTestId('location-map')).toHaveAttribute('data-current', 'hall');
  });

  it('opens on the Map once the player has traveled by it', async () => {
    openDialog();
    await userEvent.click(screen.getByRole('tab', { name: 'Map' }));
    cleanup();

    openDialog();
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('location-map')).toBeInTheDocument();
  });
});
