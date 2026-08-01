import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProfileAvatarEditor } from './ProfileAvatarEditor';
import AuthService from '@/services/AuthService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/services/WorldStorageService', () => ({ default: { API_URL: 'https://server.test/api' } }));

// The crop dialog decodes a real image, which jsdom cannot do; its own geometry is tested directly.
vi.mock('./AvatarCropDialog', () => ({
  AvatarCropDialog: ({ open, onCropped }: { open: boolean; onCropped: (image: string) => void }) =>
    open ? <button onClick={() => onCropped('data:image/webp;base64,AAAA')}>Fake Crop</button> : null,
}));

const file = (name = 'face.png', size = 1000) => {
  const made = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(made, 'size', { value: size });
  return made;
};

const show = (over: Record<string, unknown> = {}) =>
  render(
    <ProfileAvatarEditor
      username="wren_hallow"
      avatarUrl={null}
      onChanged={() => {}}
      {...over}
    />
  );

const pick = (chosen: File) =>
  fireEvent.change(screen.getByLabelText('Profile image file'), { target: { files: [chosen] } });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the picture as a button', () => {
  it('invites an image when there is none', () => {
    show();

    expect(screen.getByLabelText('Add a profile image')).toBeTruthy();
  });

  it('offers to change one that is already there', () => {
    show({ avatarUrl: '/api/avatars/abc.webp' });

    expect(screen.getByLabelText('Change your profile image')).toBeTruthy();
  });

  it('offers removal only when there is something to remove', () => {
    // An inert control reads as a missing permission rather than as nothing to do.
    show();
    expect(screen.queryByLabelText('Remove your profile image')).toBeNull();

    cleanup();
    show({ avatarUrl: '/api/avatars/abc.webp' });

    expect(screen.getByLabelText('Remove your profile image')).toBeTruthy();
  });

  it('is inert for a suspended account, which writes nothing', () => {
    show({ avatarUrl: '/api/avatars/abc.webp', disabled: true });

    expect((screen.getByLabelText('Change your profile image') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Remove your profile image') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('picking a file', () => {
  it('opens the crop step rather than uploading what was picked', () => {
    // The whole point of the flow: nothing is sent until the reader has seen the circle.
    const setAvatar = vi.spyOn(AuthService, 'setAvatar').mockResolvedValue(null);
    show();

    pick(file());

    expect(screen.getByText('Fake Crop')).toBeTruthy();
    expect(setAvatar).not.toHaveBeenCalled();
  });

  it('turns away something larger than the cap before decoding it', () => {
    show();

    pick(file('huge.png', 11 * 1024 * 1024));

    expect(screen.queryByText('Fake Crop')).toBeNull();
  });

  it('clears the input so the same file can be picked twice', () => {
    // Without this the second pick fires no change event, which reads as a broken button.
    show();
    const input = screen.getByLabelText('Profile image file') as HTMLInputElement;

    pick(file());

    expect(input.value).toBe('');
  });
});

describe('saving the crop', () => {
  it('sends what the crop produced and reports the new URL', async () => {
    const setAvatar = vi.spyOn(AuthService, 'setAvatar').mockResolvedValue('/api/avatars/new.webp');
    const onChanged = vi.fn();
    show({ onChanged });

    pick(file());
    fireEvent.click(screen.getByText('Fake Crop'));

    await waitFor(() => expect(setAvatar).toHaveBeenCalledWith('data:image/webp;base64,AAAA'));
    expect(onChanged).toHaveBeenCalledWith('/api/avatars/new.webp');
  });

  it('leaves the crop open when the save is refused', async () => {
    // Closing it would throw away the positioning they just did over a failure they can retry.
    vi.spyOn(AuthService, 'setAvatar').mockRejectedValue(new Error('Your account has been suspended'));
    const onChanged = vi.fn();
    show({ onChanged });

    pick(file());
    fireEvent.click(screen.getByText('Fake Crop'));

    await waitFor(() => expect(onChanged).not.toHaveBeenCalled());
    expect(screen.getByText('Fake Crop')).toBeTruthy();
  });
});

describe('removing it', () => {
  it('clears it and says so', async () => {
    const removeAvatar = vi.spyOn(AuthService, 'removeAvatar').mockResolvedValue(undefined);
    const onChanged = vi.fn();
    show({ avatarUrl: '/api/avatars/abc.webp', onChanged });

    fireEvent.click(screen.getByLabelText('Remove your profile image'));

    await waitFor(() => expect(removeAvatar).toHaveBeenCalled());
    expect(onChanged).toHaveBeenCalledWith(null);
  });

  it('does not report a removal that failed', async () => {
    vi.spyOn(AuthService, 'removeAvatar').mockRejectedValue(new Error('nope'));
    const onChanged = vi.fn();
    show({ avatarUrl: '/api/avatars/abc.webp', onChanged });

    fireEvent.click(screen.getByLabelText('Remove your profile image'));

    await waitFor(() => expect(screen.getByLabelText('Remove your profile image')).toBeTruthy());
    expect(onChanged).not.toHaveBeenCalled();
  });
});
