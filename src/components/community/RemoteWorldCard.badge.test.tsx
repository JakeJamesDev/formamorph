import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail: () => <div data-testid="thumb" /> }));

/**
 * A catalog card says who published it, and the badge is part of who they are. Without it, somebody on
 * the team is badged on their feedback replies and anonymous on their own listings.
 */

const world = (authorOver: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1',
  name: 'Sedge Landing',
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'u1', username: 'wren_hallow', ...authorOver },
  tags: [],
  downloads: 0,
  comment_count: 0,
}) as unknown as WorldRecord;

const show = (record: WorldRecord) =>
  render(
    <RemoteWorldCard
      world={record}
      downloadState="none"
      downloadProgress={undefined}
      isAuthenticated={false}
      currentUser={null}
      onView={() => {}}
      onHideWorld={() => {}}
      onHideAuthor={() => {}}
      onHideTag={() => {}}
      onContextualDownload={() => {}}
      onDelete={() => {}}
    />
  );

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a catalog card’s author', () => {
  it('wears their badge beside the byline', () => {
    show(world({ role: 'mod' }));

    expect(screen.getByText('Mod')).toBeTruthy();
  });

  it('tells the three roles apart', () => {
    show(world({ role: 'dev' }));

    expect(screen.getByText('Dev')).toBeTruthy();
  });

  it('wears none when the author is an ordinary account', () => {
    show(world({ role: null }));

    expect(screen.queryByText(/^(Mod|Dev|Admin)$/)).toBeNull();
  });

  it('wears none when the server sent no role at all', () => {
    // A client talking to an older server should read as "no badge", never as a broken one.
    show(world());

    expect(screen.queryByText(/^(Mod|Dev|Admin)$/)).toBeNull();
  });
});
