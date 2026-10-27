import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from '@/components/prompt/PromptField';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { plainVocabulary } from '@/lib/chipVocabulary';
import FeedbackService from '@/services/FeedbackService';
import type { FeedbackThreadSuggestion, FeedbackType, FeedbackUserSuggestion } from '@/types';
import { FeedbackSuggestPlugin } from './FeedbackSuggestPlugin';

const vocab = plainVocabulary();

function Harness({ thread, threadTypes = null }: { thread?: string; threadTypes?: readonly FeedbackType[] | null }) {
  const [value, setValue] = useState(' end');
  return (
    <>
      <PromptField value={value} onChange={setValue} vocabulary={vocab} markdown ariaLabel="Reply">
        <FeedbackSuggestPlugin thread={thread} threadTypes={threadTypes} />
      </PromptField>
      <div data-testid="value">{value}</div>
    </>
  );
}

const user = (username: string, participant: boolean): FeedbackUserSuggestion => ({
  id: `id-${username}`, username, avatarUrl: null, role: null, participant,
});
const thread = (number: number, title: string): FeedbackThreadSuggestion => ({ number, title, type: 'suggestion', status: 'open' });

const value = () => screen.getByTestId('value').textContent;
const rows = () => screen.queryByTestId('feedback-suggestions')?.querySelectorAll('button') ?? [];
/** The name in each row; the avatar's initial also sits in the row's text. */
const names = () => [...rows()].map((row) => ['Wren_H', 'Wrenna', 'Stale'].find((name) => row.textContent?.includes(name)));

/** Type at the head of the value: jsdom has no layout, so a click puts the caret at the start. */
async function type(text: string) {
  const u = userEvent.setup();
  await u.click(screen.getByLabelText('Reply'));
  await u.keyboard(text);
  return u;
}

afterEach(() => vi.restoreAllMocks());

describe('FeedbackSuggestPlugin', () => {
  it('lists participants first and inserts the picked name', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user('Wren_H', true), user('Wrenna', false)]);
    render(<Harness thread="t1" />);
    await type('@wr');

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(names()).toEqual(['Wren_H', 'Wrenna']);
    expect(search).toHaveBeenCalledWith('wr', 't1', expect.any(AbortSignal));

    fireEvent.mouseDown(rows()[1]);
    await waitFor(() => expect(value()).toBe('@Wrenna  end'));
    expect(rows()).toHaveLength(0);
  });

  it('inserts the underscore form of a spaced account', async () => {
    vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user('Jake James', false)]);
    render(<Harness thread="t1" />);
    await type('@jake_j');

    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.mouseDown(rows()[0]);
    await waitFor(() => expect(value()).toBe('@Jake_James  end'));
  });

  it('debounces typing into one request', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user('Wren_H', true)]);
    render(<Harness thread="t1" />);
    await type('@wren');

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('wren', 't1', expect.any(AbortSignal));
  });

  it('lists the participants for a bare @ in a thread, and nothing in a new one', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user('Wren_H', true)]);
    const { unmount } = render(<Harness thread="t1" />);
    await type('@');
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(search).toHaveBeenCalledWith('', 't1', expect.any(AbortSignal));
    unmount();

    search.mockClear();
    render(<Harness />);
    await type('@');
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(search).not.toHaveBeenCalled();
  });

  it('searches threads with the given boards and inserts the number', async () => {
    const search = vi.spyOn(FeedbackService, 'searchThreads').mockResolvedValue([thread(12, 'Dark mode'), thread(3, 'Darker fog')]);
    render(<Harness thread="t1" threadTypes={['suggestion', 'question']} />);
    const u = await type('#dark');

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(search).toHaveBeenCalledWith('dark', ['suggestion', 'question'], expect.any(AbortSignal));
    expect(rows()[0].textContent).toBe('#12Dark mode');

    await u.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(value()).toBe('#3  end'));
  });

  it('wraps the arrows and picks with Enter', async () => {
    vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user('Wren_H', true), user('Wrenna', false)]);
    render(<Harness thread="t1" />);
    const u = await type('@wr');
    await waitFor(() => expect(rows()).toHaveLength(2));

    await u.keyboard('{ArrowUp}{Enter}');
    await waitFor(() => expect(value()).toBe('@Wrenna  end'));
  });

  it('closes on Escape without inserting, and stays closed for that run', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user('Wren_H', true)]);
    render(<Harness thread="t1" />);
    const u = await type('@wr');
    await waitFor(() => expect(rows()).toHaveLength(1));

    await u.keyboard('{Escape}');
    expect(rows()).toHaveLength(0);
    expect(value()).toBe('@wr end');

    await u.keyboard('e');
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(rows()).toHaveLength(0);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('searches everyone once letters follow a bare @ that found no participants', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([user('Wrenna', false)]);
    render(<Harness thread="t1" />);
    const u = await type('@');
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 50));

    await u.keyboard('w');
    await waitFor(() => expect(names()).toEqual(['Wrenna']));
    expect(search).toHaveBeenLastCalledWith('w', 't1', expect.any(AbortSignal));
  });

  it('keeps the run shut when Escape comes before the list shows', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user('Wren_H', true)]);
    render(<Harness thread="t1" />);
    await type('@wr{Escape}e');
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(rows()).toHaveLength(0);
    expect(search).not.toHaveBeenCalled();
  });

  it('closes only the list when the field sits in a dialog', async () => {
    vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user('Wren_H', true)]);
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Thread</DialogTitle>
          <Harness thread="t1" />
        </DialogContent>
      </Dialog>,
    );
    const u = await type('@wr');
    await waitFor(() => expect(rows()).toHaveLength(1));

    await u.keyboard('{Escape}');
    expect(rows()).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();

    // With the list shut, Escape is the dialog's again.
    await u.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('opens nothing inside a code span', async () => {
    const search = vi.spyOn(FeedbackService, 'searchUsers').mockResolvedValue([user('Wren_H', true)]);
    render(<Harness thread="t1" />);
    await type('`run @wr');
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(search).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
  });

  it('drops a response that a newer query overtook', async () => {
    let answerOld: (rows: FeedbackUserSuggestion[]) => void = () => {};
    const search = vi.spyOn(FeedbackService, 'searchUsers')
      .mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }))
      .mockResolvedValueOnce([user('Wrenna', false)]);
    render(<Harness thread="t1" />);
    const u = await type('@wr');
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));

    await u.keyboard('en');
    await waitFor(() => expect(rows()).toHaveLength(1));
    await act(async () => answerOld([user('Stale', true)]));
    expect(names()).toEqual(['Wrenna']);
  });

  it('aborts the request in flight at unmount', async () => {
    let signal: AbortSignal | undefined;
    vi.spyOn(FeedbackService, 'searchUsers').mockImplementation((_q, _t, s) => { signal = s; return new Promise(() => {}); });
    const { unmount } = render(<Harness thread="t1" />);
    await type('@wr');
    await waitFor(() => expect(signal).toBeDefined());

    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('closes quietly when the search fails', async () => {
    vi.spyOn(FeedbackService, 'searchUsers').mockRejectedValue(new Error('Too many searches'));
    render(<Harness thread="t1" />);
    await type('@wr');
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(rows()).toHaveLength(0);
    expect(value()).toBe('@wr end');
  });
});
