import { describe, expect, it } from 'vitest';
import { showsScrollArrow } from './windowBox';

// A 400px viewport: the threshold is 200px from the end.
const at = (scrollTop: number, scrollHeight = 1000, clientHeight = 400) => showsScrollArrow({ scrollTop, scrollHeight, clientHeight });

describe('the scroll-arrow rule', () => {
  it('hides at the end', () => {
    expect(at(600)).toBe(false);
  });

  it('hides when the end is exactly half a viewport away', () => {
    expect(at(400)).toBe(false);
  });

  it('shows when the end is just past half a viewport away', () => {
    expect(at(399)).toBe(true);
  });

  it('shows at the top of a long conversation', () => {
    expect(at(0)).toBe(true);
  });

  it('hides when the content fits the viewport', () => {
    expect(at(0, 300)).toBe(false);
  });

  it('scales the threshold with the viewport height', () => {
    // 600px viewport: the threshold is 300px.
    expect(at(0, 1000, 600)).toBe(true);
    expect(at(100, 1000, 600)).toBe(false);
  });
});
