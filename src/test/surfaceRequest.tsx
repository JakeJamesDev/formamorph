import { act } from '@testing-library/react';
import { useSettings, type SurfaceOpenRequest } from '@/contexts/SettingsContext';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import type { SurfaceRoute } from '@/lib/surface/surfaceRoute';

/**
 * Sends surface requests the way the help window does, through the SettingsProvider it is mounted under.
 * Mount `handle.Requester` inside the providers; `send` and `pending` work once it has rendered.
 */
export function createSurfaceRequester() {
  let request: ((route: SurfaceRoute) => void) | null = null;
  let current: SurfaceOpenRequest | null = null;
  function Requester() {
    const { requestSurface, surfaceRequest } = useSettings();
    request = requestSurface;
    current = surfaceRequest;
    return null;
  }
  return {
    Requester,
    send(id: SurfaceId, target?: string) {
      if (!request) throw new Error('Requester is not mounted');
      act(() => request!(target === undefined ? { id } : { id, target }));
    },
    /** The request still waiting for a view to answer it. */
    pending: () => current,
  };
}
