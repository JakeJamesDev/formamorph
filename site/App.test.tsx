import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';
import { resetAccountPage } from './test/support';

vi.mock('./pages/CommunityPage', () => ({
  CommunityPage: () => <h1>Community Creations</h1>,
}));

beforeEach(() => resetAccountPage('/reset-password'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('site routes', () => {
  it('serves password recovery at /reset-password', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
    expect(document.title).toBe('Reset Password · Formamorph');
  });

  it('routes a nested community listing to the community page', async () => {
    resetAccountPage('/community/world/shared-world');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Community Creations' })).toBeInTheDocument();
    expect(document.title).toBe('Community Creations · Formamorph');
  });
});
