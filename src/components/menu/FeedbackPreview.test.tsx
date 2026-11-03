import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical';
import { toast } from 'react-toastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PromptField from '@/components/prompt/PromptField';
import { UserProfileContext } from '@/contexts/userProfileStore';
import { plainVocabulary } from '@/lib/chipVocabulary';
import { APP_FEEDBACK_CAPABILITIES, WEBSITE_FEEDBACK_CAPABILITIES } from '@/lib/feedbackCapabilities';
import { toastFeedbackNotify } from '@/lib/feedbackToast';
import AuthService from '@/services/AuthService';
import FeedbackService from '@/services/FeedbackService';
import type { FeedbackLinkTarget, FeedbackThread } from '@/types';
import { FeedbackDialog } from './FeedbackDialog';
import { FeedbackEditDialog } from './FeedbackEditDialog';
import type { FeedbackLinkPlace } from '@/lib/feedbackLinks';
import { APP_FEEDBACK_LINK_PLACE, FeedbackLinkContext } from './FeedbackMarkdown';
import { FeedbackPreview, PREVIEW_LOOKUP_PAUSE_MS } from './FeedbackPreview';
import { FeedbackThreadView } from './FeedbackThreadView';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const WREN: FeedbackLinkTarget = { kind: 'user', ref: 'wren', available: true, id: 'u3', username: 'wren', avatarUrl: null };
const SUGGESTION: FeedbackLinkTarget = { kind: 'thread', ref: '7', available: true, number: 7, title: 'Pin a stat', type: 'suggestion', status: 'planned' };
const BUG: FeedbackLinkTarget = { kind: 'thread', ref: '9', available: true, number: 9, title: 'Map stops panning', type: 'bug', status: 'confirmed' };
const LISTING: FeedbackLinkTarget = { kind: 'listing', ref: 'world/w2', available: true, listingKind: 'world', id: 'w2', title: 'Brinewell', thumbnailUrl: '' };

const thread = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: 'uuid-1',
  number: 1,
  type: 'suggestion',
  title: 'Darker map tiles',
  category: 'interface',
  body: 'See @wren.',
  status: 'open',
  reporter: { id: 'u1', username: 'morgan' },
  diagnostics: {},
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  locked: false,
  votes: 0,
  voted: false,
  unread: false,
  ...over,
});

const resolving = (targets: FeedbackLinkTarget[] = [WREN]) => vi.spyOn(FeedbackService, 'resolveLinks').mockResolvedValue(targets);

/** A resolve for each call, settled by hand in any order. */
function heldResolves() {
  const held: { resolve: (targets: FeedbackLinkTarget[]) => void; reject: (error: unknown) => void; signal?: AbortSignal; text: string }[] = [];
  const mock = vi.spyOn(FeedbackService, 'resolveLinks').mockImplementation((text, signal) =>
    new Promise((resolve, reject) => { held.push({ resolve, reject, signal, text }); }));
  return { held, mock };
}

/** Puts text in a real editor. jsdom gives an empty Lexical editor no selection, so typing can't start one. */
function fill(name: string | HTMLElement, text: string) {
  const field = typeof name === 'string' ? screen.getByLabelText(name) : name;
  act(() => {
    (field as HTMLElement & { __lexicalEditor?: LexicalEditor }).__lexicalEditor?.update(() => {
      $getRoot().clear().append($createParagraphNode().append($createTextNode(text)));
    }, { discrete: true });
  });
}

const pastThePause = () => act(() => new Promise<void>((done) => { setTimeout(done, PREVIEW_LOOKUP_PAUSE_MS + 100); }));

const tab = (name: 'Edit' | 'Preview') => userEvent.setup().click(screen.getByRole('tab', { name }));
const pane = () => screen.getByTestId('prompt-preview');

function Box({ text }: { text: string }) {
  const [value, setValue] = useState(text);
  return <PromptField value={value} onChange={setValue} vocabulary={plainVocabulary()} markdown ariaLabel="Reply" markdownPreview={FeedbackPreview} />;
}

