import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackQueueTab } from './FeedbackQueueTab';
import { MyFeedbackTab } from './MyFeedbackTab';
import { FeedbackHubDialog } from './FeedbackHubDialog';
import FeedbackService from '@/services/FeedbackService';
import { ANY_STATUS, CATEGORY_OPTIONS, DEFAULT_CATEGORY } from '@/lib/feedbackPresentation';
import type { FeedbackThread, FeedbackType } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// Radix Select never opens in jsdom, so each dropdown stands in as a native select with the trigger's label.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: {
    value: string; onValueChange: (value: string) => void; children: ReactNode;
  }) => {
    const trigger = Children.toArray(children).find(
      (child): child is ReactElement<{ 'aria-label'?: string }> => isValidElement(child) && child.type === SelectTriggerStub,
    );
    return (
      <select aria-label={trigger?.props['aria-label']} value={value} onChange={(e) => onValueChange(e.target.value)}>
        {children}
      </select>
    );
  },
  SelectTrigger: SelectTriggerStub,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));

function SelectTriggerStub() { return null; }

// The thread view has its own coverage; the stub hands back its Back and its change report.
const threadProps = vi.hoisted(() => ({ last: null as { onBack: () => void; onChanged?: () => void } | null }));

vi.mock('./FeedbackThreadView', () => ({
  FeedbackThreadView: (props: { onBack: () => void; onChanged?: () => void }) => {
    threadProps.last = props;
    return <div data-testid="thread" />;
  },
}));
vi.mock('./FeedbackDialog', () => ({ FeedbackDialog: () => null }));

vi.mock('@/services/AuthService', () => ({
  default: { getCurrentUser: vi.fn(() => ({ id: 'u1', username: 'finder', accountType: 'normal' })) },
}));

const thread = (id: string, type: FeedbackType): FeedbackThread => ({
  id,
  type,
  title: `Thread ${id}`,
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

/** The server's thread count; a test lowers it to stand for triage moving threads out. */
let serverTotal = 45;

const lastPageAsked = () => vi.mocked(FeedbackService.list).mock.calls.at(-1)?.[0].page;

beforeEach(() => {
  serverTotal = 45;
  threadProps.last = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(FeedbackService, 'list').mockImplementation(async ({ type, page = 1, limit = 10 }) => {
    const first = (page - 1) * limit;
    const count = Math.max(Math.min(limit, serverTotal - first), 0);
    return {
      threads: Array.from({ length: count }, (_, i) => thread(`${page}-${i}`, type)),
      total: serverTotal,
    };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TABS = [
  { name: 'the staff queue', renderTab: (type: FeedbackType) => <FeedbackQueueTab active type={type} /> },
  { name: 'the user tab', renderTab: (type: FeedbackType) => <MyFeedbackTab active type={type} /> },
];

/** Pages forward until the pager reads `page`. */
const pageTo = async (page: number, of = 5) => {
  await screen.findByText(`Page 1 of ${of}`);
  for (let at = 2; at <= page; at++) {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText(`Page ${at} of ${of}`);
  }
};

const openRow = async (title: string) => {
  fireEvent.click(await screen.findByText(title));
  expect(screen.getByTestId('thread')).toBeTruthy();
};

const pressBack = () => act(() => threadProps.last!.onBack());

describe.each(TABS)('Back in $name', ({ renderTab }) => {
  it('returns to the page the thread was opened from', async () => {
    render(renderTab('bug'));
    await pageTo(4);

    await openRow('Thread 4-2');
    pressBack();

    expect(await screen.findByText('Page 4 of 5')).toBeTruthy();
    expect(screen.getByText('Thread 4-2')).toBeTruthy();
    expect(lastPageAsked()).toBe(4);
  });

  it('restores the scroll position the list had', async () => {
    render(<div data-radix-scroll-area-viewport="">{renderTab('bug')}</div>);
    const viewport = document.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')!;
    await pageTo(2);

    viewport.scrollTop = 320;
    await openRow('Thread 2-7');
    // The thread is read at its own offset.
    viewport.scrollTop = 0;
    pressBack();

    expect(viewport.scrollTop).toBe(320);
    // The rows the offset points into are already there; a skeleton would clamp it in a real browser.
    expect(screen.getByText('Thread 2-7')).toBeTruthy();
  });

  it('lands on the last page when a reload finds the page gone', async () => {
    render(renderTab('bug'));
    await pageTo(5);

    await openRow('Thread 5-1');
    // Triage moved enough threads out that page 5 no longer exists.
    serverTotal = 40;
    act(() => threadProps.last!.onChanged?.());
    pressBack();

    expect(await screen.findByText('Page 4 of 4')).toBeTruthy();
    expect(screen.getByText('Thread 4-0')).toBeTruthy();
    expect(lastPageAsked()).toBe(4);
  });
});

describe('a filter change', () => {
  const CASES = [
    { name: 'status', label: 'Filter by status', tab: <FeedbackQueueTab active type="bug" />, pick: ANY_STATUS },
    { name: 'category on the queue', label: 'Filter by category', tab: <FeedbackQueueTab active type="bug" />, pick: CATEGORY_OPTIONS.bug[1].value },
    { name: 'sort on the queue', label: 'Sort by', tab: <FeedbackQueueTab active type="suggestion" />, pick: 'newest' },
    { name: 'scope', label: 'Which threads', tab: <MyFeedbackTab active type="bug" />, pick: 'all' },
    { name: 'category on the user tab', label: 'Filter by category', tab: <MyFeedbackTab active type="bug" />, pick: CATEGORY_OPTIONS.bug[1].value },
    { name: 'sort on the user tab', label: 'Sort by', tab: <MyFeedbackTab active type="suggestion" />, pick: 'votes' },
  ];

  it.each(CASES)('resets to page 1: $name', async ({ label, tab, pick }) => {
    render(tab);
    await pageTo(3);

    fireEvent.change(screen.getByLabelText(label), { target: { value: pick } });

    expect(await screen.findByText('Page 1 of 5')).toBeTruthy();
    expect(lastPageAsked()).toBe(1);
  });
});

describe('the Feedback dialog', () => {
  it('starts on page 1 when it is closed and opened again', async () => {
    const { rerender } = render(<FeedbackHubDialog open onOpenChange={() => {}} />);
    await pageTo(3);

    rerender(<FeedbackHubDialog open={false} onOpenChange={() => {}} />);
    rerender(<FeedbackHubDialog open onOpenChange={() => {}} />);

    expect(await screen.findByText('Page 1 of 5')).toBeTruthy();
    expect(lastPageAsked()).toBe(1);
  });
});
