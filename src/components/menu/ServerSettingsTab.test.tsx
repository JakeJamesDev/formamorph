import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServerSettingsTab } from './ServerSettingsTab';
import { catalogStale, resetCatalogStale } from '@/lib/catalogStale';
import { toastTexts } from '@/test/toastText';

const toastErrorMock = vi.fn();
vi.mock('react-toastify', () => ({ toast: { error: (...args: unknown[]) => toastErrorMock(...args) } }));

vi.mock('@/services/AuthService', () => ({
  default: { API_URL: 'https://server.test/api', token: 'staff-token' },
}));

// Whether the server has listing review; its switch follows it.
const reviewMeta = vi.hoisted(() => ({ supported: false, enabled: false }));
const recorded = vi.hoisted(() => vi.fn());
vi.mock('@/lib/useListingReviewMeta', () => ({
  useListingReviewMeta: () => reviewMeta,
  setListingReviewEnabled: recorded,
}));

/** The listing review box, by its accessible name. */
const listingReview = () => screen.getByRole('checkbox', { name: 'Listing Review' });

/** The box for the likes setting, by its accessible name. */
const anonymousLikes = () => screen.getByRole('checkbox', { name: 'Anonymous Likes' });

/** A settings response, which carries the stored value under `data`. */
const settingBody = (value: unknown) =>
  ({ ok: true, json: async () => ({ success: true, key: 'anonymous_likes', data: value }) }) as Response;

/** A refusal, in the envelope this API uses. */
const refusal = (error: string) =>
  ({ ok: false, text: async () => JSON.stringify({ success: false, error }) }) as Response;

/** A read that has not answered yet, so the pending state can be asserted while it hangs. */
const never = () => new Promise<Response>(() => {});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reviewMeta.supported = false;
  recorded.mockClear();
  resetCatalogStale();
  toastErrorMock.mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('reading the setting', () => {
  it('shows what the server holds', async () => {
    fetchMock.mockResolvedValueOnce(settingBody(true));

    render(<ServerSettingsTab active />);

    await waitFor(() => expect(anonymousLikes().getAttribute('data-state')).toBe('checked'));
    expect(fetchMock.mock.calls[0][0]).toBe('https://server.test/api/settings/anonymous_likes');
  });

  it('shows no box at all until the server answers, rather than an empty one', () => {
    // An unread setting is not an off one. An empty box reads as off, and a press on it writes on what
    // may already be on: the emergency stop applied in the wrong direction.
    fetchMock.mockReturnValueOnce(never());

    render(<ServerSettingsTab active />);

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Anonymous Likes')).toBeTruthy();
  });

  it('reports a read it could not make, and still shows no box', async () => {
    // A dimmed empty box after a failed read is indistinguishable from a setting that is off.
    fetchMock.mockResolvedValueOnce(refusal('Not staff'));

    render(<ServerSettingsTab active />);

    await waitFor(() => expect(toastTexts(toastErrorMock)).toContain('Not staffView Details →'));
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('This server didn’t answer for this setting')).toBeTruthy();
  });

  it('asks for nothing while the tab is not the one on screen', () => {
    render(<ServerSettingsTab active={false} />);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('writing the setting', () => {
  it('follows the value the server stored', async () => {
    fetchMock.mockResolvedValueOnce(settingBody(false)).mockResolvedValueOnce(settingBody(true));

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(anonymousLikes().hasAttribute('disabled')).toBe(false));

    fireEvent.click(anonymousLikes());

    await waitFor(() => expect(anonymousLikes().getAttribute('data-state')).toBe('checked'));
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('https://server.test/api/settings/anonymous_likes');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ value: true }));
  });

  it('calls the catalog in hand out of date, so this session’s hearts follow the new value', async () => {
    fetchMock.mockResolvedValueOnce(settingBody(true)).mockResolvedValueOnce(settingBody(false));

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(anonymousLikes().hasAttribute('disabled')).toBe(false));
    const before = catalogStale.marked();

    fireEvent.click(anonymousLikes());

    await waitFor(() => expect(catalogStale.marked()).toBe(before + 1));
  });

  it('restores the box and says why when the write is refused', async () => {
    fetchMock.mockResolvedValueOnce(settingBody(true)).mockResolvedValueOnce(refusal('No such setting'));

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(anonymousLikes().getAttribute('data-state')).toBe('checked'));

    fireEvent.click(anonymousLikes());

    await waitFor(() => expect(toastTexts(toastErrorMock)).toContain('No such settingView Details →'));
    expect(anonymousLikes().getAttribute('data-state')).toBe('checked');
    expect(catalogStale.marked()).toBe(0);
  });

  it('takes no second press while the first is in the air', async () => {
    fetchMock.mockResolvedValueOnce(settingBody(false)).mockReturnValueOnce(never());

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(anonymousLikes().hasAttribute('disabled')).toBe(false));

    fireEvent.click(anonymousLikes());

    await waitFor(() => expect(anonymousLikes().hasAttribute('disabled')).toBe(true));
  });
});

