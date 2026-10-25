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

/** Whether a branch's panel is the one on screen, and whether its queue may fetch. */
const shown = (type: string) => {
  const queue = screen.getByTestId(`queue-${type}`);
  return {
    panel: queue.closest('[role="tabpanel"]')!.getAttribute('data-state'),
    fetching: queue.getAttribute('data-active'),
  };
};

describe('the two branches', () => {
  it('opens on bugs', () => {
    render(<FeedbackTab active />);

    expect(shown('bug')).toEqual({ panel: 'active', fetching: 'true' });
    expect(shown('suggestion')).toEqual({ panel: 'inactive', fetching: 'false' });
  });

  it('opens where the caller asks, which is how the dev-router lands on either', () => {
    render(<FeedbackTab active initialTab="suggestions" />);

    expect(shown('suggestion')).toEqual({ panel: 'active', fetching: 'true' });
  });

  it('switches between them', () => {
    render(<FeedbackTab active />);

    // Radix tab triggers act on mousedown, not click.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Suggestions' }));

    expect(shown('suggestion')).toEqual({ panel: 'active', fetching: 'true' });
    // Still mounted, so its search, filters, and page are there on the way back.
    expect(shown('bug')).toEqual({ panel: 'inactive', fetching: 'false' });
  });
});

describe('the questions branch', () => {
  it('has its own tab beside the other two', () => {
    render(<FeedbackTab active />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Bugs', 'Suggestions', 'Questions']);
  });

  it('shows the question queue when picked', () => {
    render(<FeedbackTab active />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Questions' }));

    expect(shown('question')).toEqual({ panel: 'active', fetching: 'true' });
    expect(shown('bug')).toEqual({ panel: 'inactive', fetching: 'false' });
  });

  it('opens on it when the dev-router asks', () => {
    render(<FeedbackTab active initialTab="questions" />);

    expect(shown('question')).toEqual({ panel: 'active', fetching: 'true' });
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
