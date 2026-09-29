import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
const { CachedThumbnail } = vi.hoisted(() => ({
  CachedThumbnail: vi.fn(({ file }: { file: string }) => <img data-testid="thumb" alt="" data-file={file} />),
}));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail }));

/** An entity or Avatar listing the server stored its stand-in silhouette for draws Morph art and never asks for that file. */

const listing = (over: Record<string, unknown>): WorldRecord => ({
  id: 'listing-1',
  name: 'Wren Hallow',
  kind: 'entity',
  thumbnail_file: 'stand-in.png',
  author: { id: 'u1', username: 'sedge_reader' },
  tags: [],
  ...over,
}) as unknown as WorldRecord;

const show = (over: Record<string, unknown>) =>
  render(
    <RemoteWorldCard
      world={listing(over)}
      downloadState="none"
      downloadProgress={undefined}
      isAuthenticated={false}
      currentUser={null}
      onView={() => {}}
    />
  );

afterEach(() => {
  cleanup();
  CachedThumbnail.mockClear();
});

describe('RemoteWorldCard art', () => {
  it('draws Morph art for a flagged entity and requests no thumbnail', () => {
    const { container } = show({ placeholder: true });
    expect(container.querySelector('[data-morph-art]')).not.toBeNull();
    expect(CachedThumbnail).not.toHaveBeenCalled();
  });

  it('shows the stored image of an entity that is not flagged', () => {
    const { container, getByTestId } = show({ placeholder: false });
    expect(getByTestId('thumb').dataset.file).toBe('stand-in.png');
    expect(container.querySelector('[data-morph-art]')).toBeNull();
  });

  it('draws Morph art for a flagged avatar and requests no thumbnail', () => {
    const { container } = show({ kind: 'model', placeholder: true });
    expect(container.querySelector('[data-morph-art]')).not.toBeNull();
    expect(CachedThumbnail).not.toHaveBeenCalled();
  });

  it('draws Morph art for an avatar with no thumbnail file', () => {
    const { container } = show({ kind: 'model', thumbnail_file: null });
    expect(container.querySelector('[data-morph-art]')).not.toBeNull();
  });

  it('shows the art of an avatar that is not flagged', () => {
    const { container, getByTestId } = show({ kind: 'model', placeholder: false });
    expect(getByTestId('thumb').dataset.file).toBe('stand-in.png');
    expect(container.querySelector('[data-morph-art]')).toBeNull();
  });
});
