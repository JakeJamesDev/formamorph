// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import { type WorldRecord } from '@/components/WorldDetails';
import { UserProfileContext } from '@/contexts/userProfileStore';
import { WEBSITE_COMMUNITY_CAPABILITIES } from '@/lib/communityBrowserCapabilities';
import WorldStorageService from '@/services/WorldStorageService';
import type { FeedbackLinkTarget } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));

// jsdom can't drive a real Lexical selection; the editor is a textarea here. The markdown is the real renderer.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel, placeholder }: {
    value: string; onChange: (v: string) => void; ariaLabel?: string; placeholder?: string;
  }) => (
    <textarea aria-label={ariaLabel} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const SUGGESTION: FeedbackLinkTarget = { kind: 'thread', ref: '7', available: true, number: 7, title: 'Pin a stat to the panel', type: 'suggestion', status: 'planned' };
const BUG: FeedbackLinkTarget = { kind: 'thread', ref: '9', available: true, number: 9, title: 'Map stops panning', type: 'bug', status: 'confirmed' };
const LISTING: FeedbackLinkTarget = { kind: 'listing', ref: 'world/w2', available: true, listingKind: 'world', id: 'w2', title: 'Harbor Lights', thumbnailUrl: '' };
const USER: FeedbackLinkTarget = { kind: 'user', ref: 'lantern_keeper', available: true, id: 'u9', username: 'Lantern_Keeper', avatarUrl: null };

const ALL_KINDS = 'Ask @lantern_keeper about #7, or see https://formamorph.ai/community/world/w2.';

const world = { id: 'w1', name: 'Sedge Landing', description: '', kind: 'world', author: { id: 'author-1', username: 'wren_hallow' }, tags: [], downloads: 0, comment_count: 1, likes: 0 } as unknown as WorldRecord;

const comment = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  content: ALL_KINDS,
  targets: [SUGGESTION, LISTING, USER],
  created_at: '2026-08-01T00:00:00.000Z',
  edited_at: null,
  author: { id: 'commenter-1', username: 'saltmarsh', role: null },
  ...over,
});

const list = (...comments: ReturnType<typeof comment>[]) =>
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true, data: comments, pagination: {}, total: comments.length,
  });

const show = (props: Record<string, unknown> = {}) => {
  const openProfile = vi.fn();
  render(
    <UserProfileContext.Provider value={{ openProfile, setListingOpener: () => {} }}>
      <RemoteWorldDetailsModal
        open
        onOpenChange={() => {}}
        world={world}
        collapsed={false}
        onToggleCollapsed={() => {}}
        isAuthenticated
        openImageViewer={() => {}}
        downloadStateForWorld={() => 'none'}
        downloadProgress={{}}
        onContextualDownload={() => {}}
        currentUser={{ id: 'commenter-1', username: 'saltmarsh', accountType: 'normal' } as unknown as WorldRecord}
        {...props}
      />
    </UserProfileContext.Provider>,
  );
  return { openProfile };
};

const SITE = { capabilities: WEBSITE_COMMUNITY_CAPABILITIES, onContextualDownload: undefined };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('chips in a listing comment, in the app', () => {
  it('draws all three kinds with their titles and website addresses', async () => {
    list(comment());
    show();

    const thread = await screen.findByRole('link', { name: /Pin a stat to the panel/ });
    expect(thread).toHaveAttribute('href', 'https://formamorph.ai/feedback/7');
    expect(screen.getByRole('link', { name: /Harbor Lights/ })).toHaveAttribute('href', 'https://formamorph.ai/community/world/w2');
    expect(screen.getByRole('link', { name: /Lantern_Keeper/ })).toHaveAttribute('href', 'https://formamorph.ai/u/Lantern_Keeper');
  });

  it('draws the Unknown user form and both unavailable forms, without the typed name or address', async () => {
    list(comment({
      content: 'Ask @nobody_here about #57 or https://formamorph.ai/community/world/gone.',
      targets: [
        { kind: 'user', ref: 'nobody_here', available: false },
        { kind: 'thread', ref: '57', available: false },
        { kind: 'listing', ref: 'world/gone', available: false },
      ],
    }));
    show();

    expect(await screen.findByText('Unknown user')).toBeInTheDocument();
    expect(screen.getByText('57 · Unavailable thread')).toBeInTheDocument();
    expect(screen.getByText('Unavailable listing')).toBeInTheDocument();
    expect(screen.queryByText(/nobody_here/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Unavailable|Unknown/ })).not.toBeInTheDocument();
  });

  it('draws a bug thread as a focusable button, since it has no address', async () => {
    list(comment({ content: 'See #9.', targets: [BUG] }));
    show();

    expect(await screen.findByRole('button', { name: /Map stops panning/ })).not.toHaveAttribute('href');
  });

  it('opens a thread chip in place, so its address carries no new-tab target', async () => {
    list(comment());
    show();

    expect(await screen.findByRole('link', { name: /Pin a stat to the panel/ })).not.toHaveAttribute('target');
  });

  it('opens a listing through the modal on a plain click, and leaves a modified click to the browser', async () => {
    const user = userEvent.setup();
    const onOpenListing = vi.fn();
    list(comment());
    show({ onOpenListing });
    const chip = await screen.findByRole('link', { name: /Harbor Lights/ });
    const prevented = vi.fn();
    const watch = (event: Event) => { prevented(event.defaultPrevented); event.preventDefault(); };
    window.addEventListener('click', watch);

    await user.keyboard('{Control>}');
    await user.click(chip);
    await user.keyboard('{/Control}');
    expect(onOpenListing).not.toHaveBeenCalled();
    expect(prevented).toHaveBeenLastCalledWith(false);

    await user.click(chip);
    window.removeEventListener('click', watch);
    expect(onOpenListing).toHaveBeenCalledWith({ kind: 'world', id: 'w2' });
    expect(prevented).toHaveBeenLastCalledWith(true);
  });

  it('opens the profile on a plain click on a user chip', async () => {
    const user = userEvent.setup();
    list(comment());
    const { openProfile } = show();

    await user.click(await screen.findByRole('link', { name: /Lantern_Keeper/ }));

    expect(openProfile).toHaveBeenCalledWith('u9', 'Lantern_Keeper');
  });
});

