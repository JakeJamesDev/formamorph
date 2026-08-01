import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { UserAvatar } from './UserAvatar';

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://server.test/api' },
}));

afterEach(cleanup);

describe('somebody with a picture', () => {
  it('shows it, resolved against the API origin', () => {
    render(<UserAvatar username="wren_hallow" avatarUrl="/api/avatars/abc.webp" />);

    const image = screen.getByRole('img') as HTMLImageElement;

    expect(image.src).toBe('https://server.test/api/avatars/abc.webp');
  });

  it('is named as the person, not as "avatar"', () => {
    // The name is usually right beside it; a screen reader saying both is noise.
    render(<UserAvatar username="wren_hallow" avatarUrl="/api/avatars/abc.webp" />);

    expect(screen.getByAltText('wren_hallow')).toBeTruthy();
  });

  it('falls back to the letter when the image will not load', () => {
    // Otherwise a deleted file leaves a torn-page icon where a face should be.
    render(<UserAvatar username="wren_hallow" avatarUrl="/api/avatars/gone.webp" />);

    fireEvent.error(screen.getByRole('img'));

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('W')).toBeTruthy();
  });

  it('gives a replacement its own chance rather than inheriting the last failure', () => {
    const { rerender } = render(<UserAvatar username="wren_hallow" avatarUrl="/api/avatars/gone.webp" />);
    fireEvent.error(screen.getByRole('img'));

    rerender(<UserAvatar username="wren_hallow" avatarUrl="/api/avatars/new.webp" />);

    expect(screen.getByRole('img')).toBeTruthy();
  });
});

describe('somebody without one', () => {
  it('shows their initial', () => {
    render(<UserAvatar username="osk_tinder" />);

    expect(screen.getByText('O')).toBeTruthy();
  });

  it('colors it from the name, so one person is one color at every size', () => {
    render(
      <>
        <UserAvatar username="osk_tinder" />
        <UserAvatar username="osk_tinder" size="lg" />
      </>
    );

    const [small, large] = screen.getAllByText('O') as HTMLElement[];

    expect(small.style.backgroundColor).toBe(large.style.backgroundColor);
    expect(small.style.backgroundColor).toBeTruthy();
  });

  it('gives different people different colors', () => {
    render(
      <>
        <UserAvatar username="osk_tinder" />
        <UserAvatar username="wren_hallow" />
      </>
    );

    const osk = screen.getByText('O') as HTMLElement;
    const wren = screen.getByText('W') as HTMLElement;

    expect(osk.style.backgroundColor).not.toBe(wren.style.backgroundColor);
  });

  it('has something to show for a nameless account', () => {
    render(<UserAvatar username={null} />);

    expect(screen.getByText('?')).toBeTruthy();
  });
});
