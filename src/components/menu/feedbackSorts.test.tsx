import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackQueueTab } from './FeedbackQueueTab';
import { MyFeedbackTab } from './MyFeedbackTab';
import FeedbackService from '@/services/FeedbackService';
import { sortsFor } from '@/lib/feedbackPresentation';
import type { FeedbackThread, FeedbackType } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('./FeedbackThreadView', () => ({ FeedbackThreadView: () => null }));
vi.mock('./FeedbackDialog', () => ({ FeedbackDialog: () => null }));
vi.mock('@/services/AuthService', () => ({
  default: { getCurrentUser: vi.fn(() => ({ id: 'u1', username: 'finder', accountType: 'normal' })) },
}));

const thread = (type: FeedbackType): FeedbackThread => ({
  id: 't1',
  type,
  title: 'Save button does nothing',
  category: 'other',
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

/** Radix picks an option on pointer events, so the click alone selects nothing in jsdom. */
const pick = (option: HTMLElement) => {
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.pointerUp(option, { pointerType: 'mouse' });
  fireEvent.click(option);
};

/** Opens the Filters popover, where the user tab keeps Sort. */
const openFilters = async () => fireEvent.click(await screen.findByRole('button', { name: /^More Filters/ }));

/** Opens the Sort dropdown by keyboard (Radix ignores jsdom's missing pointer events) and reads its options. */
const openSort = async () => {
  fireEvent.keyDown(await screen.findByLabelText('Sort by'), { key: 'Enter' });
  return screen.findAllByRole('option');
};

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(FeedbackService, 'list').mockImplementation(async ({ type }) => ({ threads: [thread(type)], total: 1 }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('which sorts a branch offers', () => {
  it('gives suggestions every sort and bugs all but votes', () => {
    expect(sortsFor('suggestion')).toEqual(['newest', 'oldest', 'active', 'votes']);
    expect(sortsFor('bug')).toEqual(['newest', 'oldest', 'active']);
  });
});

describe('the sort control on the staff queue', () => {
  it.each([
    ['bug', ['Newest', 'Oldest', 'Recently Active']],
    ['suggestion', ['Newest', 'Oldest', 'Recently Active', 'Most Voted']],
  ] as const)('lists the %s sorts', async (type, labels) => {
    render(<FeedbackQueueTab active type={type} />);

    expect((await openSort()).map((option) => option.textContent)).toEqual(labels);
  });

  it('opens Bugs on Newest and Suggestions on Most Voted', async () => {
    render(<FeedbackQueueTab active type="bug" />);
    await waitFor(() => expect(lastQuery()).toMatchObject({ sort: 'newest' }));
    cleanup();

    render(<FeedbackQueueTab active type="suggestion" />);
    await waitFor(() => expect(lastQuery()).toMatchObject({ type: 'suggestion', sort: 'votes' }));
  });

  it('sends the sort a staff member picks on Bugs', async () => {
    render(<FeedbackQueueTab active type="bug" />);
    const options = await openSort();

    pick(options.find((option) => option.textContent === 'Recently Active') as HTMLElement);

    await waitFor(() => expect(lastQuery()).toMatchObject({ type: 'bug', sort: 'active' }));
  });
});

describe('the sort control on the user tab', () => {
  it.each([
    ['bug', ['Newest', 'Oldest', 'Recently Active']],
    ['suggestion', ['Newest', 'Oldest', 'Recently Active', 'Most Voted']],
  ] as const)('lists the %s sorts', async (type, labels) => {
    render(<MyFeedbackTab active type={type} />);
    await openFilters();

    expect((await openSort()).map((option) => option.textContent)).toEqual(labels);
  });

  it('opens on Newest in both branches', async () => {
    render(<MyFeedbackTab active type="bug" />);
    await waitFor(() => expect(lastQuery()).toMatchObject({ type: 'bug', sort: 'newest' }));
    cleanup();

    render(<MyFeedbackTab active type="suggestion" />);
    await waitFor(() => expect(lastQuery()).toMatchObject({ type: 'suggestion', sort: 'newest' }));
  });

  it.each([
    ['bug', 'all'],
    ['suggestion', 'mine'],
  ] as const)('keeps Sort on %s after switching to %s', async (type, scope) => {
    render(<MyFeedbackTab active type={type} />);

    fireEvent.keyDown(await screen.findByLabelText('Which threads'), { key: 'Enter' });
    const scopes = await screen.findAllByRole('option');
    pick(scopes[scope === 'all' ? 1 : 0]);

    await waitFor(() => expect(lastQuery()).toMatchObject({ scope: scope === 'all' ? 'all' : undefined }));
    await openFilters();
    expect(screen.getByLabelText('Sort by')).toBeTruthy();
  });

  it('sends the pick from the caller’s own scope', async () => {
    render(<MyFeedbackTab active type="bug" />);
    await openFilters();
    const options = await openSort();

    pick(options.find((option) => option.textContent === 'Oldest') as HTMLElement);

    await waitFor(() => expect(lastQuery()).toMatchObject({ scope: undefined, sort: 'oldest' }));
  });
});
