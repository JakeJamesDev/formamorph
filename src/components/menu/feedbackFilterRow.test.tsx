import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackQueueTab } from './FeedbackQueueTab';
import { MyFeedbackTab } from './MyFeedbackTab';
import FeedbackService from '@/services/FeedbackService';
import { ANY_STATUS, CATEGORY_OPTIONS, UNRESOLVED_STATUSES } from '@/lib/feedbackPresentation';
import type { FeedbackThread, FeedbackType } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// Each dropdown stands in as a native select with the trigger's label, so a pick is one change event.
vi.mock('@/components/ui/select', () => {
  const SelectTrigger = () => null;
  return {
    Select: ({ value, onValueChange, children }: {
      value: string; onValueChange: (value: string) => void; children: ReactNode;
    }) => {
      const trigger = Children.toArray(children).find(
        (child): child is ReactElement<{ 'aria-label'?: string }> => isValidElement(child) && child.type === SelectTrigger,
      );
      return (
        <select aria-label={trigger?.props['aria-label']} value={value} onChange={(e) => onValueChange(e.target.value)}>
          {children}
        </select>
      );
    },
    SelectTrigger,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
  };
});

vi.mock('./FeedbackThreadView', () => ({ FeedbackThreadView: () => null }));
vi.mock('./FeedbackDialog', () => ({ FeedbackDialog: () => null }));
vi.mock('@/services/AuthService', () => ({
  default: { getCurrentUser: vi.fn(() => ({ id: 'u1', username: 'finder', accountType: 'normal' })) },
}));

const thread = (id: string, type: FeedbackType): FeedbackThread => ({
  id,
  type,
  title: `Thread ${id}`,
  category: CATEGORY_OPTIONS[type][0].value,
  body: 'Body.',
  status: 'open',
  reporter: { id: 'u1', username: 'finder' },
  diagnostics: {},
  locked: false,
  votes: 0,
  voted: false,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  unread: false,
});

const lastQuery = () => vi.mocked(FeedbackService.list).mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(FeedbackService, 'list').mockImplementation(async ({ type, page = 1, limit = 10 }) => ({
    threads: Array.from({ length: limit }, (_, i) => thread(`${page}-${i}`, type)),
    total: 45,
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const filtersButton = () => screen.getByRole('button', { name: /^More Filters/ });
const openFilters = () => fireEvent.click(filtersButton());
const pickIn = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

const pageTo = async (page: number) => {
  await screen.findByText('Page 1 of 5');
  for (let at = 2; at <= page; at++) {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText(`Page ${at} of 5`);
  }
};

const searchFor = (label: string, text: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('the Filters badge on the staff queue', () => {
  it('shows no count while every filter is at its default', async () => {
    render(<FeedbackQueueTab active type="bug" />);
    await screen.findByText('Page 1 of 5');

    expect(filtersButton()).toHaveAccessibleName('More Filters');
    expect(filtersButton()).toHaveTextContent(/^Filters$/);
  });

  it('counts a changed Category, which the row hides', async () => {
    render(<FeedbackQueueTab active type="bug" />);
    await screen.findByText('Page 1 of 5');
    openFilters();

    pickIn('Filter by category', CATEGORY_OPTIONS.bug[1].value);

    expect(filtersButton()).toHaveAccessibleName('More Filters, 1 changed');
    expect(filtersButton()).toHaveTextContent(/^Filters1$/);
  });

  it('leaves out Status and Sort, which the row shows', async () => {
    render(<FeedbackQueueTab active type="suggestion" />);
    await screen.findByText('Page 1 of 5');

    pickIn('Filter by status', ANY_STATUS);
    pickIn('Sort by', 'oldest');

    expect(filtersButton()).toHaveAccessibleName('More Filters');
  });
});

describe('the Filters badge on the user tab', () => {
  it('counts each hidden filter that differs', async () => {
    render(<MyFeedbackTab active type="bug" />);
    await screen.findByText('Page 1 of 5');
    openFilters();

    pickIn('Filter by status', 'confirmed');
    pickIn('Sort by', 'active');

    expect(filtersButton()).toHaveAccessibleName('More Filters, 2 changed');
  });

  it('drops the count when a filter returns to its default', async () => {
    render(<MyFeedbackTab active type="bug" />);
    await screen.findByText('Page 1 of 5');
    openFilters();

    pickIn('Sort by', 'active');
    pickIn('Sort by', 'newest');

    expect(filtersButton()).toHaveAccessibleName('More Filters');
  });

  it('leaves out the scope, which the row shows', async () => {
    render(<MyFeedbackTab active type="bug" />);
    await screen.findByText('Page 1 of 5');

    pickIn('Which threads', 'all');

    expect(filtersButton()).toHaveAccessibleName('More Filters');
  });
});

describe('Reset Filters', () => {
  it('is off while every filter is at its default', async () => {
    render(<FeedbackQueueTab active type="bug" />);
    await screen.findByText('Page 1 of 5');
    openFilters();

    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeDisabled();
  });

  it('turns on for a changed filter the row shows', async () => {
    render(<FeedbackQueueTab active type="bug" />);
    await screen.findByText('Page 1 of 5');
    pickIn('Sort by', 'oldest');
    openFilters();

    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeEnabled();
  });

  it('restores every staff default and page 1, and keeps the search', async () => {
    render(<FeedbackQueueTab active type="suggestion" />);
    await screen.findByText('Page 1 of 5');
    searchFor('Search Suggestions', 'export');
    pickIn('Filter by status', ANY_STATUS);
    pickIn('Sort by', 'oldest');
    openFilters();
    pickIn('Filter by category', CATEGORY_OPTIONS.suggestion[1].value);
    await pageTo(3);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Filters' }));

    await waitFor(() => expect(lastQuery()).toMatchObject({
      page: 1,
      status: UNRESOLVED_STATUSES.suggestion,
      category: undefined,
      sort: 'votes',
      search: 'export',
    }));
    expect(screen.getByLabelText('Search Suggestions')).toHaveValue('export');
    expect(filtersButton()).toHaveAccessibleName('More Filters');
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeDisabled();
  });

  it('restores every user default, the scope included, and keeps the search', async () => {
    render(<MyFeedbackTab active type="bug" />);
    await screen.findByText('Page 1 of 5');
    searchFor('Search Reports', 'crash');
    pickIn('Which threads', 'all');
    openFilters();
    pickIn('Filter by status', 'resolved');
    pickIn('Filter by category', CATEGORY_OPTIONS.bug[1].value);
    pickIn('Sort by', 'oldest');
    await pageTo(2);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Filters' }));

    await waitFor(() => expect(lastQuery()).toMatchObject({
      page: 1,
      scope: undefined,
      status: UNRESOLVED_STATUSES.bug,
      category: undefined,
      sort: 'newest',
      search: 'crash',
    }));
    expect(screen.getByLabelText('Which threads')).toHaveValue('mine');
    expect(screen.getByLabelText('Search Reports')).toHaveValue('crash');
    expect(filtersButton()).toHaveAccessibleName('More Filters');
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeDisabled();
  });
});
