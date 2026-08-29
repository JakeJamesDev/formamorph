import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMorphFullscreen, useMorphResize } from './useMorphFullscreen';

const rect = (left: number, top: number, width: number, height: number) => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top,
  toJSON: () => ({}),
}) as DOMRect;

/** jsdom lays nothing out, so both ends of the trip have to be stated for the FLIP to have any arithmetic
 *  to do. Transform writes are recorded because the interesting ones are overwritten in the same tick. */
function makeElements(source = rect(20, 40, 200, 60), box = rect(0, 0, 1000, 800)) {
  const sourceEl = document.createElement('textarea');
  sourceEl.getBoundingClientRect = () => source;
  const boxEl = document.createElement('div');
  boxEl.getBoundingClientRect = () => box;

  const writes: string[] = [];
  Object.defineProperty(boxEl.style, 'transform', {
    configurable: true,
    get: () => writes[writes.length - 1] ?? '',
    set: (value: string) => { writes.push(value); },
  });
  return { sourceEl, boxEl, writes };
}

const reduceMotion = (on: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
};

describe('useMorphFullscreen', () => {
  beforeEach(() => {
    // rAF has to be faked too: the release deliberately waits for a painted frame.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    reduceMotion(false);
  });
  afterEach(() => vi.useRealTimers());

  it('starts the overlay sitting exactly over the source, then lets it go', () => {
    const { sourceEl, boxEl, writes } = makeElements();
    const { result } = renderHook(() => useMorphFullscreen({ current: sourceEl }));

    // Opening comes first and the box arrives afterwards, which is the real order: the dialog primitive
    // portals its content in, so the ref lands after the effect that asked for the trip. Attaching the box
    // up front would be a harness convenience no caller can reproduce.
    act(() => result.current.open());
    act(() => result.current.boxRef(boxEl));

    // 200/1000 and 60/800 wide, offset by the source's own corner — the overlay is laid out full size and
    // pulled back onto the field, never sized to it.
    // Clearing writes are skipped: the trip wipes any leftover transform before measuring, so the element's
    // own resting position is what gets read rather than where a previous trip left it.
    expect(writes.filter(Boolean)).toEqual(['translate(20px, 40px) scale(0.2, 0.075)']);
    // And it is still sitting there after the commit. Releasing in the same frame the overlay was portaled
    // into the document skips the animation outright — the browser has no painted start to transition
    // from, so the box arrives at full size instantly.
    expect(boxEl.style.transition).toBe('none');
    expect(result.current.phase).toBe('entering');

    act(() => vi.advanceTimersByTime(50));
    expect(writes[writes.length - 1]).toBe('none');
    expect(boxEl.style.transition).toContain('transform 260ms');

    act(() => vi.advanceTimersByTime(400));
    expect(result.current.phase).toBe('open');
    // Nothing of the trip is left behind to fight the next one.
    expect(writes[writes.length - 1]).toBe('');
    expect(boxEl.style.transition).toBe('');
  });

  it('closes by shrinking the veiled panel back onto the slot the content already reoccupies', () => {
    const { sourceEl, boxEl, writes } = makeElements();
    const { result } = renderHook(() => useMorphFullscreen({ current: sourceEl }));
    act(() => result.current.open());
    act(() => result.current.boxRef(boxEl));
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.contentInOverlay).toBe(true);

    act(() => result.current.close());
    // The content belongs to the docked slot from the first frame of the close; the box that stays
    // behind is a veiled solid panel wearing its travel edge, shrinking onto that very slot.
    expect(result.current.mounted).toBe(true);
    expect(result.current.phase).toBe('leaving');
    expect(result.current.contentInOverlay).toBe(false);
    expect(result.current.veilClassName).toContain('opacity-100');
    expect(result.current.boxClassName).toContain('border');
    act(() => vi.advanceTimersByTime(50));
    expect(writes[writes.length - 1]).toBe('translate(20px, 40px) scale(0.2, 0.075)');
    // The box then fades over the widget after landing, so the settle waits out shrink plus reveal.
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.mounted).toBe(false);
    expect(result.current.phase).toBe('closed');
  });

  it('puts the panels behind it back where they were reading, however they got moved', () => {
    // Closing hands focus around — the host dialog's trap, then the browser revealing whatever ended up
    // focused — and each of those scrolls the panel underneath. None of them are ours to prevent, so the
    // position the window opened from is simply restored.
    const { sourceEl, boxEl } = makeElements();
    const pane = document.createElement('div');
    Object.defineProperty(pane, 'scrollHeight', { value: 1405, configurable: true });
    Object.defineProperty(pane, 'clientHeight', { value: 853, configurable: true });
    pane.appendChild(sourceEl);
    document.body.appendChild(pane);
    pane.scrollTop = 100;

    const { result } = renderHook(() => useMorphFullscreen({ current: sourceEl }));
    act(() => result.current.open());
    act(() => result.current.boxRef(boxEl));
    act(() => vi.advanceTimersByTime(400));

    act(() => result.current.close());
    act(() => vi.advanceTimersByTime(400));
    pane.scrollTop = 0; // whatever took focus on the way out drags the panel to the top
    act(() => vi.advanceTimersByTime(200));

    expect(pane.scrollTop).toBe(100);
    pane.remove();
  });

  it('keeps a centered box centered while it travels', () => {
    // A windowed dialog is centered *by* a transform. Assigning the trip straight to `transform` threw that
    // away, and the box sat at the raw left:50%/top:50% corner — off in one screen quadrant — until the
    // animation ended and the class took over again.
    const { sourceEl, boxEl, writes } = makeElements();
    const centering = 'matrix(1, 0, 0, 1, -380, -418)';
    boxEl.style.setProperty('transform', centering);
    // The recorder's getter reports the last write, which is what `getComputedStyle` stands in for here.
    Object.defineProperty(window, 'getComputedStyle', {
      configurable: true,
      value: (el: Element) => (el === boxEl ? { transform: centering } : { transform: 'none' }),
    });

    writes.length = 0; // drop the setup write, so the first entry is the trip's own
    const { result } = renderHook(() => useMorphFullscreen({ current: sourceEl }));
    act(() => result.current.open());
    act(() => result.current.boxRef(boxEl));

    // The centering leads, so it is applied outermost: the box is placed where its styles intend, and the
    // trip moves it from there. The other order scales the centering offset along with the box.
    expect(writes.filter(Boolean)[0]).toBe(`${centering} translate(20px, 40px) scale(0.2, 0.075)`);
    act(() => vi.advanceTimersByTime(50));
    expect(writes[writes.length - 1]).toBe(centering);
  });

  it('opens without travelling when the reader asked for less motion', () => {
    reduceMotion(true);
    const { sourceEl, boxEl, writes } = makeElements();
    const { result } = renderHook(() => useMorphFullscreen({ current: sourceEl }));

    act(() => result.current.open());
    act(() => result.current.boxRef(boxEl));
    expect(result.current.phase).toBe('open');
    expect(result.current.mounted).toBe(true);
    expect(writes.filter(Boolean)).toEqual([]);

    act(() => result.current.close());
    // The close fade still runs — an opacity-only exit is reduced-motion safe, like the app's other fades.
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.mounted).toBe(false);
  });

  it('opens plainly rather than collapsing to nothing when the field has no size to grow from', () => {
    // The Preview tab unmounts the textarea, so the source can genuinely be a zero-area or missing element
    // at the moment full screen is asked for. Scaling onto that would shrink the overlay out of existence.
    const { sourceEl, boxEl, writes } = makeElements(rect(0, 0, 0, 0));
    const { result } = renderHook(() => useMorphFullscreen({ current: sourceEl }));

    act(() => result.current.open());
    act(() => result.current.boxRef(boxEl));
    expect(result.current.phase).toBe('open');
    expect(writes.filter(Boolean)).toEqual([]);
  });

  it('still lands at full size when the frame that would release it never comes', () => {
    // A hidden tab suspends rAF entirely. The overlay is parked on top of the field at that point, so a
    // settle that waited for the release would leave it stuck there — animation lost is fine, the window
    // never opening is not.
    const raf = vi.fn(() => 0 as unknown as number);
    vi.stubGlobal('requestAnimationFrame', raf);

    const { sourceEl, boxEl, writes } = makeElements();
    const { result } = renderHook(() => useMorphFullscreen({ current: sourceEl }));
    act(() => result.current.open());
    act(() => result.current.boxRef(boxEl));
    expect(writes[writes.length - 1]).toBe('translate(20px, 40px) scale(0.2, 0.075)');

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.phase).toBe('open');
    expect(writes[writes.length - 1]).toBe('');
    vi.unstubAllGlobals();
  });

  it('keeps the widget covered while the box travels, and reveals it only once landed', () => {
    const { sourceEl, boxEl } = makeElements();
    const { result } = renderHook(() => useMorphFullscreen({ current: sourceEl }));

    act(() => result.current.open());
    act(() => result.current.boxRef(boxEl));
    // Covered through the whole trip: the widget underneath never animates, so revealing it mid-travel
    // would show it scaled with the box.
    expect(result.current.veilClassName).not.toContain('opacity-0');
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.veilClassName).toContain('opacity-0');

    // And covered again before the box moves, so the shrinking box is a clean panel.
    act(() => result.current.close());
    expect(result.current.veilClassName).not.toContain('opacity-0');
  });

  it('carries the dim sheet out with the shrinking box instead of holding it dark until unmount', () => {
    const { sourceEl, boxEl } = makeElements();
    const { result } = renderHook(() => useMorphFullscreen({ current: sourceEl }));

    act(() => result.current.open());
    act(() => result.current.boxRef(boxEl));
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.overlayClassName).not.toContain('opacity-0');

    // The fade starts with the shrink, not after it — the sheet held at full dark through the whole
    // trip and released only at unmount is the flash this class exists to remove.
    act(() => result.current.close());
    expect(result.current.overlayClassName).toContain('opacity-0');

    // And it stays held at 0 through `closed`: the dialog primitive keeps the overlay in the tree for
    // its own exit animation, and a class that reverted here would flash the sheet back mid-teardown.
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.phase).toBe('closed');
    expect(result.current.overlayClassName).toContain('opacity-0');
  });
});