describe('chips in a listing comment, on the website', () => {
  it('draws chips with site addresses that stay in this tab', async () => {
    list(comment());
    show(SITE);

    const thread = await screen.findByRole('link', { name: /Pin a stat to the panel/ });
    const listing = screen.getByRole('link', { name: /Harbor Lights/ });
    expect(thread).toHaveAttribute('href', '/feedback/7');
    expect(thread).not.toHaveAttribute('target');
    expect(listing).toHaveAttribute('href', '/community/world/w2');
    expect(listing).not.toHaveAttribute('target');
    expect(screen.getByRole('link', { name: /Lantern_Keeper/ })).toHaveAttribute('href', '/u/Lantern_Keeper');
  });

  it('shows a bug thread as Unavailable thread', async () => {
    list(comment({ content: 'See #9.', targets: [BUG] }));
    show(SITE);

    expect(await screen.findByText('9 · Unavailable thread')).toBeInTheDocument();
    expect(screen.queryByText(/Map stops panning/)).not.toBeInTheDocument();
  });

  it('leaves a listing chip to its address, even with an opener on the modal', async () => {
    const user = userEvent.setup();
    const onOpenListing = vi.fn();
    list(comment());
    show({ ...SITE, onOpenListing });
    const watch = (event: Event) => event.preventDefault();
    window.addEventListener('click', watch);

    await user.click(await screen.findByRole('link', { name: /Harbor Lights/ }));
    window.removeEventListener('click', watch);

    expect(onOpenListing).not.toHaveBeenCalled();
  });

  it('opens the profile on a plain click on a user chip', async () => {
    const user = userEvent.setup();
    list(comment());
    const { openProfile } = show(SITE);

    await user.click(await screen.findByRole('link', { name: /Lantern_Keeper/ }));

    expect(openProfile).toHaveBeenCalledWith('u9', 'Lantern_Keeper');
  });
});

describe('a comment from a server with no targets', () => {
  it('shows its links as typed, with no unavailable form', async () => {
    list(comment({ content: 'Ask @lantern_keeper about #7.', targets: undefined }));
    show();

    expect(await screen.findByText(/Ask @lantern_keeper about #7\./)).toBeInTheDocument();
    expect(screen.queryByText('Unknown user')).not.toBeInTheDocument();
    expect(screen.queryByText(/Unavailable/)).not.toBeInTheDocument();
  });

  it('still draws Unknown user when the server resolved the comment and found nobody', async () => {
    list(comment({ content: 'Ask @lantern_keeper.', targets: [] }));
    show();

    expect(await screen.findByText('Unknown user')).toBeInTheDocument();
  });
});

describe('a comment just written', () => {
  it('draws chips from the post response, with no second read', async () => {
    const user = userEvent.setup();
    const read = list();
    vi.spyOn(WorldStorageService, 'postComment').mockResolvedValue(comment({ content: 'Ask @lantern_keeper.', targets: [USER] }));
    show();
    await screen.findByText('No comments yet.');

    await user.type(screen.getByRole('textbox', { name: 'Comment' }), 'Ask @lantern_keeper.');
    await user.click(screen.getByRole('button', { name: 'Post Comment' }));

    expect(await screen.findByRole('link', { name: /Lantern_Keeper/ })).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('draws chips from the edit response, with no second read', async () => {
    const user = userEvent.setup();
    const read = list(comment({ content: 'A plain note.', targets: [] }));
    vi.spyOn(WorldStorageService, 'updateComment').mockResolvedValue(comment({ content: 'See #7.', targets: [SUGGESTION], edited_at: '2026-08-02T00:00:00.000Z' }));
    show();
    await screen.findByText('A plain note.');

    await user.click(screen.getByRole('button', { name: /edit comment/i }));
    const box = screen.getByRole('textbox', { name: 'Comment text' });
    await user.clear(box);
    await user.type(box, 'See #7.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('link', { name: /Pin a stat to the panel/ })).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
