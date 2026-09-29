import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail: () => <div data-testid="thumb" /> }));

/**
 * Character art is tall, so an entity sits beside its text with its name at the top of the art. The art's
 * hover actions then move to the bottom corner, clear of the name.
 */

const listing = (kind: string, description = 'A ferry keeper.'): WorldRecord => ({
  id: `${kind}-1`,
  name: 'Wren Hallow',
  description,
  kind,
  author: { id: 'u1', username: 'sedge_reader' },
  tags: [],
  downloads: 0,
  comment_count: 0,
}) as unknown as WorldRecord;

const show = (kind: string, description?: string) =>
  render(
    <RemoteWorldCard
      world={listing(kind, description)}
      downloadState="none"
      downloadProgress={undefined}
      isAuthenticated={false}
      currentUser={null}
      onView={() => {}}
      onHideWorld={() => {}}
      onContextualDownload={() => {}}
    />
  );

/** The card frame, the name's scrim, and the hover action cluster. */
const parts = () => {
  const name = screen.getByRole('heading', { name: 'Wren Hallow' });
  const frame = name.closest('[data-layout]') as HTMLElement;
  const scrim = name.closest('.absolute') as HTMLElement;
  const actions = screen.getByRole('button', { name: /Download this/ }).closest('.absolute') as HTMLElement;
  return { frame, scrim, actions };
};

afterEach(cleanup);

describe('RemoteWorldCard layout', () => {
  it('puts an entity beside its text, name at the top, actions at the bottom', () => {
    show('entity');
    const { frame, scrim, actions } = parts();
    expect(frame.dataset.layout).toBe('split');
    expect(scrim).toHaveClass('top-0');
    expect(actions).toHaveClass('bottom-1');
    expect(actions).not.toHaveClass('top-1');
  });

  it('puts an Avatar beside its text like an entity', () => {
    show('model');
    const { frame, scrim, actions } = parts();
    expect(frame.dataset.layout).toBe('split');
    expect(scrim).toHaveClass('top-0');
    expect(actions).toHaveClass('bottom-1');
  });

  it('keeps a world stacked, name at the bottom, actions at the top', () => {
    show('world');
    const { frame, scrim, actions } = parts();
    expect(frame.dataset.layout).toBe('stacked');
    expect(scrim).toHaveClass('bottom-0');
    expect(actions).toHaveClass('top-1');
  });
});

describe('RemoteWorldCard description line', () => {
  it('shows an Avatar’s credit line', () => {
    show('model', 'By Ada Reyes.');
    expect(screen.getByText('By Ada Reyes.')).toBeInTheDocument();
  });

  it('leaves an Avatar with no credit line without a description line', () => {
    show('model', '');
    expect(screen.queryByText('No description available.')).toBeNull();
  });

  it('keeps the stand-in line on an entity with no description', () => {
    show('entity', '');
    expect(screen.getByText('No description available.')).toBeInTheDocument();
  });
});

describe('RemoteWorldCard tag line', () => {
  it('leaves an Avatar without a tag line', () => {
    show('model');
    expect(screen.queryByText('No tags')).toBeNull();
  });

  it('keeps the no-tags line on an entity', () => {
    show('entity');
    expect(screen.getByText('No tags')).toBeInTheDocument();
  });
});
