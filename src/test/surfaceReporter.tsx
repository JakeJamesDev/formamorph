import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { SurfaceReporterContext } from '@/components/ui/surface';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';

/** Renders under the app's surface registry, as `App` does. A rerender keeps it. */
export function renderReporting(ui: ReactElement): RenderResult {
  return render(ui, {
    wrapper: ({ children }) => (
      <SurfaceReporterContext.Provider value={surfaceRegistry}>{children}</SurfaceReporterContext.Provider>
    ),
  });
}
