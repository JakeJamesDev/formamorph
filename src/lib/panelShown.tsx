/* eslint-disable react-refresh/only-export-components -- a context and its hooks, no components to hot-reload */
import { createContext, useContext, useEffect, useRef, useState } from 'react';

// Whether the panel around a component is on screen. Outside a panel strip, everything counts as shown.
const PanelShownContext = createContext(true);

export const PanelShownProvider = PanelShownContext.Provider;

/** Whether this component's panel is on screen now. */
export const usePanelShown = () => useContext(PanelShownContext);

/** Whether this component's panel has been on screen at least once, so heavy content can wait for it. */
export function usePanelEverShown() {
  const shown = usePanelShown();
  const [ever, setEver] = useState(shown);
  if (shown && !ever) setEver(true);
  return ever || shown;
}

/**
 * For a render loop: it reads `shown.current` each frame and stops scheduling itself while that is false,
 * and sets `wake.current` to a restart that runs once its panel shows again.
 */
export function usePanelLoopGate() {
  const shown = usePanelShown();
  const shownRef = useRef(shown);
  const wakeRef = useRef<() => void>(() => {});
  useEffect(() => {
    shownRef.current = shown;
    if (shown) wakeRef.current();
  }, [shown]);
  return { shown: shownRef, wake: wakeRef };
}
