import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityIdentityFields } from './EntityFields';
import { EditorModeContext } from '@/lib/editorMode';
import { swatchColor } from '@/lib/coref/speakerPalette';
import type { Entity } from '@/types';

// The chip editors need a browser caret; a plain box stands in.
vi.mock('@/components/prompt/PlaceholderField', () => {
  const Box = ({ value, ariaLabel }: { value: string; ariaLabel?: string }) => <input aria-label={ariaLabel} value={value} readOnly />;
  return { default: Box, PlaceholderNameField: Box };
});

function mount(value: Partial<Entity>, advanced = true) {
  const onChange = vi.fn();
  render(
    <EditorModeContext.Provider value={{ mode: advanced ? 'advanced' : 'simple', advanced, setMode: () => {} }}>
      <EntityIdentityFields value={{ id: 'e1', name: 'Sylvie', ...value } as Entity} onChange={onChange} home="world" />
    </EditorModeContext.Provider>,
  );
  return onChange;
}

describe('the Quote Color field', () => {
  it('shows Auto for an entity with no pinned swatch', () => {
    mount({});
    expect(screen.getByRole('combobox', { name: 'Quote Color' })).toHaveTextContent('Auto');
  });

  it('shows the pinned swatch by name', () => {
    mount({ quoteColor: 'teal' });
    expect(screen.getByRole('combobox', { name: 'Quote Color' })).toHaveTextContent('Teal');
  });

  it('stores the picked swatch key, each option shown in its own color', async () => {
    const onChange = mount({});
    await userEvent.click(screen.getByRole('combobox', { name: 'Quote Color' }));
    const plum = screen.getByRole('option', { name: 'Plum' });
    expect(plum.getAttribute('style')).toContain(`color: ${swatchColor('plum')}`);
    await userEvent.click(plum);
    expect(onChange).toHaveBeenCalledWith('quoteColor', 'plum');
  });

  it('clears the field when Auto is picked', async () => {
    const onChange = mount({ quoteColor: 'teal' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Quote Color' }));
    await userEvent.click(screen.getByRole('option', { name: 'Auto' }));
    expect(onChange).toHaveBeenCalledWith('quoteColor', undefined);
  });

  it('is an Advanced field', () => {
    mount({}, false);
    expect(screen.queryByRole('combobox', { name: 'Quote Color' })).not.toBeInTheDocument();
  });
});
