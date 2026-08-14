import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCanvasConnectionStyle, useCanvasGridVisible, useCanvasSnap } from './canvasPrefs';

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

  it('start on straight lines and remember another shape', () => {
    expect(renderHook(() => useCanvasConnectionStyle()).result.current[0]).toBe('straight');
    const style = renderHook(() => useCanvasConnectionStyle());
    act(() => style.result.current[1]('elbow'));
    style.unmount();
    expect(renderHook(() => useCanvasConnectionStyle()).result.current[0]).toBe('elbow');
  });

  /** A stored shape nobody draws would leave the map with no arrows at all, so it falls back rather than
   *  being handed to the renderer. */
  it('fall back to straight lines when the stored shape is not one of them', () => {
    localStorage.setItem('FORMAMORPH_canvasConnectionStyle', 'squiggle');
    expect(renderHook(() => useCanvasConnectionStyle()).result.current[0]).toBe('straight');
  });

  it('keep snapping and grid visibility apart', () => {
    const grid = renderHook(() => useCanvasGridVisible());
    act(() => grid.result.current[1](false));
    expect(renderHook(() => useCanvasSnap()).result.current[0]).toBe(true);
  });
});
