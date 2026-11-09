import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityDescriptionFields, EntityIdentityFields, EntityStrangerDescriptionField, type EntityHome } from './EntityFields';
import { EditorModeContext } from '@/lib/editorMode';
import { HELP_TOPICS } from '@/lib/helpTopics';
import type { Entity } from '@/types';

// The generate button reads Settings; this suite is about the Stranger fields.
vi.mock('@/components/AiGenerateButton', () => ({ default: () => null }));

// The chip editors need a browser caret; a plain box stands in for typing.
vi.mock('@/components/prompt/PlaceholderField', () => {
  const Box = ({ value, onChange, ariaLabel, label, labelAside }: {
    value: string; onChange: (v: string) => void; ariaLabel?: string; label?: string; labelAside?: ReactNode;
  }) => (
    <>
      {labelAside}
      <input aria-label={ariaLabel ?? label} value={value} onChange={(e) => onChange(e.target.value)} />
    </>
  );
  return { default: Box, PlaceholderNameField: Box };
});

function mount(value: Partial<Entity>, { home = 'world', advanced = true }: { home?: EntityHome; advanced?: boolean } = {}) {
  const onChange = vi.fn();
  const entity = { id: 'e1', name: 'Sylvie', ...value } as Entity;
  render(
    <EditorModeContext.Provider value={{ mode: advanced ? 'advanced' : 'simple', advanced, setMode: () => {} }}>
      <EntityIdentityFields value={entity} onChange={onChange} home={home} />
      <EntityDescriptionFields
        value={entity}
        onChange={onChange}
        afterPlayer={<EntityStrangerDescriptionField value={entity} onChange={onChange} home={home} />}
      />
    </EditorModeContext.Provider>,
  );
  return onChange;
}

describe('the Stranger fields', () => {
  it('shows both fields with the stored values', () => {
    mount({ strangerName: 'a hooded figure', strangerDescription: 'Face hidden.' });
    expect(screen.getByLabelText('Stranger Name')).toHaveValue('a hooded figure');
    expect(screen.getByLabelText('Stranger Description')).toHaveValue('Face hidden.');
  });

  it('puts Stranger Name in the same row as Name', () => {
    mount({});
    const row = screen.getByLabelText('Name').closest('.grid');
    expect(row).toContainElement(screen.getByLabelText('Stranger Name'));
  });

  it('puts Stranger Description directly after Player-Facing Description, with a blank Stranger Name', () => {
    mount({});
    const order = screen.getAllByRole('textbox').map((box) => box.getAttribute('aria-label'));
    const player = order.indexOf('Player-Facing Description');
    expect(order[player + 1]).toBe('Stranger Description');
    expect(order[player + 2]).toBe('AI-Facing Description');
  });

  it('gives each field one help button for its own topic, with no inline hint', () => {
    mount({});
    expect(screen.getAllByRole('button', { name: 'About Stranger Name' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'About Stranger Description' })).toHaveLength(1);
    expect(HELP_TOPICS['worldEditor.strangerName']?.title).toBe('Stranger Name');
    expect(HELP_TOPICS['worldEditor.strangerDescription']?.title).toBe('Stranger Description');
    expect(screen.queryByText(/until the narration uses/)).not.toBeInTheDocument();
  });

  it('saves typed text to the entity', async () => {
    const onChange = mount({});
    await userEvent.setup().type(screen.getByLabelText('Stranger Name'), 'a');
    expect(onChange).toHaveBeenCalledWith('strangerName', 'a');
  });

  it.each(['strangerName', 'strangerDescription'] as const)('stores a cleared %s as absent, not an empty string', async (field) => {
    const onChange = mount({ [field]: 'x' });
    const label = field === 'strangerName' ? 'Stranger Name' : 'Stranger Description';
    await userEvent.setup().clear(screen.getByLabelText(label));
    expect(onChange).toHaveBeenLastCalledWith(field, undefined);
  });

  it('clearing Stranger Name never writes the Stranger Description', async () => {
    const onChange = mount({ strangerName: 'a hooded figure', strangerDescription: 'Face hidden.' });
    await userEvent.setup().clear(screen.getByLabelText('Stranger Name'));
    expect(onChange.mock.calls.map(([field]) => field)).toEqual(['strangerName']);
  });

  it('stores a whitespace-only Stranger Name as absent', async () => {
    const onChange = mount({});
    await userEvent.setup().type(screen.getByLabelText('Stranger Name'), ' ');
    expect(onChange).toHaveBeenLastCalledWith('strangerName', undefined);
  });

  it('hides both fields in Simple mode and leaves Name alone in its row', () => {
    mount({}, { advanced: false });
    expect(screen.queryByLabelText('Stranger Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Stranger Description')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name').closest('.grid')?.querySelectorAll('input')).toHaveLength(1);
  });

  it('hides both fields for a library entity', () => {
    mount({}, { home: 'library' });
    expect(screen.queryByLabelText('Stranger Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Stranger Description')).not.toBeInTheDocument();
  });
});
