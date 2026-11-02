import { afterEach, beforeEach } from 'vitest';

/**
 * Stubs the widths a collapsing strip reads, since jsdom lays nothing out: labeled segments 100px, the
 * `wide` one 130px, icons 40px, and the strip's room whatever the test sets. Registers its own setup and
 * teardown, so call it at a suite's top level.
 */
export function stubSegmentWidths(wide: string): { room: number } {
  const box = { room: 0 };
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.hasAttribute('data-collapsing-root')) return box.room;
        if (this.parentElement?.parentElement?.hasAttribute('data-collapsing-measure')) {
          if (this.children.length < 2) return 40;
          return this.textContent === wide ? 130 : 100;
        }
        return 0;
      },
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original);
  });
  return box;
}
