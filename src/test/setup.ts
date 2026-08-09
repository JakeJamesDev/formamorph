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

// jsdom has no object-URL store. The upload path makes one to show the file being converted without handing
// an <img> the multi-megabyte data URL, so without these the whole flow throws.
if (typeof URL.createObjectURL === 'undefined') {
  let n = 0;
  URL.createObjectURL = () => `blob:formamorph/${++n}`;
  URL.revokeObjectURL = () => {};
}

// Unmount anything React Testing Library rendered between tests.
afterEach(() => cleanup());
