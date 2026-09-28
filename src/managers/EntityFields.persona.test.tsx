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

const role = (name: string) => screen.getByRole('radio', { name });

describe('the Persona role', () => {
  it.each([
    [{}, 'Cast'],
    [{ persona: true }, 'Playable'],
    [{ persona: true, personaOnly: true }, 'Persona-Only'],
  ] as const)('reads %o as %s', (value, label) => {
    mount(value);
    expect(role(label)).toBeChecked();
  });

  it('writes both marks for Persona-Only', async () => {
    const onChange = mount({});
    await userEvent.setup().click(role('Persona-Only'));
    expect(onChange).toHaveBeenCalledWith('persona', true);
    expect(onChange).toHaveBeenCalledWith('personaOnly', true);
  });

  it('clears both marks for Cast', async () => {
    const onChange = mount({ persona: true, personaOnly: true });
    await userEvent.setup().click(role('Cast'));
    expect(onChange).toHaveBeenCalledWith('persona', undefined);
    expect(onChange).toHaveBeenCalledWith('personaOnly', undefined);
  });

  it('keeps the role when the active segment is clicked again', async () => {
    const onChange = mount({ persona: true });
    await userEvent.setup().click(role('Playable'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers no Persona-Only in the library, since a library entity is never in a world cast', () => {
    mount({ persona: true }, 'library');
    expect(role('Playable')).toBeChecked();
    expect(screen.queryByRole('radio', { name: 'Persona-Only' })).not.toBeInTheDocument();
  });
});
