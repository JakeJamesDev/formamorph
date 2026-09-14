import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ListingCompatibleWorlds } from './ListingCompatibleWorlds';
import { associationGroups } from '@/lib/listingAssociations';
import type { WorldAssociation } from '@/lib/compatibleWorlds';

afterEach(cleanup);

const draw = (associations: WorldAssociation[], onOpenWorld?: (id: string) => void) =>
  render(
    <ListingCompatibleWorlds
      groups={associationGroups(associations, true)}
      kind="entity"
      {...(onOpenWorld ? { onOpenWorld } : {})}
    />,
  );

describe('a component listing’s Compatible Worlds', () => {
  it('draws nothing for a component offered for no world', () => {
    const { container } = draw([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists the approved and the community worlds under their own headings', () => {
    draw([
      { id: 'w1', name: 'Sedge Landing', reviewState: 'approved' },
      { id: 'w2', name: 'The Long Dark', reviewState: 'unreviewed' },
    ]);

    expect(screen.getByText('Compatible Worlds')).toBeTruthy();
    expect(screen.getByText('Approved (1)')).toBeTruthy();
    expect(screen.getByText('Sedge Landing')).toBeTruthy();
    expect(screen.getByText('Community (1)')).toBeTruthy();
    expect(screen.getByText('The Long Dark')).toBeTruthy();
  });

  it('says the worlds are offered rather than installed', () => {
    draw([{ id: 'w1', name: 'Sedge Landing', reviewState: 'approved' }]);

    expect(screen.getByText(/Downloading this entity installs the entity alone/)).toBeTruthy();
  });

  it('labels a declined world rather than hiding it from the reader the server sent it to', () => {
    draw([{ id: 'w3', name: 'Ashfall', reviewState: 'declined' }]);

    expect(screen.getByText('Ashfall')).toBeTruthy();
    expect(screen.getByText('Not recommended by the world author')).toBeTruthy();
  });

  it('keeps a declined world out of the approved and community groups', () => {
    draw([
      { id: 'w1', name: 'Sedge Landing', reviewState: 'approved' },
      { id: 'w3', name: 'Ashfall', reviewState: 'declined' },
    ]);

    // Grouped under its own heading, never counted among the worlds the listing is offered for.
    expect(screen.getByText('Approved (1)')).toBeTruthy();
    expect(screen.queryByText(/^Community/)).toBeNull();
  });

  it('opens the world a row names', () => {
    const onOpenWorld = vi.fn();
    draw([{ id: 'w1', name: 'Sedge Landing', reviewState: 'approved' }], onOpenWorld);

    fireEvent.click(screen.getByRole('button', { name: 'Open Sedge Landing' }));

    expect(onOpenWorld).toHaveBeenCalledWith('w1');
  });

  it('leaves the row a plain name where the surface opens nothing', () => {
    draw([{ id: 'w1', name: 'Sedge Landing', reviewState: 'approved' }]);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Sedge Landing')).toBeTruthy();
  });
});
