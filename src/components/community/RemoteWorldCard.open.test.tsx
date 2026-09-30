import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail: () => <div data-testid="thumb" /> }));
vi.mock('@/lib/listingDetailsLoader', () => ({ prefetchListing: vi.fn() }));

/** A card opens from the keyboard through its name, and its inner controls never open it. */

const world = {
  id: 'w1',
  name: 'Drowned Coast',
  description: 'A coastal town.',
  kind: 'world',
  author: { id: 'u1', username: 'wren_hallow' },
  tags: [],
  downloads: 7,
  comment_count: 2,
  likes: 3,
} as unknown as WorldRecord;

const setup = () => {
  const onView = vi.fn();
  const onHideWorld = vi.fn();
  const onContextualDownload = vi.fn();
  render(
    <RemoteWorldCard
      world={world}
      downloadState="none"
      downloadProgress={undefined}
      isAuthenticated
      currentUser={{ id: 'me', username: 'reader' } as unknown as WorldRecord}
      onView={onView}
      onHideWorld={onHideWorld}
      onContextualDownload={onContextualDownload}
    />,
  );
  return { onView, onHideWorld, onContextualDownload };
};

const openButton = () => screen.getByRole('button', { name: 'Drowned Coast' });

afterEach(cleanup);

describe('a clipped name', () => {
  it('anchors its tip on the open button, which has a box, not on the heading around it', () => {
    // jsdom lays nothing out; a tall scroll height past a small line height reads as a clipped name.
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(500);
    const realStyle = window.getComputedStyle.bind(window);
    const style = vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const computed = realStyle(el);
      return new Proxy(computed, { get: (target, key) => (key === 'lineHeight' ? '20px' : Reflect.get(target, key)) });
    });
    try {
      setup();
      expect(openButton().hasAttribute('data-base-ui-tooltip-trigger')).toBe(true);
      expect(openButton().closest('h3')?.hasAttribute('data-base-ui-tooltip-trigger')).toBe(false);
    } finally {
      scroll.mockRestore();
      style.mockRestore();
    }
  });
});

describe('opening a card from the keyboard', () => {
  it('names the open button for the listing', () => {
    setup();
    expect(openButton()).toBeTruthy();
  });

  it('reaches the open button with Tab', async () => {
    setup();
    const user = userEvent.setup();
    // The hover actions come first in the tab order; Tab until the open button has focus.
    for (let i = 0; i < 6 && document.activeElement !== openButton(); i++) await user.tab();
    expect(document.activeElement).toBe(openButton());
  });

  it('opens once on Enter', async () => {
    const { onView } = setup();
    const user = userEvent.setup();
    openButton().focus();
    await user.keyboard('{Enter}');
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledWith(world);
  });

  it('opens once on Space', async () => {
    const { onView } = setup();
    const user = userEvent.setup();
    openButton().focus();
    await user.keyboard(' ');
    expect(onView).toHaveBeenCalledTimes(1);
  });
});

describe('clicking a card', () => {
  it('opens from the description, away from any control', () => {
    const { onView } = setup();
    fireEvent.click(screen.getByText('A coastal town.'));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('keeps hide and download from opening the card', () => {
    const { onView, onHideWorld, onContextualDownload } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Download this world' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide this world' }));
    expect(onContextualDownload).toHaveBeenCalledTimes(1);
    expect(onHideWorld).toHaveBeenCalledTimes(1);
    expect(onView).not.toHaveBeenCalled();
  });
});

describe('card structure', () => {
  it('nests no button inside another', () => {
    setup();
    expect(document.querySelectorAll('button button, a button, button a')).toHaveLength(0);
  });
});
