import { useMemo, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder } from '@/types';
import PlaceholderSectionList from './PlaceholderSectionList';

import { phValues } from '@/test/placeholderValues';

/**
 * The one list every placeholder dropdown draws: the vocabulary's own sections, a folder headed as text and
 * an owner headed by its name and its icon, with the rows under an owner reading bare. The list lives inside
 * whatever opened it rather than in a portal of its own — a dialog's scroll lock cancels the wheel on
 * anything outside its subtree, and a list that cannot be scrolled is a list an author cannot reach.
 */

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge']) };
const weather: Placeholder = { id: 'weather', name: 'Weather', values: phValues(['fog']) };
const mood: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['sour']) };

/** A world whose entity carries Mood, with Weather filed in a folder and Town loose. */
const worldLists = (ownerName: string, kind: 'entities' | 'dictionaries' = 'entities') => ({
  placeholders: [town, { ...weather, groupId: 'looks' }],
  placeholderGroups: [{ id: 'looks', name: 'Looks', parentId: null }],
  entities: [],
  dictionaries: [],
  [kind]: [{ id: 'keeper', name: ownerName, placeholders: [mood] }],
});

const onSelect = vi.fn();

/** The picker as a pin row mounts it: inside a modal dialog, over the world's own rows. */
function Harness({ ownerName = 'Keeper', kind = 'entities' as 'entities' | 'dictionaries' }) {
  const [selectedId, setSelectedId] = useState('');
  const lists = useMemo(() => worldLists(ownerName, kind), [ownerName, kind]);
  const all = useMemo(() => allPlaceholders(lists), [lists]);
  const owners = useMemo(() => placeholderOwners(lists), [lists]);
  const rows = useMemo(
    () => placeholderVocabulary(all, { owners, groups: lists.placeholderGroups }).palette(),
    [all, owners, lists],
  );
  return (
    <PlaceholderStoreProvider value={{ ...placeholderStore(all, () => {}), lists, owners }}>
      <Dialog open>
        <DialogContent data-testid="host-dialog">
          <DialogTitle>Pins</DialogTitle>
          <PlaceholderSectionList
            rows={rows}
            selectedId={selectedId}
            onSelect={(id) => { onSelect(id); setSelectedId(id); }}
            placeholders={all}
          />
        </DialogContent>
      </Dialog>
    </PlaceholderStoreProvider>
  );
}

const rowNames = () => screen.getAllByTestId('placeholder-section-row').map((r) => r.textContent ?? '');
const openList = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /Select placeholder|›/ }));

describe('PlaceholderSectionList', () => {
  it('heads a folder with plain text and an owner with its name and icon, and reads owned rows bare', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openList(user);
    expect(rowNames()).toEqual(['Town', 'Weather', 'Mood']);
    // The name is what a reader hears, the shape what an author sees. Both, or a swapped icon passes.
    const icon = screen.getByRole('img', { name: 'Entity' });
    expect(icon).toHaveClass('lucide-user');
    expect(icon.parentElement).toHaveTextContent('Keeper');
    // A folder is told from an owner by the icon alone, so it must carry none.
    const folder = screen.getByText('Looks');
    expect(folder.tagName).toBe('SPAN');
    expect(within(folder).queryByRole('img')).toBeNull();
  });

  it('carries the book icon for a dictionary owner', async () => {
    const user = userEvent.setup();
    render(<Harness kind="dictionaries" ownerName="Fen" />);
    await openList(user);
    expect(screen.getByRole('img', { name: 'Dictionary' })).toHaveClass('lucide-book-open');
  });

  it('wears no chip surface on the heading, and draws an owner named with a placeholder as a neutral pill', async () => {
    const user = userEvent.setup();
    render(<Harness ownerName={`Ma ${chip('town')}`} />);
    await openList(user);
    const head = screen.getByRole('img', { name: 'Entity' }).parentElement!;
    expect(head).toHaveClass('text-meta', 'text-muted-foreground');
    expect([...head.classList].filter((c) => c.startsWith('bg-') || c === 'border')).toEqual([]);
    const pill = head.querySelector<HTMLElement>('[data-chip-token]')!;
    expect(pill).toHaveTextContent('Town');
    // In its own accent the pill would read as a placeholder on offer, which a heading is not.
    expect(pill.style.backgroundColor).toBe('');
  });

  it('fires onSelect with the placeholder id, and the closed trigger reads the whole path with the icon', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openList(user);
    await user.click(screen.getByRole('button', { name: 'Mood' }));
    expect(onSelect).toHaveBeenCalledWith('mood');
    const trigger = screen.getByRole('button', { name: /Keeper/ });
    expect(trigger).toHaveTextContent('Keeper › Mood');
    expect(within(trigger).getByRole('img', { name: 'Entity' })).toBeInTheDocument();
  });

  it('mounts its rows inside the dialog, where the wheel still reaches them', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openList(user);
    // Portaled, the list would hang off the body beside the dialog, and the dialog's scroll lock would
    // cancel every wheel event that reached it.
    const row = screen.getAllByTestId('placeholder-section-row')[0];
    expect(screen.getByTestId('host-dialog')).toContainElement(row);
  });
});
