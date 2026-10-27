import type { ReactElement } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { UserProfileContext } from '@/contexts/userProfileStore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackThreadView } from './FeedbackThreadView';
import FeedbackService from '@/services/FeedbackService';
import AuthService from '@/services/AuthService';
import { WEBSITE_FEEDBACK_CAPABILITIES } from '@/lib/feedbackCapabilities';
import { toastFeedbackNotify } from '@/lib/feedbackToast';
import type { FeedbackComment, FeedbackDetail, FeedbackLinkTarget, FeedbackThread } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// jsdom can't drive a real Lexical selection; the editor is a textarea here. The markdown is the real renderer.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const thread = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: 'uuid-1',
  number: 1,
  type: 'suggestion',
  title: 'Darker map tiles',
  category: 'interface',
  body: 'Plain text.',
  status: 'open',
  reporter: { id: 'u2', username: 'rowan' },
  diagnostics: {},
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  locked: false,
  votes: 0,
  voted: false,
  unread: false,
  ...over,
});

const comment = (body: string, targets: FeedbackLinkTarget[]): FeedbackComment => ({
  id: 'c1', body, targets, createdAt: '2026-07-01T01:00:00.000Z', editedAt: null, author: { id: 'u3', username: 'wren' },
});

const PLANNED: FeedbackLinkTarget = { kind: 'thread', ref: '7', available: true, number: 7, title: 'Pin a stat to the panel', type: 'suggestion', status: 'planned' };
const BUG: FeedbackLinkTarget = { kind: 'thread', ref: '9', available: true, number: 9, title: 'Map stops panning', type: 'bug', status: 'confirmed' };
const MISSING: FeedbackLinkTarget = { kind: 'thread', ref: '57', available: false };

/** Serve each thread by number, as the server's read does, and by UUID. */
const serve = (...details: FeedbackDetail[]) =>
  vi.spyOn(FeedbackService, 'fetchThread').mockImplementation(async (id) => {
    const found = details.find(({ thread: t }) => t.id === id || String(t.number) === id);
    if (!found) throw new Error('Not found');
    return found;
  });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u1', username: 'morgan' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('thread links in the app', () => {
  it('shows the thread number beside the title', async () => {
    serve({ thread: thread({ number: 23 }), comments: [] });

    render(<FeedbackThreadView threadId="23" onBack={() => {}} notify={toastFeedbackNotify} />);

    const heading = await screen.findByRole('heading', { name: /Darker map tiles/ });
    expect(heading).toHaveTextContent('Darker map tiles #23');
  });

  it('draws #N and a pasted thread URL as titled chips, and a missing thread as the unavailable form', async () => {
    serve({
      thread: thread({ body: 'See #7, and the bug https://formamorph.ai/feedback/9.', targets: [PLANNED, BUG] }),
      comments: [comment('Also #57.', [MISSING])],
    });

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);

    const planned = await screen.findByRole('link', { name: /Pin a stat to the panel/ });
    expect(planned).toHaveTextContent('7Pin a stat to the panel');
    expect(planned).toHaveAttribute('href', 'https://formamorph.ai/feedback/7');
    expect(within(planned).getByRole('img', { name: 'Planned' })).toBeInTheDocument();
    // The website never serves a bug, so the app's bug chip carries no address and opens only in place.
    expect(screen.queryByRole('link', { name: /Map stops panning/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Map stops panning/ })).not.toHaveAttribute('href');
    expect(screen.queryByText(/formamorph\.ai\/feedback\/9/)).not.toBeInTheDocument();

    expect(screen.getByText('57 · Unavailable thread')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Unavailable/ })).not.toBeInTheDocument();
  });

  it('opens a bug chip in this view on a click', async () => {
    serve({ thread: thread({ body: 'See #9.', targets: [BUG] }), comments: [] });
    const onOpen = vi.fn();

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} onOpenThread={onOpen} />);

    fireEvent.click(await screen.findByRole('button', { name: /Map stops panning/ }));
    expect(onOpen).toHaveBeenCalledWith(9);
  });

  it('draws a markdown link to a thread as the chip, dropping its own text', async () => {
    serve({ thread: thread({ body: 'Read [this one](https://formamorph.ai/feedback/7) first.', targets: [PLANNED] }), comments: [] });

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);

    expect(await screen.findByRole('link', { name: /Pin a stat to the panel/ })).toBeInTheDocument();
    expect(screen.queryByText('this one')).not.toBeInTheDocument();
  });

  it('links #N in text that also holds an escape', async () => {
    serve({ thread: thread({ body: 'A \\*literal\\* star, then #7.', targets: [PLANNED] }), comments: [] });

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);

    expect(await screen.findByRole('link', { name: /Pin a stat to the panel/ })).toBeInTheDocument();
    expect(screen.getByText(/A \*literal\* star, then/)).toBeInTheDocument();
  });

  it('keeps #N plain inside the text of another link', async () => {
    serve({ thread: thread({ body: 'Read [notes on #7](https://example.com/notes).', targets: [PLANNED] }), comments: [] });

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);

    expect(await screen.findByText('notes on #7')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pin a stat/ })).not.toBeInTheDocument();
  });

  it('keeps #N plain inside a code span and a code block', async () => {
    serve({ thread: thread({ body: 'Type `#7` like this:\n\n```\n#7\n```\n\nThen #7.', targets: [PLANNED] }), comments: [] });

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);

    await screen.findByRole('link', { name: /Pin a stat to the panel/ });
    expect(screen.getAllByRole('link', { name: /Pin a stat/ })).toHaveLength(1);
    expect(screen.getByText('#7', { selector: 'code' })).toBeInTheDocument();
  });

  it('opens a linked thread in the same view, and writes to it by its UUID', async () => {
    serve(
      { thread: thread({ body: 'See #7.', targets: [PLANNED] }), comments: [] },
      { thread: thread({ id: 'uuid-7', number: 7, title: 'Pin a stat to the panel', status: 'planned' }), comments: [] },
    );
    const send = vi.spyOn(FeedbackService, 'comment').mockResolvedValue(comment('Agreed.', []));

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);
    fireEvent.click(await screen.findByRole('link', { name: /Pin a stat to the panel/ }));

    expect(await screen.findByRole('heading', { name: /Pin a stat to the panel #7/ })).toBeInTheDocument();
    expect(FeedbackService.fetchThread).toHaveBeenLastCalledWith('7');

    fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'Agreed.' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Reply/ }));
    expect(send).toHaveBeenCalledWith('uuid-7', 'Agreed.');
  });

  it('leaves a modified click to the browser', async () => {
    serve({ thread: thread({ body: 'See #7.', targets: [PLANNED] }), comments: [] });

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);
    const link = await screen.findByRole('link', { name: /Pin a stat to the panel/ });

    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(FeedbackService.fetchThread).toHaveBeenCalledTimes(1);
  });
});

