import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { EntityLocationsField } from './EntityFields';
import type { Entity } from '@/types';

const options = [{ label: 'Town Gate', value: 'gate' }, { label: 'Mill', value: 'mill' }];
const GROUP_HINT = 'Lets the player start at any of these when they play this entity';
const INDIVIDUAL_HINT = 'Lets the player start at any of its start locations when they play this entity';

const mount = (value: Partial<Entity>, onEntityChange = vi.fn()) => {
  render(
    <EntityLocationsField value={{ id: 'e1', name: 'Hermit', ...value } as Entity} onChange={() => {}} options={options} onEntityChange={onEntityChange} />,
  );
  return onEntityChange;
};

describe('the placement field', () => {
  it('tells a persona author where the player can start, for each placement', () => {
    mount({ persona: true, kind: 'group', locations: ['gate'] });
    expect(screen.getByText(GROUP_HINT)).toBeInTheDocument();
  });

  it('tells a persona author of an entity in one location that its start locations count', () => {
    mount({ persona: true, kind: 'individual' });
    expect(screen.getByText(INDIVIDUAL_HINT)).toBeInTheDocument();
  });

  it('carries no start hint on a cast entity', () => {
    mount({ kind: 'group' });
    expect(screen.queryByText(GROUP_HINT)).not.toBeInTheDocument();
    expect(screen.queryByText(INDIVIDUAL_HINT)).not.toBeInTheDocument();
  });

  it('sets where an entity in one location starts', () => {
    const write = mount({ kind: 'individual', traversable: 'anywhere' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Starts At' }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Mill' }));
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'individual', locations: ['mill'], starts: [expect.objectContaining({ place: 'mill', weight: 1, schedule: [] })],
    }));
  });

  it('says how many start locations an older entity has', () => {
    mount({
      kind: 'individual',
      starts: [{ id: 'a', place: 'gate', weight: 1, schedule: [] }, { id: 'b', place: 'mill', weight: 1, schedule: [] }],
    });
    expect(screen.getByText('Starts at one of 2 locations, picked at random in each new game. This sets the first.')).toBeInTheDocument();
  });

  it('turns an entity in one location into one at every location, keeping its places', () => {
    const write = mount({ kind: 'individual', locations: ['gate'], starts: [{ id: 'a', place: 'gate', weight: 1, schedule: [] }] });
    fireEvent.click(screen.getByRole('radio', { name: 'Every Location' }));
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ kind: 'group', locations: ['gate'] }));
    expect(write.mock.calls[0][0]).not.toHaveProperty('starts');
  });
});
