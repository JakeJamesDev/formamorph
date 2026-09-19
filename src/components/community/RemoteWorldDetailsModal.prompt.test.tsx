// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import { type WorldRecord } from '@/components/WorldDetails';

const thumbnails = vi.hoisted(() => ({ asked: [] as (string | null | undefined)[] }));

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({
  useCachedThumbnail: (file: string | null | undefined) => {
    thumbnails.asked.push(file);
    return { src: file ? 'blob:thumb' : '' };
  },
}));
vi.mock('@/lib/useReportsEnabled', () => ({ useReportsEnabled: () => true }));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, ariaLabel }: { value: string; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly />
  ),
}));

/**
 * What a prompt listing's details tell a player deciding whether to take it: what it is, who wrote it,
 * which models it fits, and which app version it was made for.
 */

const listing = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'p1',
  name: 'Slow Burn',
  description: 'Tuned for small models.',
  kind: 'prompt',
  author: { id: 'author-1', username: 'wren_hallow' },
  tags: ['slow burn', 'romance'],
  models: ['Cydonia-24B', 'Mistral-Nemo'],
  app_version: '2.0.3',
  // The server's stand-in cover art, which a prompt never shows.
  thumbnail_file: 'placeholder-prompt.png',
  downloads: 7,
  likes: 3,
  liked: false,
  ...over,
}) as unknown as WorldRecord;

const show = (props: Record<string, unknown> = {}) =>
  render(
    <RemoteWorldDetailsModal
      open
      onOpenChange={() => {}}
      world={listing()}
      collapsed={false}
      onToggleCollapsed={() => {}}
      isAuthenticated
      openImageViewer={() => {}}
      downloadStateForWorld={() => 'none'}
      downloadProgress={{}}
      currentUser={{ id: 'reader-1', username: 'reader-1' } as unknown as WorldRecord}
      {...props}
    />
  );

beforeEach(() => {
  thumbnails.asked = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true, data: [], pagination: {}, total: 0,
  });
  vi.spyOn(WorldStorageService, 'fetchListingDetails').mockResolvedValue({ changelog: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a prompt listing’s details', () => {
  it('shows the description, tags, models, and author', async () => {
    show();

    expect(await screen.findByText('Tuned for small models.')).toBeInTheDocument();
    expect(screen.getByText('slow burn')).toBeInTheDocument();
    expect(screen.getByText('wren_hallow')).toBeInTheDocument();

    const models = within(screen.getByRole('heading', { name: 'Models' }).parentElement!);
    expect(models.getByText('Cydonia-24B')).toBeInTheDocument();
    expect(models.getByText('Mistral-Nemo')).toBeInTheDocument();
  });

  it('says which app version the preset was made for', async () => {
    show();

    expect(await screen.findByText('Made for Formamorph 2.0.3')).toBeInTheDocument();
  });

  it('says nothing about a version the listing does not carry', async () => {
    show({ world: listing({ app_version: null }) });
    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalled());
    expect(screen.queryByText(/Made for Formamorph/)).not.toBeInTheDocument();

    cleanup();
    // An older server sends no field at all.
    show({ world: listing({ app_version: undefined }) });
    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Made for Formamorph/)).not.toBeInTheDocument();
  });

  it('wears the kind icon and never asks for the stand-in thumbnail', async () => {
    show();

    expect(await screen.findByRole('img', { name: 'Prompt' })).toBeInTheDocument();
    expect(thumbnails.asked.every((file) => !file)).toBe(true);
  });

  it('offers a like and a report, named for the kind', async () => {
    const onLike = vi.fn(async () => {});
    show({ onLike });

    await userEvent.click(await screen.findByRole('button', { name: /like/i }));
    expect(onLike).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), true);
    expect(screen.getByRole('button', { name: 'Report This Prompt' })).toBeInTheDocument();
  });

  it('draws no empty Models heading for a row that names no model', async () => {
    show({ world: listing({ models: [] }) });

    expect(await screen.findByText('Made for Formamorph 2.0.3')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Models' })).not.toBeInTheDocument();
  });

  it('leaves models and version off every other kind', async () => {
    show({ world: listing({ kind: 'world', models: [], app_version: null }) });

    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Models' })).not.toBeInTheDocument();
  });
});

describe('Use This Preset', () => {
  it('selects the downloaded preset', async () => {
    const onUse = vi.fn();
    show({ downloadStateForWorld: () => 'refresh', onContextualDownload: vi.fn(), presetUse: { active: false, onUse } });

    await userEvent.click(await screen.findByRole('button', { name: 'Use This Preset' }));
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('shows the active state when the preset is already selected', async () => {
    show({ downloadStateForWorld: () => 'refresh', onContextualDownload: vi.fn(), presetUse: { active: true, onUse: vi.fn() } });

    expect(await screen.findByRole('button', { name: 'Preset In Use' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Use This Preset' })).not.toBeInTheDocument();
  });

  it('is absent before the preset is downloaded', async () => {
    show();

    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Use This Preset|Preset In Use/ })).not.toBeInTheDocument();
  });
});
