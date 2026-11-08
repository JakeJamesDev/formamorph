import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PanelShownProvider, usePanelEverShown, usePanelLoopGate, usePanelShown } from './panelShown';

const inPanel = (shown: { current: boolean }) => function Wrapper({ children }: { children: React.ReactNode }) {
  return <PanelShownProvider value={shown.current}>{children}</PanelShownProvider>;
};

describe('panelShown', () => {
  it('counts everything outside a panel strip as shown', () => {
    expect(renderHook(() => usePanelShown()).result.current).toBe(true);
    expect(renderHook(() => usePanelEverShown()).result.current).toBe(true);
  });

  it('waits for a panel to show once, then stays loaded', () => {
    const shown = { current: false };
    const { result, rerender } = renderHook(() => usePanelEverShown(), { wrapper: inPanel(shown) });
    expect(result.current).toBe(false);
    shown.current = true;
    rerender();
    expect(result.current).toBe(true);
    shown.current = false;
    rerender();
    expect(result.current).toBe(true);
  });

  it('wakes a stopped loop when its panel shows, and only then', () => {
    const shown = { current: true };
    const { result, rerender } = renderHook(() => usePanelLoopGate(), { wrapper: inPanel(shown) });
    const wake = vi.fn();
    result.current.wake.current = wake;
    shown.current = false;
    rerender();
    expect(result.current.shown.current).toBe(false);
    expect(wake).not.toHaveBeenCalled();
    shown.current = true;
    rerender();
    expect(result.current.shown.current).toBe(true);
    expect(wake).toHaveBeenCalledTimes(1);
  });
});
