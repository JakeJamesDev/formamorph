import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServerSettingsTab } from './ServerSettingsTab';
import { catalogStale, resetCatalogStale } from '@/lib/catalogStale';

const toastError = vi.fn();
vi.mock('react-toastify', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

vi.mock('@/services/AuthService', () => ({
  default: { API_URL: 'https://server.test/api', token: 'staff-token' },
}));

/** The one box this tab has, by its accessible name. */
const anonymousLikes = () => screen.getByRole('checkbox', { name: 'Anonymous Likes' });

/** A settings response, which carries the stored value under `data`. */
const settingBody = (value: unknown) =>
  ({ ok: true, json: async () => ({ success: true, key: 'anonymous_likes', data: value }) }) as Response;

/** A refusal, in the envelope this API uses. */
const refusal = (error: string) =>
  ({ ok: false, json: async () => ({ success: false, error }) }) as Response;

/** A read that has not answered yet, so the pending state can be asserted while it hangs. */
const never = () => new Promise<Response>(() => {});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetCatalogStale();
  toastError.mockClear();
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

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Not staff'));
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

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('No such setting'));
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
