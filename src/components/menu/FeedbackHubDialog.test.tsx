import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { FeedbackHubDialog } from './FeedbackHubDialog';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The branch panel has its own coverage; stubbing it keeps this file about the dialog's own shell.
vi.mock('./MyFeedbackTab', () => ({
  MyFeedbackTab: ({ type, active }: { type: string; active: boolean }) => (
    <div data-testid={type === 'bug' ? 'bugs' : 'suggestions'} data-active={active} />
  ),
}));

afterEach(cleanup);

describe('the feedback dialog', () => {
  it('opens on the lists rather than on the form', async () => {
    // The whole point of moving it here: the queue is findable now, so what is already filed does not
    // get filed a second time.
    render(<FeedbackHubDialog open onOpenChange={() => {}} />);

    expect(await screen.findByTestId('bugs')).toBeTruthy();
  });

  it('holds both branches', async () => {
    render(<FeedbackHubDialog open onOpenChange={() => {}} />);

    expect(await screen.findByRole('tab', { name: 'Bugs' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Suggestions' })).toBeTruthy();
  });

  it('lands on the branch it is pointed at', async () => {
    render(<FeedbackHubDialog open onOpenChange={() => {}} initialTab="suggestions" />);

    expect(await screen.findByTestId('suggestions')).toBeTruthy();
  });

  it('fetches nothing while it is closed', () => {
    // The lists are mounted with the dialog; a closed one must not be paying for a page of threads.
    render(<FeedbackHubDialog open={false} onOpenChange={() => {}} />);

    expect(screen.queryByTestId('bugs')).toBeNull();
  });

  it('tells the branch it is on screen, so it loads', async () => {
    render(<FeedbackHubDialog open onOpenChange={() => {}} />);

    expect((await screen.findByTestId('bugs')).getAttribute('data-active')).toBe('true');
  });

  it('says what it is, since the header is all the dialog explains itself with', async () => {
    render(<FeedbackHubDialog open onOpenChange={() => {}} />);

    expect(await screen.findByRole('heading', { name: /Feedback/ })).toBeTruthy();
  });
});
