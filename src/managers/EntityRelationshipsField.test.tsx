import { useMemo, useState } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { $createParagraphNode, $createTextNode, $getRoot, getNearestEditorFromDOMNode } from 'lexical';
import userEvent from '@testing-library/user-event';
import EntityRelationshipsField from './EntityRelationshipsField';
import { CHIP_PALETTE_ATTR, ChipInsertTargetProvider, useChipInsertTarget } from '@/components/prompt/ChipInsertTarget';
import { CHIP_DRAG_MIME } from '@/components/prompt/chipDragSource';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { YOU_TARGET, withRelationships } from '@/lib/entityRelationships';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Entity, Placeholder } from '@/types';

const kate: Entity = { id: 'kate', name: 'Kate' };
const ash: Entity = { id: 'ash', name: 'Ash' };
const rowan: Entity = { id: 'rowan', name: 'Rowan' };

let current: Entity;

/** Holds the entity as the panel's draft does, so each change renders back. */
const Harness = ({ start }: { start: Entity }) => {
  const [entity, setEntity] = useState(start);
  current = entity;
  return (
    <EntityRelationshipsField
      entity={entity}
      entities={[kate, entity, ash, rowan]}
      labelOf={(e) => e.name}
      placeholders={[]}
      onChange={(relationships) => setEntity((prev) => withRelationships(prev, relationships))}
    />
  );
};

const openAdd = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Add a Relationship' }));
  return (await screen.findAllByRole('option')).map((o) => o.textContent);
};

const row = (name: string) => screen.getByText(name, { selector: 'span' }).parentElement!;

/** Writes a label through its chip editor's composer, as an author's typing lands. */
const write = async (label: HTMLElement, text: string) => {
  const editor = getNearestEditorFromDOMNode(label);
  await act(async () => {
    editor?.update(() => { $getRoot().clear().append($createParagraphNode().append($createTextNode(text))); }, { discrete: true });
  });
};

describe('the Relationships list', () => {
  it('adds a row for a picked target, takes its label, and removes it', async () => {
    render(<Harness start={{ id: 'tera', name: 'Tera' }} />);
    expect(await openAdd()).toEqual(['Persona', 'Kate', 'Ash', 'Rowan']);
    await userEvent.click(screen.getByRole('option', { name: 'Kate' }));
    const role = within(row('Kate')).getByRole('textbox', { name: 'Kate’s Role' });
    expect(role).toHaveFocus();
    await write(role, 'mother');
    expect(current.relationships).toEqual([{ targetId: 'kate', label: 'mother' }]);

    fireEvent.click(within(row('Kate')).getByRole('button', { name: 'Remove this relationship' }));
    expect(screen.queryByText('Kate', { selector: 'span' })).toBeNull();
    // An emptied list is stored as no field.
    expect(current).toEqual({ id: 'tera', name: 'Tera' });
  });

  it('offers neither the owner nor a target it already uses', async () => {
    render(<Harness start={{ id: 'tera', name: 'Tera', relationships: [{ targetId: 'ash', label: 'butler' }] }} />);
    expect(within(row('Ash')).getByRole('textbox')).toHaveTextContent('butler');
    expect(await openAdd()).toEqual(['Persona', 'Kate', 'Rowan']);
  });

  it('edits one row without touching the others, in author order', async () => {
    render(<Harness start={{
      id: 'tera', name: 'Tera',
      relationships: [{ targetId: 'rowan', label: 'friend' }, { targetId: 'kate', label: 'mother' }],
    }} />);
    await write(within(row('Kate')).getByRole('textbox'), 'mother and employer');
    expect(current.relationships).toEqual([{ targetId: 'rowan', label: 'friend' }, { targetId: 'kate', label: 'mother and employer' }]);
  });

  it('shows a row whose target the world lacks as an unknown entity, so it can be removed', () => {
    render(<Harness start={{ id: 'tera', name: 'Tera', relationships: [{ targetId: 'gone', label: 'twin' }, { targetId: 'kate', label: 'mother' }] }} />);
    expect(within(row('Unknown Entity')).getByRole('textbox', { name: 'Unknown Entity’s Role' })).toHaveTextContent('twin');
    fireEvent.click(within(row('Unknown Entity')).getByRole('button', { name: 'Remove this relationship' }));
    expect(current.relationships).toEqual([{ targetId: 'kate', label: 'mother' }]);
  });

  it.each([
    ['the Custom Persona entity', { customPersona: true }],
    ['a persona-only Persona', { persona: true, personaOnly: true }],
  ])('offers no Persona row to %s, and still shows a stored one to remove', async (_, marks) => {
    const { unmount } = render(<Harness start={{ id: 'tera', name: 'Tera', ...marks }} />);
    expect(await openAdd()).toEqual(['Kate', 'Ash', 'Rowan']);
    unmount();
    render(<Harness start={{ id: 'tera', name: 'Tera', ...marks, relationships: [{ targetId: YOU_TARGET, label: 'ward' }] }} />);
    expect(within(row('Persona')).getByRole('textbox', { name: 'Persona’s Role' })).toHaveTextContent('ward');
    fireEvent.click(within(row('Persona')).getByRole('button', { name: 'Remove this relationship' }));
    expect(current.relationships).toBeUndefined();
  });

  it('offers the Persona row to a Persona that plays in the cast too', async () => {
    render(<Harness start={{ id: 'tera', name: 'Tera', persona: true }} />);
    expect(await openAdd()).toEqual(['Persona', 'Kate', 'Ash', 'Rowan']);
  });

  it('disables the select when every entity is used', () => {
    render(<Harness start={{
      id: 'tera', name: 'Tera',
      relationships: [YOU_TARGET, 'kate', 'ash', 'rowan'].map((targetId) => ({ targetId, label: 'friend' })),
    }} />);
    expect(screen.getByRole('combobox', { name: 'Add a Relationship' })).toBeDisabled();
  });

  it('adds the Persona row, and offers it no more once used', async () => {
    render(<Harness start={{ id: 'tera', name: 'Tera' }} />);
    await openAdd();
    await userEvent.click(screen.getByRole('option', { name: 'Persona' }));
    const role = within(row('Persona')).getByRole('textbox', { name: 'Persona’s Role' });
    await write(role, 'ward');
    expect(current.relationships).toEqual([{ targetId: YOU_TARGET, label: 'ward' }]);
    expect(await openAdd()).toEqual(['Kate', 'Ash', 'Rowan']);
  });
});

