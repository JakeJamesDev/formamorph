import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackTab } from './FeedbackTab';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The queue has its own coverage; this file is about which branch is shown and whether it is fetching.
vi.mock('./FeedbackQueueTab', () => ({
  FeedbackQueueTab: ({ type, active }: { type: string; active: boolean }) => (
    <div data-testid={`queue-${type}`} data-active={String(active)} />
  ),
}));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the two branches', () => {
  it('opens on bugs', () => {
    render(<FeedbackTab active />);

    expect(screen.getByTestId('queue-bug')).toBeTruthy();
    expect(screen.queryByTestId('queue-suggestion')).toBeNull();
  });

  it('opens where the caller asks, which is how the dev-router lands on either', () => {
    render(<FeedbackTab active initialTab="suggestions" />);

    expect(screen.getByTestId('queue-suggestion')).toBeTruthy();
  });

  it('switches between them', () => {
    render(<FeedbackTab active />);

    // Radix tab triggers act on mousedown, not click.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Suggestions' }));

    expect(screen.getByTestId('queue-suggestion')).toBeTruthy();
    expect(screen.queryByTestId('queue-bug')).toBeNull();
  });
});

describe('what fetches', () => {
  it('lets the branch on screen fetch', () => {
    render(<FeedbackTab active />);

    expect(screen.getByTestId('queue-bug').getAttribute('data-active')).toBe('true');
  });

  it('holds the fetch while the whole tab is off screen', () => {
    // The admin dialog keeps every panel mounted; without this the queue would load behind another tab.
    render(<FeedbackTab active={false} />);

    expect(screen.getByTestId('queue-bug').getAttribute('data-active')).toBe('false');
  });
});
