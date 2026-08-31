import { useState } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChipInput from './ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder } from '@/types';

import { phValues } from '@/test/placeholderValues';
/**
 * The `{` menu as an author drives it: filter, walk into a placeholder's parts, back out, insert the path
 * that walk took, and make a placeholder that does not exist yet. Lexical needs a real caret, and jsdom
 * gives it one only inside written text — so every case starts from a value and types the trigger in front
 * of it, the same run a half-typed insert anywhere in a field takes.
 */

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });

const WORLD: Placeholder[] = [
  { id: 'molly', name: 'Molly', values: phValues([chip('white'), chip('asian')]) },
  { id: 'white', name: 'isWhite', roll: false, values: phValues([chip('hair'), chip('eyes')]) },
  { id: 'asian', name: 'isAsian', roll: false, values: phValues([chip('hair')]) },
  { id: 'hair', name: 'Hair', values: phValues(['brown', 'black']) },
  { id: 'eyes', name: 'Eyes', values: phValues(['green', 'hazel']) },
];

let world: Placeholder[];

/** The field under its own store, so an inline create lands somewhere a test can read back. */
function Harness() {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>(world);
  const [value, setValue] = useState('.');
  return (
    <PlaceholderStoreProvider value={placeholderStore(placeholders, setPlaceholders)}>
      <Field value={value} onChange={setValue} placeholders={placeholders} />
      <div data-testid="value">{value}</div>
      <div data-testid="names">{placeholders.map((p) => p.name).join(',')}</div>
      <div data-testid="ids">{JSON.stringify(Object.fromEntries(placeholders.map((p) => [p.id, p.name])))}</div>
    </PlaceholderStoreProvider>
  );
}

function Field({ value, onChange, placeholders }: {
  value: string;
  onChange: (v: string) => void;
  placeholders: Placeholder[];
}) {
  return (
    <ChipInput value={value} onChange={onChange} vocabulary={usePlaceholderChipVocabulary(placeholders)} ariaLabel="Name" />
  );
}

/** A field with no store bound — displayed placeholders, nothing to write a new one to. */
function ReadOnlyStoreHarness() {
  const [value, setValue] = useState('.');
  return <Field value={value} onChange={setValue} placeholders={world} />;
}

const value = () => screen.getByTestId('value').textContent ?? '';
const names = () => (screen.getByTestId('names').textContent ?? '').split(',');
const menu = () => screen.queryByTestId('chip-typeahead');

/** Type the trigger and a query at the head of the value, leaving the caret inside the run. */
async function open(query = '') {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Name'));
  await user.keyboard(`{{${query}`);
  await screen.findByTestId('chip-typeahead');
  return user;
}

/** The chip labels the menu currently lists, in order. */
const offered = (): string[] =>
  [...screen.queryAllByTestId('chip-typeahead-row')].map((b) => b.textContent?.trim() ?? '');

/** The token in the field, and whatever text is left around it. */
function inserted(): { token: string | null; around: string } {
  const raw = value();
  const token = raw.match(/\{\{ph:[^{}]*\}\}/)?.[0] ?? null;
  return { token, around: token ? raw.replace(token, '') : raw };
}

/** The path of the one chip token in the field, read as names through the store's current list. */
function insertedPath(): string[] {
  const { token } = inserted();
  const d = token ? decodePlaceholderToken(token) : null;
  if (!d) return [];
  const byId: Record<string, string> = JSON.parse(screen.getByTestId('ids').textContent || '{}');
  return [byId[d.id] ?? d.id, ...(d.path ?? []).map((s) => (s.kind === 'slot' ? s.name : byId[s.ref] ?? s.ref))];
}

beforeEach(() => { world = WORLD.map((p) => ({ ...p })); });

