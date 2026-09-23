import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LocationTabBody } from './LocationTabBody';
import type { Connection, GameLocation } from '@/types';

/**
 * The Location tab's body renders from the world's locations alone. In Play shows it inside the World
 * Editor, where no game is running and no game state exists to read.
 */

const dock: GameLocation = { id: 'dock', name: 'Dock', playerDescription: 'Ropes creak in the fog.' };
const market: GameLocation = { id: 'market', name: 'Market' };
const cellar: GameLocation = { id: 'cellar', name: 'Cellar', parentId: 'dock' };
const locations = [dock, market, cellar];
const connections: Connection[] = [{ id: 'c1', from: 'dock', to: 'market', twoWay: true }];

afterEach(cleanup);

describe('LocationTabBody outside a running game', () => {
  it('shows the location, its Player-Facing Description and its Connected Locations', () => {
    render(<LocationTabBody location={dock} locations={locations} connections={connections} />);
    expect(screen.getByRole('button', { name: 'Current Location: Dock' })).toBeInTheDocument();
    expect(screen.getByText('Ropes creak in the fog.')).toBeInTheDocument();
    expect(screen.getByText('Connected Locations:')).toBeInTheDocument();
    // The nested Cellar is reachable too, but only drawn Connections are listed.
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Market']);
  });

  it('resolves the description through the resolver it is given', () => {
    render(
      <LocationTabBody
        location={dock}
        locations={locations}
        connections={connections}
        resolveText={(text) => text.toUpperCase()}
      />,
    );
    expect(screen.getByText('ROPES CREAK IN THE FOG.')).toBeInTheDocument();
  });

  it('lists no Connected Locations for a place no Connection leaves', () => {
    render(<LocationTabBody location={cellar} locations={locations} connections={connections} />);
    expect(screen.queryByText('Connected Locations:')).toBeNull();
  });

  it('names a past turn\'s location without offering travel from it', () => {
    const onLocationClick = vi.fn();
    render(
      <LocationTabBody
        location={dock}
        locations={locations}
        connections={connections}
        past
        onLocationClick={onLocationClick}
      />,
    );
    const button = screen.getByRole('button', { name: 'Location: Dock' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onLocationClick).not.toHaveBeenCalled();
  });

  it('reads Unknown when there is no location', () => {
    render(<LocationTabBody location={null} locations={locations} connections={connections} />);
    expect(screen.getByRole('button', { name: 'Current Location: Unknown' })).toBeInTheDocument();
  });
});
