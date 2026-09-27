import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityPersonaField, type EntityHome } from './EntityFields';
import { EditorModeContext } from '@/lib/editorMode';
import type { Entity } from '@/types';

function mount(value: Partial<Entity>, home: EntityHome = 'world', onChange = vi.fn()) {
  render(
    <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
      <EntityPersonaField value={{ id: 'e1', name: 'Custom Character', ...value } as Entity} onChange={onChange} home={home} />
    </EditorModeContext.Provider>,
  );
  return onChange;
}

describe('the Persona-Only switch', () => {
  it('writes the mark', async () => {
    const user = userEvent.setup();
    const onChange = mount({ persona: true });
    const box = screen.getByRole('checkbox', { name: /Persona-Only/ });
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(onChange).toHaveBeenLastCalledWith('personaOnly', true);
  });

  it('reads a stored mark as checked, and unchecking clears it', async () => {
    const user = userEvent.setup();
    const onChange = mount({ persona: true, personaOnly: true });
    const box = screen.getByRole('checkbox', { name: /Persona-Only/ });
    expect(box).toBeChecked();
    await user.click(box);
    expect(onChange).toHaveBeenLastCalledWith('personaOnly', undefined);
  });

  it('shows only with the Persona mark', () => {
    mount({ personaOnly: true });
    expect(screen.getByRole('checkbox', { name: /^Persona\b(?!-)/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Persona-Only/ })).not.toBeInTheDocument();
  });

  it('shows only in a world, since a library entity is never in a world cast', () => {
    mount({ persona: true }, 'library');
    expect(screen.queryByRole('checkbox', { name: /Persona-Only/ })).not.toBeInTheDocument();
  });
});