describe('useMorphResize', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    reduceMotion(false);
  });
  afterEach(() => vi.useRealTimers());

  it('takes the box out of its own CSS animation for the trip, and hands it back after', () => {
    // The window that resizes itself also has an open animation, and `animate-in` keeps its last keyframe
    // applied for good. A CSS animation writing `transform` outranks an inline one, so leaving it in place
    // means every resize after the first open is silently swallowed.
    const { boxEl, writes } = makeElements();
    // The old rect is read during render, before the commit that resizes the element — so only that first
    // measurement sees the windowed size; everything after it is the grown box.
    let measured = 0;
    boxEl.getBoundingClientRect = () => (measured++ === 0 ? rect(0, 0, 400, 300) : rect(0, 0, 1000, 800));

    const { result, rerender } = renderHook(({ key }: { key: string }) => useMorphResize(key), {
      initialProps: { key: 'window' },
    });
    act(() => result.current(boxEl));

    rerender({ key: 'full' });

    expect(boxEl.style.animation).toBe('none');
    expect(writes[writes.length - 1]).toBe('translate(0px, 0px) scale(0.4, 0.375)');

    act(() => vi.advanceTimersByTime(400));
    expect(boxEl.style.animation).toBe('');
  });

  it('hands the animation back already finished, so the open zoom-and-fade does not replay', () => {
    // Restoring `animation: ''` flips animation-name from `none` back to the class's, which starts it
    // over from frame one — the window blinked out and zoomed back in at the end of every trip.
    const { boxEl } = makeElements();
    let measured = 0;
    boxEl.getBoundingClientRect = () => (measured++ === 0 ? rect(0, 0, 400, 300) : rect(0, 0, 1000, 800));
    const finish = vi.fn();
    (boxEl as HTMLElement & { getAnimations(): Animation[] }).getAnimations =
      () => [{ finish } as unknown as Animation];

    const { result, rerender } = renderHook(({ key }: { key: string }) => useMorphResize(key), {
      initialProps: { key: 'window' },
    });
    act(() => result.current(boxEl));
    rerender({ key: 'full' });
    // Not before the trip lands: the box is still travelling on its inline transform.
    expect(finish).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(400));
    expect(boxEl.style.animation).toBe('');
    expect(finish).toHaveBeenCalled();
  });
});
