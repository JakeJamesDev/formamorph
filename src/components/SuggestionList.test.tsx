import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SuggestionList } from './SuggestionList';

/** jsdom reports every box as zero and clamps `scrollTop` to it, so the list is given a real scroll range.
 *  Only layout is stood in for; the wheel and the handler under it are genuine. */
function size(el: HTMLElement, scrollHeight = 500, clientHeight = 200) {
  let top = 0;
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => { top = Math.max(0, Math.min(v, scrollHeight - clientHeight)); },
  });
}

const ITEMS = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];

const list = () => {
  const { container } = render(
    <SuggestionList items={ITEMS} active={0} onPick={vi.fn()} onHover={vi.fn()} />,
  );
  return container.firstElementChild as HTMLElement;
};

describe('SuggestionList', () => {
  // A caller may portal this out of a modal dialog, whose scroll lock cancels the browser's scroll for
  // every wheel landing outside the dialog's own content. Handling the wheel is what survives that.
  it('scrolls itself on the wheel rather than leaving it to the browser', () => {
    const el = list();
    size(el);
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
    expect(el.scrollTop).toBe(120);
  });

  it('picks the item a row was pressed on', () => {
    const onPick = vi.fn();
    const { getByText } = render(
      <SuggestionList items={ITEMS} active={0} onPick={onPick} onHover={vi.fn()} />,
    );
    getByText('charlie').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(onPick).toHaveBeenCalledWith('charlie');
  });
});
