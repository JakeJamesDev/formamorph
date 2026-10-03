import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DURATION, DEFAULT_STAGGER } from '@/lib/narrationRevealConfig';
import { setRevealTiming } from '@/lib/revealTimingStore';
import { MarkdownRenderer } from './MarkdownRenderer';

const secondWord = (container: HTMLElement) => container.querySelectorAll<HTMLElement>('[data-sd-animate]')[1];

afterEach(() => {
  cleanup();
  setRevealTiming({ duration: DEFAULT_DURATION, stagger: DEFAULT_STAGGER });
});

describe('the word timing of a reveal', () => {
  it("reads the narration store when no timing is given", () => {
    setRevealTiming({ duration: 555, stagger: 33 });
    const { container } = render(<MarkdownRenderer text="Hello brave world" animate animation="reveal" />);
    expect(secondWord(container).style.getPropertyValue('--sd-duration')).toBe('555ms');
    expect(secondWord(container).style.getPropertyValue('--sd-delay')).toBe('33ms');
  });

  it('takes a given timing over the store', () => {
    setRevealTiming({ duration: 555, stagger: 33 });
    const { container } = render(<MarkdownRenderer text="Hello brave world" animate animation="reveal" timing={{ duration: 777, stagger: 55 }} />);
    expect(secondWord(container).style.getPropertyValue('--sd-duration')).toBe('777ms');
    expect(secondWord(container).style.getPropertyValue('--sd-delay')).toBe('55ms');
  });
});
