import '@testing-library/jest-dom/vitest'; // augments Vitest's expect with DOM matchers
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement ResizeObserver; provide a no-op so components that observe element size
// (e.g. MarkdownField's edit/preview height sharing) can render under test.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom doesn't implement matchMedia either; anything reading a media query (useIsMobile, the theme's
// contrast check) needs it just to render. Reports "no match", i.e. the desktop/light branch — a test that
// cares about the other branch stubs its own, which still overrides this.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom's Blob predates `arrayBuffer()` and doesn't implement it; every browser we target (and Electron's
// Chromium) has had it since 2019. FileReader is jsdom's supported path to the same bytes.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer === 'undefined') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// jsdom implements no layout, so Range has no `getBoundingClientRect` (browsers do). Lexical measures the
// selection range to scroll it into view after restoring a history entry, and the miss surfaces as an
// unhandled error *after* the test that caused it — a real failure elsewhere would be lost in that noise.
if (typeof Range !== 'undefined' && typeof Range.prototype.getBoundingClientRect === 'undefined') {
  const emptyRect = () => ({
    x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}),
  }) as DOMRect;
  Range.prototype.getBoundingClientRect = emptyRect;
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
}

// Same layout gap: jsdom has nothing to scroll, so Element.scrollIntoView is missing entirely. Anything
// that reveals a row after selecting it (the editor's find bar, the Test Bench's highlights) calls it as a
// side effect of rendering, and the miss throws out of an effect rather than failing anything meaningful.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom has no PointerEvent constructor, so a dispatched pointer event falls back to a bare Event and
// drops the coordinates with it — a drag then reads `clientX: undefined` and computes NaN. A mouse event
// carries exactly the fields a pointer one needs on top of it.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventStub extends MouseEvent {
    pointerId: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }

  window.PointerEvent = PointerEventStub as unknown as typeof window.PointerEvent;
}

// jsdom implements no Pointer Capture either, and Radix's Select asks the pointer target whether it holds
// capture before it will open — without these a click on any Select throws instead of opening its list.
if (typeof Element !== 'undefined' && typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// jsdom has no object-URL store. The upload path makes one to show the file being converted without handing
// an <img> the multi-megabyte data URL, so without these the whole flow throws.
if (typeof URL.createObjectURL === 'undefined') {
  let n = 0;
  URL.createObjectURL = () => `blob:formamorph/${++n}`;
  URL.revokeObjectURL = () => {};
}

// Unmount anything React Testing Library rendered between tests, and forget the module-level session
// state that would otherwise carry one test's server answers into the next — the shared events list and
// the prose read back behind it both live for the session by design.
afterEach(async () => {
  cleanup();
  // Imported here rather than at the top of this file, for two reasons. A static import would pull the
  // real `EventService` into every suite's module graph before its own `vi.mock` calls are registered,
  // and the cache would then read the live community server instead of the test's stub; and it reaches
  // `AuthService`, which needs `localStorage` — absent in the suites that run outside jsdom.
  if (typeof window === 'undefined') return;
  (await import('@/lib/eventsCache')).resetEventsCache();
});
