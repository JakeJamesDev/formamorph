import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelDetailsPanel } from './ModelDetailsPanel';
import { useAvatarDetailsOpen } from '@/lib/useAvatarDetailsOpen';
import type { VrmLicense } from '@/types';

// The real viewer needs a WebGL context jsdom doesn't have; this suite is about the license verdict shown
// beside it, not the 3D preview.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));

/** A license that clears every Permissive License requirement, matching the bundled avatars. */
const PERMISSIVE: VrmLicense = {
  metaVersion: '1',
  avatarPermission: 'everyone',
  allowRedistribution: true,
  modification: 'allowModificationRedistribution',
  commercialUse: 'corporation',
};

const KEY = 'fm-avatar-details-open';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

/** Renders with the details table open, the state most of these checks read. */
const renderPanel = (license?: VrmLicense) => {
  localStorage.setItem(KEY, '1');
  return render(
    <ModelDetailsPanel open name="Test Avatar" url="blob:test" license={license} size={1024} onClose={() => {}} />,
  );
};

describe('ModelDetailsPanel Permissive License verdict', () => {
  it('shows Shareable for a license meeting every requirement, naming no requirement', () => {
    renderPanel(PERMISSIVE);
    expect(screen.getByText('Shareable')).toBeInTheDocument();
    expect(screen.queryByText(/Needs/)).not.toBeInTheDocument();
  });

  it('names every failed requirement for a VRM 0.0 file', () => {
    renderPanel({ metaVersion: '0' });
    expect(screen.getByText('Not shareable')).toBeInTheDocument();
    const reasons = screen.getByText(/^Needs/);
    expect(reasons).toHaveTextContent('VRM 1.0 metadata');
    expect(reasons).toHaveTextContent('permission for everyone to use it');
    expect(reasons).toHaveTextContent('redistribution allowed');
    expect(reasons).toHaveTextContent('modification and redistribution allowed');
    expect(reasons).toHaveTextContent('commercial use allowed');
  });

  it('names every failed requirement for a plain glTF with no VRM metadata', () => {
    renderPanel({ metaVersion: null });
    expect(screen.getByText('Not shareable')).toBeInTheDocument();
    expect(screen.getByText(/^Needs/)).toHaveTextContent('VRM 1.0 metadata');
  });

  it('names only the one requirement a file falls short on', () => {
    renderPanel({ ...PERMISSIVE, allowRedistribution: false });
    const reasons = screen.getByText(/^Needs/);
    expect(reasons).toHaveTextContent('redistribution allowed');
    expect(reasons.textContent).not.toMatch(/VRM 1\.0 metadata|everyone to use it|modification and redistribution|commercial use allowed/);
  });

  it('gates a model whose license has not resolved yet the same as a plain glTF, never as a pass', () => {
    renderPanel(undefined);
    expect(screen.getByText('Not shareable')).toBeInTheDocument();
  });
});

describe('ModelDetailsPanel details collapse', () => {
  const mount = () =>
    render(<ModelDetailsPanel open name="Test Avatar" url="blob:test" license={PERMISSIVE} size={1024} onClose={() => {}} />);

  it('starts collapsed', () => {
    mount();
    expect(screen.getByRole('button', { name: /details/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Shareable')).not.toBeInTheDocument();
  });

  it('opens on press and stores the choice', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText('Shareable')).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('reads the stored state on a fresh mount', () => {
    localStorage.setItem(KEY, '1');
    mount();
    expect(screen.getByText('Shareable')).toBeInTheDocument();
  });

  it('shares the state with every other mounted surface', async () => {
    // Two open dialogs block each other's pointer events, so the second surface is a bare hook consumer.
    const Other = () => <span data-testid="other">{String(useAvatarDetailsOpen()[0])}</span>;
    render(<Other />);
    mount();
    await userEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByTestId('other')).toHaveTextContent('true');
  });

  it('falls back to collapsed when storage throws, and still opens for the session', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    mount();
    expect(screen.queryByText('Shareable')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText('Shareable')).toBeInTheDocument();
  });
});
