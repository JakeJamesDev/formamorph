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

// Unmount anything React Testing Library rendered between tests.
afterEach(() => cleanup());
