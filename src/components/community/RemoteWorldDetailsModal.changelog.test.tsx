// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import { changelogOf, type ChangelogEntry } from '@/lib/listingChangelog';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));

// Rendered as its own text so a test can find an entry body by what it says, and marked so a test can
// tell the renderer apart from a plain paragraph.
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="markdown">{text}</div>,
}));

// jsdom can't drive a real Lexical selection; the editors are stubbed to textareas so they can be filled.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel, placeholder }: {
    value: string; onChange: (v: string) => void; ariaLabel?: string; placeholder?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

/**
 * The Listing Changelog where a reader meets it: the right panel of the community details window.
 *
 * Three rules are being held at once, and each has to read off the controls alone. Most listings have no
 * changelog and must look exactly as they always did. Their author still needs a way to start one, at the
 * place the result will appear. And a server that has never heard of any of this has to make the whole
 * feature vanish rather than break — the client and the community server ship separately.
 */

const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1',
  name: 'Sedge Landing',
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'author-1', username: 'wren_hallow' },
  tags: [],
  downloads: 7,
  likes: 3,
  ...over,
}) as unknown as WorldRecord;

const entry = (over: Partial<ChangelogEntry> = {}): ChangelogEntry => ({
  id: 'e1',
  world_id: 'w1',
  title: 'Update 1',
  body: 'The drowned quarter is walkable now.',
  entry_date: '2026-08-01',
  created_at: '2026-08-01T12:00:00.000Z',
  updated_at: '2026-08-01T12:00:00.000Z',
  ...over,
});

const account = (id: string) => ({ id, username: id, accountType: 'normal' }) as unknown as WorldRecord;

/**
 * Stand in for the service, faithfully: it answers through the same `changelogOf` the real one does, so
 * what the panel is handed is in the order the server's answer really arrives in. `null` is what an old
 * server's answer resolves to.
 */
const serveChangelog = (entries: ChangelogEntry[] | null) =>
  vi.spyOn(WorldStorageService, 'fetchChangelog')
    .mockResolvedValue(entries === null ? null : changelogOf({ changelog: entries }));

const show = (props: Record<string, unknown> = {}) =>
  render(
    <RemoteWorldDetailsModal
      open
      onOpenChange={() => {}}
      world={world()}
      collapsed={false}
      onToggleCollapsed={() => {}}
      isAuthenticated
      openImageViewer={() => {}}
      downloadStateForWorld={() => 'none'}
      downloadProgress={{}}
      onContextualDownload={() => {}}
      currentUser={account('reader-1')}
      {...props}
    />
  );

/** The author of the listing in `world()`, matched the way the modal matches them. */
const owner = () => ({ id: 'author-1', username: 'wren_hallow', accountType: 'normal' }) as unknown as WorldRecord;

const changelogTab = () => screen.queryByRole('radio', { name: 'Changelog' })
  ?? screen.queryByRole('button', { name: 'Changelog' });
const commentsTab = () => screen.queryByRole('radio', { name: 'Comments' })
  ?? screen.queryByRole('button', { name: 'Comments' });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true, data: [], pagination: {}, total: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('whether the switch is there at all', () => {
  it('is absent for a reader when the listing has no changelog', async () => {
    // Most listings. The panel has to look exactly as it did before any of this existed.
    serveChangelog([]);

    show();

    await waitFor(() => expect(WorldStorageService.fetchChangelog).toHaveBeenCalled());
    expect(changelogTab()).toBeNull();
    expect(commentsTab()).toBeNull();
    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
  });

  it('is there for a reader once the listing has one', async () => {
    serveChangelog([entry()]);

    show();

    expect(await screen.findByText('Changelog')).toBeInTheDocument();
  });

  it('is there for the listing owner even with nothing in it', async () => {
    // The entry point belongs where the result will appear, so an author with no history yet still finds
    // the door rather than having to publish an update to be offered one.
    serveChangelog([]);

    show({ currentUser: owner() });

    expect(await screen.findByText('Changelog')).toBeInTheDocument();
  });

  it('stays away entirely when the server does not keep changelogs', async () => {
    // An older community deploy. No tab, no error — the feature is simply not here.
    serveChangelog(null);

    show({ currentUser: owner() });

    await waitFor(() => expect(WorldStorageService.fetchChangelog).toHaveBeenCalled());
    expect(changelogTab()).toBeNull();
    expect(screen.queryByRole('button', { name: /add entry/i })).toBeNull();
  });
});

