import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';
import { resetAccountPage } from './test/support';

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
});
