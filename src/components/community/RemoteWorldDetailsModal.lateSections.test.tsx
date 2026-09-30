// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import type { ListingDetails } from '@/services/WorldStorageService';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useReportsEnabled', () => ({ useReportsEnabled: () => true }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, ariaLabel }: { value: string; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly />
  ),
}));

/**
 * Compatible Worlds arrives with the details answer. It sits last in the left column, so when it lands
 * nothing above it moves. A listing with no such section changes nothing at all.
 */

const component = (kind: string): WorldRecord => ({
  id: 'e1',
  _id: 'e1',
  name: 'Wren Hallow',
  description: 'A traveling cartographer.',
  kind,
  author: { id: 'author-1', username: 'alice' },
  tags: ['cozy'],
}) as unknown as WorldRecord;

const reader = { id: 'reader-1', username: 'reader-1', accountType: 'normal' } as unknown as WorldRecord;

/** The info column: description, meta, tags, then the late sections. */
const column = () => screen.getByTestId('details-meta').parentElement as HTMLElement;

/** Every block in the column except the late sections. */
const blocksAbove = () =>
  Array.from(column().children)
    .filter((el) => !/Compatible Worlds|Download installs/.test(el.textContent ?? ''))
    .map((el) => el.outerHTML);

let answer: (details: ListingDetails) => void;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true, data: [], pagination: {}, total: 0,
  });
  vi.spyOn(WorldStorageService, 'fetchDependencies').mockResolvedValue([]);
  vi.spyOn(WorldStorageService, 'fetchAddons').mockResolvedValue([]);
  vi.spyOn(WorldStorageService, 'readListingDetails').mockImplementation(
    () => new Promise((resolve) => { answer = (details) => resolve({ status: 'ok', details }); }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const show = (kind: string) =>
  render(
    <RemoteWorldDetailsModal
      open
      onOpenChange={() => {}}
      world={component(kind)}
      collapsed={false}
      onToggleCollapsed={() => {}}
      isAuthenticated
      openImageViewer={() => {}}
      downloadStateForWorld={() => 'none'}
      downloadProgress={{}}
      onContextualDownload={() => {}}
      currentUser={reader}
    />,
  );

// An entity draws its tags beside the art; a dictionary draws them in the column, above the late sections.
describe.each(['entity', 'dictionary'])('the left column of a %s when the details answer lands', (kind) => {
  beforeEach(() => { show(kind); });

  it('adds Compatible Worlds after everything else and moves nothing above it', async () => {
    await waitFor(() => expect(WorldStorageService.readListingDetails).toHaveBeenCalled());
    const before = blocksAbove();

    await act(async () => {
      answer({
        anonymousLikes: false,
        changelog: null,
        compatibleWorlds: [{ id: 'w1', name: 'Sedge Landing', reviewState: 'approved' }],
      });
    });

    const heading = await screen.findByText('Compatible Worlds');
    expect(blocksAbove()).toEqual(before);
    for (const above of [screen.getByRole('button', { name: /Report This/ }), screen.getByText('cozy')]) {
      expect(above.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(column().lastElementChild!.contains(heading)).toBe(true);
  });

  it('changes nothing for a listing with no late sections', async () => {
    await waitFor(() => expect(WorldStorageService.readListingDetails).toHaveBeenCalled());
    const before = column().innerHTML;

    await act(async () => { answer({ anonymousLikes: false, changelog: null, compatibleWorlds: [] }); });

    expect(screen.queryByText('Compatible Worlds')).toBeNull();
    expect(column().innerHTML).toBe(before);
  });
});
