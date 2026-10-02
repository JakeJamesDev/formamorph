import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackQueueTab } from './FeedbackQueueTab';
import { MyFeedbackTab } from './MyFeedbackTab';
import { FeedbackTab } from './FeedbackTab';
import { FeedbackHubDialog } from './FeedbackHubDialog';
import { FEEDBACK_SEARCH_DELAY_MS, FEEDBACK_SEARCH_MAX, FeedbackSearchInput } from './FeedbackSearchInput';
import FeedbackService from '@/services/FeedbackService';
import { DEFAULT_CATEGORY, SEARCH_LABELS } from '@/lib/feedbackPresentation';
import type { FeedbackThread, FeedbackType } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The thread view has its own coverage; the stub hands back its Back.
const threadProps = vi.hoisted(() => ({ last: null as { onBack: () => void } | null }));

vi.mock('./FeedbackThreadView', () => ({
  FeedbackThreadView: (props: { onBack: () => void }) => {
    threadProps.last = props;
    return <div data-testid="thread" />;
  },
}));
vi.mock('./FeedbackDialog', () => ({ FeedbackDialog: () => null }));

vi.mock('@/services/AuthService', () => ({
  default: { getCurrentUser: vi.fn(() => ({ id: 'u1', username: 'finder', accountType: 'normal' })) },
}));