describe('Relationship label chips', () => {
  const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge', 'Fen']) };
  const rank: Placeholder = { id: 'rank', name: 'Rank', values: phValues(['elder', 'heir']) };
  const grudge: Placeholder = { id: 'grudge', name: 'Grudge', values: phValues(['old', 'new']) };
  const grudgingKate: Entity = { ...kate, placeholders: [grudge] };
  const PALETTE_TOWN =encodePlaceholderToken({ id: 'town', mode: 'world', placementId: 'palette' });

  /** A palette strip with one chip, sending as the editor's shared palette does. */
  const Palette = () => {
    const { insert } = useChipInsertTarget();
    return (
      <div {...{ [CHIP_PALETTE_ATTR]: '' }}>
        <button type="button" onClick={() => insert?.(PALETTE_TOWN)}>Town</button>
      </div>
    );
  };

  /** Tera owns Rank and Kate owns Grudge, over the world's Town, with the store the editor provides. */
  const ChipHarness = () => {
    const [entity, setEntity] = useState<Entity>({
      id: 'tera', name: 'Tera', placeholders: [rank], relationships: [{ targetId: 'kate', label: 'aunt' }],
    });
    current = entity;
    const lists = useMemo(() => ({ placeholders: [town], placeholderGroups: [], dictionaries: [], entities: [entity, grudgingKate] }), [entity]);
    const all = useMemo(() => allPlaceholders(lists), [lists]);
    const store = useMemo(() => ({ ...placeholderStore(all, () => {}), lists, owners: placeholderOwners(lists) }), [all, lists]);
    return (
      <PlaceholderStoreProvider value={store}>
        <ChipInsertTargetProvider>
          <EntityRelationshipsField
            entity={entity}
            entities={[grudgingKate, entity]}
            labelOf={(e) => e.name}
            placeholders={all}
            onChange={(relationships) => setEntity((prev) => withRelationships(prev, relationships))}
          />
          <Palette />
        </ChipInsertTargetProvider>
      </PlaceholderStoreProvider>
    );
  };

  const label = () => screen.getByRole('textbox', { name: 'Kate’s Role' });
  const chipIn = (text: string | undefined) => decodePlaceholderToken(text?.match(/\{\{ph:[^{}]*\}\}/)?.[0] ?? '');
  const kateLabel = () => current.relationships?.find((r) => r.targetId === 'kate')?.label;
  const offered = () => screen.queryAllByTestId('chip-typeahead-row').map((b) => b.textContent?.trim() ?? '');

  afterEach(() => { Reflect.deleteProperty(document, 'caretRangeFromPoint'); });

  it('offers the owning entity’s own placeholders in the { menu and inserts one', async () => {
    render(<ChipHarness />);
    const user = userEvent.setup();
    await user.click(label());
    await user.keyboard('{{');
    await screen.findByTestId('chip-typeahead');
    // The owner's own section leads, ahead of the world's and other owners'.
    expect(offered()).toEqual(['Rank', 'Town', 'Grudge']);
    await user.keyboard('Rank{Enter}');
    await waitFor(() => expect(chipIn(kateLabel())?.id).toBe('rank'));
  });

  it('inserts a palette chip into the label that has focus', async () => {
    render(<ChipHarness />);
    await userEvent.click(label());
    await userEvent.click(screen.getByRole('button', { name: 'Town' }));
    await waitFor(() => expect(chipIn(kateLabel())?.id).toBe('town'));
  });

  it('takes a chip dragged from the palette', async () => {
    render(<ChipHarness />);
    const editor = label();
    const text = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT).nextNode() as Text;
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => {
        const range = document.createRange();
        range.setStart(text, text.length);
        range.collapse(true);
        return range;
      },
    });
    const data = new Map([[CHIP_DRAG_MIME, PALETTE_TOWN]]);
    const dataTransfer = {
      types: [...data.keys()], effectAllowed: 'copy', dropEffect: 'none',
      getData: (type: string) => data.get(type) ?? '', setData: vi.fn(), setDragImage: vi.fn(),
    };
    await act(async () => {
      fireEvent.dragOver(editor, { clientX: 1, clientY: 1, dataTransfer });
      fireEvent.drop(editor, { clientX: 1, clientY: 1, dataTransfer });
    });
    await waitFor(() => expect(kateLabel()).toMatch(/^aunt\{\{ph:town:world:/));
  });
});