const LISTING: FeedbackLinkTarget = {
  kind: 'listing', ref: 'world/w1', available: true, listingKind: 'world', id: 'w1', title: 'Brinewell Harbor', thumbnailUrl: '/api/thumbs/w1.webp',
};
const GONE: FeedbackLinkTarget = { kind: 'listing', ref: 'entity/e9', available: false };
const LISTING_URL = 'https://formamorph.ai/community/world/w1';

describe('listing links', () => {
  it('draws a pasted listing URL as a chip with title, kind and thumbnail, and a taken-down one as the unavailable form', async () => {
    serve({
      thread: thread({ body: `Try ${LISTING_URL} first.`, targets: [LISTING] }),
      comments: [comment('Gone: https://formamorph.ai/community/entity/e9', [GONE])],
    });

    const { container } = render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);

    const chipLink = await screen.findByRole('link', { name: /Brinewell Harbor/ });
    expect(chipLink).toHaveTextContent('Brinewell HarborWorld');
    expect(chipLink).toHaveAttribute('href', LISTING_URL);
    expect(container.querySelector('img')).toHaveAttribute('src', expect.stringContaining('/api/thumbs/w1.webp'));
    expect(screen.queryByText(LISTING_URL)).not.toBeInTheDocument();

    expect(screen.getByText('Unavailable listing')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Unavailable/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/entity\/e9|community\/entity/)).not.toBeInTheDocument();
  });

  it('opens the listing in the app catalog on a plain click, and leaves a modified click to the browser', async () => {
    serve({ thread: thread({ body: LISTING_URL, targets: [LISTING] }), comments: [] });
    const open = vi.fn();

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} onOpenListing={open} />);
    const link = await screen.findByRole('link', { name: /Brinewell Harbor/ });

    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(open).not.toHaveBeenCalled();

    fireEvent.click(link);
    expect(open).toHaveBeenCalledWith({ kind: 'world', id: 'w1' });
  });

  it('opens a new tab at the site address when no catalog browser is there', async () => {
    serve({ thread: thread({ body: LISTING_URL, targets: [LISTING] }), comments: [] });

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);

    expect(await screen.findByRole('link', { name: /Brinewell Harbor/ })).toHaveAttribute('target', '_blank');
  });

  it('follows the site route in place on the website', async () => {
    serve({ thread: thread({ body: LISTING_URL, targets: [LISTING] }), comments: [] });

    render(
      <FeedbackThreadView
        threadId="1"
        onBack={() => {}}
        notify={toastFeedbackNotify}
        capabilities={WEBSITE_FEEDBACK_CAPABILITIES}
        listingHref={({ kind, id }) => `/community/${kind}/${id}`}
      />,
    );

    const link = await screen.findByRole('link', { name: /Brinewell Harbor/ });
    expect(link).toHaveAttribute('href', '/community/world/w1');
    expect(link).not.toHaveAttribute('target');
  });

  it('keeps a listing URL plain inside code', async () => {
    serve({ thread: thread({ body: `Paste \`${LISTING_URL}\` like this.`, targets: [LISTING] }), comments: [] });

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);

    expect(await screen.findByText(LISTING_URL, { selector: 'code' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Brinewell Harbor/ })).not.toBeInTheDocument();
  });

  it('shows the kind icon when the thumbnail fails to load', async () => {
    serve({ thread: thread({ body: LISTING_URL, targets: [LISTING] }), comments: [] });

    const { container } = render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);
    await screen.findByRole('link', { name: /Brinewell Harbor/ });
    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('link', { name: /Brinewell Harbor/ }).querySelector('svg')).not.toBeNull();
  });
});

