import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { openDatabase, promisifyRequest } from '@/lib/idb';
import { FindBarReference } from './FindBarReference';

const renderReference = () => render(
  <TooltipProvider>
    <FindBarReference />
  </TooltipProvider>,
);

const STORED_WORLD = { id: 'protected-world', name: 'Protected World', data: { marker: 'unchanged' } };

const replaceWorldStore = async (records: object[]) => {
  const db = await openDatabase('worldsDB', 1, [{ name: 'worlds', keyPath: 'id' }]);
  const store = db.transaction(['worlds'], 'readwrite').objectStore('worlds');
  await promisifyRequest(store.clear());
  await Promise.all(records.map((record) => promisifyRequest(store.put(record))));
  db.close();
};

const readWorldStore = async (): Promise<object[]> => {
  const db = await openDatabase('worldsDB', 1, [{ name: 'worlds', keyPath: 'id' }]);
  const records = await promisifyRequest<object[]>(db.transaction(['worlds'], 'readonly').objectStore('worlds').getAll());
  db.close();
  return records;
};

it('navigates the production Find bar through local World Editor fields', async () => {
  const user = userEvent.setup();
  renderReference();

  const find = screen.getByRole('textbox', { name: 'Find' });
  expect(find).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Previous match' })).toBeDisabled();

  await user.type(find, 'harbor');

  await waitFor(() => expect(screen.getByText('1 / 5')).toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: 'World Introduction' })).toHaveAttribute('data-find-current', 'true');

  await user.keyboard('{Enter}');
  expect(screen.getByText('2 / 5')).toBeInTheDocument();
  expect(find).toHaveFocus();
  await user.keyboard('{Shift>}{Enter}{/Shift}');
  expect(screen.getByText('1 / 5')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Previous match' }));

  expect(screen.getByText('5 / 5')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous match' })).toHaveFocus();
  expect(screen.getByRole('textbox', { name: 'Keeper Description' })).toHaveAttribute('data-find-current', 'true');
});

it('shows match-option and no-results states through the production controls', async () => {
  const user = userEvent.setup();
  renderReference();

  const find = screen.getByRole('textbox', { name: 'Find' });
  await user.type(find, 'harbor');
  await waitFor(() => expect(screen.getByText('1 / 5')).toBeInTheDocument());

  const matchCase = screen.getByRole('button', { name: 'Match case' });
  await user.click(matchCase);
  expect(matchCase).toHaveAttribute('aria-pressed', 'true');
  await waitFor(() => expect(screen.getByText('1 / 4')).toBeInTheDocument());

  const wholeWord = screen.getByRole('button', { name: 'Match whole word' });
  await user.click(wholeWord);
  expect(wholeWord).toHaveAttribute('aria-pressed', 'true');
  await waitFor(() => expect(screen.getByText('1 / 3')).toBeInTheDocument());

  await user.clear(find);
  await user.type(find, 'observatories');

  await waitFor(() => expect(screen.getByText('No results')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('The reference has no selected match.');
});

it('confirms local replacements and restores focus when the bar closes', async () => {
  await replaceWorldStore([STORED_WORLD]);
  const user = userEvent.setup();
  renderReference();

  const openReplace = screen.getByRole('button', { name: 'Find and Replace' });
  await user.click(openReplace);
  expect(screen.getByRole('button', { name: 'Hide replace' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Find' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Hide replace' }));
  expect(screen.getByRole('button', { name: 'Show replace' })).toHaveFocus();
  await user.click(openReplace);
  expect(screen.getByRole('button', { name: 'Hide replace' })).toBeInTheDocument();
  const find = screen.getByRole('textbox', { name: 'Find' });
  expect(find).toHaveFocus();
  await user.type(find, 'harbor');
  await waitFor(() => expect(screen.getByText('1 / 5')).toBeInTheDocument());
  await user.type(screen.getByRole('textbox', { name: 'Replace with' }), 'haven');
  await user.click(screen.getByRole('button', { name: 'Replace' }));

  expect((screen.getByRole('textbox', { name: 'World Introduction' }) as HTMLTextAreaElement).value)
    .toContain('haven entrance');

  await user.click(screen.getByRole('button', { name: 'Replace all' }));
  const confirmation = screen.getByRole('alertdialog');
  expect(within(confirmation).getByText(/^Replace 4 matches across 3 fields\?/)).toBeInTheDocument();
  await user.click(within(confirmation).getByRole('button', { name: 'Replace All' }));

  await waitFor(() => expect(screen.getByText('Replaced 4 matches across 3 fields.')).toBeInTheDocument());
  expect(await readWorldStore()).toEqual([STORED_WORLD]);

  await user.click(screen.getByRole('button', { name: 'Reset Sample' }));
  expect((screen.getByRole('textbox', { name: 'World Introduction' }) as HTMLTextAreaElement).value)
    .toContain('harbor entrance');
  await waitFor(() => expect(screen.getByRole('status'))
    .toHaveTextContent('The selected field is World — World Introduction.'));

  await user.click(find);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('search', { name: 'Find and replace in world' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Find' })).toHaveFocus();
});