describe('ChipTypeahead — drilling into a placeholder’s parts', () => {
  it('offers the world’s placeholders, filtered by what is typed', async () => {
    render(<Harness />);
    await open('is');
    expect(offered()).toEqual(['isWhite', 'isAsian']);
  });

  it('marks only the rows that have parts to walk into', async () => {
    render(<Harness />);
    await open();
    expect(screen.getByLabelText('Show Molly Parts')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show Hair Parts')).not.toBeInTheDocument();
  });

  it('walks into the highlighted row on ArrowRight and lists its parts', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(offered()).toEqual(['isWhite', 'isAsian']));
  });

  it('drops the filter on the way in, so each level is searchable on its own terms', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(offered()).toEqual(['isWhite', 'isAsian']));
    // "Molly" would match nothing under Molly; the level starts clean and the field holds only the trigger.
    expect(value()).toBe('{.');
  });

  it('filters the level it is on, not the root', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(offered()).toHaveLength(2));
    await user.keyboard('isW');
    await waitFor(() => expect(offered()).toEqual(['isWhite']));
  });

  it('goes as deep as the author walks', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(offered()).toEqual(['isWhite', 'isAsian']));
    await user.keyboard('{ArrowRight}'); // into isWhite
    await waitFor(() => expect(offered()).toEqual(['Hair', 'Eyes']));
  });

  it('backs out to the level above on ArrowLeft', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await waitFor(() => expect(offered()).toEqual(['Hair', 'Eyes']));
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(offered()).toEqual(['isWhite', 'isAsian']));
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(offered()).toEqual(['Molly', 'isWhite', 'isAsian', 'Hair', 'Eyes']));
  });

  it('leaves ArrowLeft to the caret at the root, where there is no level to leave', async () => {
    render(<Harness />);
    const user = await open('Mol');
    await user.keyboard('{ArrowLeft}');
    // The menu stays put and the query is untouched — only the caret moved.
    await waitFor(() => expect(offered()).toEqual(['Molly']));
    expect(value()).toBe('{Mol.');
  });

  it('leaves a modified arrow to the caret, so selecting across the query is still possible', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    // Shift-Right extends a selection; hijacking it would walk into Molly instead.
    await waitFor(() => expect(offered()).toEqual(['Molly']));
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(offered()).toEqual(['isWhite', 'isAsian']));
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(offered()).toEqual(['isWhite', 'isAsian']);
  });

  it('inserts the walked path, not just the placeholder it started from', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(offered()).toEqual(['isWhite', 'isAsian']));
    await user.keyboard('{ArrowRight}'); // into isWhite
    await waitFor(() => expect(offered()).toEqual(['Hair', 'Eyes']));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(insertedPath()).toEqual(['Molly', 'isWhite', 'Hair']));
  });

  it('leaves nothing of the typed run behind when it inserts at depth', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(offered()).toHaveLength(2));
    await user.keyboard('isW{Enter}');
    await waitFor(() => expect(insertedPath()).toEqual(['Molly', 'isWhite']));
    // The trigger and both levels' worth of typing go with the chip; only the value it was typed into stays.
    expect(inserted().around).toBe('.');
  });

  it('walks in by pointer too, so the keyboard path is not the only one', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByLabelText('Show Molly Parts') });
    await waitFor(() => expect(offered()).toEqual(['isWhite', 'isAsian']));
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByLabelText('Back to All Placeholders') });
    await waitFor(() => expect(offered()).toContain('Hair'));
  });

  it('names the level it is in, so a deep list says where it came from', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await waitFor(() => expect(screen.getByLabelText('Back to Molly')).toBeInTheDocument());
    expect(screen.getByLabelText('Back to Molly').textContent).toContain('Molly › isWhite');
  });

  it('forgets the level once a chip lands, so the next trigger opens at the root', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(offered()).toHaveLength(2));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(insertedPath()).toEqual(['Molly', 'isWhite']));
    await user.keyboard('{{');
    await waitFor(() => expect(offered()).toEqual(['Molly', 'isWhite', 'isAsian', 'Hair', 'Eyes']));
  });
});

describe('ChipTypeahead — making a placeholder that is not there yet', () => {
  it('offers to make what the filter names when nothing matches it', async () => {
    render(<Harness />);
    await open('Freckles');
    expect(screen.getByText('New Placeholder "Freckles"')).toBeInTheDocument();
  });

  it('adds a born-Wildcard placeholder to the list and inserts its chip', async () => {
    render(<Harness />);
    const user = await open('Freckles');
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(insertedPath()).toEqual(['Freckles']));
    expect(names()).toContain('Freckles');
    expect(inserted().around).toBe('.');
  });

  it('makes it by pointer as well', async () => {
    render(<Harness />);
    const user = await open('Freckles');
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByText('New Placeholder "Freckles"') });
    await waitFor(() => expect(names()).toContain('Freckles'));
  });

  it('leaves Enter to the field while only the create row is on offer', async () => {
    render(<Harness />);
    const user = await open('Freckles');
    await user.keyboard('{Enter}');
    // Nothing was preselected, so a `{` typed in prose cannot author a placeholder by accident.
    await waitFor(() => expect(names()).not.toContain('Freckles'));
    expect(insertedPath()).toEqual([]);
  });

  it('offers to make one alongside the matches, not only when there are none', async () => {
    render(<Harness />);
    await open('Hair');
    expect(offered()).toEqual(['Hair']);
    expect(screen.getByText('New Placeholder "Hair"')).toBeInTheDocument();
  });

  it('offers nothing to make before anything is typed', async () => {
    render(<Harness />);
    await open();
    expect(screen.queryByText(/New Placeholder/)).not.toBeInTheDocument();
  });

  it('offers nothing to make where no store is bound to hold it', async () => {
    render(<ReadOnlyStoreHarness />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Name'));
    await user.keyboard('{{Freckles');
    // No matches and nothing to make: the trigger reads as the literal character it is.
    await waitFor(() => expect(menu()).not.toBeInTheDocument());
  });

  it('offers nothing to make inside a level, where a new placeholder would be no part of it', async () => {
    render(<Harness />);
    const user = await open('Molly');
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(offered()).toHaveLength(2));
    await user.keyboard('Freckles');
    await waitFor(() => expect(offered()).toEqual([]));
    expect(screen.queryByText(/New Placeholder/)).not.toBeInTheDocument();
    expect(screen.getByText('No parts match.')).toBeInTheDocument();
  });
});
