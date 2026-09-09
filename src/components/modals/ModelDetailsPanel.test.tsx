import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelDetailsPanel } from './ModelDetailsPanel';
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

const renderPanel = (license?: VrmLicense) =>
  render(
    <ModelDetailsPanel open name="Test Avatar" url="blob:test" license={license} size={1024} onClose={() => {}} />,
  );

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
