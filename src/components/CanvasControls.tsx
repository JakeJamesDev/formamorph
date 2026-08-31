import type { ReactNode } from 'react';
import { Controls, useReactFlow, useStore } from '@xyflow/react';
import { Minus, Plus, Scan } from 'lucide-react';

import { Tip } from '@/components/ui/tooltip';

/**
 * The zoom controls both canvases wear, drawn as our own buttons inside xyflow's panel.
 *
 * xyflow's built-in trio takes its `title` and its `aria-label` from one string, so its buttons cannot
 * keep their name and drop the browser tip; its `ControlButton` is a plain function and never receives
 * the ref a tooltip trigger needs. These are native buttons wearing its class instead, which is all
 * `ControlButton` ever was — the panel, the styling, and the placement stay xyflow's.
 */
const CONTROL_BUTTON = 'react-flow__controls-button';

/** One tipped control. The tip is the button's only name: these carry an icon and nothing else. */
function CanvasControlButton({ tip, onClick, disabled, children }: {
  tip: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tip tip={tip} side="right">
      <button type="button" className={CONTROL_BUTTON} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    </Tip>
  );
}

/**
 * Zoom in, zoom out, and fit the view. `children` add whatever else a canvas keeps down here — the
 * editor hangs its full-screen toggle off the end.
 */
export function CanvasControls({ children }: { children?: ReactNode }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  // Two boolean selectors rather than one object, so the store needs no equality function to stay still.
  const atMinZoom = useStore((s) => s.transform[2] <= s.minZoom);
  const atMaxZoom = useStore((s) => s.transform[2] >= s.maxZoom);

  return (
    <Controls showZoom={false} showFitView={false} showInteractive={false}>
      <CanvasControlButton tip="Zoom In" onClick={() => zoomIn()} disabled={atMaxZoom}>
        <Plus />
      </CanvasControlButton>
      <CanvasControlButton tip="Zoom Out" onClick={() => zoomOut()} disabled={atMinZoom}>
        <Minus />
      </CanvasControlButton>
      <CanvasControlButton tip="Fit View" onClick={() => fitView()}>
        <Scan />
      </CanvasControlButton>
      {children}
    </Controls>
  );
}

export { CanvasControlButton };
