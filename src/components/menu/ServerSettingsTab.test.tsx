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

// The hosted AI panel reads its own routes and has its own tests.
vi.mock('@/components/menu/HostedAiPanel', () => ({ HostedAiPanel: () => null }));

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

/** Answers each read by key (switches off, numbers 1 unless given); a PUT takes the next prepared answer. */
const answerKeyed = (stored: Record<string, unknown> = {}, writes: Response[] = []) =>
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return writes.shift() as Response;
    const key = url.split('/').pop() as string;
    const isSwitch = ['anonymous_likes', 'listing_review', 'network_kind', 'active_installs'].includes(key);
    return settingBody(key in stored ? stored[key] : (isSwitch ? false : 1));
  });

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
    fetchMock.mockResolvedValue(refusal('Not staff'));

    render(<ServerSettingsTab active />);

    await waitFor(() => expect(toastTexts(toastErrorMock)).toContain('Not staffView Details →'));
    expect(screen.queryByRole('checkbox')).toBeNull();
    // One notice per row that went unanswered: the three switches and the four numbers.
    expect(screen.getAllByText('This server didn’t answer for this setting')).toHaveLength(7);
  });

  it('asks for nothing while the tab is not the one on screen', () => {
    render(<ServerSettingsTab active={false} />);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('writing the setting', () => {
  it('follows the value the server stored', async () => {
    answerKeyed({ anonymous_likes: false }, [settingBody(true)]);

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(anonymousLikes().hasAttribute('disabled')).toBe(false));

    fireEvent.click(anonymousLikes());

    await waitFor(() => expect(anonymousLikes().getAttribute('data-state')).toBe('checked'));
    const [url, init] = fetchMock.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === 'PUT') as [string, RequestInit];
    expect(url).toBe('https://server.test/api/settings/anonymous_likes');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ value: true }));
  });

  it('calls the catalog in hand out of date, so this session’s hearts follow the new value', async () => {
    answerKeyed({ anonymous_likes: true }, [settingBody(false)]);

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(anonymousLikes().hasAttribute('disabled')).toBe(false));
    const before = catalogStale.marked();

    fireEvent.click(anonymousLikes());

    await waitFor(() => expect(catalogStale.marked()).toBe(before + 1));
  });

  it('restores the box and says why when the write is refused', async () => {
    answerKeyed({ anonymous_likes: true }, [refusal('No such setting')]);

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(anonymousLikes().getAttribute('data-state')).toBe('checked'));

    fireEvent.click(anonymousLikes());

    await waitFor(() => expect(toastTexts(toastErrorMock)).toContain('No such settingView Details →'));
    expect(anonymousLikes().getAttribute('data-state')).toBe('checked');
    expect(catalogStale.marked()).toBe(0);
  });

  it('takes no second press while the first is in the air', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => (init?.method === 'PUT'
      ? never()
      : Promise.resolve(settingBody(url.endsWith('anonymous_likes') || url.endsWith('network_kind') || url.endsWith('active_installs') ? false : 1))));

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

describe('the Network Check switch', () => {
  const networkCheck = () => screen.getByRole('checkbox', { name: 'Network Check' });

  /** Answers each read by key; a PUT takes the next prepared answer. */
  const answerByKey = (values: Record<string, unknown>, writes: Response[] = []) =>
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return writes.shift() as Response;
      return settingBody(values[url.split('/').pop() as string]);
    });

  it('reads and writes the network_kind key', async () => {
    answerByKey({ anonymous_likes: false, network_kind: false }, [settingBody(true)]);

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(networkCheck().hasAttribute('disabled')).toBe(false));
    expect(networkCheck().getAttribute('data-state')).toBe('unchecked');

    fireEvent.click(networkCheck());

    await waitFor(() => expect(networkCheck().getAttribute('data-state')).toBe('checked'));
    const write = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT') as [string, RequestInit];
    expect(write[0]).toBe('https://server.test/api/settings/network_kind');
    expect(write[1].body).toBe(JSON.stringify({ value: true }));
  });
});

