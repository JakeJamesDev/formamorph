import { useState, type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityOpenings } from './OpeningsPanel';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { placeholderOwners } from '@/lib/placeholderHomes';
import { CodeRenameContext } from '@/lib/useCodeRename';
import type { Entity, Opening } from '@/types';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const rows: Opening[] = [
  { id: 'o1', name: 'ambush', text: 'A.', kind: 'narration' },
  { id: 'o2', text: 'B.', kind: 'narration' },
];
const aki = { id: 'e', name: 'Aki', openings: rows } as Entity;
const lists = { placeholders: [], placeholderGroups: [], dictionaries: [], entities: [aki] };
const store = { ...placeholderStore([], () => {}), lists, owners: placeholderOwners(lists) };

const tree = (entity: Entity, onChange: (patch: Partial<Entity>) => void): ReactNode => (
  <PlaceholderStoreProvider value={store}>
    <EditorPreviewRollsProvider><EntityOpenings entity={entity} onChange={onChange} placeholders={[]} /></EditorPreviewRollsProvider>
  </PlaceholderStoreProvider>
);
const nameBox = (n: number) => screen.getByRole('textbox', { name: `Name, Opening ${n}` });

/** The editor's side of the contract: the parent applies each patch. */
function Applying({ onPatch }: { onPatch?: (patch: Partial<Entity>) => void }) {
  const [entity, setEntity] = useState(aki);
  return (
    <PlaceholderStoreProvider value={store}>
      <EditorPreviewRollsProvider>
        <EntityOpenings
          entity={entity}
          onChange={(patch) => { onPatch?.(patch); setEntity((e) => ({ ...e, ...patch })); }}
          placeholders={[]}
        />
        <button type="button" onClick={() => setEntity((e) => ({ ...e, openings: [rows[0], { ...rows[1], name: 'older' }] }))}>
          Revert name
        </button>
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>
  );
}

describe('opening names in the panel', () => {
  it('heads each card with its name, or "Owner · Opening N" while blank, following the row order', () => {
    const { rerender } = render(tree(aki, () => {}));
    expect(screen.getByRole('button', { name: 'Collapse Opening 1' })).toHaveTextContent('ambush');
    expect(screen.getByRole('button', { name: 'Collapse Opening 2' })).toHaveTextContent('Aki · Opening 2');
    rerender(tree({ ...aki, openings: [rows[1], rows[0]] }, () => {}));
    expect(screen.getByRole('button', { name: 'Collapse Opening 1' })).toHaveTextContent('Aki · Opening 1');
  });

  it('writes a free name, with the derived label as the blank field’s placeholder', async () => {
    const onChange = vi.fn();
    render(tree(aki, onChange));
    expect(nameBox(2)).toHaveAttribute('placeholder', 'Aki · Opening 2');
    await userEvent.setup().type(nameBox(2), 'q');
    expect(onChange).toHaveBeenLastCalledWith({ openings: [rows[0], { ...rows[1], name: 'q' }] });
  });

  it('follows the saved name when it changes under a focused box, as an undo does', async () => {
    const user = userEvent.setup();
    render(<Applying />);
    await user.type(nameBox(2), 'q');
    expect(nameBox(2)).toHaveValue('q');
    // fireEvent leaves the box focused, as Ctrl+Z does; a user click would blur it first.
    fireEvent.click(screen.getByRole('button', { name: 'Revert name' }));
    expect(nameBox(2)).toHaveValue('older');
  });

  it('asks the code rename offer once, with the owner, when a committed name changes', async () => {
    const offer = vi.fn();
    const user = userEvent.setup();
    render(<CodeRenameContext.Provider value={offer}><Applying /></CodeRenameContext.Provider>);
    await user.clear(nameBox(1));
    await user.type(nameBox(1), 'raid');
    expect(offer).not.toHaveBeenCalled();
    await user.tab();
    expect(offer).toHaveBeenCalledTimes(1);
    expect(offer).toHaveBeenCalledWith(expect.objectContaining({
      root: 'openings', oldName: 'ambush', newName: 'raid', otherNames: [''], openingOwner: { kind: 'entity', id: 'e' },
    }));
  });

  it('asks nothing when the name is left as it was', async () => {
    const offer = vi.fn();
    const user = userEvent.setup();
    render(<CodeRenameContext.Provider value={offer}><Applying /></CodeRenameContext.Provider>);
    await user.click(nameBox(1));
    await user.tab();
    expect(offer).not.toHaveBeenCalled();
  });

  it('shows an error and writes nothing for a name a sibling has, then restores the saved name on leaving', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Applying onPatch={onChange} />);
    await user.click(nameBox(2));
    await user.paste('ambush');
    expect(screen.getByRole('alert')).toHaveTextContent('Another opening here has this name. Type a different one.');
    const wrote = onChange.mock.calls.some(([patch]) => patch.openings?.[1]?.name === 'ambush');
    expect(wrote).toBe(false);
    await user.tab();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(nameBox(2)).toHaveValue('');
  });
});
