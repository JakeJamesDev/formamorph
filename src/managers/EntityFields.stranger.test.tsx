import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityStrangerFields, type EntityHome } from './EntityFields';
import { EditorModeContext } from '@/lib/editorMode';
import type { Entity } from '@/types';

// The chip editors need a browser caret; a plain box stands in for typing.
vi.mock('@/components/prompt/PlaceholderField', () => {
  const Box = ({ value, onChange, ariaLabel, label }: { value: string; onChange: (v: string) => void; ariaLabel?: string; label?: string }) =>
    <input aria-label={ariaLabel ?? label} value={value} onChange={(e) => onChange(e.target.value)} />;
  return { default: Box, PlaceholderNameField: Box };
});

function mount(value: Partial<Entity>, { home = 'world', advanced = true }: { home?: EntityHome; advanced?: boolean } = {}) {
  const onChange = vi.fn();
  render(
    <EditorModeContext.Provider value={{ mode: advanced ? 'advanced' : 'simple', advanced, setMode: () => {} }}>
      <EntityStrangerFields value={{ id: 'e1', name: 'Sylvie', ...value } as Entity} onChange={onChange} home={home} />
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

  it('stores a whitespace-only Stranger Name as absent', async () => {
    const onChange = mount({});
    await userEvent.setup().type(screen.getByLabelText('Stranger Name'), ' ');
    expect(onChange).toHaveBeenLastCalledWith('strangerName', undefined);
  });

  it('hides both fields in Simple mode', () => {
    mount({}, { advanced: false });
    expect(screen.queryByLabelText('Stranger Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Stranger Description')).not.toBeInTheDocument();
  });

  it('hides both fields for a library entity', () => {
    mount({}, { home: 'library' });
    expect(screen.queryByLabelText('Stranger Name')).not.toBeInTheDocument();
  });
});