describe('the Daily Check-In Counts switch', () => {
  const dailyCheckIn = () => screen.getByRole('checkbox', { name: 'Daily Check-In Counts' });

  it('reads and writes the active_installs key', async () => {
    answerKeyed({ active_installs: false }, [settingBody(true)]);

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(dailyCheckIn().hasAttribute('disabled')).toBe(false));
    expect(dailyCheckIn().getAttribute('data-state')).toBe('unchecked');

    fireEvent.click(dailyCheckIn());

    await waitFor(() => expect(dailyCheckIn().getAttribute('data-state')).toBe('checked'));
    const write = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT') as [string, RequestInit];
    expect(write[0]).toBe('https://server.test/api/settings/active_installs');
    expect(write[1].body).toBe(JSON.stringify({ value: true }));
  });

  it('shows the stored on state, not an empty box', async () => {
    answerKeyed({ active_installs: true });

    render(<ServerSettingsTab active />);

    await waitFor(() => expect(dailyCheckIn().getAttribute('data-state')).toBe('checked'));
  });
});

describe('the threshold rows', () => {
  const STORED = {
    anonymous_likes: false, network_kind: false,
    likes_marker_min_flagged: 5, likes_marker_share: 0.5, burst_size: 8, burst_window_minutes: 15,
  };

  const field = (name: string) => screen.getByRole('spinbutton', { name }) as HTMLInputElement;

  const answerByKey = (writes: Response[] = []) =>
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return writes.shift() as Response;
      return settingBody(STORED[url.split('/').pop() as keyof typeof STORED]);
    });

  const writes = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT') as [string, RequestInit][];

  it('shows each stored value, the share as a percent', async () => {
    answerByKey();

    render(<ServerSettingsTab active />);

    await waitFor(() => expect(field('Minimum Flagged Likes').value).toBe('5'));
    expect(field('Flagged Share').value).toBe('50');
    expect(field('Burst Size').value).toBe('8');
    expect(field('Burst Window').value).toBe('15');
  });

  it('writes on blur, converting the percent back to the stored share', async () => {
    answerByKey([settingBody(0.35)]);

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(field('Flagged Share').value).toBe('50'));

    fireEvent.change(field('Flagged Share'), { target: { value: '35' } });
    fireEvent.blur(field('Flagged Share'));

    await waitFor(() => expect(field('Flagged Share').value).toBe('35'));
    expect(writes()[0][0]).toBe('https://server.test/api/settings/likes_marker_share');
    expect(writes()[0][1].body).toBe(JSON.stringify({ value: 0.35 }));
    expect(catalogStale.marked()).toBe(1);
  });

  it('writes on Enter', async () => {
    answerByKey([settingBody(10)]);

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(field('Burst Size').value).toBe('8'));

    fireEvent.change(field('Burst Size'), { target: { value: '10' } });
    field('Burst Size').focus();
    fireEvent.keyDown(field('Burst Size'), { key: 'Enter' });

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0][1].body).toBe(JSON.stringify({ value: 10 }));
  });

  it('shows the server’s reason and puts the stored value back when a value is refused', async () => {
    answerByKey([refusal('The Burst size must be a whole number of at least 2')]);

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(field('Burst Size').value).toBe('8'));

    fireEvent.change(field('Burst Size'), { target: { value: '1' } });
    fireEvent.blur(field('Burst Size'));

    await waitFor(() => expect(toastTexts(toastErrorMock)).toContain('The Burst size must be a whole number of at least 2View Details →'));
    expect(field('Burst Size').value).toBe('8');
    expect(catalogStale.marked()).toBe(0);
  });

  it('refuses a percent out of range in percent, without asking the server', async () => {
    answerByKey();

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(field('Flagged Share').value).toBe('50'));
    const writesBefore = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT').length;

    fireEvent.change(field('Flagged Share'), { target: { value: '101' } });
    fireEvent.blur(field('Flagged Share'));

    await waitFor(() => expect(toastTexts(toastErrorMock).join()).toContain('Flagged Share must be above 0 and at most 100'));
    expect(field('Flagged Share').value).toBe('50');
    expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT').length).toBe(writesBefore);
  });

  it('writes nothing for an unchanged or empty field', async () => {
    answerByKey();

    render(<ServerSettingsTab active />);
    await waitFor(() => expect(field('Burst Size').value).toBe('8'));

    fireEvent.blur(field('Burst Size'));
    fireEvent.change(field('Burst Size'), { target: { value: '' } });
    fireEvent.blur(field('Burst Size'));

    expect(writes()).toHaveLength(0);
    expect(field('Burst Size').value).toBe('8');
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
