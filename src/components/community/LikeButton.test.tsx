import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LikeButton, HIDDEN_LIKES_TIP, PRIVATE_LIKES_TIP } from './LikeButton';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { LikeCount } from '@/lib/likeCount';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));

/**
 * The heart's three counts: a number, a number only the author and staff see, and a contest count hidden
 * until the winners are announced.
 */

const show = (count: LikeCount, props: Partial<Parameters<typeof LikeButton>[0]> = {}) =>
  render(<TooltipProvider><LikeButton count={count} {...props} /></TooltipProvider>);

/** Hover, and find the tip's popup with exactly this text. */
const expectTip = async (element: HTMLElement, text: string) => {
  await userEvent.hover(element);
  expect(await screen.findByText(text, { selector: 'div' })).toBeVisible();
};

describe('a hidden count', () => {
  it('shows a dash, never a number', () => {
    show({ visibility: 'hidden' });

    const count = screen.getByLabelText(HIDDEN_LIKES_TIP);
    expect(count.textContent?.trim()).toBe('—');
  });

  it('says when the likes will show', async () => {
    show({ visibility: 'hidden' });

    await expectTip(screen.getByLabelText(HIDDEN_LIKES_TIP), HIDDEN_LIKES_TIP);
  });

  it('stays pressable', async () => {
    const onToggle = vi.fn(async () => {});
    show({ visibility: 'hidden' }, { liked: false, onToggle });

    const heart = screen.getByRole('button', { name: 'Like — likes hidden' });
    expect(heart.textContent?.trim()).toBe('—');
    await expectTip(heart, `Like this. ${HIDDEN_LIKES_TIP}.`);

    fireEvent.click(heart);

    await waitFor(() => expect(onToggle).toHaveBeenCalledWith(true));
  });
});

describe('a private count', () => {
  it('shows the number, and says who else sees it', async () => {
    show({ visibility: 'private', likes: 12 });

    const count = screen.getByText('12', { exact: false }).closest('span') as HTMLElement;
    await expectTip(count, `12 likes. ${PRIVATE_LIKES_TIP}.`);
  });

  it('says so on the staff count that opens the likers', async () => {
    show({ visibility: 'private', likes: 12 }, { liked: false, onToggle: vi.fn(async () => {}), onOpenLikers: vi.fn() });

    const likers = screen.getByRole('button', { name: 'Show who liked this — 12 likes' });
    expect(likers.textContent).toBe('12');
    await expectTip(likers, `See who liked this. ${PRIVATE_LIKES_TIP}.`);
  });
});

describe('a public count', () => {
  it('shows the number with no extra line', async () => {
    show({ visibility: 'public', likes: 3 }, { liked: false, onToggle: vi.fn(async () => {}) });

    const heart = screen.getByRole('button', { name: 'Like — 3 likes' });
    await expectTip(heart, 'Like this');
  });
});
