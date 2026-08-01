import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackQueueTab } from './FeedbackQueueTab';
import { MyFeedbackTab } from './MyFeedbackTab';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

/**
 * The filters' wiring, on its own.
 *
 * Radix's `Select` cannot be opened in jsdom, so a test that picks a category and watches the request is
 * not available. What is checkable is that each tab *hands the list* every filter it owns — a dropped
 * prop is the failure that would otherwise ship silently, since the default (no filter) looks identical
 * whether the wire is there or not.
 */
const listProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('./FeedbackList', () => ({
  FeedbackList: (props: Record<string, unknown>) => { listProps.last = props; return <div data-testid="list" />; },
}));

vi.mock('./FeedbackThreadView', () => ({ FeedbackThreadView: () => <div /> }));
vi.mock('./FeedbackDialog', () => ({ FeedbackDialog: () => null }));

vi.mock('@/services/AuthService', () => ({
  default: { getCurrentUser: vi.fn(() => ({ id: 'u1', username: 'finder', accountType: 'normal' })) },
}));

beforeEach(() => {
  listProps.last = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the admin queue hands the list its filters', () => {
  it('passes a category through', () => {
    render(<FeedbackQueueTab active type="bug" />);

    expect(listProps.last).toHaveProperty('category');
  });

  it('passes a status and a sort through', () => {
    render(<FeedbackQueueTab active type="suggestion" />);

    expect(listProps.last).toHaveProperty('status');
    expect(listProps.last).toHaveProperty('sort');
  });
});

describe('the profile tab hands the list its filters', () => {
  it('passes a category through', () => {
    render(<MyFeedbackTab active type="suggestion" />);

    expect(listProps.last).toHaveProperty('category');
  });

  it('passes a scope and a sort through', () => {
    render(<MyFeedbackTab active type="bug" />);

    expect(listProps.last).toHaveProperty('scope');
    expect(listProps.last).toHaveProperty('sort');
  });
});
