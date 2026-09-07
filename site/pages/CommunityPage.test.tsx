import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityPage } from './CommunityPage';
import { resetAccountPage } from '../test/support';

const { host } = vi.hoisted(() => ({
  host: vi.fn(() => <div data-testid="community-host">Community browser</div>),
}));

vi.mock('@/views/CommunityBrowserHost', () => ({ default: host }));
vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

beforeEach(() => {
  resetAccountPage('/community');
  host.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the website community route', () => {
  it('does not mount the browser until a guest accepts the content warning', async () => {
    const user = userEvent.setup();
    render(<CommunityPage />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('community-host')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByTestId('community-host')).toBeInTheDocument();
    expect(host).toHaveBeenCalledWith(expect.objectContaining({
      presentation: 'embedded',
      capabilities: expect.objectContaining({
        localLibrary: false,
        likes: false,
        comments: false,
        moderation: false,
      }),
    }), {});
  });

  it('keeps a direct listing destination outside the warning, then gives it to the shared browser', async () => {
    const user = userEvent.setup();
    resetAccountPage('/community/entity/e1');
    render(<CommunityPage />);

    expect(host).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByTestId('community-host')).toBeInTheDocument();
    expect(host).toHaveBeenLastCalledWith(expect.objectContaining({
      listing: { id: 'e1', kind: 'entity' },
    }), {});
  });

  it('keeps a malformed destination unavailable instead of loading the catalog', async () => {
    const user = userEvent.setup();
    resetAccountPage('/community/contest/e1');
    render(<CommunityPage />);

    expect(host).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This creation link is unavailable.');
    expect(host).not.toHaveBeenCalled();
  });

  it('updates the destination after the shared browser selects a card', async () => {
    const user = userEvent.setup();
    render(<CommunityPage />);
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await screen.findByTestId('community-host');

    const [props] = host.mock.calls.at(-1) as unknown as [{ onListingChange: (listing: { id: string; kind: string }) => void }];
    act(() => props.onListingChange({ id: 'w / 1', kind: 'world' }));

    expect(window.location.pathname).toBe('/community/world/w%20%2F%201');
  });
});
