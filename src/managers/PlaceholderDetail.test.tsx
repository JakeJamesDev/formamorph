import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { ownerNodeId } from '@/lib/placeholderScopes';
import type { Placeholder } from '@/types';
import { usePlaceholderDetail } from './PlaceholderDetail';

// The chip editors need a browser caret; a plain box stands in for typing.
vi.mock('@/components/prompt/PlaceholderField', () => {
  const Box = ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) =>
    <input aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />;
  return { default: Box, PlaceholderNameField: Box };
});

const GARB: Placeholder = { id: 'garb', name: 'Class Garb', groupId: 'bp', values: [{ id: 'v-tabard', text: 'a tabard' }] };
const COPY: Placeholder = { id: 'c-garb', name: 'Class Garb', values: [], blueprintId: 'garb' };

/** The router over a store bound to one list, the way a library item binds it: no world lists, no owners. */
function Scoped({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const { detail, footer } = usePlaceholderDetail({ selectedId, onSelect, ownerName: 'Albus' });
  return <div data-testid="pane">{detail}{footer}</div>;
}

function renderInStore(selectedId: string) {
  const onSelect = vi.fn();
  const Harness = () => {
    const [placeholders, setPlaceholders] = useState<Placeholder[]>([GARB, COPY]);
    return (
      <PlaceholderStoreProvider value={placeholderStore(placeholders, setPlaceholders)}>
        <Scoped selectedId={selectedId} onSelect={onSelect} />
      </PlaceholderStoreProvider>
    );
  };
  render(<Harness />);
  return { onSelect };
}

describe('usePlaceholderDetail over a scoped store', () => {
  it('opens a copy in the copy editor, named by the given owner, with its footer', () => {
    const { onSelect } = renderInStore(COPY.id);
    expect(screen.getByLabelText('Name')).toHaveValue('Albus.Class Garb');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Blueprint' }));
    expect(onSelect).toHaveBeenCalledWith(GARB.id);
  });

  it('opens any other placeholder in the manager, with no copy footer', () => {
    renderInStore(GARB.id);
    expect(screen.getByLabelText('Placeholder kind')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Blueprint' })).toBeNull();
  });

  it('resolves no group or owner node without world lists', () => {
    renderInStore('bp');
    expect(screen.getByTestId('pane')).toBeEmptyDOMElement();
    renderInStore(ownerNodeId('albus'));
    expect(screen.getAllByTestId('pane')[1]).toBeEmptyDOMElement();
  });
});
