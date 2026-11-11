import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PersonaPresenceHint from './PersonaPresenceHint';

describe('PersonaPresenceHint', () => {
  it('names Placement and Known In as the fields the Custom Persona lacks', () => {
    const { container } = render(<PersonaPresenceHint />);
    expect(container.textContent).toBe('Moves with the player, so Placement and Known In don’t apply');
  });
});
