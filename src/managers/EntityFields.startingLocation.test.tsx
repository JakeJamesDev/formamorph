import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityStartingLocationField } from './EntityFields';
import { EditorModeContext } from '@/lib/editorMode';
import type { Entity } from '@/types';

// Flagged or not, every location is a choice: the flag lives on the location, not in this list.
const options = [
  { label: 'Town Gate', value: 'gate' },
  { label: 'Hermit Cellar', value: 'cellar', depth: 1 },
];

function mount(value: Partial<Entity>, onChange = vi.fn()) {
  render(
    <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
      <EntityStartingLocationField value={{ id: 'e1', name: 'Hermit', ...value } as Entity} onChange={onChange} options={options} />
    </EditorModeContext.Provider>,
  );
  return onChange;
}

describe('the Starting Location select', () => {
  it('offers Automatic first, then every location', async () => {
    mount({ persona: true });
    const select = screen.getByRole('combobox', { name: 'Starting Location' });
    expect(select).toHaveTextContent('Automatic');
    await userEvent.setup().click(select);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Automatic', 'Town Gate', 'Hermit Cellar']);
  });

  it('writes the picked location, and Automatic clears it', async () => {
    const user = userEvent.setup();
    const onChange = mount({ persona: true, startingLocationId: 'gate' });
    await user.click(screen.getByRole('combobox', { name: 'Starting Location' }));
    await user.click(screen.getByRole('option', { name: 'Hermit Cellar' }));
    expect(onChange).toHaveBeenLastCalledWith('startingLocationId', 'cellar');
    await user.click(screen.getByRole('combobox', { name: 'Starting Location' }));
    await user.click(screen.getByRole('option', { name: 'Automatic' }));
    expect(onChange).toHaveBeenLastCalledWith('startingLocationId', undefined);
  });

  it('reads a deleted location as Automatic', () => {
    mount({ persona: true, startingLocationId: 'gone' });
    expect(screen.getByRole('combobox', { name: 'Starting Location' })).toHaveTextContent('Automatic');
  });

  it('shows only for an entity with the Persona mark', () => {
    mount({ startingLocationId: 'gate' });
    expect(screen.queryByRole('combobox', { name: 'Starting Location' })).not.toBeInTheDocument();
  });
});
