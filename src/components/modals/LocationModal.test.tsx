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
      resolveText={(text) => text}
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

  it('sets each row in further than the one holding it', () => {
    openDialog();
    // The inset is the indentation the player sees; jsdom has no layout, so the inline style is the seam.
    const insets = rows().map((row) => parseFloat(row.querySelector('button')!.style.paddingLeft));
    const byName = Object.fromEntries(rowNames().map((name, i) => [name, insets[i]]));
    expect(byName['Hall']).toBeGreaterThan(byName['Castle']);
    expect(byName['Cellar']).toBeGreaterThan(byName['Hall']);
    expect(byName['Tower']).toBe(byName['Hall']);
    expect(byName['Moor']).toBe(byName['Castle']);
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

describe('each travel row carries the place\'s description', () => {
  beforeEach(() => localStorage.clear());

  // The described fixture: what the player is told about a place, in the two fields a world can say it in.
  const DESCRIBED: GameLocation[] = [
    { id: 'hall', name: 'Hall', playerDescription: 'Banners hang from the rafters.', description: 'Authored notes.' },
    { id: 'moor', name: 'Moor', description: 'Mist over open ground.' },
    { id: 'void', name: 'Void' },
  ];

  /** The description line of a row, or null when the row has none. */
  const descriptionOf = (name: string) => {
    const button = screen.getByRole('button', { name: new RegExp(`^${name}`) });
    const [, description] = button.querySelectorAll('span');
    return description?.textContent ?? null;
  };

  it('shows the player description, falling back to the authored one', () => {
    openDialog({ locations: DESCRIBED, currentLocationId: 'hall' });
    expect(descriptionOf('Hall')).toBe('Banners hang from the rafters.');
    expect(descriptionOf('Moor')).toBe('Mist over open ground.');
  });

  it('gives a location with no description a name-only row', () => {
    openDialog({ locations: DESCRIBED, currentLocationId: 'hall' });
    expect(descriptionOf('Void')).toBeNull();
  });

  it('reads descriptions through the placeholder resolver', () => {
    openDialog({
      locations: DESCRIBED,
      currentLocationId: 'hall',
      resolveText: (text) => text.replace('Banners', 'Standards'),
    });
    expect(descriptionOf('Hall')).toBe('Standards hang from the rafters.');
  });

  it('keeps the description to a single clipped line', () => {
    openDialog({ locations: DESCRIBED, currentLocationId: 'hall' });
    // jsdom has no layout, so the truncation class is the seam — as the inset test reads paddingLeft.
    const button = screen.getByRole('button', { name: /^Hall/ });
    const [, description] = button.querySelectorAll('span');
    expect(description.className).toContain('truncate');
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

  it('opens on the Map once the player has switched to it', async () => {
    openDialog();
    await userEvent.click(screen.getByRole('tab', { name: 'Map' }));
    cleanup();

    openDialog();
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('location-map')).toBeInTheDocument();
  });
});
