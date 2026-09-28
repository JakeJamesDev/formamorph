import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

describe('the Custom Persona role', () => {
  const linked = { traitLinks: [{ id: 'l1', originalId: 'o', kind: 'trait' as const, originalName: 'Paladin', groupId: null }] };

  function mountHeld(value: Partial<Entity>, holder?: string) {
    const onChange = vi.fn();
    render(
      <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
        <EntityPersonaField value={{ id: 'e1', name: 'Newcomer', ...value } as Entity} onChange={onChange} home="world" customPersonaHolder={holder} />
      </EditorModeContext.Provider>,
    );
    return onChange;
  }

  it('is a fourth segment in a world and absent in the library', () => {
    mount({ customPersona: true });
    expect(role('Custom Persona')).toBeChecked();
    cleanup();
    mount({}, 'library');
    expect(screen.queryByRole('radio', { name: 'Custom Persona' })).not.toBeInTheDocument();
  });

  it('clears the Persona marks and the node placement when picked', async () => {
    const onChange = mount({ persona: true, personaOnly: true });
    await userEvent.setup().click(role('Custom Persona'));
    expect(onChange).toHaveBeenCalledWith('customPersona', true);
    expect(onChange).toHaveBeenCalledWith('persona', undefined);
    expect(onChange).toHaveBeenCalledWith('personaOnly', undefined);
    expect(onChange).toHaveBeenCalledWith('traitPlacement', undefined);
  });

  it('is unavailable while another entity holds it, naming that entity', () => {
    mountHeld({}, 'Wanderer');
    expect(role('Custom Persona')).toBeDisabled();
    expect(screen.getByText('Wanderer')).toBeInTheDocument();
    expect(screen.getByText(/Only one entity can be the Custom Persona/)).toHaveTextContent('Only one entity can be the Custom Persona. Wanderer has it now.');
  });

  it('asks before an entity with links leaves the role, and keeps it on Cancel', async () => {
    const user = userEvent.setup();
    const onChange = mount({ customPersona: true, ...linked });
    await user.click(role('Cast'));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('It becomes a regular entity and keeps its 1 link.');
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves the role on Confirm, into the role the author picked', async () => {
    const user = userEvent.setup();
    const onChange = mount({ customPersona: true, ...linked });
    await user.click(role('Playable'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onChange).toHaveBeenCalledWith('customPersona', undefined);
    expect(onChange).toHaveBeenCalledWith('persona', true);
  });

  it('leaves the role at once when the entity carries nothing', async () => {
    const onChange = mount({ customPersona: true });
    await userEvent.setup().click(role('Cast'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('customPersona', undefined);
  });
});