describe('the Listing Review switch', () => {
  /** Answers each settings read by key, so row order does not matter. */
  const answerByKey = (values: Record<string, boolean>, writes: Response[] = []) =>
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return writes.shift() as Response;
      const key = url.split('/').pop() as string;
      return settingBody(values[key]);
    });

  it('is absent against a server without listing review, which would refuse the key', () => {
    answerByKey({ anonymous_likes: true });

    render(<ServerSettingsTab active />);

    expect(screen.queryByText('Listing Review')).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain('https://server.test/api/settings/listing_review');
  });

  it('reads the stored value from the listing_review key', async () => {
    reviewMeta.supported = true;
    answerByKey({ anonymous_likes: false, listing_review: true });

    render(<ServerSettingsTab active />);

    await waitFor(() => expect(listingReview().getAttribute('data-state')).toBe('checked'));
  });

  it('writes listing_review and follows the value the server stored', async () => {
    reviewMeta.supported = true;
    answerByKey({ anonymous_likes: false, listing_review: false }, [settingBody(true)]);

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(listingReview().hasAttribute('disabled')).toBe(false));

    fireEvent.click(listingReview());

    await waitFor(() => expect(listingReview().getAttribute('data-state')).toBe('checked'));
    const write = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT') as [string, RequestInit];
    expect(write[0]).toBe('https://server.test/api/settings/listing_review');
    expect(write[1].body).toBe(JSON.stringify({ value: true }));
  });

  it('tells the rest of the app the stored value, not the pressed one', async () => {
    reviewMeta.supported = true;
    // The server answers off to a press that asked for on.
    answerByKey({ anonymous_likes: false, listing_review: false }, [settingBody(false)]);

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(listingReview().hasAttribute('disabled')).toBe(false));
    fireEvent.click(listingReview());

    await waitFor(() => expect(recorded).toHaveBeenCalledWith(false));
  });

  it('says in its brief line that pending items stay in the queue when it is off', async () => {
    reviewMeta.supported = true;
    answerByKey({ anonymous_likes: false, listing_review: false });

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(listingReview()).toBeTruthy());

    expect(screen.getByText(/Pending items stay in the queue when it’s off/)).toBeTruthy();
  });
});

describe('the copy', () => {
  it('keeps the brief line to what the box does', async () => {
    fetchMock.mockResolvedValueOnce(settingBody(true));

    render(<ServerSettingsTab active />);

    await waitFor(() => expect(screen.getByText('Takes a like from anyone, signed in or not')).toBeTruthy());
  });

  it('puts the two facts about switching off behind the row’s information control', async () => {
    // Switching off asks for no confirmation, so the administrator has to be able to learn on this row
    // that the stop keeps what was given and leaves the way back open.
    fetchMock.mockResolvedValueOnce(settingBody(true));

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(anonymousLikes()).toBeTruthy());

    fireEvent.click(screen.getAllByRole('button', { name: 'More info' })[0]);

    await waitFor(() => {
      const body = screen.getByText(/Likes already given stay counted/);
      expect(body.textContent).toContain('take their own like back');
    });
  });
});
