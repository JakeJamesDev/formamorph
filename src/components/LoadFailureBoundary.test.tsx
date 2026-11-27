import { describe, it, expect, vi } from 'vitest';
import { lazy, Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { LoadFailureBoundary } from './LoadFailureBoundary';

describe('LoadFailureBoundary', () => {
  it('shows its fallback and reports the error when a lazy part fails to load', async () => {
    const failure = new TypeError('Failed to fetch dynamically imported module');
    const Part = lazy(() => Promise.reject(failure));
    const onError = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // React logs a caught render error as well.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <div>
        <p>Around it</p>
        <LoadFailureBoundary fallback={<p>Not loaded</p>} onError={onError}>
          <Suspense fallback={<p>Loading</p>}><Part /></Suspense>
        </LoadFailureBoundary>
      </div>,
    );

    expect(await screen.findByText('Not loaded')).toBeInTheDocument();
    expect(screen.getByText('Around it')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(failure);
    warn.mockRestore();
    error.mockRestore();
  });
});