const LANTERN: FeedbackLinkTarget = { kind: 'user', ref: 'lantern_keeper', available: true, id: 'u9', username: 'Lantern_Keeper', avatarUrl: null };
const GHOST: FeedbackLinkTarget = { kind: 'user', ref: 'ghost_typo', available: false };

const withProfiles = (openProfile: () => void, ui: ReactElement) => (
  <UserProfileContext.Provider value={{ openProfile, setListingOpener: () => {} }}>{ui}</UserProfileContext.Provider>
);

describe('user links', () => {
  const body = 'Thanks @lantern_keeper, and @ghost_typo too.';

  it.each([
    ['the app', {}],
    ['the website', { capabilities: WEBSITE_FEEDBACK_CAPABILITIES, profileHref: (name: string) => `/u/${name}` }],
  ])('draws a resolved mention as a user chip and an unavailable one without the typed name in %s', async (_, props) => {
    serve({ thread: thread({ body, targets: [LANTERN, GHOST] }), comments: [] });

    const { container } = render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} {...props} />);

    const user = await screen.findByRole('link', { name: /Lantern_Keeper/ });
    expect(user).toHaveTextContent('Lantern_Keeper');
    expect(user.getAttribute('href')).toMatch(/\/u\/Lantern_Keeper$/);
    expect(screen.getByText('Unknown user')).toBeInTheDocument();
    expect(container.innerHTML.toLowerCase()).not.toContain('ghost_typo');
    expect(container.innerHTML).not.toContain('@lantern_keeper');
  });

  it('shows the stored name on a spaced account’s chip and links its underscore form', async () => {
    const jake: FeedbackLinkTarget = { kind: 'user', ref: 'jake_james', available: true, id: 'u7', username: 'Jake James', avatarUrl: null };
    serve({ thread: thread({ body: 'Thanks @Jake_James.', targets: [jake] }), comments: [] });

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);

    const chip = await screen.findByRole('link', { name: /Jake James/ });
    expect(chip).toHaveTextContent('Jake James');
    expect(chip.getAttribute('href')).toMatch(/\/u\/Jake_James$/);
  });

  it('opens the profile on a plain click and leaves a modified click to the browser', async () => {
    serve({ thread: thread({ body, targets: [LANTERN, GHOST] }), comments: [] });
    const openProfile = vi.fn();

    render(withProfiles(openProfile, <FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />));
    const user = await screen.findByRole('link', { name: /Lantern_Keeper/ });

    expect(fireEvent.click(user, { ctrlKey: true })).toBe(true);
    expect(openProfile).not.toHaveBeenCalled();

    fireEvent.click(user);
    expect(openProfile).toHaveBeenCalledWith('u9', 'Lantern_Keeper');
  });

  it('keeps @name plain in a code span', async () => {
    serve({ thread: thread({ body: 'Type `@lantern_keeper`.', targets: [LANTERN] }), comments: [] });

    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);

    expect(await screen.findByText('@lantern_keeper', { selector: 'code' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Lantern_Keeper/ })).not.toBeInTheDocument();
  });
});

describe('thread links on the website', () => {
  it('opens a pasted thread URL at the site route, and shows a bug as unavailable', async () => {
    serve({ thread: thread({ body: 'See https://formamorph.ai/feedback/7 and #9.', targets: [PLANNED, BUG] }), comments: [] });
    const open = vi.fn();

    render(
      <FeedbackThreadView
        threadId="1"
        onBack={() => {}}
        notify={toastFeedbackNotify}
        capabilities={WEBSITE_FEEDBACK_CAPABILITIES}
        onOpenThread={open}
        threadHref={(n) => `/feedback/${n}`}
      />,
    );

    const planned = await screen.findByRole('link', { name: /Pin a stat to the panel/ });
    expect(planned).toHaveAttribute('href', '/feedback/7');
    expect(screen.getByText('9 · Unavailable thread')).toBeInTheDocument();
    expect(screen.queryByText(/Map stops panning/)).not.toBeInTheDocument();

    fireEvent.click(planned);
    expect(open).toHaveBeenCalledWith(7);
  });
});
