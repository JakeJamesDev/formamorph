import 'fake-indexeddb/auto';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { createSurfaceRequester } from '@/test/surfaceRequest';
import type { SurfaceSteps } from './surfaceRoute';
import { useSurfaceOpenRequest } from './useSurfaceOpenRequest';

let requester: ReturnType<typeof createSurfaceRequester>;
let open: ReturnType<typeof vi.fn<(steps: SurfaceSteps, clear: () => void) => void>>;

function Host() {
  useSurfaceOpenRequest(open);
  return null;
}

beforeEach(() => {
  localStorage.clear();
  requester = createSurfaceRequester();
  open = vi.fn((_steps, clear) => clear());
  render(<SettingsProvider><requester.Requester /><Host /></SettingsProvider>);
});
afterEach(cleanup);

describe('useSurfaceOpenRequest', () => {
  it('hands the host the request target unchanged', () => {
    requester.send('settings.display', 'narration-layout');
    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0][0]).toEqual({ view: null, dialog: 'settings', tabs: ['settings.display'], target: 'narration-layout' });
    expect(requester.pending()).toBeNull();
  });

  it('hands the host the bare surface for a bare request', () => {
    requester.send('settings.display');
    expect(open.mock.calls[0][0]).not.toHaveProperty('target');
  });
});