describe('which panel opens first', () => {
  it('opens on the changelog for a reader whose copy is out of date', async () => {
    serveChangelog([entry()]);

    show({ downloadStateForWorld: () => 'update' });

    expect(await screen.findByText('The drowned quarter is walkable now.')).toBeInTheDocument();
  });

  it('opens on comments for a reader whose copy is current', async () => {
    serveChangelog([entry()]);

    show({ downloadStateForWorld: () => 'refresh' });

    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
    expect(screen.queryByText('The drowned quarter is walkable now.')).toBeNull();
  });

  it('opens on comments for somebody who holds no copy at all', async () => {
    serveChangelog([entry()]);

    show({ downloadStateForWorld: () => 'none' });

    expect(await screen.findByText(/no comments yet/i)).toBeInTheDocument();
  });

  it('switches to the changelog when the reader asks for it', async () => {
    serveChangelog([entry()]);

    show();

    fireEvent.click(await screen.findByText('Changelog'));

    expect(await screen.findByText('The drowned quarter is walkable now.')).toBeInTheDocument();
  });
});

describe('reading the entries', () => {
  it('renders a body through the markdown renderer, not as a plain paragraph', async () => {
    serveChangelog([entry({ body: '**Drowned** and lovely.' })]);

    show({ downloadStateForWorld: () => 'update' });

    expect(await screen.findByText('**Drowned** and lovely.')).toHaveAttribute('data-testid', 'markdown');
  });

  it('lists them newest first', async () => {
    serveChangelog([
      entry({ id: 'old', title: 'The first one', entry_date: '2026-01-01' }),
      entry({ id: 'new', title: 'The latest one', entry_date: '2026-08-01' }),
    ]);

    show({ downloadStateForWorld: () => 'update' });

    const titles = (await screen.findAllByText(/The (first|latest) one/)).map((el) => el.textContent);
    expect(titles).toEqual(['The latest one', 'The first one']);
  });
});

describe('who may maintain it', () => {
  it('offers a reader no controls', async () => {
    serveChangelog([entry()]);

    show({ downloadStateForWorld: () => 'update' });

    await screen.findByText('The drowned quarter is walkable now.');
    expect(screen.queryByRole('button', { name: /add entry/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit update 1/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete update 1/i })).toBeNull();
  });

  it('gives the author add, edit and delete', async () => {
    serveChangelog([entry()]);

    show({ currentUser: owner(), downloadStateForWorld: () => 'update' });

    expect(await screen.findByRole('button', { name: /add entry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit update 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete update 1/i })).toBeInTheDocument();
  });

  it('writes a new entry into the panel where its date puts it, not at the end', async () => {
    // Backfilling is the case: dated between two entries already on screen, so appending and sorting
    // give different answers.
    serveChangelog([
      entry({ id: 'newest', title: 'Update 3', entry_date: '2026-08-05' }),
      entry({ id: 'oldest', title: 'Update 1', entry_date: '2026-01-01' }),
    ]);
    vi.spyOn(WorldStorageService, 'createChangelogEntry').mockResolvedValue(
      entry({ id: 'backfilled', title: 'Update 2', entry_date: '2026-04-01' }),
    );

    show({ currentUser: owner(), downloadStateForWorld: () => 'update' });

    fireEvent.click(await screen.findByRole('button', { name: /add entry/i }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Update 2' } });
    fireEvent.change(screen.getByLabelText('What changed'), { target: { value: 'The middle news.' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Entry' }));

    await waitFor(() => expect(WorldStorageService.createChangelogEntry).toHaveBeenCalledWith(
      'w1', { title: 'Update 2', body: 'The middle news.', date: '2026-04-01' },
    ));
    await waitFor(() => {
      const titles = screen.getAllByText(/^Update [123]$/).map((el) => el.textContent);
      expect(titles).toEqual(['Update 3', 'Update 2', 'Update 1']);
    });
  });

  it('opens an edit on the entry it was pressed for, its own date included', async () => {
    serveChangelog([entry({ title: 'Update 1', body: 'The old wording.', entry_date: '2026-01-09' })]);

    show({ currentUser: owner(), downloadStateForWorld: () => 'update' });

    fireEvent.click(await screen.findByRole('button', { name: /edit update 1/i }));

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Update 1');
    expect((screen.getByLabelText('What changed') as HTMLTextAreaElement).value).toBe('The old wording.');
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-01-09');
  });

  it('takes a deleted entry off the panel', async () => {
    serveChangelog([entry()]);
    vi.spyOn(WorldStorageService, 'deleteChangelogEntry').mockResolvedValue(undefined);

    show({ currentUser: owner(), downloadStateForWorld: () => 'update' });

    fireEvent.click(await screen.findByRole('button', { name: /delete update 1/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^continue$|^ok$|^delete$|^confirm$/i }));

    await waitFor(() => expect(WorldStorageService.deleteChangelogEntry).toHaveBeenCalledWith('w1', 'e1'));
    await waitFor(() => expect(screen.queryByText('The drowned quarter is walkable now.')).toBeNull());
  });
});
