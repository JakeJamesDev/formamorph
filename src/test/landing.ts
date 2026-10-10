import { act } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { LANDING_PULSE_CLASS, landingRing } from '@/lib/landingPulse';
import { findTargetRow } from '@/lib/surface/surfaceTargets';

/** The row that carries a route. */
export const rowOf = (route: string) => findTargetRow(document, route);

/** Whether a running landing draws the given ring for a row. */
export const ringOn = (row: HTMLElement | null, name = LANDING_PULSE_CLASS) =>
  !!row && !!landingRing(row)?.classList.contains(name);

/** Ends a row's ring as its animation would. */
export const endLanding = (row: HTMLElement, name = LANDING_PULSE_CLASS) => {
  landingRing(row)?.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName: name }));
};

/** Lets a landing's frames run out. */
export const frames = (count: number) => act(async () => {
  for (let i = 0; i < count; i++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
});

/**
 * Stubs `scrollIntoView`, which jsdom lacks, for every test in the file. Returns the elements scrolled into
 * view, in order, emptied before each test. Call it at the top level of a test file.
 */
export function recordScrolls(): readonly Element[] {
  const scrolled: Element[] = [];
  const realScroll = Element.prototype.scrollIntoView;
  beforeEach(() => {
    scrolled.length = 0;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };
  });
  afterEach(() => { Element.prototype.scrollIntoView = realScroll; });
  return scrolled;
}
