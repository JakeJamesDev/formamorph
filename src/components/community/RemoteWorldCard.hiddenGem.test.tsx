import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail: () => <div data-testid="thumb" /> }));

// The catalog flag rides on the row either way: the badge follows the slot, not the flag.
const world = {
  id: 'w1', name: 'Sedge Landing', description: 'A drowned coastal town.', kind: 'world', hidden_gem: true,
  author: { id: 'u1', username: 'wren_hallow' }, tags: [], downloads: 0, comment_count: 0,
} as unknown as WorldRecord;

const show = (hiddenGem?: boolean) => render(
  <RemoteWorldCard
    world={world} downloadState="none" downloadProgress={undefined}
    isAuthenticated={false} currentUser={null} onView={() => {}} hiddenGem={hiddenGem}
  />,
);

afterEach(cleanup);

describe('the Hidden Gem badge', () => {
  it('shows on a card in a gem slot', () => {
    show(true);

    expect(screen.getByText('Hidden Gem')).toBeTruthy();
  });

  it('is absent on a flagged card outside a gem slot', () => {
    show();

    expect(screen.queryByText('Hidden Gem')).toBeNull();
  });
});
