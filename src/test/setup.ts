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

// Unmount anything React Testing Library rendered between tests.
afterEach(() => cleanup());
