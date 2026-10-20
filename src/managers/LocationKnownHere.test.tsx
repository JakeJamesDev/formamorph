import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import LocationKnownHere from './LocationKnownHere';
import type { Entity, GameLocation } from '@/types';

// rosewood > inn
const rosewood: GameLocation = { id: 'rosewood', name: 'Rosewood' };
const inn: GameLocation = { id: 'inn', name: 'Inn', parentId: 'rosewood' };
const queen: Entity = { id: 'queen', name: 'Queen', locations: ['throne'], knownIn: ['rosewood'] };
const herald: Entity = { id: 'herald', name: 'Herald', knownIn: ['inn', 'rosewood'] };
const smith: Entity = { id: 'smith', name: 'Smith' };

const renderAt = (entities: Entity[], onChange = vi.fn()) => {
  render(
    <LocationKnownHere
      location={inn}
      locations={[rosewood, inn]}
      entities={entities}
      labelOf={(e) => e.name}
      locationLabel={(id) => (id === 'rosewood' ? 'Rosewood' : id)}
      onChange={onChange}
    />,
  );
  return onChange;
};

const row = (name: string) => screen.getByText(name).parentElement!;

describe('LocationKnownHere', () => {
  it("names the parent a parent's pick comes from, with no Remove", () => {
    renderAt([queen]);
    expect(within(row('Queen')).getByText('Known in Rosewood')).toBeInTheDocument();
    expect(within(row('Queen')).queryByRole('button')).toBeNull();
  });

  it("removes only this location's own pick", () => {
    const onChange = renderAt([herald]);
    fireEvent.click(within(row('Herald')).getByRole('button', { name: 'Removes this location from Herald’s Known In' }));
    expect(onChange).toHaveBeenCalledWith({ ...herald, knownIn: ['rosewood'] });
  });

  it('lists no one known only Nearby', () => {
    renderAt([smith]);
    expect(screen.queryByText('Smith')).toBeNull();
  });
});
