import { render, screen } from '@testing-library/react';
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
});
