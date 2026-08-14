import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCanvasGridVisible, useCanvasSnap } from './canvasPrefs';

/** The prefs are only worth anything if the choice outlives the session that made it, and if the two
 *  choices are genuinely separate — turning the grid off must not stop nodes snapping to it. */
describe('canvas preferences', () => {
  beforeEach(() => localStorage.clear());

  it('start on', () => {
    expect(renderHook(() => useCanvasSnap()).result.current[0]).toBe(true);
    expect(renderHook(() => useCanvasGridVisible()).result.current[0]).toBe(true);
  });

  it('remember a choice for the next session', () => {
    const first = renderHook(() => useCanvasSnap());
    act(() => first.result.current[1](false));
    first.unmount();
    expect(renderHook(() => useCanvasSnap()).result.current[0]).toBe(false);
  });

  it('keep snapping and grid visibility apart', () => {
    const grid = renderHook(() => useCanvasGridVisible());
    act(() => grid.result.current[1](false));
    expect(renderHook(() => useCanvasSnap()).result.current[0]).toBe(true);
  });
});
