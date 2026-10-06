import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMemo, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';
import type { PlaceholderTreeNode } from '@/lib/placeholderScopes';
import PlaceholderList from './PlaceholderList';
import type { SortableTreeAdapter } from './SortableTree';

/** Which rows the tree builds again after an edit, read through the spec calls the scaffold makes. */

const built: string[] = [];

vi.mock('./SortableTree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./SortableTree')>();
  return {
    ...actual,
    SortableTree: (props: Parameters<typeof actual.SortableTree<PlaceholderTreeNode>>[0]) => {
      const tapped: SortableTreeAdapter<PlaceholderTreeNode> = {
        ...props.adapter,
        rowSpec: (node, select) => {
          built.push(node.id);
          return props.adapter.rowSpec(node, select);
        },
      };
      return <actual.SortableTree {...props} adapter={tapped} />;
    },
  };
});

const P = (id: string, name: string): Placeholder => ({ id, name, values: phValues(['a']) });
const START = ['hair', 'town', 'weather', 'mood'].map((id) => P(id, id));

let rename: (id: string, name: string) => void = () => {};

function Harness() {
  const [placeholders, setPlaceholders] = useState(START);
  rename = (id, name) => setPlaceholders((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  const store = useMemo(
    () => ({ ...placeholderStore(placeholders, setPlaceholders), placedIds: () => new Set<string>() }),
    [placeholders],
  );
  return (
    <PlaceholderStoreProvider value={store}>
      <PlaceholderList selectedId={null} onSelect={() => {}} />
    </PlaceholderStoreProvider>
  );
}

beforeEach(() => { built.length = 0; });

describe('editing one placeholder in the placeholder tree', () => {
  it('builds that row again and no other', () => {
    render(<Harness />);
    expect(built.length).toBeGreaterThanOrEqual(START.length);
    built.length = 0;

    act(() => rename('weather', 'Weather'));

    expect(screen.getByText('Weather')).toBeInTheDocument();
    expect(built).toEqual(['weather']);
  });
});
