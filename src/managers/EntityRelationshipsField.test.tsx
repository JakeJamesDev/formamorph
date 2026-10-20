import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityRelationshipsField from './EntityRelationshipsField';
import { YOU_TARGET, withRelationships } from '@/lib/entityRelationships';
import type { Entity } from '@/types';

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
      onChange={(relationships) => setEntity((prev) => withRelationships(prev, relationships))}
    />
  );
};

const openAdd = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: 'Add a Relationship' }));
  return (await screen.findAllByRole('option')).map((o) => o.textContent);
};

const row = (name: string) => screen.getByText(name, { selector: 'span' }).parentElement!;

describe('the Relationships list', () => {
  it('adds a row for a picked target, takes its label, and removes it', async () => {
    render(<Harness start={{ id: 'tera', name: 'Tera' }} />);
    expect(await openAdd()).toEqual(['You', 'Kate', 'Ash', 'Rowan']);
    await userEvent.click(screen.getByRole('option', { name: 'Kate' }));
    const role = within(row('Kate')).getByRole('textbox', { name: 'Kate’s Role' });
    expect(role).toHaveFocus();
    fireEvent.change(role, { target: { value: 'mother' } });
    expect(current.relationships).toEqual([{ targetId: 'kate', label: 'mother' }]);

    fireEvent.click(within(row('Kate')).getByRole('button', { name: 'Remove this relationship' }));
    expect(screen.queryByText('Kate', { selector: 'span' })).toBeNull();
    // An emptied list is stored as no field.
    expect(current).toEqual({ id: 'tera', name: 'Tera' });
  });

  it('offers neither the owner nor a target it already uses', async () => {
    render(<Harness start={{ id: 'tera', name: 'Tera', relationships: [{ targetId: 'ash', label: 'butler' }] }} />);
    expect(within(row('Ash')).getByRole('textbox')).toHaveValue('butler');
    expect(await openAdd()).toEqual(['You', 'Kate', 'Rowan']);
  });

  it('edits one row without touching the others, in author order', () => {
    render(<Harness start={{
      id: 'tera', name: 'Tera',
      relationships: [{ targetId: 'rowan', label: 'friend' }, { targetId: 'kate', label: 'mother' }],
    }} />);
    fireEvent.change(within(row('Kate')).getByRole('textbox'), { target: { value: 'mother and employer' } });
    expect(current.relationships).toEqual([{ targetId: 'rowan', label: 'friend' }, { targetId: 'kate', label: 'mother and employer' }]);
  });

  it('keeps a row whose target the world lacks, without showing it', () => {
    render(<Harness start={{ id: 'tera', name: 'Tera', relationships: [{ targetId: 'gone', label: 'twin' }, { targetId: 'kate', label: 'mother' }] }} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    fireEvent.change(within(row('Kate')).getByRole('textbox'), { target: { value: 'aunt' } });
    expect(current.relationships).toEqual([{ targetId: 'gone', label: 'twin' }, { targetId: 'kate', label: 'aunt' }]);
  });

  it('disables the select when every entity is used', () => {
    render(<Harness start={{
      id: 'tera', name: 'Tera',
      relationships: [YOU_TARGET, 'kate', 'ash', 'rowan'].map((targetId) => ({ targetId, label: 'friend' })),
    }} />);
    expect(screen.getByRole('combobox', { name: 'Add a Relationship' })).toBeDisabled();
  });

  it('adds You as a row of its own, and offers it no more once used', async () => {
    render(<Harness start={{ id: 'tera', name: 'Tera' }} />);
    await openAdd();
    await userEvent.click(screen.getByRole('option', { name: 'You' }));
    const role = within(row('You')).getByRole('textbox', { name: 'Your Role' });
    fireEvent.change(role, { target: { value: 'ward' } });
    expect(current.relationships).toEqual([{ targetId: YOU_TARGET, label: 'ward' }]);
    expect(await openAdd()).toEqual(['Kate', 'Ash', 'Rowan']);
  });
});
