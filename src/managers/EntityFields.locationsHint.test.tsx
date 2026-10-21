import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntityLocationsField } from './EntityFields';
import type { Entity } from '@/types';

const options = [{ label: 'Town Gate', value: 'gate' }];
const HINT = 'The player can start as this persona at any of these';

const mount = (value: Partial<Entity>) => render(
  <EntityLocationsField value={{ id: 'e1', name: 'Hermit', ...value } as Entity} onChange={() => {}} options={options} />,
);

describe('the Locations field', () => {
  it('tells a persona author that the player can start at any of them', () => {
    mount({ persona: true });
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it('carries no start hint on a cast entity', () => {
    mount({});
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});