beforeEach(() => {
  // The new thread form stores its draft, and each test is a new player.
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u1', username: 'morgan' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(toast.error).mockClear();
});

describe('Preview in the feedback boxes', () => {
  const serve = (body = 'Plain.') => vi.spyOn(FeedbackService, 'fetchThread').mockResolvedValue({
    thread: thread({ body }),
    comments: [{ id: 'c1', body: 'Ask @wren.', targets: [WREN], createdAt: '2026-07-01T01:00:00.000Z', editedAt: null, author: { id: 'u1', username: 'morgan' } }],
  });

  it('draws chips in the reply box', async () => {
    serve();
    const resolve = resolving();
    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);
    await screen.findByLabelText('Reply');
    fill('Reply', 'Hello @wren');

    await tab('Preview');

    expect(await within(pane()).findByRole('link', { name: /wren/ })).toBeInTheDocument();
    expect(resolve).toHaveBeenCalledWith('Hello @wren', expect.any(AbortSignal));
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('draws chips in the comment edit box', async () => {
    serve();
    const resolve = resolving();
    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);
    fireEvent.click(await screen.findByRole('button', { name: /edit comment/i }));
    await screen.findByLabelText('Comment text');

    await userEvent.setup().click(screen.getAllByRole('tab', { name: 'Preview' })[0]);

    expect(await within(pane()).findByRole('link', { name: /wren/ })).toBeInTheDocument();
    expect(resolve).toHaveBeenCalledWith('Ask @wren.', expect.any(AbortSignal));
  });

  it('draws chips in the new thread box', async () => {
    const resolve = resolving();
    render(<FeedbackDialog open onOpenChange={() => {}} initialType="suggestion" initialBody="Ask @wren." notify={toastFeedbackNotify} />);

    await tab('Preview');

    const chip = await within(pane()).findByRole('link', { name: /wren/ });
    expect(chip).toHaveAttribute('href', 'https://formamorph.ai/u/wren');
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('uses relative addresses and the Votable boards in the website new thread box', async () => {
    resolving([SUGGESTION, BUG]);
    render(<FeedbackDialog open onOpenChange={() => {}} initialType="suggestion" initialBody="See #7 and #9." notify={toastFeedbackNotify} capabilities={WEBSITE_FEEDBACK_CAPABILITIES} />);

    await tab('Preview');

    const chip = await within(pane()).findByRole('link', { name: /Pin a stat/ });
    expect(chip).toHaveAttribute('href', '/feedback/7');
    expect(chip).toHaveAttribute('target', '_blank');
    expect(within(pane()).getByText('9 · Unavailable thread')).toBeInTheDocument();
  });

  it('keeps every board in the app new thread box', async () => {
    resolving([BUG]);
    render(<FeedbackDialog open onOpenChange={() => {}} initialType="suggestion" initialBody="See #9." notify={toastFeedbackNotify} capabilities={APP_FEEDBACK_CAPABILITIES} />);

    await tab('Preview');

    expect(await within(pane()).findByRole('button', { name: /Map stops panning/ })).toBeInTheDocument();
  });

  it('draws chips in the thread edit box', async () => {
    const resolve = resolving();
    render(<FeedbackEditDialog notify={toastFeedbackNotify} threadSearchTypes={null} open onOpenChange={() => {}} thread={thread()} mayEditProse mayRefile={false} onSaved={() => {}} />);

    await tab('Preview');

    expect(await within(pane()).findByRole('link', { name: /wren/ })).toBeInTheDocument();
    expect(resolve).toHaveBeenCalledWith('See @wren.', expect.any(AbortSignal));
  });
});

describe('the request', () => {
  it('shows plain markdown with no chip while the resolve is pending', async () => {
    heldResolves();
    render(<Box text={'**Bold** and @wren'} />);

    await tab('Preview');

    // Rendered, not raw: the asterisks are gone and the name stays as typed.
    expect(pane().textContent).toContain('Bold and @wren');
    expect(within(pane()).queryByText('Unknown user')).not.toBeInTheDocument();
  });

  it('stays plain after a failure, with no chip and no toast', async () => {
    const { held } = heldResolves();
    render(<Box text="Ask @wren" />);
    await tab('Preview');

    await act(async () => { held[0].reject(new Error('Too many requests')); });

    expect(pane()).toHaveTextContent('Ask @wren');
    expect(within(pane()).queryByText('Unknown user')).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('draws Unknown user once the server answers for a name with no account', async () => {
    resolving([{ kind: 'user', ref: 'wren', available: false }]);
    render(<Box text="Ask @wren" />);

    await tab('Preview');

    expect(await within(pane()).findByText('Unknown user')).toBeInTheDocument();
  });

  it('sends nothing for text with no links', async () => {
    const resolve = resolving();
    render(<Box text={'C# and a@b.com, with `@wren` in code'} />);

    await tab('Preview');

    expect(pane()).toHaveTextContent('C# and a@b.com');
    expect(resolve).not.toHaveBeenCalled();
  });

  it('resolves once per opening, not per render', async () => {
    const resolve = resolving();
    render(<Box text="Ask @wren" />);

    await tab('Preview');
    await within(pane()).findByRole('link', { name: /wren/ });
    expect(resolve).toHaveBeenCalledTimes(1);

    await tab('Edit');
    await tab('Preview');
    await within(pane()).findByRole('link', { name: /wren/ });
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('drops an older response that lands after the text changed and Preview reopened', async () => {
    const { held } = heldResolves();
    render(<Box text="Ask @wren" />);
    await tab('Preview');
    await tab('Edit');
    fill('Reply', 'Ask #7');
    await tab('Preview');
    expect(held.map((h) => h.text)).toEqual(['Ask @wren', 'Ask #7']);
    expect(held[0].signal?.aborted).toBe(true);

    // The newer answer first, so the older one is the last to land.
    await act(async () => { held[1].resolve([SUGGESTION]); });
    await act(async () => { held[0].resolve([WREN]); });

    expect(within(pane()).getByRole('link', { name: /Pin a stat/ })).toBeInTheDocument();
    expect(within(pane()).queryByRole('link', { name: /wren/ })).not.toBeInTheDocument();
  });

  it('drops an older response that lands before the newer one', async () => {
    const { held } = heldResolves();
    render(<Box text="Ask @wren" />);
    await tab('Preview');
    await tab('Edit');
    fill('Reply', 'Ask #7');
    await tab('Preview');

    await act(async () => { held[0].resolve([WREN]); });

    expect(pane()).toHaveTextContent('Ask #7');
    expect(within(pane()).queryByRole('link')).not.toBeInTheDocument();
    expect(within(pane()).queryByText(/Unavailable thread/)).not.toBeInTheDocument();
  });

  it('writes no state and sends nothing when the pane closes during a pause', async () => {
    const resolve = resolving();
    const field = (value: string) => <PromptField value={value} onChange={() => {}} vocabulary={plainVocabulary()} markdown ariaLabel="Reply" markdownPreview={FeedbackPreview} />;
    const { rerender, unmount } = render(field('Ask @wren'));
    await tab('Preview');
    await within(pane()).findByRole('link', { name: /wren/ });

    rerender(field('Ask @wren and @rowan now'));
    unmount();
    await pastThePause();

    expect(resolve).toHaveBeenCalledTimes(1);
  });
});

describe('text that changes under an open pane', () => {
  const ROWAN: FeedbackLinkTarget = { kind: 'user', ref: 'rowan', available: true, id: 'u4', username: 'rowan', avatarUrl: null };
  const field = (value: string) => <PromptField value={value} onChange={() => {}} vocabulary={plainVocabulary()} markdown ariaLabel="Reply" markdownPreview={FeedbackPreview} />;

  const openOn = async (text: string) => {
    const view = render(field(text));
    await tab('Preview');
    await within(pane()).findByRole('link', { name: /wren/ });
    return view;
  };

  it('keeps a known chip and leaves a link still being typed as typed', async () => {
    const resolve = resolving();
    const { rerender } = await openOn('Ask @wren');

    rerender(field('Ask @wren and @rowan'));
    await pastThePause();

    expect(pane()).toHaveTextContent('and @rowan');
    expect(within(pane()).getByRole('link', { name: /wren/ })).toBeInTheDocument();
    expect(within(pane()).queryByText('Unknown user')).not.toBeInTheDocument();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a space', 'Ask @wren and @rowan '],
    ['a period', 'Ask @wren and @rowan.'],
    ['a comma', 'Ask @wren and @rowan, please'],
  ])('asks for only the new link once %s ends it, after a pause', async (_, text) => {
    const resolve = resolving();
    const { rerender } = await openOn('Ask @wren');
    resolve.mockResolvedValue([ROWAN]);

    rerender(field(text));
    expect(resolve).toHaveBeenCalledTimes(1);

    expect(await within(pane()).findByRole('link', { name: /rowan/ })).toBeInTheDocument();
    expect(within(pane()).getByRole('link', { name: /wren/ })).toBeInTheDocument();
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve.mock.calls[1][0]).toBe('@rowan');
  });

  it('waits for the pause, so typing into a sentence asks once', async () => {
    const resolve = resolving();
    const { rerender } = await openOn('Ask @wren now');
    resolve.mockResolvedValue([ROWAN]);

    for (const name of ['@ro', '@row', '@rowa', '@rowan']) {
      rerender(field(`Ask ${name} @wren now`));
      await act(() => new Promise<void>((done) => { setTimeout(done, PREVIEW_LOOKUP_PAUSE_MS / 10); }));
    }
    await within(pane()).findByRole('link', { name: /rowan/ });

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve.mock.calls[1][0]).toBe('@rowan');
  });

  it('draws Unknown user for a finished name with no account', async () => {
    const resolve = resolving();
    const { rerender } = await openOn('Ask @wren');
    resolve.mockResolvedValue([{ kind: 'user', ref: 'rowan', available: false }]);

    rerender(field('Ask @wren and @rowan '));

    expect(await within(pane()).findByText('Unknown user')).toBeInTheDocument();
  });

  it('does not ask again for a link it knows', async () => {
    const resolve = resolving();
    const { rerender } = await openOn('Ask @wren');

    rerender(field('Ask @wren, and more text after it.'));
    await pastThePause();

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('leaves a failed link as typed, with no toast and no second try', async () => {
    const resolve = resolving();
    const { rerender } = await openOn('Ask @wren');
    resolve.mockRejectedValue(new Error('Too many requests'));

    rerender(field('Ask @wren and @rowan now'));
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(2));
    rerender(field('Ask @wren and @rowan now, and more'));
    await pastThePause();

    expect(pane()).toHaveTextContent('and @rowan now');
    expect(within(pane()).queryByText('Unknown user')).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('cancels at unmount and writes nothing when the answer lands later', async () => {
    const { held } = heldResolves();
    const { unmount } = render(<Box text="Ask @wren" />);
    await tab('Preview');
    const errors = vi.mocked(console.error);
    errors.mockClear();

    unmount();
    expect(held[0].signal?.aborted).toBe(true);
    await act(async () => { held[0].reject(new DOMException('Aborted', 'AbortError')); });

    expect(errors).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('stays quiet when the answer lands after the unmount', async () => {
    const { held } = heldResolves();
    const { unmount } = render(<Box text="Ask @wren" />);
    await tab('Preview');
    const errors = vi.mocked(console.error);
    errors.mockClear();

    unmount();
    await act(async () => { held[0].resolve([WREN]); });

    expect(errors).not.toHaveBeenCalled();
  });

  it('keeps the field’s own Preview with no opt-in', async () => {
    const resolve = resolving();
    render(<PromptField value="Ask @wren" onChange={() => {}} vocabulary={plainVocabulary()} markdown ariaLabel="Reply" />);

    await tab('Preview');

    expect(pane()).toHaveTextContent('Ask @wren');
    expect(within(pane()).queryByRole('link')).not.toBeInTheDocument();
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe('a plain click over a draft', () => {
  const opens = () => ({ openThread: vi.fn(), openListing: vi.fn() });
  const inPlace = (place: Partial<FeedbackLinkPlace>, text = 'See #7, #9 and https://formamorph.ai/community/world/w2') => {
    resolving([SUGGESTION, BUG, LISTING]);
    return render(
      <FeedbackLinkContext.Provider value={{ ...APP_FEEDBACK_LINK_PLACE, ...place }}>
        <Box text={text} />
      </FeedbackLinkContext.Provider>,
    );
  };

  it('opens thread and listing addresses beside the page and never calls an opener', async () => {
    const place = opens();
    inPlace(place);
    await tab('Preview');

    const thread = await within(pane()).findByRole('link', { name: /Pin a stat/ });
    const listing = within(pane()).getByRole('link', { name: /Brinewell/ });
    expect(thread).toHaveAttribute('target', '_blank');
    expect(listing).toHaveAttribute('target', '_blank');
    fireEvent.click(thread);
    fireEvent.click(listing);
    fireEvent.click(within(pane()).getByRole('button', { name: /Map stops panning/ }));

    expect(place.openThread).not.toHaveBeenCalled();
    expect(place.openListing).not.toHaveBeenCalled();
  });

  it('opens a relative address beside the page too', async () => {
    inPlace({ threadHref: (number) => `/feedback/${number}` });
    await tab('Preview');

    expect(await within(pane()).findByRole('link', { name: /Pin a stat/ })).toHaveAttribute('target', '_blank');
  });

  it('keeps a thread opener that opens above the box, and still not the listing opener', async () => {
    const place = opens();
    inPlace({ ...place, threadOpensAbove: true });
    await tab('Preview');

    fireEvent.click(await within(pane()).findByRole('link', { name: /Pin a stat/ }));
    fireEvent.click(within(pane()).getByRole('button', { name: /Map stops panning/ }));
    fireEvent.click(within(pane()).getByRole('link', { name: /Brinewell/ }));

    expect(place.openThread.mock.calls).toEqual([[7], [9]]);
    expect(place.openListing).not.toHaveBeenCalled();
  });

  it('keeps the reply draft when a thread chip is clicked', async () => {
    vi.spyOn(FeedbackService, 'fetchThread').mockResolvedValue({ thread: thread(), comments: [] });
    resolving([SUGGESTION]);
    render(<FeedbackThreadView threadId="uuid-1" onBack={() => {}} notify={toastFeedbackNotify} />);
    await screen.findByLabelText('Reply');
    fill('Reply', 'See #7');
    await tab('Preview');

    fireEvent.click(await within(pane()).findByRole('link', { name: /Pin a stat/ }));

    expect(FeedbackService.fetchThread).toHaveBeenCalledTimes(1);
    await tab('Edit');
    expect(screen.getByLabelText('Reply')).toHaveTextContent('See #7');
  });

  describe('on a user chip', () => {
    const withProfile = (profileLeavesPage?: boolean) => {
      const openProfile = vi.fn();
      resolving();
      render(
        <UserProfileContext.Provider value={{ openProfile, setListingOpener: () => {}, profileLeavesPage }}>
          <Box text="Ask @wren" />
        </UserProfileContext.Provider>,
      );
      return openProfile;
    };

    it('opens the profile in place in the app', async () => {
      const openProfile = withProfile();
      await tab('Preview');

      const chip = await within(pane()).findByRole('link', { name: /wren/ });
      expect(chip).not.toHaveAttribute('target');
      fireEvent.click(chip);

      expect(openProfile).toHaveBeenCalledWith('u3', 'wren');
    });

    it('opens a new tab on the website, where the profile leaves the page', async () => {
      const openProfile = withProfile(true);
      await tab('Preview');

      const chip = await within(pane()).findByRole('link', { name: /wren/ });
      expect(chip).toHaveAttribute('target', '_blank');
      fireEvent.click(chip);

      expect(openProfile).not.toHaveBeenCalled();
    });
  });
});