const thread = (id: string, type: FeedbackType, title: string): FeedbackThread => ({
  id,
  type,
  title,
  category: DEFAULT_CATEGORY[type],
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

/** 45 threads per branch; the fake server matches the search against their titles, as the real one does. */
const POOL = Array.from({ length: 45 }, (_, i) => `Thread ${i}`);

const calls = () => vi.mocked(FeedbackService.list).mock.calls.map(([options]) => options);
const lastCall = () => calls().at(-1)!;
const searchesSent = () => calls().map((options) => options.search ?? '');

beforeEach(() => {
  threadProps.last = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(FeedbackService, 'list').mockImplementation(async ({ type, page = 1, limit = 10, search }) => {
    const term = search?.trim().toLowerCase() ?? '';
    const matches = POOL.filter((title) => title.toLowerCase().includes(term));
    const first = (page - 1) * limit;
    return {
      threads: matches.slice(first, first + limit).map((title) => thread(`${type}-${title}`, type, title)),
      total: matches.length,
    };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const queue = (type: FeedbackType) => <FeedbackQueueTab active type={type} />;
const userTab = (type: FeedbackType) => <MyFeedbackTab active type={type} />;

const TABS = [
  { name: 'the staff queue', type: 'bug', renderTab: queue, empty: 'No reports match this filter.' },
  { name: 'the staff queue', type: 'suggestion', renderTab: queue, empty: 'No suggestions match this filter.' },
  { name: 'the user tab', type: 'bug', renderTab: userTab, empty: 'No reports match this search.' },
  { name: 'the user tab', type: 'suggestion', renderTab: userTab, empty: 'No suggestions match this search.' },
] as const;

const searchBox = (type: FeedbackType) => screen.getByRole('searchbox', { name: SEARCH_LABELS[type] });

const type_ = (type: FeedbackType, text: string) => fireEvent.change(searchBox(type), { target: { value: text } });

/** Lets effects and resolved fetches run without letting the clock reach the search delay. */
const settle = () => act(async () => {});

const pageTo = async (page: number, of = 5) => {
  await screen.findByText(`Page 1 of ${of}`);
  for (let at = 2; at <= page; at++) {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText(`Page ${at} of ${of}`);
  }
};

describe.each(TABS)('search in $name, $type', ({ type, renderTab, empty }) => {
  it('searches once typing pauses, from page 1', async () => {
    render(renderTab(type));
    await pageTo(3);

    type_(type, 'T');
    type_(type, 'Thr');
    type_(type, 'Thread 1');
    await act(() => new Promise((resolve) => setTimeout(resolve, FEEDBACK_SEARCH_DELAY_MS - 100)));
    expect(searchesSent().filter(Boolean)).toEqual([]);

    await waitFor(() => expect(lastCall()).toMatchObject({ search: 'Thread 1', page: 1 }), { timeout: 300 });
    expect(await screen.findByText('Page 1 of 2')).toBeTruthy();
    expect(searchesSent().filter(Boolean)).toEqual(['Thread 1']);
    expect(screen.getByText('Thread 18')).toBeTruthy();
  });

  it('clears at once from the clear button', async () => {
    render(renderTab(type));
    type_(type, 'Thread 1');
    await screen.findByText('Page 1 of 2');

    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));
    await settle();

    expect(lastCall().search ?? '').toBe('');
    expect(searchBox(type)).toHaveProperty('value', '');
    expect(await screen.findByText('Page 1 of 5')).toBeTruthy();
  });

  it('clears at once when the text is erased', async () => {
    render(renderTab(type));
    type_(type, 'Thread 1');
    await screen.findByText('Page 1 of 2');

    type_(type, '  ');
    await settle();

    expect(lastCall().search ?? '').toBe('');
  });

  it('searches at once on Enter', async () => {
    render(renderTab(type));
    await screen.findByText('Page 1 of 5');

    type_(type, 'Thread 2');
    fireEvent.keyDown(searchBox(type), { key: 'Enter' });
    await settle();

    expect(lastCall()).toMatchObject({ search: 'Thread 2', page: 1 });
  });

  it('shows the empty label when nothing matches', async () => {
    render(renderTab(type));
    await screen.findByText('Page 1 of 5');

    type_(type, 'teleport');

    expect(await screen.findByText(empty)).toBeTruthy();
    expect(lastCall().search).toBe('teleport');
    expect(screen.queryByText('Thread 0')).toBeNull();
  });

  it('keeps the search across Back', async () => {
    render(renderTab(type));
    type_(type, 'Thread 1');
    await screen.findByText('Page 1 of 2');

    fireEvent.click(screen.getByText('Thread 12'));
    act(() => threadProps.last!.onBack());
    await settle();

    expect(searchBox(type)).toHaveProperty('value', 'Thread 1');
    expect(lastCall().search).toBe('Thread 1');
  });

  it('holds no more than the server searches', async () => {
    render(renderTab(type));

    expect(searchBox(type)).toHaveProperty('maxLength', FEEDBACK_SEARCH_MAX);
  });
});

describe('the search input', () => {
  it('drops typing cut off by unmount', async () => {
    const onSearch = vi.fn();
    const { unmount } = render(<FeedbackSearchInput value="" onSearch={onSearch} label="Search Reports" />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Thread 1' } });
    unmount();
    await new Promise((resolve) => setTimeout(resolve, FEEDBACK_SEARCH_DELAY_MS + 50));

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('takes a search set from outside as its text', () => {
    const { rerender } = render(<FeedbackSearchInput value="Thread 1" onSearch={() => {}} label="Search Reports" />);

    rerender(<FeedbackSearchInput value="" onSearch={() => {}} label="Search Reports" />);

    expect(screen.getByRole('searchbox')).toHaveProperty('value', '');
  });
});

/** Switches tabs the way Radix listens for: a primary-button press on the trigger. */
const switchTo = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });

describe.each([
  { name: 'the Admin Panel', renderHost: () => <FeedbackTab active /> },
  { name: 'the Feedback dialog', renderHost: () => <FeedbackHubDialog open onOpenChange={() => {}} /> },
])('a tab switch in $name', ({ renderHost }) => {
  it('keeps each tab’s search and page', async () => {
    render(renderHost());
    await screen.findByText('Page 1 of 5');
    type_('bug', 'Thread 1');
    await screen.findByText('Page 1 of 2');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 2');

    switchTo('Suggestions');
    await waitFor(() => expect(lastCall().type).toBe('suggestion'));
    switchTo('Bugs');
    await waitFor(() => expect(lastCall().type).toBe('bug'));

    expect(searchBox('bug')).toHaveProperty('value', 'Thread 1');
    expect(lastCall()).toMatchObject({ search: 'Thread 1', page: 2 });
  });
});

describe('the Feedback dialog', () => {
  it('starts with an empty search when it is closed and opened again', async () => {
    const { rerender } = render(<FeedbackHubDialog open onOpenChange={() => {}} />);
    await screen.findByText('Page 1 of 5');
    type_('bug', 'Thread 1');
    await screen.findByText('Page 1 of 2');

    rerender(<FeedbackHubDialog open={false} onOpenChange={() => {}} />);
    rerender(<FeedbackHubDialog open onOpenChange={() => {}} />);

    expect(await screen.findByText('Page 1 of 5')).toBeTruthy();
    expect(searchBox('bug')).toHaveProperty('value', '');
    expect(lastCall().search ?? '').toBe('');
  });
});
