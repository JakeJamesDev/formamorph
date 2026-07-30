/* eslint-disable react-refresh/only-export-components -- test-only module; nothing here is hot-reloaded */
import { forwardRef, useImperativeHandle } from 'react';
import type { VRMViewerHandle } from '@/views/VRMViewer';

/**
 * Stand-in for the VRM viewer. three.js needs a real WebGL context, which jsdom has none of, so any test
 * that renders a panel holding the player model swaps the viewer for this: it renders a marker element and
 * records the props it was handed, so a test can still assert what the panel asked the viewer to draw.
 *
 * Mock it from a test with
 * `vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'))`.
 */

/** Props of every render this stub has received, oldest first. Cleared by `resetVrmViewerStub`. */
export const vrmViewerRenders: Record<string, unknown>[] = [];

/** Forget every recorded render. Call between tests that read `vrmViewerRenders`. */
export function resetVrmViewerStub(): void {
  vrmViewerRenders.length = 0;
}

/** The most recent props the panel handed the viewer, or undefined if it never rendered one. */
export function lastVrmViewerProps(): Record<string, unknown> | undefined {
  return vrmViewerRenders[vrmViewerRenders.length - 1];
}

const VRMViewerStub = forwardRef<VRMViewerHandle, Record<string, unknown>>((props, ref) => {
  vrmViewerRenders.push(props);
  useImperativeHandle(ref, () => ({ calcColor: () => null }));
  return <div data-testid="vrm-viewer" />;
});
VRMViewerStub.displayName = 'VRMViewerStub';

export default VRMViewerStub;
